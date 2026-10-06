import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TeamStore } from "../pi-package/agents/store.ts";
process.env.N_EIN_WORKTREE_ROOT = mkdtempSync(
  join(tmpdir(), "nein-workspaces-"),
);

const root = mkdtempSync(join(tmpdir(), "nein-team-"));
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.email", "test@local");
git("config", "user.name", "Test");
writeFileSync(
  join(root, "WORK.md"),
  "# Goal\n- [ ] T1 frontend\n- [ ] T2 backend\n",
);
git("add", ".");
git("commit", "-qm", "base");
git("switch", "-qc", "feature");
const store = new TeamStore(root);
const a = store.create({
  taskId: "T1",
  label: "front",
  prompt: "front",
  model: "test/model",
  thinking: "medium",
  owner: "one",
});
const b = store.create({
  taskId: "T2",
  label: "back",
  prompt: "back",
  model: "test/model",
  thinking: "medium",
  owner: "one",
});
assert.notEqual(a.cwd, b.cwd);
assert.ok(
  !a.cwd.includes("/.git/"),
  "Vite must be able to serve files from the worktree",
);
assert.equal(
  readFileSync(join(a.cwd, "WORK.md"), "utf8"),
  readFileSync(join(root, "WORK.md"), "utf8"),
);
assert.throws(
  () =>
    store.create({
      taskId: "T1",
      label: "again",
      prompt: "x",
      model: "test/model",
      thinking: "medium",
      owner: "two",
    }),
  /already/,
);
writeFileSync(join(a.cwd, "front.txt"), "front");
execFileSync("git", ["add", "."], { cwd: a.cwd });
execFileSync("git", ["commit", "-qm", "front"], { cwd: a.cwd });
store.update(a.id, { status: "ready" });
store.integrate(a.id);
assert.equal(readFileSync(join(root, "front.txt"), "utf8"), "front");
assert.equal(store.get(a.id).status, "integrated");
assert.equal(new TeamStore(root).list().length, 2);
writeFileSync(join(root, "user.txt"), "mine");
assert.throws(() => store.integrate(b.id), /ready|clean/);
assert.equal(readFileSync(join(root, "user.txt"), "utf8"), "mine");
console.log("team store and real Git: OK");
// Rechaza modificaciones externas tras registrar un resultado listo.
writeFileSync(join(b.cwd, "back.txt"), "back");
execFileSync("git", ["add", "."], { cwd: b.cwd });
execFileSync("git", ["commit", "-qm", "back"], { cwd: b.cwd });
store.snapshot(b.id);
store.update(b.id, { status: "ready" });
writeFileSync(join(b.cwd, "late.txt"), "outside result");
execFileSync("git", ["add", "."], { cwd: b.cwd });
execFileSync("git", ["commit", "-qm", "late"], { cwd: b.cwd });
const { unlinkSync } = await import("node:fs");
unlinkSync(join(root, "user.txt"));
assert.throws(() => store.integrate(b.id), /HEAD changed/);
assert.equal(git("ls-files", "late.txt"), "");
// Dos cambios incompatibles dejan un conflicto visible, sin perder las ramas.
const c = store.create({
  taskId: "T3",
  label: "conflict",
  prompt: "change front",
  model: "test/model",
  thinking: "medium",
  owner: "one",
});
writeFileSync(join(c.cwd, "front.txt"), "worker");
execFileSync("git", ["add", "."], { cwd: c.cwd });
execFileSync("git", ["commit", "-qm", "worker"], { cwd: c.cwd });
store.snapshot(c.id);
store.update(c.id, { status: "ready" });
writeFileSync(join(root, "front.txt"), "coordinator");
git("add", ".");
git("commit", "-qm", "coordinator");
assert.throws(() => store.integrate(c.id));
assert.match(git("status", "--porcelain"), /UU front.txt/);
assert.equal(store.get(c.id).status, "ready");
console.log("stale results and integration conflicts: OK");
