// =============================================================================
// [BENCH] RECORRIDO CONVERSACIONAL
// uso: bun conversation.ts basic|design|handoff [identificador]
// Procesos y modelos reales; credenciales en sus hogares existentes, sesiones
// y proyectos del ensayo separados. No envía nombres de skills en los prompts.
// =============================================================================

import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { TeamManager } from "../../pi-package/agents/manager.ts";
import type { TaskRecord } from "../../pi-package/agents/store.ts";

const repo = process.env.N_EIN_PRODUCT_ROOT || resolve(import.meta.dir, "../..");
const sourceRepo = resolve(import.meta.dir, "../..");
const withTeam = process.argv[2] === "handoff-team";
const scenario = withTeam ? "handoff" : process.argv[2];
assert.ok(["basic", "design", "handoff"].includes(scenario!), "elige basic, design o handoff");
const id = process.argv[3] || `flow-${scenario}-${Date.now()}`;
const bench = process.env.N_EIN_BENCH || resolve(repo, "../n_ein-bench");
const root = join(bench, "conversation", id), project = join(root, "project"), logs = join(root, "logs");
assert.ok(!existsSync(root), "el ensayo ya existe; usa otro identificador");
mkdirSync(logs, { recursive: true });
cpSync(join(sourceRepo, "evals/fixtures/continuity"), project, { recursive: true });
rmSync(join(project, "WORK.md"));
writeFileSync(join(project, ".gitignore"), ".codegraph/\n");
writeFileSync(join(project, "README.md"), "# Port lab\n\nA CLI port formatter.\n\nThe counnt is shown in the terminal.\n");
const validParser = `export function parsePort(raw: string): number {\n  if (!/^\\d+$/.test(raw.trim())) throw new Error("Invalid port");\n  const port = Number(raw);\n  if (port > 65535) throw new Error("Invalid port");\n  return port;\n}\n`;
if (scenario !== "basic") writeFileSync(join(project, "src/parse-port.ts"), validParser);
if (scenario === "handoff") {
  writeFileSync(join(project, "src/format-port.ts"), 'import { parsePort } from "./parse-port.ts";\nexport function formatPort(raw: string): string { const port = parsePort(raw); return port === 0 ? "Port: 0 (automatic)" : `Port: ${port}`; }\n');
  mkdirSync(join(project, "docs/adr"), { recursive: true });
  writeFileSync(join(project, "docs/adr/0001-zero.md"), "# Port zero\n\nStatus: accepted. Port 0 requests automatic allocation by the OS. Never replace it with a fallback port.\n");
  writeFileSync(join(project, "WORK.md"), "## Goal\nReview the zero contract and return the result, read-only.\n\n## Authorization\nRead and report only; do not change project files.\n\n## Decisions\nPort 0 requests automatic OS allocation; see docs/adr/0001-zero.md.\n\n## Tasks\n- [ ] Read and report the contract.\n\n## Next step\nReview in Claude, then return to Pi and report the result without another transfer.\n");
}
const git = (...args: string[]) => execFileSync("git", args, { cwd: project, encoding: "utf8" }).trim();
git("init", "-b", "main"); git("config", "user.name", "n_ein evaluation"); git("config", "user.email", "eval@n-ein.invalid"); git("add", "."); git("commit", "-qm", "test: conversation base");
const base = git("rev-parse", "HEAD");
const marker=randomUUID();let seeded:TaskRecord[]=[];
if(withTeam){
  git("switch","-qc","feature/team-continuity");
  process.env.N_EIN_WORKTREE_ROOT=join(root,"workspaces");
  const realPi=join(homedir(),".n_ein/runtimes/pi/1.0.2/bin/pi"),wrapper=join(root,"seed-pi");
  const quote=(value:string)=>"'"+value.replace(/'/g,"'\\''")+"'";
  writeFileSync(wrapper,`#!/bin/sh\nexec ${quote(realPi)} "$@" -e ${quote(join(sourceRepo,"tests/fixtures/team-provider.ts"))}\n`,{mode:0o755});
  let ready!:()=>void;const firstReady=new Promise<void>(r=>ready=r);
  const manager=new TeamManager({root:repo,cwd:project,owner:"seed",env:{N_EIN_PI_BIN:wrapper,PI_CODING_AGENT_DIR:join(root,"seed-home"),N_EIN_TEST_CONTINUITY:"1",N_EIN_TEST_MARKER:marker},onResult:t=>{if(t.taskId==="T1"&&t.status==="ready")ready();}});
  seeded=manager.start(["T1","T2"].map(taskId=>({taskId,label:taskId,prompt:"Prepare your marker fixture.",model:"nein-test/team",thinking:"off"})));
  let deadline: ReturnType<typeof setTimeout>;
  try { await Promise.race([firstReady,new Promise((_,reject)=>{deadline=setTimeout(()=>{void manager.shutdown();reject(new Error("Fixture worker did not finish"));},15000);})]); } finally { clearTimeout(deadline!); }
  const partialDeadline=Date.now()+3000;
  while(!existsSync(join(seeded[1]!.cwd,"partial.txt")) && Date.now()<partialDeadline)await new Promise(r=>setTimeout(r,20));
  await manager.stop(seeded[1]!.id);await manager.shutdown();
  assert.equal(manager.store.get(seeded[0]!.id).status,"ready");assert.equal(manager.store.get(seeded[1]!.id).status,"stopped");
  assert.ok(existsSync(join(seeded[1]!.cwd,"partial.txt")));
  writeFileSync(join(project,"WORK.md"),"## Goal\nInspect two preserved fronts and report their exact contents.\n\n## Authorization\nRead only. Do not edit, integrate or restart workers.\n\n## Tasks\n- [ ] T1 Inspect committed first.txt in its worker branch.\n- [ ] T2 Inspect uncommitted partial.txt in its stopped worktree.\n\n## Next step\nReview in Claude, then return to Pi with both literal values and the pending integration.\n");
  git("add","WORK.md");git("commit","-qm","test: prepare read-only team handoff");
}

if(withTeam && process.env.N_EIN_FIXTURE_ONLY === "1"){console.log(JSON.stringify({fixture:project,tasks:seeded.map(t=>t.id)}));process.exit(0);}
const models = { schema: 1, agents: { principal: { model: "nein/auto", thinking: "medium" }, mecanico: { model: "openai/gpt-6-luna", thinking: "high" }, ordinario: { model: "openai/gpt-6-sol", thinking: "medium" }, riesgo: { model: "openai/gpt-6-sol", thinking: "high" }, abierto: { model: "openai/gpt-6-sol", thinking: "high" } }, claude: { effort: "medium" } };
writeFileSync(join(root, "models.json"), JSON.stringify(models));
writeFileSync(join(root, "lang.json"), JSON.stringify({ chat: "es", artifacts: "en" }));
const env = { ...process.env, N_EIN_AGENT_DIR: process.env.N_EIN_FLOW_AGENT_DIR || join(homedir(), ".n_ein/preview/pi-agent"), N_EIN_CLAUDE_DIR: process.env.N_EIN_FLOW_CLAUDE_DIR || join(homedir(), ".n_ein/dev/claude"), N_EIN_MODELS_FILE: join(root, "models.json"), N_EIN_LANG_FILE: join(root, "lang.json"), N_EIN_CODEGRAPH_ALLOW_TEMP: "1", PI_OFFLINE: "1", DO_NOT_TRACK: "1" };
const steps: any[] = [];
function fingerprint(dir = project): string {
  const hash = createHash("sha256");
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if ([".git", ".codegraph"].includes(e.name)) continue;
    hash.update(e.name); hash.update(e.isDirectory() ? fingerprint(join(dir, e.name)) : readFileSync(join(dir, e.name)));
  }
  return hash.digest("hex");
}
const events = (path: string) => existsSync(path) ? readFileSync(path, "utf8").split("\n").flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }) : [];
function summarize(path: string) {
  const messages = events(path).filter((e) => e.type === "message_end" && e.message?.role === "assistant").map((e) => e.message);
  const last = messages.at(-1);
  const text = (last?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  const questionMarks = (text.match(/\?/g) ?? []).length;
  const decisionQuestions = (text.match(/\*\*Q\d+\b/g) ?? []).length || questionMarks;
  return { text, questionMarks, decisionQuestions, models: [...new Set(messages.map((m) => `${m.provider}/${m.model}`))], catalogUsd: messages.reduce((n, m) => n + (m.usage?.cost?.total ?? 0), 0), tools: messages.flatMap((m) => m.content?.filter((c: any) => c.type === "toolCall").map((c: any) => ({ name: c.name, arguments: c.arguments })) ?? []), error: last?.stopReason === "error" ? last.errorMessage : undefined };
}
async function execute(name: string, binary: string, args: string[], additions: Record<string, string> = {}) {
  const out = Bun.file(join(logs, name + ".jsonl")).writer(), err = Bun.file(join(logs, name + ".stderr")).writer();
  const started = Date.now();
  const child = spawn(binary, args, { cwd: project, env: { ...env, ...additions }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.stdout!.on("data", (data) => out.write(data)); child.stderr!.on("data", (data) => err.write(data));
  const timer = setTimeout(() => { try { process.kill(-child.pid!, "SIGTERM"); } catch {} }, 600_000);
  let exit: number | null;
  try { exit = await new Promise((done, reject) => { child.once("close", done); child.once("error", reject); }); }
  finally { clearTimeout(timer); await out.end(); await err.end(); }
  const result = { name, exit, seconds: Math.round((Date.now() - started) / 1000), ...summarize(join(logs, name + ".jsonl")) };
  steps.push(result); writeFileSync(join(logs, "steps.json"), JSON.stringify(steps, null, 2));
  console.log(JSON.stringify({ name, exit, seconds: result.seconds, catalogUsd: result.catalogUsd, questions: result.questionMarks }));
  assert.equal(exit, 0, result.error || name); assert.ok(!result.error, result.error);
  return result;
}
const session = randomUUID();
const pi = (name: string, prompt: string, sid = session) => execute(name, join(repo, "bin/n-ein-dev"), ["--print", "--mode", "json", "--session-dir", join(logs, "sessions"), "--session-id", sid, prompt]);
const check = (phase: string) => execute("acceptance-" + phase, "bun", ["test", join(repo, "evals/reserved/conversation.test.ts")], { N_EIN_FLOW_COPY: project, N_EIN_FLOW_PHASE: phase });
if (scenario === "basic") {
  const fixed = await pi("direct", "Corrige parsePort: debe aceptar cadenas de dígitos decimales con espacios alrededor y valores de 0 a 65535, y lanzar error para vacío, negativos, decimales, sufijos o valores fuera de rango. Es un único arreglo; conserva formatPort tal como está.");
  assert.equal(fixed.questionMarks, 0, "el encargo claro no necesita entrevista");
  assert.ok(!existsSync(join(project, "WORK.md")), "un arreglo pequeño no necesita documento de trabajo");
  await check("parser");
  const code = readFileSync(join(project, "src/parse-port.ts"), "utf8");
  const next = await pi("new-job", "Otra cosa: corrige únicamente la errata counnt por count en README.md.");
  assert.deepEqual(next.models, ["openai/gpt-6-luna"], "el nuevo encargo mecánico no arrastra el modelo anterior");
  assert.ok(readFileSync(join(project, "README.md"), "utf8").includes("count"));
  assert.equal(readFileSync(join(project, "src/parse-port.ts"), "utf8"), code);
  const before = fingerprint();
  const query = await pi("runtime-question", "¿Qué conservaría Claude si más adelante decido pasarle este trabajo? Solo explícalo; seguimos aquí.");
  assert.ok(!query.tools.some((t: any) => t.name === "nein_handoff"), "preguntar por Claude no pide un relevo");
  assert.equal(fingerprint(), before);
} else if (scenario === "design") {
  const before = fingerprint();
  const design = await pi("design", "Quiero mejorar cómo esta pequeña CLI muestra el puerto configurado, porque el cero confunde a quien la usa. Ayúdame a pensar y diseñar la experiencia antes de construir; todavía no cambies archivos.");
  assert.equal(fingerprint(), before, "diseñar todavía no autoriza escrituras");
  assert.ok(design.decisionQuestions > 0 && design.decisionQuestions <= 3, "primera ronda breve de decisiones");
  assert.match(design.text, /recomiend|recomendaci|propongo|opci[oó]n/i);
  assert.doesNotMatch(design.text, /(?:ejecuta|invoca|usa)\s+[`\s]*\/(?:skill|intent)/i);
  const built = await pi("go-ahead", "El acuerdo es este: el cero se verá como Port: 0 (automatic), los otros valores válidos como Port: N. Conserva el parser y los errores actuales. Actualiza formatPort y documenta el significado del cero en README. Mantén inglés en los artefactos. Me encaja: hazlo y compruébalo.");
  assert.equal(built.questionMarks, 0, "hazlo no necesita otra confirmación administrativa");
  await check("format");
  assert.equal(readFileSync(join(project, "src/parse-port.ts"), "utf8"), validParser, "no amplía el alcance al parser");
  const paused = fingerprint();
  await pi("save-pending", "Para la próxima sesión queda añadir configurationLabel(raw) en src/configuration-label.ts: devolverá Listening on seguido de un espacio y formatPort(raw), con tests. Autorizo implementarlo cuando retomemos. Ahora solo guarda ese pendiente y el acuerdo, sin hacer aún ese código.");
  assert.ok(!existsSync(join(project, "src/configuration-label.ts")));
  assert.notEqual(fingerprint(), paused, "dejarlo pendiente debe conservarse en el documento");
  const resumed = await pi("resume", "Sigue donde lo dejamos.", randomUUID());
  assert.equal(resumed.questionMarks, 0, "recupera un encargo ya autorizado sin repetir la entrevista");
  await check("resume");
} else {
  const before = fingerprint();
  const workerBefore=seeded.map(t=>fingerprint(t.cwd));
  const quote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
  const realPi = join(homedir(), ".n_ein/runtimes/pi", JSON.parse(readFileSync(join(repo, "runtime.json"), "utf8")).pi.version, "bin/pi");
  const realClaude = execFileSync("which", ["claude"], { encoding: "utf8" }).trim();
  const piWrapper = join(root, "pi-print"), claudeWrapper = join(root, "claude-print");
  writeFileSync(piWrapper, `#!/bin/bash\nif [[ "$1" == --version ]]; then exec ${quote(realPi)} --version; fi\nexec ${quote(realPi)} --print --mode json --session-dir ${quote(join(logs, "sessions"))} "$@" >> ${quote(join(logs, "pi-events.jsonl"))}\n`, { mode: 0o755 });
  writeFileSync(claudeWrapper, `#!/bin/bash\nexec ${quote(realClaude)} --print --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools Read,Edit,Write,Bash,Grep,Glob,Skill "$@" >> ${quote(join(logs, "claude-events.jsonl"))}\n`, { mode: 0o755 });
  await execute("roundtrip", join(repo, "bin/n-ein-dev"), [withTeam ? "Pásame a Claude para revisar de solo lectura los dos frentes conservados: T1 tiene first.txt confirmado en su rama y T2 tiene partial.txt sin commit en su árbol detenido. Comprueba y conserva literalmente el contenido de ambos archivos, sus rutas y qué falta integrar. Después sigamos con Pi para que me devuelva esos dos valores exactos. No edites, no integres y no reinicies trabajadores." : "Pásame a Claude. Allí quiero comprobar de solo lectura si el contrato del puerto 0 se conserva y cuál es su razón. Cuando termine esa revisión, sigamos con Pi para recibir el resultado. No cambies archivos del proyecto."], { N_EIN_PI_BIN: piWrapper, N_EIN_CLAUDE_BIN: claudeWrapper });
  const p = summarize(join(logs, "pi-events.jsonl"));
  assert.equal(p.tools.filter((t: any) => t.name === "nein_handoff").length, 1, "un solo cambio a Claude, sin bucle de relevo");
  const c = events(join(logs, "claude-events.jsonl"));
  assert.ok(c.some((e) => e.type === "result" && !e.is_error), "Claude respondió");
  assert.ok(c.some((e) => e.type === "assistant" && e.message?.content?.some((t: any) => t.type === "tool_use" && t.name === "Bash" && t.input?.command?.includes("n-ein-prepare-pi"))), "Claude preparó el regreso por petición natural");
  assert.ok(events(join(logs, "pi-events.jsonl")).filter((e) => e.type === "session").length >= 2, "Pi volvió a abrirse");
  assert.equal(fingerprint(), before, "el relevo de lectura no cambia el proyecto");
  for(let i=0;i<seeded.length;i++)assert.equal(fingerprint(seeded[i]!.cwd),workerBefore[i],"the handoff preserves every worker tree");
  if(withTeam){assert.ok(p.text.includes(`first-${marker}`),"Pi recovered the committed worker value");assert.ok(p.text.includes(`partial-${marker}`),"Pi recovered the uncommitted worker value");}
  steps.push({ name: "pi-roundtrip-metrics", ...p });
}
writeFileSync(join(logs, "result.json"), JSON.stringify({ id, scenario, withTeam, base, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRepo, encoding: "utf8" }).trim(), accepted: true, steps, finalHead: git("rev-parse", "HEAD") }, null, 2));
console.log(`accepted: ${join(logs, "result.json")}`);
