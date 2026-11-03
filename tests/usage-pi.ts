import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Pi real en RPC: las cabeceras de la respuesta llegan a la extensión y acaban en la línea de estado.
const root = resolve("."),
  cwd = mkdtempSync(join(tmpdir(), "nein-usage-pi-"));
const child = spawn(
  process.env.N_EIN_PI_BIN || join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
  [
    "--mode", "rpc", "--no-session", "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates", "--no-context-files",
    "-e", join(root, "pi-package/extensions/usage.ts"),
    "-e", join(root, "tests/fixtures/usage-provider.ts"),
    "--model", "usage-test/model", "--thinking", "off",
  ],
  { cwd, env: { ...process.env, PI_CODING_AGENT_DIR: join(cwd, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1" }, stdio: ["pipe", "pipe", "pipe"] },
);
let text = "",
  errors = "";
child.stdout.on("data", (chunk) => {
  text += chunk.toString();
  if (text.includes('"text":"USAGE_DONE"') && text.includes("nein-usage")) child.stdin.end();
});
child.stderr.on("data", (chunk) => (errors += chunk.toString()));
const timer = setTimeout(() => child.kill("SIGTERM"), 15_000);
child.stdin.write(JSON.stringify({ type: "prompt", message: "hola" }) + "\n");
await new Promise((done) => child.once("close", done));
clearTimeout(timer);
const status = text.split("\n").filter(Boolean).map((line) => JSON.parse(line)).find((event) => event.type === "extension_ui_request" && event.statusKey === "nein-usage");
assert.ok(status, errors + text.slice(-2000));
assert.equal(status.statusText, "Codex 5h 37%");
console.log("usage Pi: las cabeceras de la respuesta llegan a la línea de estado");
