import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
const repo = resolve("."),
  area = mkdtempSync(join(tmpdir(), "nein-team-pi-")),
  cwd = join(area, "project");
mkdirSync(cwd);
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.name", "Test");
git("config", "user.email", "test@local");
writeFileSync(join(cwd, "WORK.md"), "# Goal\n- [ ] T1\n- [ ] T2\n");
git("add", ".");
git("commit", "-qm", "base");
git("switch", "-qc", "feature");
const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
const real =
    process.env.N_EIN_PI_BIN ||
    join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
  wrapper = join(area, "pi");
writeFileSync(
  wrapper,
  `#!/bin/sh\nexec ${quote(real)} "$@" -e ${quote(join(repo, "tests/fixtures/team-provider.ts"))}\n`,
  { mode: 0o755 },
);
const models = join(area, "models.json");
writeFileSync(
  models,
  JSON.stringify({
    schema: 1,
    agents: { principal: { model: "nein-test/team", thinking: "off" } },
  }),
);
const index = join(area, "codegraph");
writeFileSync(index, '#!/bin/sh\nprintf "{}\\n"\n', { mode: 0o755 });
const env = {
  ...process.env,
  N_EIN_PI_BIN: wrapper,
  N_EIN_AGENT_DIR: join(area, "home"),
  N_EIN_WORKTREE_ROOT: join(area, "workspaces"),
  N_EIN_MODELS_FILE: models,
  N_EIN_CODEGRAPH_BIN: index,
  N_EIN_TEAM: "1",
  PI_SKIP_VERSION_CHECK: "1",
};
const child = spawn(
  join(repo, "dist/n-ein"),
  [
    "--root",
    repo,
    "--project",
    cwd,
    "--runtime",
    "pi",
    "--",
    "--mode",
    "json",
    "--print",
    "Implement the two assigned tasks.",
  ],
  { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
);
let out = "",
  err = "";
child.stdout.on("data", (x) => (out += x));
child.stderr.on("data", (x) => (err += x));
const timer = setTimeout(() => {
  try {
    process.kill(-child.pid!, "SIGTERM");
  } catch {}
}, 25000);
const exit = await new Promise<number | null>((r, j) => {
  child.once("close", r);
  child.once("error", j);
});
clearTimeout(timer);
writeFileSync(join(area, "events.jsonl"), out);
writeFileSync(join(area, "stderr"), err);
assert.equal(exit, 0, err);
assert.ok(out.includes("INTEGRATED"), out.slice(-3000));
const records = readdirSync(join(cwd, ".git/n_ein/team"))
  .filter((x) => x.endsWith(".json"))
  .map((x) =>
    JSON.parse(readFileSync(join(cwd, ".git/n_ein/team", x), "utf8")),
  );
assert.equal(records.length, 2);
assert.ok(records.every((t) => t.status === "integrated"));
const parentTime = statSync(join(cwd, "parent.txt")).mtimeMs;
for (const t of records) {
  const file = `child-${t.id}.txt`;
  assert.equal(readFileSync(join(cwd, file), "utf8"), "done");
  assert.ok(
    parentTime < statSync(join(t.cwd, file)).mtimeMs,
    "parent advances while workers run",
  );
}
console.log(
  "real Pi coordinator + two workers + automatic continuation + integration: OK",
);
