// Regresión sin modelo: Vite debe poder resolver el setup de los tests del árbol.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { strict as assert } from "node:assert";
import { TeamStore } from "../../pi-package/agents/store.ts";
const dependencies = process.argv[2];
if (!dependencies)
  throw new Error(
    "Pass a local node_modules containing Vitest; no installation is performed.",
  );
const area = mkdtempSync(join(tmpdir(), "nein-vite-layout-")),
  root = join(area, "project"),
  deps = join(area, "node_modules");
mkdirSync(root);
execFileSync("cp", ["-c", "-R", resolve(dependencies), deps]);
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.name", "Test");
git("config", "user.email", "test@local");
mkdirSync(join(root, "tests"));
writeFileSync(join(root, "WORK.md"), "# Goal\n- [ ] T1 behaviour\n");
writeFileSync(join(root, ".gitignore"), "node_modules/\n.cache/\n");
writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
writeFileSync(
  join(root, "vitest.config.ts"),
  "import {defineConfig} from 'vitest/config';export default defineConfig({cacheDir:'.cache',test:{environment:'jsdom',include:['tests/*.test.ts'],setupFiles:['./tests/setup.ts']}});\n",
);
writeFileSync(join(root, "tests/setup.ts"), "globalThis.fixtureReady=true;\n");
writeFileSync(
  join(root, "tests/behaviour.test.ts"),
  "import {test,expect} from 'vitest';test('setup runs',()=>expect(globalThis.fixtureReady).toBe(true));\n",
);
git("add", ".");
git("commit", "-qm", "fixture");
git("switch", "-qc", "feature");
const old = join(root, ".git/old-worker");
git("worktree", "add", "-b", "old", old, "HEAD");
process.env.N_EIN_WORKTREE_ROOT = join(area, "workspaces");
const store = new TeamStore(root);
const task = store.create({
  taskId: "T1",
  label: "test",
  prompt: "test",
  model: "test/model",
  thinking: "medium",
  owner: "test",
});
function run(cwd: string) {
  symlinkSync(deps, join(cwd, "node_modules"), "dir");
  const p = spawnSync("node", [join(deps, "vitest/vitest.mjs"), "run"], {
    cwd,
    encoding: "utf8",
    timeout: 30000,
  });
  return { exit: p.status, output: p.stdout + p.stderr };
}
const before = run(old),
  after = run(task.cwd);
writeFileSync(join(area,"result.json"),JSON.stringify({before,after,worktree:task.cwd},null,2));
console.log("Evidence: "+area);
assert.notEqual(
  before.exit,
  0,
  "old .git location must reproduce Vite refusal",
);
assert.match(before.output, /Cannot find module/);
assert.equal(after.exit, 0, after.output);
assert.match(after.output, /1 passed/);
writeFileSync(
  join(area, "result.json"),
  JSON.stringify({ before, after, worktree: task.cwd }, null, 2),
);
console.log(
  "Vite worktree regression: RED under .git, GREEN in external storage. Evidence: " +
    area,
);
