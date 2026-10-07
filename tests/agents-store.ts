import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
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
// El documento configurado sigue siendo la única guía; no exige crear otro WORK.md.
const custom = mkdtempSync(join(tmpdir(), "nein-custom-doc-"));
const customGit = (...args: string[]) =>
  execFileSync("git", args, { cwd: custom, encoding: "utf8" }).trim();
customGit("init", "-q");
customGit("config", "user.name", "Test");
customGit("config", "user.email", "test@local");
writeFileSync(join(custom, "PLAN.md"), "# Plan\n- [ ] custom\n");
customGit("add", ".");
customGit("commit", "-qm", "base");
const previousDoc = process.env.N_EIN_WORK_DOC;
process.env.N_EIN_WORK_DOC = "PLAN.md";
try {
  const task = new TeamStore(custom).create({
    taskId: "custom",
    label: "custom",
    prompt: "x",
    model: "test/model",
    thinking: "medium",
    owner: "test",
  });
  assert.equal(task.workDoc, join(realpathSync(custom), "PLAN.md"));
} finally {
  if (previousDoc === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previousDoc;
}
console.log("configured work document: OK");
// Los bloqueos se refieren a asignaciones únicas, no a un T1 de otro encargo.
const assigned = new TeamStore(custom);
const previous = assigned.list()[0]!;
process.env.N_EIN_WORK_DOC = "PLAN.md";
try {
  assert.throws(
    () =>
      assigned.create({
        taskId: "dependent",
        label: "d",
        prompt: "x",
        model: "test/model",
        thinking: "medium",
        owner: "new",
        dependsOn: [previous.id],
      }),
    /not integrated/,
  );
  assigned.update(previous.id, { status: "integrated" });
  assert.throws(
    () =>
      assigned.create({
        taskId: "dependent",
        label: "d",
        prompt: "x",
        model: "test/model",
        thinking: "medium",
        owner: "new",
        dependsOn: ["custom"],
      }),
    /assignment/,
  );
  const dependent = assigned.create({
    taskId: "dependent",
    label: "d",
    prompt: "x",
    model: "test/model",
    thinking: "medium",
    owner: "new",
    dependsOn: [previous.id],
  });
  assert.deepEqual(dependent.dependsOn, [previous.id]);
  const oldBase = customGit("rev-parse", "HEAD");
  customGit("switch", "-qc", "feature-base");
  writeFileSync(join(custom, "foundation.txt"), "foundation");
  customGit("add", ".");
  customGit("commit", "-qm", "foundation");
  const move = assigned.create({
    taskId: "moved",
    label: "moved",
    prompt: "x",
    model: "test/model",
    thinking: "medium",
    owner: "test",
  });
  writeFileSync(join(move.cwd, "result.txt"), "result");
  execFileSync("git", ["add", "."], { cwd: move.cwd });
  execFileSync("git", ["commit", "-qm", "result"], { cwd: move.cwd });
  assigned.snapshot(move.id);
  assigned.update(move.id, { status: "ready" });
  customGit("switch", "-qc", "another-base", oldBase);
  assert.throws(() => assigned.integrate(move.id), /left the assigned base/);
  assert.equal(
    customGit("ls-files", "foundation.txt"),
    "",
    "integration must not resurrect the abandoned base",
  );
} finally {
  if (previousDoc === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previousDoc;
}

// Investigar conserva el árbol local, incluso sin guía y con cambios previos.
const readRoot = mkdtempSync(join(tmpdir(), "nein-reader-store-"));
const readGit = (...args: string[]) =>
  execFileSync("git", args, { cwd: readRoot, encoding: "utf8" }).trim();
readGit("init", "-q");
readGit("config", "user.name", "Test");
readGit("config", "user.email", "test@local");
writeFileSync(join(readRoot, "source.txt"), "base");
readGit("add", ".");
readGit("commit", "-qm", "base");
writeFileSync(join(readRoot, "source.txt"), "user change");
const readStore = new TeamStore(readRoot);
const beforeRead = readGit("status", "--porcelain");
const beforeTrees = readGit("worktree", "list", "--porcelain");
const research = readStore.create({
  mode: "read",
  taskId: "R1",
  label: "Find the behavior",
  prompt: "Locate source",
  model: "test/model",
  thinking: "medium",
  owner: "reader",
});
assert.equal(research.cwd, realpathSync(readRoot));
assert.equal(research.branch, "");
assert.equal(research.workDoc, undefined);
assert.equal(readGit("worktree", "list", "--porcelain"), beforeTrees);
assert.equal(readGit("status", "--porcelain"), beforeRead);
assert.equal(readStore.get(research.id).mode, "read");
readStore.snapshot(research.id);
readStore.update(research.id, {
  status: "complete",
  result: "source.txt:1",
  delivered: true,
});
assert.throws(() => readStore.integrate(research.id), /read-only/i);
assert.equal(readFileSync(join(readRoot, "source.txt"), "utf8"), "user change");
console.log("read-only assignment without plan, clean tree or worktree: OK");
