import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve("."),
  area = mkdtempSync(join(tmpdir(), "nein-jobs-pi-"));
async function run(deny: boolean) {
  const cwd = join(area, deny ? "denied" : "allowed");
  mkdirSync(cwd);
  const child = spawn(
    process.env.N_EIN_PI_BIN ||
      join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
    [
      "--mode",
      "rpc",
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-themes",
      "--no-prompt-templates",
      "--no-context-files",
      "-e",
      join(root, "pi-package/extensions/jobs.ts"),
      "-e",
      join(root, "tests/fixtures/jobs-provider.ts"),
      "--model",
      "jobs-test/model",
      "--thinking",
      "off",
    ],
    {
      cwd,
      env: {
        ...process.env,
        PI_CODING_AGENT_DIR: join(cwd, "agent"),
        N_EIN_HOME: join(cwd, "home"),
        N_EIN_TEST_DENY_JOB: deny ? "1" : "0",
        PI_OFFLINE: "1",
        PI_SKIP_VERSION_CHECK: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let text = "",
    errors = "";
  child.stdout.on("data", (chunk) => {
    text += chunk.toString();
    if (text.includes('"text":"JOB_OBSERVED"')) child.stdin.end();
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 15000);
  child.stdin.write(
    JSON.stringify({ type: "prompt", message: "Run the fixture job" }) + "\n",
  );
  const code = await new Promise<number | null>((r) => child.once("close", r));
  clearTimeout(timer);
  assert.ok(text.includes('"text":"JOB_OBSERVED"'), errors + text.slice(-3000));
  assert.equal(code, 0, errors);
  assert.equal(existsSync(join(cwd, "marker")), !deny);
  assert.ok(text.includes(deny ? "native-test-denial" : "Estado: passed"));
}
await run(false);
await run(true);
console.log(
  "native Pi jobs: background delivery and bash permission hooks observed",
);
