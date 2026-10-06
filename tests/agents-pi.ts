import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startWorker } from "../pi-package/agents/rpc.ts";
const cwd = mkdtempSync(join(tmpdir(), "nein-pi-worker-"));
const host = resolve("dist/n-ein"),
  binary = join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
const args = [
  "--mode",
  "rpc",
  "--no-session",
  "--no-extensions",
  "--no-skills",
  "--no-themes",
  "--no-prompt-templates",
  "-e",
  resolve("pi-package/agents/child.ts"),
  "-e",
  resolve("tests/fixtures/worker-provider.ts"),
  "--model",
  "nein-test/scripted",
];
const env = {
  ...process.env,
  PI_CODING_AGENT_DIR: join(cwd, "home"),
  PI_SKIP_VERSION_CHECK: "1",
  N_EIN_WORKER_HOST: host,
};
const events: any[] = [];
const first = startWorker({
  host,
  cwd,
  binary,
  args,
  prompt: "Run the check",
  env,
  onEvent: (e) => events.push(e),
});
const result = await first.done;
assert.equal(result.status, "ready", result.error);
assert.equal(result.text, "checked");
assert.ok(
  events.some(
    (e) =>
      e.type === "tool_execution_end" && e.toolName === "bash" && !e.isError,
  ),
);
const ticks = join(cwd, "ticks"),
  pid = join(cwd, "pid");
const second = startWorker({
  host,
  cwd,
  binary,
  args,
  prompt: "Run the check",
  env: {
    ...env,
    N_EIN_TEST_COMMAND: `trap '' TERM; while :; do echo x >> '${ticks}'; sleep 0.03; done`,
    N_EIN_TEST_PID: pid,
  },
  onEvent: () => {},
});
const deadline = Date.now() + 10000;
while (!existsSync(ticks)) {
  if (Date.now() > deadline) {
    await second.stop();
    throw new Error("owned bash did not start");
  }
  await new Promise((r) => setTimeout(r, 30));
}
process.kill(Number(readFileSync(pid, "utf8")), "SIGKILL");
assert.equal((await second.done).status, "failed");
const before = readFileSync(ticks, "utf8");
await new Promise((r) => setTimeout(r, 120));
assert.equal(readFileSync(ticks, "utf8"), before);
console.log("Pi provider → guarded bash → abrupt stop: OK");
// Si desaparece el host, Pi recibe EOF; su bash propio también debe detenerse.
const orphanTicks = join(cwd, "orphan-ticks"),
  orphanPid = join(cwd, "orphan-pid");
const orphan = startWorker({
  host,
  cwd,
  binary,
  args,
  prompt: "Run",
  env: {
    ...env,
    N_EIN_TEST_COMMAND: `trap '' TERM; while :; do echo x >> '${orphanTicks}'; sleep 0.03; done`,
    N_EIN_TEST_PID: orphanPid,
  },
  onEvent: () => {},
});
const orphanDeadline = Date.now() + 10000;
while (!existsSync(orphanTicks)) {
  if (Date.now() > orphanDeadline) {
    await orphan.stop();
    throw new Error("orphan case did not start");
  }
  await new Promise((r) => setTimeout(r, 30));
}
process.kill(orphan.pid!, "SIGKILL");
let rescued=false;
const watchdog = setTimeout(() => {
  rescued=true;
  try {
    process.kill(Number(readFileSync(orphanPid, "utf8")), "SIGKILL");
  } catch {}
}, 4000);
const orphanResult = await orphan.done;
clearTimeout(watchdog);
assert.equal(rescued,false,"Pi must close on EOF without the test watchdog killing it");
assert.equal(orphanResult.status, "failed");
const orphanBefore = readFileSync(orphanTicks, "utf8");
await new Promise((r) => setTimeout(r, 120));
assert.equal(readFileSync(orphanTicks, "utf8"), orphanBefore);
console.log("host death → Pi EOF → command stop: OK");
