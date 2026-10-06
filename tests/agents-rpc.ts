import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startWorker } from "../pi-package/agents/rpc.ts";
const root = mkdtempSync(join(tmpdir(), "nein-rpc-"));
const fixture = join(root, "child.cjs");
writeFileSync(
  fixture,
  `let buf='';process.stdin.on('data',x=>{buf+=x;let i;while((i=buf.indexOf('\\n'))>=0){const c=JSON.parse(buf.slice(0,i));buf=buf.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:c.id,success:true,data:{disposition:'started'}})+'\\n');if(c.type==='prompt'){process.stdout.write(JSON.stringify({type:'agent_end',messages:[]})+'\\n');setTimeout(()=>{process.stdout.write(JSON.stringify({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'listo\\u2028bien'}],usage:{input:10,output:3,cacheRead:0,cacheWrite:0,cost:{total:0.1}}}})+'\\n');process.stdout.write('{"type":"agent_settled"}\\n')},120)}}});`,
);
const start = Date.now();
const worker = startWorker({
  host: resolve("dist/n-ein"),
  cwd: root,
  binary: process.execPath,
  args: [fixture],
  prompt: "trabaja",
  env: { ...process.env },
  onEvent: () => {},
});
const result = await worker.done;
assert.ok(Date.now() - start >= 120, "agent_end no termina la ejecución");
assert.equal(result.status, "ready");
assert.equal(result.text, "listo\u2028bien");
assert.equal(result.tokens, 13);
const command = join(root, "ticks");
const writer = startWorker({
  host: resolve("dist/n-ein"),
  cwd: root,
  binary: "/bin/sh",
  args: ["-c", `while :; do echo x >> '${command}'; sleep 0.02; done`],
  prompt: "x",
  env: { ...process.env },
  onEvent: () => {},
});
await new Promise((r) => setTimeout(r, 150));
await writer.stop();
assert.equal((await writer.done).status, "stopped");
const before = readFileSync(command, "utf8");
await new Promise((r) => setTimeout(r, 100));
assert.equal(readFileSync(command, "utf8"), before);
console.log("workers RPC: OK");
// Bash real del trabajador: matar Pi no deja su comando separado escribiendo.
const { spawn, execFileSync } = await import("node:child_process");
const nestedTicks = join(root, "nested");
const owner = spawn(
  resolve("dist/n-ein"),
  [
    "--worker-host",
    "--project",
    root,
    "--",
    process.execPath,
    resolve("tests/fixtures/owned-shell.ts"),
    `trap '' TERM; while :; do echo x >> '${nestedTicks}'; sleep 0.03; done`,
  ],
  {
    env: { ...process.env, N_EIN_WORKER_HOST: resolve("dist/n-ein") },
    stdio: ["pipe", "ignore", "pipe"],
  },
);
await new Promise((r) => setTimeout(r, 250));
owner.stdin.end();
await new Promise<void>((r) => owner.once("close", () => r()));
await new Promise((r) => setTimeout(r, 650));
const nestedBefore = readFileSync(nestedTicks, "utf8");
await new Promise((r) => setTimeout(r, 120));
assert.equal(readFileSync(nestedTicks, "utf8"), nestedBefore);
execFileSync(resolve("dist/n-ein"), ["--worker-probe", "--project", root]);
console.log("owned bash descendants: OK");
// Pi real, sin modelo: RPC y la herramienta bash del host cierran ordenadamente.
const { homedir } = await import("node:os");
const realTicks = join(root, "pi-ticks");
const real = spawn(
  resolve("dist/n-ein"),
  [
    "--worker-host",
    "--project",
    root,
    "--",
    process.env.N_EIN_PI_BIN ||
      join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
    "--no-skills",
    "--no-themes",
    "--no-prompt-templates",
    "-e",
    resolve("pi-package/agents/child.ts"),
  ],
  {
    env: {
      ...process.env,
      N_EIN_WORKER_HOST: resolve("dist/n-ein"),
      PI_CODING_AGENT_DIR: join(root, "home"),
      PI_SKIP_VERSION_CHECK: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  },
);
let realErr = "";
real.stderr.on("data", (x) => (realErr += x));
let realBuffer = "";
const records: any[] = [];
real.stdout.on("data", (x) => {
  realBuffer += x;
  let i;
  while ((i = realBuffer.indexOf("\n")) >= 0) {
    records.push(JSON.parse(realBuffer.slice(0, i)));
    realBuffer = realBuffer.slice(i + 1);
  }
});
real.stdin.write(
  JSON.stringify({
    id: "bash",
    type: "bash",
    command: `while :; do echo x >> '${realTicks}'; sleep 0.03; done`,
  }) + "\n",
);
const deadline = Date.now() + 12000;
while (!readFileSafe(realTicks)) {
  if (Date.now() > deadline) {
    real.stdin.end();
    throw new Error("Pi bash did not start: " + realErr);
  }
  await new Promise((r) => setTimeout(r, 50));
}
real.stdin.end();
await new Promise<void>((r) => real.once("close", () => r()));
await new Promise((r) => setTimeout(r, 150));
const realBefore = readFileSafe(realTicks);
await new Promise((r) => setTimeout(r, 120));
assert.equal(readFileSafe(realTicks), realBefore);
execFileSync(resolve("dist/n-ein"), ["--worker-probe", "--project", root]);
console.log("Pi 1.0.2 RPC lifecycle: OK");
function readFileSafe(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

// SIGKILL evita los hooks de Pi: el pipe del comando sigue proporcionando propiedad.
const killedTicks = join(root, "killed"),
  pidFile = join(root, "pid");
const killed = spawn(
  resolve("dist/n-ein"),
  [
    "--worker-host",
    "--project",
    root,
    "--",
    process.execPath,
    resolve("tests/fixtures/owned-shell.ts"),
    `trap '' TERM; while :; do echo x >> '${killedTicks}'; sleep 0.03; done`,
  ],
  {
    env: {
      ...process.env,
      N_EIN_WORKER_HOST: resolve("dist/n-ein"),
      N_EIN_TEST_PID: pidFile,
    },
    stdio: ["pipe", "ignore", "ignore"],
  },
);
const killedClose = new Promise<void>((r) => killed.once("close", () => r()));
await new Promise((r) => setTimeout(r, 250));
process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
await killedClose;
await new Promise((r) => setTimeout(r, 800));
const killedBefore = readFileSafe(killedTicks);
assert.ok(killedBefore);
await new Promise((r) => setTimeout(r, 120));
assert.equal(readFileSafe(killedTicks), killedBefore);
execFileSync(resolve("dist/n-ein"), ["--worker-probe", "--project", root]);
console.log("abrupt worker death: OK");
// Un fallo de persistencia no se convierte en éxito por una respuesta tardía.
const faulty = join(root, "faulty.cjs");
writeFileSync(
  faulty,
  `let b='';process.stdin.on('data',x=>{b+=x;let i;while((i=b.indexOf('\\n'))>=0){const c=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:c.id,success:true,data:{disposition:'started'}})+'\\n');if(c.type==='prompt')process.stdout.write([{type:'tool_execution_start',toolName:'write',toolCallId:'x'},{type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'done'}]}},{type:'agent_settled'}].map(x=>JSON.stringify(x)).join('\\n')+'\\n')}});`,
);
const failed = startWorker({
  host: resolve("dist/n-ein"),
  cwd: root,
  binary: process.execPath,
  args: [faulty],
  prompt: "x",
  env: { ...process.env },
  onEvent: (e) => {
    if (e.type === "tool_execution_start") throw new Error("disk full");
  },
});
assert.equal((await failed.done).status, "failed");
console.log("late output cannot mask recording failure: OK");
// Un cierre sin prosa no descarta el código ni exige otro modelo para repetirlo.
const quiet = join(root, "quiet.cjs");
writeFileSync(
  quiet,
  `let b='';process.stdin.on('data',x=>{b+=x;let i;while((i=b.indexOf('\\n'))>=0){const c=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:c.id,success:true,data:{disposition:'started'}})+'\\n');if(c.type==='prompt')process.stdout.write('{"type":"agent_settled"}\\n')}});`,
);
const quietResult = await startWorker({
  host: resolve("dist/n-ein"),
  cwd: root,
  binary: process.execPath,
  args: [quiet],
  prompt: "x",
  env: { ...process.env },
  onEvent: () => {},
}).done;
assert.equal(quietResult.status, "ready");
assert.match(quietResult.text, /Inspect the preserved branch/);
