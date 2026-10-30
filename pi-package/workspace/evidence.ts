// =============================================================================
// [DATA] COMPROBACIONES CON VIGENCIA
// El proceso acredita ejecución, no el significado de la prueba. El alcance
// declarado enlaza con WORK.md; la identidad incluye archivos nuevos y cambios.
// =============================================================================
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, readlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { atomicJSON, dataDir, projectRoot, smallJSON, workState, digest } from "./state.ts";
export type Evidence = { schema: 1; id: string; project: string; criterion: string; command: string[]; cwd: string; before: string | null; after: string | null;
  exit: number | null; error: string | null; started: string; ended: string; log: string; environment: string };
export function fingerprint(cwd: string): string | null {
  try {
    const root = projectRoot(cwd), work = workState(cwd).path;
    const files = [...new Set(execFileSync("git",["ls-files","-z","--cached","--others","--exclude-standard"],{cwd:root,encoding:"utf8",maxBuffer:4<<20,timeout:5000,stdio:["ignore","pipe","ignore"]}).split("\0").filter(Boolean))].sort();
    if (files.length > 20000) return null;
    const hash = createHash("sha256"); let bytes = 0;
    for (const file of files) {
      if (work && file === relative(root,work)) continue; // Marcar una casilla no invalida el código.
      const path = join(root,file); hash.update(file).update("\0");
      let stat; try { stat = lstatSync(path); } catch { hash.update("absent\0"); continue; }
      if (stat.isSymbolicLink()) { hash.update("link\0").update(readlinkSync(path)).update("\0"); continue; }
      const inside = relative(root, realpathSync(path)); if (inside === ".." || inside.startsWith("../")) return null;
      if (!stat.isFile() || stat.size > (16 << 20) || (bytes += stat.size) > (128 << 20)) return null;
      hash.update(String(stat.mode)).update("\0").update(readFileSync(path)).update("\0");
    }
    return hash.digest("hex");
  } catch { return null; }
}
const environment = () => JSON.stringify({ platform: process.platform, arch: process.arch, runtime: process.version, bun: process.versions.bun, executable: process.execPath });
export function criteria(cwd: string): string[] {
  const w = workState(cwd);
  return [...w.criteria.split(/\r?\n/).map(l => l.replace(/^\s*[-*]\s+/," ").trim()).filter(l => l && !l.startsWith("|")), ...w.tasks.map(t => t.text)];
}
function criterionFor(cwd: string, query: string): string {
  const matches = criteria(cwd).filter(c => c === query || c.startsWith(`${query} ·`) || c.startsWith(`${query} `));
  if (!query.trim() || matches.length !== 1) throw new Error("Indica un criterio o id de tarea inequívoco de WORK.md.");
  return matches[0];
}
export async function checkWork(root: string, cwd: string, query: string, command: string[], signal?: AbortSignal, timeout = 600): Promise<Evidence> {
  const criterion = criterionFor(cwd,query);
  if (!command.length || command.some(s => s.includes("\0"))) throw new Error("Falta el comando después de --");
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1800) throw new Error("timeout entre 1 y 1800 segundos");
  const dir = join(dataDir(root,cwd),"evidence"), id = randomUUID(); mkdirSync(dir,{recursive:true,mode:0o700});
  const log = join(dir,`${id}.log`); writeFileSync(log,"",{mode:0o600,flag:"wx"});
  const record: Evidence = {schema:1,id,project:projectRoot(cwd),criterion,command,cwd,before:fingerprint(cwd),after:null,exit:null,error:null,started:new Date().toISOString(),ended:"",log,environment:environment()};
  const child = spawn(command[0],command.slice(1),{cwd,stdio:["ignore","pipe","pipe"],detached:true});
  let bytes = 0, kill: ReturnType<typeof setTimeout> | undefined;
  const stop = (reason: string) => {
    record.error ??= reason;
    if (!child.pid || kill) return;
    try { process.kill(-child.pid,"SIGTERM"); } catch {}
    kill = setTimeout(()=>{try {process.kill(-child.pid!,"SIGKILL");} catch {}},1000);
  };
  const output = (data: Buffer) => { if ((bytes += data.length) <= (16 << 20)) appendFileSync(log,data); else stop("salida supera 16 MiB"); };
  child.stdout.on("data",output); child.stderr.on("data",output);
  const abort=()=>stop("cancelada"), timer=setTimeout(()=>stop("tiempo agotado"),timeout*1000);
  signal?.addEventListener("abort",abort,{once:true}); if(signal?.aborted) abort();
  record.exit = await new Promise<number|null>(done=>{child.once("error",e=>{record.error=String(e);done(null);});child.once("close",done);});
  clearTimeout(timer); if(kill) clearTimeout(kill); signal?.removeEventListener("abort",abort);
  record.after=fingerprint(cwd);record.ended=new Date().toISOString();atomicJSON(join(dir,`${id}.json`),record);return record;
}
export function inspectWork(root: string, cwd: string) {
  const work=workState(cwd), current=fingerprint(cwd), dir=join(dataDir(root,cwd),"evidence"), asks=criteria(cwd);
  let invalid=0;
  const records: Evidence[]=[];
  if(existsSync(dir)) for(const file of readdirSync(dir).filter(n=>/^[a-f0-9-]+\.json$/.test(n))) {
    try { const e=smallJSON(join(dir,file)) as Evidence;
      if(e.schema!==1 || e.project!==projectRoot(cwd) || typeof e.criterion!=="string" || !Array.isArray(e.command) || !e.command.every(s=>typeof s==="string") || typeof e.ended!=="string") throw new Error("invalid");
      records.push(e);
    } catch {invalid++;}
  }
  records.sort((a,b)=>b.ended.localeCompare(a.ended));
  const evidence=records.slice(0,100).map(e=>({...e,state: e.error || e.exit!==0 ? "failed" : !e.before || !e.after || !current ? "unknown" : e.before!==e.after || e.after!==current || !asks.includes(e.criterion) || e.environment!==environment() ? "stale" : "verified"}));
  return {...work,criteria:asks.map(text=>({id:digest(text).slice(0,12),text})),evidence,invalid,omitted:Math.max(0,records.length-100),codeKnown:current!==null};
}
