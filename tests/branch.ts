import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import registerBranch from "../pi-package/extensions/branch.ts";
import { branchOf, branchSegments } from "../pi-package/extensions/git-branch.ts";

const root = resolve(import.meta.dir, "..");
const area = mkdtempSync(join(tmpdir(), "n-ein-branch-"));
const repo = join(area, "repo");
const plain = join(area, "sin-git");
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
const noColor = process.env.NO_COLOR;
process.env.NO_COLOR = "1";

try {
  execFileSync("mkdir", ["-p", repo, plain]);
  git("init", "-q", "-b", "feat/propuestas");
  git("config", "user.name", "n_ein test");
  git("config", "user.email", "test@n-ein.invalid");

  // [CORE] La rama, aunque aún no tenga commits; HEAD suelto por su commit corto; sin Git, nada.
  assert.deepEqual(await branchOf(repo), { name: "feat/propuestas", detached: false });
  writeFileSync(join(repo, "WORK.md"), "# Encargo\n\n## Tareas\n- [ ] T1 · Uno\n");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  const sha = git("rev-parse", "--short", "HEAD").toString().trim();
  git("checkout", "-q", "--detach");
  assert.deepEqual(await branchOf(repo), { name: sha, detached: true });
  git("switch", "-q", "feat/propuestas");
  assert.equal(await branchOf(plain), null);

  const text = (parts: { text: string }[]) => parts.map((part) => part.text).join("");
  assert.equal(text(branchSegments({ name: "feat/propuestas", detached: false })), "rama feat/propuestas");
  assert.equal(text(branchSegments({ name: sha, detached: true })), `HEAD ${sha}`);
  assert.equal(text(branchSegments({ name: `feat/${"x".repeat(60)}`, detached: false })).length, 5 + 28, "una rama larga no se come la barra");

  // [FLOW] En Pi, la rama va en la línea de estado y sigue a un cambio hecho desde bash.
  const handlers = new Map<string, (event: any, ctx: any) => unknown>();
  registerBranch({ on(name: string, handler: (event: any, ctx: any) => unknown) { handlers.set(name, handler); } } as any);
  const statuses: Array<string | undefined> = [];
  const ctx = (cwd: string) => ({ cwd, hasUI: true, ui: { setStatus(key: string, value: string | undefined) { if (key === "nein-branch") statuses.push(value); } } });
  await handlers.get("session_start")?.({}, ctx(repo));
  assert.equal(statuses.at(-1), "rama feat/propuestas");
  git("switch", "-q", "-c", "fix/otra");
  await handlers.get("tool_execution_end")?.({ toolName: "read" }, ctx(repo));
  assert.equal(statuses.at(-1), "rama feat/propuestas", "leer un archivo no cambia de rama: no se pregunta a Git");
  await handlers.get("tool_execution_end")?.({ toolName: "bash" }, ctx(repo));
  assert.equal(statuses.at(-1), "rama fix/otra");
  await handlers.get("session_start")?.({}, ctx(plain));
  assert.equal(statuses.at(-1), undefined, "fuera de Git no hay rama que enseñar");

  // [FLOW] En Claude, la barra de estado la lleva entre el modelo y el TODO.
  const bar = spawnSync("bun", [join(root, "bin/n-ein-todo"), "--statusline"], {
    input: JSON.stringify({ workspace: { current_dir: repo }, model: { display_name: "Opus 5.5" } }),
    env: { ...process.env, N_EIN_WORK_DOC: "", N_EIN_CLAUDE_EFFORT: "" },
    encoding: "utf8",
  });
  assert.equal(bar.status, 0, bar.stderr);
  assert.equal(bar.stdout.trimEnd(), "n_ein   Opus 5.5   rama fix/otra   ▸ T1 · 0/1");
} finally {
  if (noColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = noColor;
  rmSync(area, { recursive: true, force: true });
}

console.log("branch: la rama en la línea de estado de Pi y en la barra de Claude");
