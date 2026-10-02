import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerTodo from "../pi-package/extensions/todo";
import { addWorkTask, readWorkDoc, resolveWorkDoc } from "../pi-package/extensions/work-doc";

const dir = mkdtempSync(join(tmpdir(), "n-ein-work-doc-"));
const previous = process.env.N_EIN_WORK_DOC;
delete process.env.N_EIN_WORK_DOC;
mkdirSync(join(dir, ".git"));
const nested = join(dir, "src");
mkdirSync(nested);
const doc = join(dir, "WORK.md");

let sessionStart: any;
let todoCommand: any;
registerTodo({
  on(name: string, handler: any) { if (name === "session_start") sessionStart = handler; },
  registerCommand(name: string, command: any) { if (name === "todo") todoCommand = command; },
} as any);

const widgets: Array<string[] | undefined> = [];
const notifications: string[] = [];
const ctx = {
  cwd: nested,
  hasUI: true,
  mode: "tui",
  ui: {
    setWidget(_name: string, lines: string[] | undefined) { widgets.push(lines); },
    notify(message: string) { notifications.push(message); },
  },
};

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
  assert.match(widgets.at(-1)?.[0] ?? "", /▸ Reproducir el defecto/);

  todoCommand.handler("done 1", ctx);
  assert.match(readFileSync(doc, "utf8"), /- \[x\] Reproducir el defecto/);
  assert.match(widgets.at(-1)?.[0] ?? "", /▸ Corregirlo/);
  assert.match(readFileSync(doc, "utf8"), /- \[ \] Esta casilla no es una tarea/);

  todoCommand.handler("add Comprobar el resultado", ctx);
  assert.equal(readWorkDoc(doc).tasks.at(-1)?.text, "Comprobar el resultado");
  assert.equal(notifications.some((message) => message.includes("Tarea añadida")), true);

  const existingDoc = join(dir, "plan.md");
  writeFileSync(existingDoc, "# Plan existente\n\n## Checklist\n- [ ] Revisar\n");
  process.env.N_EIN_WORK_DOC = existingDoc;
  assert.equal(resolveWorkDoc(nested), existingDoc);
  sessionStart({}, ctx);
  assert.match(widgets.at(-1)?.[0] ?? "", /▸ Revisar/);

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
  if (previous === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previous;
  rmSync(dir, { recursive: true, force: true });
}
