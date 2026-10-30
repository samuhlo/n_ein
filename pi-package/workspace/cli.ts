// [FLOW] ENTRADA PORTABLE DEL ENCARGO
// La CLI sirve a ambos hosts y al launcher. stdout se reserva al resultado.
import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listDesigns, readDesign, readComments, changeDesign } from "./design.ts";
import { inspectWork, checkWork } from "./evidence.ts";
import { openWork } from "./open.ts";
import { serveWork } from "./server.ts";
import { listSessions, publishSession, workState } from "./state.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values: v, positionals: p } = parseArgs({ allowPositionals: true, options: {
  project: { type: "string" }, json: { type: "boolean" }, all: { type: "boolean" }, query: { type: "string" },
  slug: { type: "string" }, file: { type: "string" }, criterion: { type: "string" }, timeout: { type: "string" },
  id: { type: "string" }, runtime: { type: "string" }, data: { type: "string" },
} });
const cwd = resolve(v.project ?? process.cwd());
try {
  let result: unknown;
  if (p[0] === "design") {
    const action=p[1]??"list";
    if(action==="list") result=listDesigns(cwd);
    else if(action==="show") result={design:readDesign(cwd,v.slug??""),comments:readComments(cwd,v.slug??"")};
    else result=await changeDesign(cwd,v.slug??"",{...JSON.parse(v.data??"{}"),action,file:v.file});
  }
  else if (p[0] === "serve") { await serveWork(root,cwd); result = { serving: true }; }
  else if (p[0] === "open") { result = { link: await openWork(root,cwd) }; }
  else if (p[0] === "check") {
    const abort = new AbortController();
    const stop = () => abort.abort(); process.once("SIGINT",stop);process.once("SIGTERM",stop);
    try { result = await checkWork(root,cwd,v.criterion ?? "",p.slice(1),abort.signal,Number(v.timeout ?? 600)); process.exitCode = (result as {exit:number|null}).exit === 0 && !(result as {error:string|null}).error ? 0 : 1; }
    finally {process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);}
  }
  else if (p[0] === "sessions") result = listSessions(root,cwd,v.query,v.all);
  else if (p[0] === "publish") {
    if (!v.id || !["pi","claude"].includes(v.runtime ?? "")) throw new Error("Indica --id y --runtime pi|claude");
    result = publishSession(root,cwd,v.id,v.runtime as "pi" | "claude", JSON.parse(v.data ?? "{}"));
  } else if (p[0] === "status") result = inspectWork(root,cwd);
  else throw new Error("uso: n-ein-work status | sessions [--query texto] [--all] | publish --id ID --runtime pi|claude --data JSON [--json]");
  if (v.json || ["publish", "serve", "check", "design"].includes(p[0])) console.log(JSON.stringify(result));
  else if (p[0] === "open") console.log((result as {link:string}).link);
  else if (p[0] === "status") {
    const w = result as ReturnType<typeof inspectWork>;
    console.log(["// 004 ENCARGO", w.objective || "Sin documento activo", ...w.tasks.map(t => `${t.done ? "✓" : "·"} ${t.text}`), ...w.evidence.map(e => `${e.state} · ${e.criterion} · ${e.command.join(" ")}`), "", "Siguiente paso", w.next || "Sin publicar"].join("\n"));
  } else {
    const rows = result as ReturnType<typeof listSessions>;
    console.log(["// 004 SESIONES", ...rows.sessions.map(s => `${s.runtime} · ${s.objective || "sin objetivo publicado"}\n  ${s.progress} · ${s.next || "sin siguiente paso"}\n  ${s.recordedAt}${s.stale ? " · resumen antiguo" : ""} · ${s.id}`), `${rows.invalid} no legibles · ${rows.omitted} omitidas`].join("\n"));
  }
} catch (error) { console.error(`[ERR] :: WORK_FAIL :: ${String(error)}`); process.exitCode = 1; }
