import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Pi real en print: Opus (puente simulado) autoriza la obra, cierra su mensaje y la obra va al ejecutor en un turno nuevo.
const root = resolve("."),
  area = mkdtempSync(join(tmpdir(), "nein-bridge-pi-")),
  log = join(area, "calls.jsonl"),
  models = join(area, "models.json");
writeFileSync(models, JSON.stringify({
  schema: 1,
  agents: {
    abierto: { model: "claude-bridge/claude-opus-5-5", thinking: "off" },
    ordinario: { model: "exec-test/model", thinking: "off" },
  },
}));
const result = spawnSync(
  process.env.N_EIN_PI_BIN || join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
  [
    "-p", "--no-session", "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates", "--no-context-files",
    "-e", join(root, "pi-package/extensions/router.ts"),
    "-e", join(root, "tests/fixtures/bridge-provider.ts"),
    "--model", "nein/auto", "¿Cómo lo planteamos? Si te parece bien, hazlo.",
  ],
  {
    cwd: area,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, PI_CODING_AGENT_DIR: join(area, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", N_EIN_MODELS_FILE: models, N_EIN_TEST_LOG: log },
  },
);
assert.equal(result.status, 0, `Pi debe terminar: ${result.error ?? ""} ${result.stderr}`);
assert.ok(existsSync(log), result.stderr);
const calls = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
assert.deepEqual(calls, [
  { provider: "claude-bridge", last: "user" },
  { provider: "claude-bridge", last: "toolResult" },
  { provider: "exec-test", last: "user" },
], "el resultado de la herramienta vuelve al puente y la obra arranca en un turno nuevo");
assert.match(result.stdout, /BUILD_ON_EXECUTOR/);
console.log("bridge handover Pi: Opus cierra su consulta y la obra empieza en el ejecutor con un turno nuevo");
