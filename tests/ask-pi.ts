import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { piBinary } from "./pi-runtime.ts";

// Pi real en RPC: nein_ask pregunta con el diálogo de Pi y la respuesta vuelve al modelo como
// resultado de la herramienta. Un proveedor falso llama a la herramienta en cada petición.
const root = resolve(".");
const area = mkdtempSync(join(tmpdir(), "nein-ask-pi-"));
const QUESTIONS = {
  questions: [
    {
      question: "¿Qué base de datos usamos?",
      options: [{ label: "Postgres", description: "relacional, ya en producción" }, { label: "SQLite" }],
      recommended: 0,
    },
  ],
};
const args = (mode: string[]) => [
  ...mode, "--no-session", "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates", "--no-context-files",
  "-e", join(root, "pi-package/extensions/ask.ts"),
  "-e", join(root, "tests/fixtures/ask-provider.ts"),
  "--model", "ask-test/model", "--thinking", "off",
];
const env = {
  ...process.env, PI_CODING_AGENT_DIR: join(area, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1",
  N_EIN_TEST_ASK: JSON.stringify(QUESTIONS),
};

type Event = {
  type?: string; id?: string; method?: string; title?: string; options?: string[];
  toolName?: string; isError?: boolean; result?: { content?: { type: string; text?: string }[] };
};

try {
  const child = spawn(piBinary, args(["--mode", "rpc"]), { cwd: area, env, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  let errors = "";
  const waiting: { match: (event: Event) => boolean; done: (event: Event) => void }[] = [];
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
        if (wait.match(event)) wait.done(event);
        else waiting.push(wait);
      }
    }
  });
  child.stderr.on("data", (chunk) => (errors += chunk.toString()));
  const until = (match: (event: Event) => boolean) =>
    new Promise<Event>((done, fail) => {
      const timer = setTimeout(() => fail(new Error("Pi no respondió: " + errors.slice(-2000))), 15_000);
      waiting.push({ match, done: (event) => (clearTimeout(timer), done(event)) });
    });
  const send = (message: object) => child.stdin.write(JSON.stringify(message) + "\n");
  const dialog = (method: string) => until((event) => event.type === "extension_ui_request" && event.method === method);
  const answered = () => until((event) => event.type === "tool_execution_end" && event.toolName === "nein_ask");
  const text = (event: Event) => event.result?.content?.map((part) => part.text ?? "").join("") ?? "";

  // Elegir una opción: la lista lleva la recomendada marcada y «Otra respuesta» al final.
  send({ type: "prompt", message: "elige" });
  const select = await dialog("select");
  assert.match(select.title ?? "", /¿Qué base de datos usamos\?/);
  assert.deepEqual(select.options, ["Postgres (recomendada) — relacional, ya en producción", "SQLite", "Otra respuesta"]);
  send({ type: "extension_ui_response", id: select.id, value: "SQLite" });
  const chosen = await answered();
  assert.equal(chosen.isError, false);
  assert.match(text(chosen), /→ SQLite/);
  await until((event) => event.type === "agent_end");

  // «Otra respuesta» pide el texto y lo devuelve citado.
  send({ type: "prompt", message: "otra" });
  send({ type: "extension_ui_response", id: (await dialog("select")).id, value: "Otra respuesta" });
  send({ type: "extension_ui_response", id: (await dialog("input")).id, value: "MySQL gestionado" });
  assert.match(text(await answered()), /other answer: "MySQL gestionado"/);
  await until((event) => event.type === "agent_end");

  // Esc no inventa respuesta.
  send({ type: "prompt", message: "cancela" });
  send({ type: "extension_ui_response", id: (await dialog("select")).id, cancelled: true });
  assert.match(text(await answered()), /no answer: the user dismissed it/);
  await until((event) => event.type === "agent_end");
  child.stdin.end();
  await new Promise((done) => child.once("close", done));

  // Sin interfaz (-p) no hay diálogo: la herramienta pide preguntar en texto.
  const print = spawnSync(piBinary, args(["--mode", "json", "-p"]).concat("pregunta"), { cwd: area, env, encoding: "utf8", timeout: 20_000 });
  const ended = print.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Event)
    .find((event) => event.type === "tool_execution_end" && event.toolName === "nein_ask");
  assert.ok(ended, print.stderr + print.stdout.slice(-2000));
  assert.match(text(ended), /ask .* in your reply/i);
  console.log("ask Pi: opción, otra respuesta, Esc y sin interfaz");
} finally {
  rmSync(area, { recursive: true, force: true });
}
