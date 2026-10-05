import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import registerAgents, { insideSurfaces, validSurface } from "../pi-package/extensions/agents.ts";

const piVersion = JSON.parse(readFileSync(resolve(import.meta.dir, "../runtime.json"), "utf8")).pi.version;
const testDir = mkdtempSync(join(tmpdir(), "n-ein-agents-"));
const saved = { ...process.env };
process.env.N_EIN_AGENT_DIR = join(testDir, "empty-agent-home");
process.env.N_EIN_MODELS_FILE = join(testDir, "missing-models.json");
process.env.N_EIN_CODEGRAPH_BIN = join(testDir, "no-codegraph");

const tools: Record<string, any> = {};
registerAgents({ registerTool(value: any) { tools[value.name] = value; }, on() {} } as any);
assert.deepEqual(Object.keys(tools).sort(), ["nein_reviewer", "nein_scout", "nein_worker"], "los tres roles se registran");
const run = (name: string, params: object, cwd = testDir) => tools[name].execute("t", params, new AbortController().signal, undefined, { cwd });

// Fake Pi: contesta como un modelo y, si se le pide, escribe archivos por shell como haría bash.
const fakePi = join(testDir, "fake-pi");
writeFileSync(fakePi, [
  "#!/usr/bin/env bash",
  `if [[ "\${1:-}" == "--version" ]]; then printf '${piVersion}\\n'; exit 0; fi`,
  "for file in ${N_EIN_FAKE_WRITES:-}; do mkdir -p \"$(dirname \"$file\")\"; printf x > \"$file\"; done",
  "model=\"${N_EIN_FAKE_MODEL:-gpt-6-luna}\"",
  "printf '%s\\n' \"{\\\"type\\\":\\\"message_end\\\",\\\"message\\\":{\\\"role\\\":\\\"assistant\\\",\\\"provider\\\":\\\"openai-codex\\\",\\\"model\\\":\\\"$model\\\",\\\"stopReason\\\":\\\"${N_EIN_FAKE_STOP:-stop}\\\",\\\"errorMessage\\\":\\\"${N_EIN_FAKE_ERROR:-}\\\",\\\"content\\\":[{\\\"type\\\":\\\"text\\\",\\\"text\\\":\\\"hecho\\\"}]}}\"",
].join("\n") + "\n");
chmodSync(fakePi, 0o755);

try {
  // Sin credenciales, el rol falla a la vista y sin cambiar de proveedor.
  const noProvider = await run("nein_scout", { question: "¿Dónde vive el parser?" });
  assert.equal(noProvider.details.status, "parcial o fallido");
  assert.equal(noProvider.details.role, "scout");
  assert.match(noProvider.content[0].text, /No API key found for openai-codex/);

  process.env.N_EIN_PI_BIN = fakePi;
  process.env.N_EIN_FAKE_MODEL = "gpt-6-sol";
  process.env.N_EIN_FAKE_STOP = "error";
  process.env.N_EIN_FAKE_ERROR = "provider unavailable";
  const modelError = await run("nein_reviewer", { target: "git diff HEAD~1...HEAD", criteria: "WORK.md" });
  assert.equal(modelError.details.model, "gpt-6-sol", "el reviewer usa su propio modelo (Sol medium por defecto)");
  assert.equal(modelError.details.status, "parcial o fallido");
  assert.match(modelError.content[0].text, /\[REVIEW\] :: PARTIAL :: rol: nein-reviewer/);
  assert.match(modelError.content[0].text, /provider unavailable/);
  delete process.env.N_EIN_FAKE_STOP;
  delete process.env.N_EIN_FAKE_ERROR;
  process.env.N_EIN_FAKE_MODEL = "gpt-6-luna";

  // Las superficies se validan antes de lanzar nada.
  for (const surfaces of [[], ["."], ["**"], ["/etc"], ["../fuera"]]) {
    const bad = await run("nein_worker", { task: "x", surfaces, acceptance: "y" });
    assert.match(bad.content[0].text, /SURFACES_BAD/, `superficie aceptada: ${JSON.stringify(surfaces)}`);
  }
  assert.ok(validSurface("src/**") && validSurface("docs/guide.md") && !validSurface("./"));
  assert.ok(insideSurfaces("src/a/b.ts", ["src/**"]) && insideSurfaces("src/x.ts", ["src"]));
  assert.ok(insideSurfaces("README.md", ["*.md"]) && !insideSurfaces("docs/a.md", ["*.md"]));
  assert.ok(!insideSurfaces("srcx/a.ts", ["src"]) && !insideSurfaces("lib/a.ts", ["src/**"]));

  // Git delata lo que el rol escribió por shell: fuera de superficie el worker, cualquier cosa el scout.
  const repo = join(testDir, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q"], { cwd: repo });
  process.env.N_EIN_FAKE_WRITES = "src/ok.ts notes/fuera.txt";
  const worker = await run("nein_worker", { task: "x", surfaces: ["src/**"], acceptance: "y" }, repo);
  assert.equal(worker.details.status, "completo");
  assert.deepEqual(worker.details.breaches, ["notes/fuera.txt"]);
  assert.match(worker.content[0].text, /SURFACE_BREACH :: files: notes\/fuera.txt/);
  process.env.N_EIN_FAKE_WRITES = "scout.txt";
  const scout = await run("nein_scout", { question: "x" }, repo);
  assert.deepEqual(scout.details.breaches, ["scout.txt"]);
  assert.match(scout.content[0].text, /READONLY_BREACH/);
  delete process.env.N_EIN_FAKE_WRITES;

  // Dentro del hijo, edit/write se bloquean fuera de superficie y en los roles de solo lectura.
  const guard = (role: string, surfaces: string[]) => {
    process.env.N_EIN_WORKER_CHILD = "1";
    process.env.N_EIN_ROLE = role;
    process.env.N_EIN_SURFACES = JSON.stringify(surfaces);
    let handler: any;
    registerAgents({ registerTool() { throw new Error("el hijo no registra herramientas"); }, on(_name: string, fn: any) { handler = fn; } } as any);
    delete process.env.N_EIN_WORKER_CHILD;
    return (toolName: string, path: string) => handler({ toolName, input: { path } }, { cwd: repo });
  };
  const workerGuard = guard("worker", ["src/**"]);
  assert.equal(workerGuard("edit", "src/a.ts"), undefined);
  assert.equal(workerGuard("write", join(repo, "src/b.ts")), undefined, "una ruta absoluta dentro de la superficie vale");
  assert.equal(workerGuard("write", "README.md").block, true);
  assert.equal(workerGuard("read", "README.md"), undefined, "leer no se limita");
  assert.equal(guard("reviewer", [])("edit", "src/a.ts").block, true);
  assert.ok(!existsSync(join(repo, "README.md")));
  console.log("agents: tres roles con su modelo, superficies impuestas y escrituras indebidas a la vista");
} finally {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  rmSync(testDir, { recursive: true, force: true });
}
