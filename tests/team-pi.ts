import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
const sourceRepo = resolve(".");
const repo = process.env.N_EIN_PRODUCT_ROOT || sourceRepo,
  area = mkdtempSync(join(tmpdir(), "nein-team-pi-")),
  cwd = join(area, "project");
const host = existsSync(join(repo, "bin/n-ein"))
  ? join(repo, "bin/n-ein")
  : join(repo, "dist/n-ein");
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
  `#!/bin/sh\nexec ${quote(real)} "$@" -e ${quote(join(sourceRepo, "tests/fixtures/team-provider.ts"))}\n`,
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
  N_EIN_TEST_RESUME: "1",
  PI_SKIP_VERSION_CHECK: "1",
};
const child = spawn(
  host,
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
const resumedCall = out
  .split("\n")
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  })
  .find(
    (e) =>
      e.type === "message_end" &&
      e.message?.role === "assistant" &&
      e.message.content.some(
        (c: any) =>
          c.type === "toolCall" &&
          c.name === "nein_team" &&
          c.arguments.action === "resume",
      ),
  );
assert.ok(
  resumedCall.message.timestamp <
    Date.parse(records.find((t) => t.taskId === "T1").ended),
  "print mode must deliver the first result while the other worker still runs",
);

assert.ok(records.every((t) => t.status === "integrated"));
assert.equal(records.find((t) => t.taskId === "T2").attempt, 2);
assert.equal(readFileSync(join(cwd, "resumed.txt"), "utf8"), "resumed");
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
// El comando de relevo debe detener también a los trabajadores todavía activos.
const reached = join(area, "claude-reached"),
  fakeClaude = join(area, "claude");
writeFileSync(
  fakeClaude,
  `#!/usr/bin/env bun
import {execFileSync} from 'node:child_process';import {readdirSync,readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
const dir=join(process.cwd(),'.git/n_ein/team');const tasks=readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>JSON.parse(readFileSync(join(dir,x),'utf8'))).filter(t=>t.status!=='integrated');
if(tasks.length!==2||tasks.some(t=>t.status!=='stopped'))process.exit(2);
for(const t of tasks)execFileSync(${JSON.stringify(host)},['--worker-probe','--project',t.cwd]);
execFileSync(${JSON.stringify(join(repo, "bin/n-ein-prepare-pi"))},['Preserve both fronts.'],{cwd:tasks[0].cwd,env:process.env});
const handoffFile=readFileSync(process.env.N_EIN_HANDOFF_SIGNAL,'utf8').trim().split('\\n')[1];
const note=readFileSync(handoffFile,'utf8');
if(!note.includes('Proyecto: '+tasks[0].origin)||!note.includes(tasks[1].cwd))process.exit(3);
writeFileSync(process.env.N_EIN_HANDOFF_SIGNAL,'');
writeFileSync(${JSON.stringify(reached)},'workers stopped');
`,
  { mode: 0o755 },
);
const transfer = spawn(
  host,
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
    "Start both workers then continue with Claude.",
  ],
  {
    cwd,
    env: {
      ...env,
      N_EIN_TEST_ACTIVE_HANDOFF: "1",
      N_EIN_CLAUDE_BIN: fakeClaude,
      N_EIN_CLAUDE_DIR: join(area, "claude-home"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);
let transferOut = "",
  transferErr = "";
transfer.stdout.on("data", (x) => (transferOut += x));
transfer.stderr.on("data", (x) => (transferErr += x));
const transferTimer = setTimeout(() => {
  try {
    process.kill(-transfer.pid!, "SIGTERM");
  } catch {}
}, 20000);
const transferExit = await new Promise<number | null>((r, j) => {
  transfer.once("close", r);
  transfer.once("error", j);
});
clearTimeout(transferTimer);
writeFileSync(join(area, "handoff-events.jsonl"), transferOut);
writeFileSync(join(area, "handoff-stderr"), transferErr);
assert.equal(transferExit, 0, transferErr);
assert.equal(readFileSync(reached, "utf8"), "workers stopped");
console.log("native handoff waits for both active workers: OK");
