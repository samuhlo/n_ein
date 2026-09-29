import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerWorker from "../pi-package/extensions/worker";

const testDir = mkdtempSync(join(tmpdir(), "n-ein-worker-error-"));
const previousHome = process.env.N_EIN_AGENT_DIR;
const previousPiBin = process.env.N_EIN_PI_BIN;
process.env.N_EIN_AGENT_DIR = join(testDir, "empty-agent-home");

let tool: any;
registerWorker({ registerTool(value: unknown) { tool = value; } } as any);
assert.ok(tool, "El trabajador no se registró.");

try {
  const result = await tool.execute(
    "test-no-provider",
    { mode: "explore", task: "Lee el proyecto.", acceptance: "Respuesta de solo lectura." },
    new AbortController().signal,
    undefined,
    { cwd: testDir },
  );
  assert.equal(result.details.status, "parcial o fallido");
  assert.notEqual(result.details.exitCode, 0);
  assert.equal(result.details.model, undefined);
  assert.match(result.content[0].text, /No API key found for openai-codex/);

  const fakePi = join(testDir, "fake-pi");
  writeFileSync(fakePi, [
    "#!/usr/bin/env bash",
    "if [[ \"${1:-}\" == \"--version\" ]]; then printf '0.87.1\\n'; exit 0; fi",
    "printf '%s\\n' '{\"type\":\"message_end\",\"message\":{\"role\":\"assistant\",\"provider\":\"openai-codex\",\"model\":\"gpt-6-luna\",\"stopReason\":\"error\",\"errorMessage\":\"provider unavailable\",\"content\":[]}}'",
  ].join("\n") + "\n");
  chmodSync(fakePi, 0o755);
  process.env.N_EIN_PI_BIN = fakePi;
  const modelError = await tool.execute(
    "test-model-error",
    { mode: "explore", task: "Lee el proyecto.", acceptance: "Respuesta de solo lectura." },
    new AbortController().signal,
    undefined,
    { cwd: testDir },
  );
  assert.equal(modelError.details.exitCode, 0);
  assert.equal(modelError.details.model, "gpt-6-luna");
  assert.equal(modelError.details.stopReason, "error");
  assert.equal(modelError.details.status, "parcial o fallido");
  assert.match(modelError.content[0].text, /provider unavailable/);
  console.log("worker error: proveedor ausente y error de modelo visibles, sin fallback");
} finally {
  if (previousHome === undefined) delete process.env.N_EIN_AGENT_DIR;
  else process.env.N_EIN_AGENT_DIR = previousHome;
  if (previousPiBin === undefined) delete process.env.N_EIN_PI_BIN;
  else process.env.N_EIN_PI_BIN = previousPiBin;
  rmSync(testDir, { recursive: true, force: true });
}
