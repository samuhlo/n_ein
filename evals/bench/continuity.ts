// =============================================================================
// [BENCH] PI -> CLAUDE -> PI
// Tres entregas en procesos reales y una sesión posterior sin WORK.md.
// El banco usa su login Pi; Claude usa su hogar n_ein ya autenticado.
// =============================================================================

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import registerHandoff from "../../pi-package/extensions/handoff.ts";

const repo = resolve(import.meta.dir, "../..");
const bench = process.env.N_EIN_BENCH || resolve(repo, "../n_ein-bench");
const run = process.env.N_EIN_CONTINUITY_RUN || "s4b-NR10-r1";
const project = join(bench, "copies", run), home = join(bench, "homes", run), log = join(bench, "logs", run);
const resume = process.argv.includes("--resume");
if (!resume && [project, home, log].some(existsSync)) throw new Error(`Ya existe ${run}; usa --resume o elige otro N_EIN_CONTINUITY_RUN`);
if (resume && ![project, home, log].every(existsSync)) throw new Error(`No existe el ensayo completo ${run}`);
mkdirSync(log, { recursive: true }); mkdirSync(join(home, "pi-agent"), { recursive: true });
const git = (...args: string[]) => execFileSync("git", args, { cwd: project, encoding: "utf8" }).trim();
if (!resume) {
cpSync(join(repo, "evals/fixtures/continuity"), project, { recursive: true });
cpSync(join(bench, "auth/pi-agent/auth.json"), join(home, "pi-agent/auth.json"));
git("init", "-b", "main"); git("config", "user.name", "n_ein evaluation"); git("config", "user.email", "eval@n-ein.invalid");
git("add", "-A"); git("commit", "-qm", "test: continuity base");
writeFileSync(join(home, "models.json"), JSON.stringify({ schema: 1, agents: { principal: { model: "nein/auto", thinking: "medium" } }, claude: { effort: "medium" } }));
writeFileSync(join(home, "lang.json"), JSON.stringify({ chat: "es", artifacts: "en" }));
writeFileSync(join(home, "preferences.md"), "When reporting checked work, put the exact command next to its observed result.\n");
}
const version = JSON.parse(readFileSync(join(repo, "runtime.json"), "utf8")).pi.version;
const realPi = join(process.env.N_EIN_HOME || join(process.env.HOME!, ".n_ein"), "runtimes/pi", version, "bin/pi");
const quote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
const piWrapper = join(home, "pi-print");
writeFileSync(piWrapper, `#!/bin/bash\nif [[ "\$1" == --version ]]; then exec ${quote(realPi)} --version; fi\nexec ${quote(realPi)} --print --mode json "\$@" >> "\$N_EIN_CONTINUITY_PI_LOG"\n`, { mode: 0o755 });
const env = {
  ...process.env,
  N_EIN_AGENT_DIR: join(home, "pi-agent"), N_EIN_MODELS_FILE: join(home, "models.json"), N_EIN_LANG_FILE: join(home, "lang.json"),
  N_EIN_PREFERENCES_FILE: join(home, "preferences.md"), N_EIN_PI_BIN: piWrapper,
  N_EIN_CLAUDE_DIR: process.env.N_EIN_EVAL_CLAUDE_DIR || join(process.env.HOME!, ".n_ein/dev/claude"),
  N_EIN_CODEGRAPH_ALLOW_TEMP: "1", PI_OFFLINE: "1", DO_NOT_TRACK: "1",
};
type Stage = { stage: string; exit: number | null; wall_s: number };
const stages: Stage[] = resume ? JSON.parse(readFileSync(join(log, "stages.json"), "utf8")) : [];
const succeeded = (stage: string) => stages.some((s) => (s.stage === stage || s.stage.startsWith(stage + "-attempt-")) && s.exit === 0);
async function execute(stage: string, binary: string, args: string[], extra: Record<string, string> = {}) {
  if (succeeded(stage)) return;
  const attempt = stages.filter((s) => s.stage === stage || s.stage.startsWith(stage + "-attempt-")).length + 1;
  if (attempt > 1) stage += `-attempt-${attempt}`;
  const start = Date.now();
  const stdout = Bun.file(join(log, `${stage}.jsonl`)).writer(), stderr = Bun.file(join(log, `${stage}.stderr`)).writer();
  const child = spawn(binary, args, { cwd: project, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.stdout!.on("data", (data) => stdout.write(data)); child.stderr!.on("data", (data) => stderr.write(data));
  const timer = setTimeout(() => { try { process.kill(-child.pid!, "SIGTERM"); } catch {} }, 600_000);
  const exit = await new Promise<number | null>((done, reject) => { child.once("error", reject); child.once("close", done); });
  clearTimeout(timer); await stdout.end(); await stderr.end();
  const result = { stage, exit, wall_s: Math.round((Date.now() - start) / 1000) }; stages.push(result);
  writeFileSync(join(log, "stages.json"), JSON.stringify(stages, null, 2));
  console.log(JSON.stringify(result));
  if (exit !== 0) throw new Error(`${stage} terminó con ${exit}; conserva los logs antes de repetir`);
}

await execute("pi-first", join(repo, "bin/n-ein-dev"), ["Implementa solo T1 de WORK.md, incluyendo recordar la decisión del puerto 0 en documentación duradera. Es una implementación autorizada. Comprueba y haz commit de T1, conserva T2 y T3 pendientes y detente para relevar a Claude."], { N_EIN_CONTINUITY_PI_LOG: join(log, "pi-first-events.jsonl") });

// La generación empieza tras close del proceso real: no se simula el fin del origen.
const sessionFiles: string[] = [];
// El directorio por proyecto puede variar entre versiones; la búsqueda solo recorre el hogar del ensayo.
function sessionPaths(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sessionPaths(path); else if (entry.name.endsWith(".jsonl")) sessionFiles.push(path);
  }
}
sessionPaths(join(home, "pi-agent/sessions"));
const branch = sessionFiles.flatMap((file) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)));
let handoff: any;
registerHandoff({ registerCommand(_name: string, command: unknown) { handoff = command; } } as never);
const oldHome = process.env.PI_CODING_AGENT_DIR, oldSignal = process.env.N_EIN_HANDOFF_SIGNAL;
process.env.PI_CODING_AGENT_DIR = join(home, "pi-agent"); delete process.env.N_EIN_HANDOFF_SIGNAL;
const notes: string[] = [];
try {
  await handoff.handler("claude", { cwd: project, waitForIdle: async () => {}, sessionManager: { getBranch: () => branch }, ui: { notify: (text: string) => notes.push(text) }, shutdown() {} });
} finally {
  if (oldHome === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldHome;
  if (oldSignal === undefined) delete process.env.N_EIN_HANDOFF_SIGNAL; else process.env.N_EIN_HANDOFF_SIGNAL = oldSignal;
}
const summary = join(home, "pi-agent/handoffs", readdirSync(join(home, "pi-agent/handoffs"))[0]!);
writeFileSync(summary, readFileSync(summary, "utf8") + "\nUser instruction for this stage: implement only T2, check and commit it. T3 stays pending. Finish your response so this non-interactive process exits. The user will invoke /to-pi next.\n");
await execute("claude-and-return", join(repo, "bin/n-ein-claude-dev"), ["--handoff", summary, "--print", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write,Bash,Grep,Glob"], { N_EIN_CONTINUITY_PI_LOG: join(log, "pi-return-events.jsonl") });
if (!existsSync(join(log, "pi-return-events.jsonl"))) {
  const stage = stages.findLast((s) => s.stage.startsWith("claude-and-return") && s.exit === 0)!;
  const events = readFileSync(join(log, `${stage.stage}.jsonl`), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const session = events.find((e) => e.type === "system" && e.subtype === "init")?.session_id;
  if (typeof session !== "string" || !/^[0-9a-f-]{36}$/i.test(session)) throw new Error("Claude no devolvió un id de sesión válido");
  // to-pi es manual: la invocación del usuario se envía como un turno, no como una instrucción al modelo.
  await execute("claude-to-pi", join(repo, "bin/n-ein-claude-dev"), ["--resume", session, "--print", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write,Bash,Grep,Glob", "--", "/to-pi Pi está autorizado a terminar T3 de WORK.md; conserva el contrato del puerto 0."], { N_EIN_CONTINUITY_PI_LOG: join(log, "pi-return-events.jsonl") });
}
if (!existsSync(join(log, "pi-return-events.jsonl"))) throw new Error("Claude no preparó el relevo: Pi no arrancó");
await execute("hidden", "bun", ["test", join(repo, "evals/reserved/continuity.test.ts")], { N_EIN_CONTINUITY_COPY: project });
await execute("suite", "bun", ["run", "test"]);
await execute("types", "bun", ["run", "typecheck"]);
const work = readFileSync(join(project, existsSync(join(project, "WORK.md")) ? "WORK.md" : "completed-work.md"), "utf8");
if (/^- \[ \]/m.test(work)) throw new Error("Quedan tareas pendientes después del relevo");

// Otro encargo ya no recibe WORK.md: tiene que recuperar la decisión duradera.
if (existsSync(join(project, "WORK.md"))) { git("mv", "WORK.md", "completed-work.md"); git("commit", "-qm", "test: start another job after completing the first"); }
function fingerprint(dir: string): string {
  const hash = createHash("sha256");
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if ([".git", ".codegraph"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    hash.update(entry.name);
    hash.update(entry.isDirectory() ? fingerprint(path) : readFileSync(path));
  }
  return hash.digest("hex");
}
const before = fingerprint(project);
await execute("later-job", join(repo, "bin/n-ein-dev"), ["Otro encargo, solo lectura: antes de proponer cambios para la configuración de puertos, recupera las decisiones vigentes de este proyecto y explica su razón. No leas completed-work.md ni las sesiones anteriores. No cambies archivos. Cita la fuente y el comando con el que comprobarías el contrato."], { N_EIN_CONTINUITY_PI_LOG: join(log, "later-job-events.jsonl") });
if (fingerprint(project) !== before) throw new Error("La consulta de memoria modificó el proyecto fuera del índice generado de CodeGraph");
writeFileSync(join(log, "result.json"), JSON.stringify({ run, stages, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), head: git("rev-parse", "HEAD"), commits: git("log", "--oneline"), handoff: summary, limitation: "Non-interactive runtimes; the Pi command handler generates its summary after the first process exits. External writers are not supervised." }, null, 2));
console.log(`continuity: ${join(log, "result.json")}`);
