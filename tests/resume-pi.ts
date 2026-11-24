import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { piBinary } from "./pi-runtime.ts";

// Pi real en RPC: la extensión deja al lanzador el id y el archivo de la sesión vigente, también tras
// /new, y solo cuando su padre es el lanzador que se lo pidió.
const root = resolve(".");
const area = mkdtempSync(join(tmpdir(), "nein-resume-pi-"));

type Event = { type?: string; command?: string; success?: boolean };

function session(record: string, owner: string) {
  const child = spawn(
    piBinary,
    [
      "--mode", "rpc", "--session-dir", join(area, "sessions"),
      "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates", "--no-context-files",
      "-e", join(root, "pi-package/extensions/resume.ts"),
      "-e", join(root, "tests/fixtures/usage-provider.ts"),
      "--model", "usage-test/model", "--thinking", "off",
    ],
    {
      cwd: area,
      env: {
        ...process.env, PI_CODING_AGENT_DIR: join(area, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1",
        N_EIN_RESUME_FILE: record, N_EIN_RESUME_OWNER: owner,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let buffer = "";
  let errors = "";
  const waiting: { match: (event: Event) => boolean; done: () => void }[] = [];
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let event: Event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      for (const wait of waiting.splice(0)) {
        if (wait.match(event)) wait.done();
        else waiting.push(wait);
      }
    }
  });
  child.stderr.on("data", (chunk) => (errors += chunk.toString()));
  const until = (match: (event: Event) => boolean) =>
    new Promise<void>((done, fail) => {
      const timer = setTimeout(() => fail(new Error("Pi no respondió: " + errors.slice(-2000))), 15_000);
      waiting.push({ match, done: () => (clearTimeout(timer), done()) });
    });
  const send = (command: object) => child.stdin.write(JSON.stringify(command) + "\n");
  const close = async () => {
    child.stdin.end();
    await new Promise((done) => child.once("close", done));
  };
  return { send, until, close };
}

const read = (record: string) => readFileSync(record, "utf8").split("\n");

try {
  const record = join(area, "resume");
  const pi = session(record, String(process.pid));
  pi.send({ type: "prompt", message: "hola" });
  await pi.until((event) => event.type === "agent_end");
  const [first, firstFile] = read(record);
  assert.ok(first, "sin id tras el primer turno");
  assert.ok(existsSync(firstFile), `la sesión guardada no existe: ${firstFile}`);

  pi.send({ type: "new_session" });
  await pi.until((event) => event.type === "response" && event.command === "new_session");
  pi.send({ type: "prompt", message: "otra" });
  await pi.until((event) => event.type === "agent_end");
  await pi.close();
  const [second, secondFile] = read(record);
  assert.notEqual(second, first, "tras /new el id debe ser el de la sesión nueva");
  assert.ok(existsSync(secondFile));

  // Un Pi hijo de otro proceso (trabajador, test) hereda la variable pero no escribe.
  const foreign = join(area, "foreign");
  const other = session(foreign, "1");
  other.send({ type: "prompt", message: "hola" });
  await other.until((event) => event.type === "agent_end");
  await other.close();
  assert.equal(existsSync(foreign), false);
  console.log("resume Pi: id de la sesión vigente tras /new, solo para su lanzador");
} finally {
  rmSync(area, { recursive: true, force: true });
}
