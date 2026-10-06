import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { TeamManager } from "../pi-package/agents/manager.ts";
process.env.N_EIN_WORKTREE_ROOT = mkdtempSync(
  join(tmpdir(), "nein-workspaces-"),
);

const cwd = mkdtempSync(join(tmpdir(), "nein-manager-"));
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.name", "Test");
git("config", "user.email", "test@local");
writeFileSync(join(cwd, "WORK.md"), "# Goal\n- [ ] T1\n- [ ] T2\n- [ ] T3");
git("add", ".");
git("commit", "-qm", "base");
git("switch", "-qc", "feature");
const fake = join(cwd, ".git", "pi");
writeFileSync(
  fake,
  `#!/usr/bin/env bun
import {writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');let buffer='';
process.stdin.on('data',x=>{buffer+=x;let i;while((i=buffer.indexOf('\\n'))>=0){const c=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);send({type:'response',id:c.id,success:true,data:{disposition:'started'}});if(c.type==='prompt')setTimeout(()=>{const name=c.message.match(/assignment (T[123])/)[1];writeFileSync(name+'.txt',name);execFileSync('git',['add',name+'.txt']);execFileSync('git',['commit','-qm',name]);send({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'done '+name}],usage:{input:5,output:2,cost:{total:0.01}}}});send({type:'agent_settled'})},200)}});`,
  { mode: 0o755 },
);
const manager = new TeamManager({
  root: resolve("."),
  cwd,
  owner: "test",
  env: { N_EIN_PI_BIN: fake, PI_CODING_AGENT_DIR: join(cwd, ".git", "home") },
});
const tasks = manager.start(
  ["T1", "T2", "T3"].map((taskId) => ({
    taskId,
    label: taskId,
    prompt: "write assigned file",
    model: "test/model",
    thinking: "medium",
  })),
);
assert.equal(manager.list().filter((t) => t.status === "running").length, 2);
assert.equal(manager.list().filter((t) => t.status === "queued").length, 1);
manager.recover();
assert.equal(
  manager.list().filter((t) => t.status === "queued").length,
  1,
  "recover does not interrupt its own queued task",
);
await manager.wait();
assert.ok(manager.list().every((t) => t.status === "ready"));
for (const t of tasks) manager.integrate(t.id);
for (const id of ["T1", "T2", "T3"])
  assert.equal(readFileSync(join(cwd, id + ".txt"), "utf8"), id);
assert.equal(
  manager.list().reduce((n, t) => n + t.tokens, 0),
  21,
);
const continued = new TeamManager({ root: resolve("."), cwd, owner: "second" });
continued.recover();
assert.ok(continued.list().every((t) => t.status === "integrated"));
console.log("team manager queue, accounting and integration: OK");
// Una asignación persistida puede sobrevivir sin proceso ni commit final.
const pending = continued.store.create({
  taskId: "T4",
  label: "partial",
  prompt: "continue",
  model: "test/model",
  thinking: "medium",
  owner: "lost",
});
writeFileSync(join(pending.cwd, "partial.txt"), "preserved");
continued.store.update(pending.id, { status: "running" });
continued.recover();
assert.equal(continued.store.get(pending.id).status, "interrupted");
assert.match(continued.store.get(pending.id).dirty!, /partial.txt/);
assert.equal(
  readFileSync(join(pending.cwd, "partial.txt"), "utf8"),
  "preserved",
);
const fakeText = readFileSync(fake, "utf8").replace("T[123]", "T[1234]");
writeFileSync(fake, fakeText);
const restored = new TeamManager({
  root: resolve("."),
  cwd,
  owner: "restored",
  env: { N_EIN_PI_BIN: fake, PI_CODING_AGENT_DIR: join(cwd, ".git", "home") },
});
restored.resume(pending.id, "Preserve partial.txt and finish the assignment");
await restored.wait();
assert.equal(restored.store.get(pending.id).status, "ready");
assert.equal(
  readFileSync(join(pending.cwd, "partial.txt"), "utf8"),
  "preserved",
);
assert.throws(
  () => restored.integrate(pending.id),
  /clean/,
  "uncommitted partial work cannot be silently dropped",
);
console.log("interrupted assignment and continuation: OK");
assert.equal(
  restored.store.get(pending.id).model,
  "test/model",
  "resume preserves its physical model",
);
writeFileSync(
  fake,
  readFileSync(fake, "utf8").replace(
    "writeFileSync(name+'.txt',name)",
    "writeFileSync(name+'.txt',name+' again')",
  ),
);
restored.resume(pending.id, "Continue with higher capability", {
  model: "test/strong",
  thinking: "high",
});
await restored.wait();
assert.equal(restored.store.get(pending.id).model, "test/strong");
assert.equal(restored.store.get(pending.id).thinking, "high");
assert.equal(restored.store.get(pending.id).tokens, 14);
console.log("explicit capability change preserves accumulated usage: OK");
// La parada no depende de poder leer el registro: los procesos vivos siguen siendo propios.
const silent = join(cwd, ".git", "silent");
writeFileSync(
  silent,
  `#!/usr/bin/env bun
import {writeFileSync,appendFileSync} from 'node:fs';writeFileSync('pid',String(process.pid));setInterval(()=>appendFileSync('ticks','x'),20);let b='';process.stdin.on('data',x=>{b+=x;let i;while((i=b.indexOf('\\n'))>=0){const c=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:c.id,success:true,data:{disposition:'started'}})+'\\n')}});
`,
  { mode: 0o755 },
);
const broken = new TeamManager({
  root: resolve("."),
  cwd,
  owner: "broken",
  env: { N_EIN_PI_BIN: silent, PI_CODING_AGENT_DIR: join(cwd, ".git", "home") },
});
const [corrupt] = broken.start([
  {
    taskId: "T5",
    label: "record failure",
    prompt: "x",
    model: "test/model",
    thinking: "medium",
  },
]);
const waitUntil = Date.now() + 3000;
while (!existsSync(join(corrupt!.cwd, "ticks")) && Date.now() < waitUntil)
  await new Promise((r) => setTimeout(r, 20));
writeFileSync(corrupt!.recordPath!, "{broken");
try {
  await broken.shutdown();
  assert.ok(
    broken.free(corrupt!.cwd),
    "shutdown stops workers even with a malformed record",
  );
  assert.equal(readFileSync(corrupt!.recordPath!, "utf8"), "{broken");
} finally {
  if (!broken.free(corrupt!.cwd)) {
    const pid = readFileSync(join(corrupt!.cwd, "pid"), "utf8");
    const command = execFileSync("ps", ["-p", pid, "-o", "command="], {
      encoding: "utf8",
    });
    if (command.includes(silent)) process.kill(Number(pid), "SIGTERM");
  }
}
console.log("record failure cannot prevent owned shutdown: OK");
