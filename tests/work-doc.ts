import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACTIVITY_EVENT } from "../pi-package/claude-plugin/hooks/activity-core";
import registerTodo from "../pi-package/extensions/todo";
import { addWorkTask, readWorkDoc, resolveWorkDoc } from "../pi-package/extensions/work-doc";

const dir = mkdtempSync(join(tmpdir(), "n-ein-work-doc-"));
const previous = process.env.N_EIN_WORK_DOC;
delete process.env.N_EIN_WORK_DOC;
mkdirSync(join(dir, ".git"));
const nested = join(dir, "src");
mkdirSync(nested);
const doc = join(dir, "WORK.md");

const noColor = process.env.NO_COLOR;
delete process.env.NO_COLOR;

let sessionStart: any;
let toolEnd: any;
let todoCommand: any;
let onActivity: (data: unknown) => void = () => {};
registerTodo({
  on(name: string, handler: any) {
    if (name === "session_start") sessionStart = handler;
    if (name === "tool_execution_end") toolEnd = handler;
  },
  registerCommand(name: string, command: any) { if (name === "todo") todoCommand = command; },
  events: { on(channel: string, handler: (data: unknown) => void) { if (channel === ACTIVITY_EVENT) onActivity = handler; return () => {}; }, emit() {} },
} as any);

type Widget = string[] | ((tui: unknown, theme: unknown) => { render(width: number): string[] }) | undefined;
const widgets: Widget[] = [];
const notifications: string[] = [];
const ctx = {
  cwd: nested,
  hasUI: true,
  mode: "tui",
  ui: {
    setWidget(_name: string, content: Widget) { widgets.push(content); },
    notify(message: string) { notifications.push(message); },
  },
};
const painted = (width = 100): string[] => {
  const widget = widgets.at(-1);
  if (!widget) return [];
  return Array.isArray(widget) ? widget : widget({}, {}).render(width);
};
const plain = (width = 100): string => painted(width).join("\n").replace(/\x1b\[[0-9;]*m/g, "");

try {
  assert.equal(resolveWorkDoc(nested), null);
  sessionStart({}, ctx);
  assert.equal(widgets.at(-1), undefined);

  writeFileSync(doc, [
    "# Encargo",
    "",
    "## Tareas",
    "- [ ] Reproducir el defecto",
    "- [ ] Corregirlo",
    "",
    "## Evidencia",
    "- [ ] Esta casilla no es una tarea",
    "",
  ].join("\n"));

  sessionStart({}, ctx);
  assert.deepEqual(readWorkDoc(doc).tasks.map((task) => task.text), ["Reproducir el defecto", "Corregirlo"]);
  assert.match(plain(), /Encargo +0\/2\n {2}▏ {2}▸ {2}Reproducir el defecto\n {2}▏ {5}Corregirlo/);
  assert.ok(painted().join("").includes("\x1b[38;2;255;202;64m▸"), "el foco va en amarillo");
  assert.ok(painted(40).every((line) => [...line.replace(/\x1b\[[0-9;]*m/g, "")].length <= 40), "ninguna línea pasa del ancho");

  // El agente marca la casilla a mitad de turno: el widget cambia sin esperar al final de la respuesta.
  writeFileSync(doc, readFileSync(doc, "utf8").replace("- [ ] Reproducir", "- [x] Reproducir"));
  toolEnd({}, ctx);
  assert.match(plain(), /✓ {2}Reproducir el defecto\n {2}▏ {2}▸ {2}Corregirlo/);
  writeFileSync(doc, readFileSync(doc, "utf8").replace("- [x] Reproducir", "- [ ] Reproducir"));
  const repaints = widgets.length;
  toolEnd({}, ctx);
  toolEnd({}, ctx);
  assert.equal(widgets.length, repaints + 1, "sin cambios no se repinta");

  // La fase llega de activity.ts por el bus de eventos y se va al acabar la respuesta.
  onActivity("testing");
  assert.match(plain(), /^ {2}Encargo +▸ testing {3}0\/2$/m);
  onActivity(null);
  assert.match(plain(), /^ {2}Encargo +0\/2$/m);

  process.env.NO_COLOR = "1";
  sessionStart({}, ctx);
  assert.doesNotMatch(painted().join(""), /\x1b\[/, "NO_COLOR deja el TODO sin color");
  delete process.env.NO_COLOR;

  todoCommand.handler("done 1", ctx);
  assert.match(readFileSync(doc, "utf8"), /- \[x\] Reproducir el defecto/);
  assert.match(plain(), /▸ {2}Corregirlo/);
  assert.match(readFileSync(doc, "utf8"), /- \[ \] Esta casilla no es una tarea/);

  todoCommand.handler("add Comprobar el resultado", ctx);
  assert.equal(readWorkDoc(doc).tasks.at(-1)?.text, "Comprobar el resultado");
  assert.equal(notifications.some((message) => message.includes("Tarea añadida")), true);

  const existingDoc = join(dir, "plan.md");
  writeFileSync(existingDoc, "# Plan existente\n\n## Checklist\n- [ ] Revisar\n");
  process.env.N_EIN_WORK_DOC = existingDoc;
  assert.equal(resolveWorkDoc(nested), existingDoc);
  sessionStart({}, ctx);
  assert.match(plain(), /Plan existente +0\/1\n {2}▏ {2}▸ {2}Revisar/);

  // WORK.md sigue el idioma de los artefactos: títulos en inglés valen igual.
  const english = join(dir, "english.md");
  writeFileSync(english, "# Work\n\n## Goal\nShip it.\n\n## Tasks\n- [x] T1 · Parse\n- [ ] T2 · Render\n  - Criterion: shows the panel\n");
  assert.deepEqual(readWorkDoc(english).tasks.map((task) => [task.text, task.done]), [["T1 · Parse", true], ["T2 · Render", false]]);
  const newEnglish = join(dir, "new-english.md");
  writeFileSync(newEnglish, "# Work\n\n## Goal\nShip it.\n");
  addWorkTask(newEnglish, "First task");
  assert.match(readFileSync(newEnglish, "utf8"), /## Tasks\n\n- \[ \] First task/, "la sección nueva sigue el idioma del documento");
  console.log("work doc: TODO proyecta y edita el markdown único, en castellano o en inglés");
} finally {
  if (noColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = noColor;
  if (previous === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previous;
  rmSync(dir, { recursive: true, force: true });
}
