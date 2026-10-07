import { strict as assert } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { TeamManager } from "../pi-package/agents/manager.ts";
import { taskLease } from "../pi-package/agents/store.ts";
const root = process.env.N_EIN_PRODUCT_ROOT || resolve(".");
const area = mkdtempSync(join(tmpdir(), "nein-read-pi-"));
const cwd = join(area, "project");
execFileSync("mkdir", [cwd]);
const git = (...a: string[]) =>
  execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.name", "Test");
git("config", "user.email", "test@local");
writeFileSync(join(cwd, "source.txt"), "base");
git("add", ".");
git("commit", "-qm", "base");
writeFileSync(join(cwd, "source.txt"), "local user evidence");
const original = git("status", "--porcelain"),
  head = git("rev-parse", "HEAD");
const host = existsSync(join(root, "bin/n-ein"))
  ? join(root, "bin/n-ein")
  : join(root, "dist/n-ein");
const pi =
  process.env.N_EIN_PI_BIN ||
  join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
const wrapper = join(area, "pi");
const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
writeFileSync(
  wrapper,
  `#!/bin/sh\nexec ${quote(pi)} "$@" -e ${quote(resolve("tests/fixtures/reader-provider.ts"))}\n`,
  { mode: 0o755 },
);
process.env.N_EIN_WORKTREE_ROOT = join(cwd, ".readers");
const manager = new TeamManager({
  root,
  cwd,
  owner: "research",
  env: {
    N_EIN_PI_BIN: wrapper,
    PI_CODING_AGENT_DIR: join(area, "home"),
    N_EIN_CODEGRAPH_BIN: "",
  },
});
// El coordinador conserva su bloqueo mientras dos lectores avanzan.
const coordinator = spawn(
  host,
  ["--worker-host", "--project", cwd, "--", "/bin/cat"],
  {
    stdio: ["pipe", "ignore", "ignore"],
    env: { ...process.env, N_EIN_LEASE_FD: "" },
  },
);
const closed = new Promise((r) => coordinator.once("close", r));
const deadline = Date.now() + 3000;
while (manager.free(cwd) && Date.now() < deadline) await Bun.sleep(20);
assert.equal(manager.free(cwd), false);
try {
  const tasks = manager.start(
    ["R1", "R2"].map((taskId) => ({
      mode: "read" as const,
      taskId,
      label: taskId,
      prompt:
        "Find the evidence in source.txt and return its path. Do not change anything.",
      model: "nein-test/reader",
      thinking: "off",
    })),
  );
  await manager.wait();
  for (const task of tasks) {
    const result = manager.store.get(task.id);
    assert.equal(result.status, "complete", result.error);
    const response = JSON.parse(result.result!);
    assert.ok(response.tools.includes("read"));
    assert.ok(
      !response.tools.some((name: string) =>
        ["bash", "write", "edit", "nein_team"].includes(name),
      ),
      JSON.stringify(response.tools),
    );
    assert.match(result.result!, /local user evidence/);
    assert.equal(manager.free(taskLease(result), result.cwd), true);
    assert.throws(() => manager.integrate(task.id), /read-only/i);
  }
  const restored = new TeamManager({
    root,
    cwd,
    owner: "new-session",
    env: manager.options.env,
  });
  restored.recover();
  assert.ok(restored.list().every((t) => t.status === "complete"));
  restored.resume(tasks[0]!.id, "Recheck the same source after the handoff.");
  await restored.wait();
  const resumed = restored.store.get(tasks[0]!.id);
  assert.equal(resumed.attempt, 2);
  assert.equal(resumed.session, manager.store.get(tasks[0]!.id).session);
  assert.equal(resumed.tokens, 210);
  assert.equal(resumed.status, "complete");
  assert.equal(git("status", "--porcelain"), original);
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.equal(
    readFileSync(join(cwd, "source.txt"), "utf8"),
    "local user evidence",
  );
  assert.equal(existsSync(join(cwd, "forbidden.txt")), false);
  assert.equal(existsSync(join(cwd, "WORK.md")), false);
  assert.equal(
    manager.free(cwd),
    false,
    "reader completion never releases the coordinator lease",
  );
} finally {
  await manager.shutdown();
  coordinator.stdin!.end();
  await closed;
}
console.log(
  "native read-only workers: permissions, dirty input, own leases, resume and usage: OK",
);
