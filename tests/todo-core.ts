import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { focusOf, parseTasks, taskLabel, taskParts } from "../pi-package/claude-plugin/hooks/todo-core.ts";

const root = resolve(import.meta.dir, "..");
const fixture = readFileSync(join(root, "tests/fixtures/work-focus.md"), "utf8");
const keys = (text: string): string[] => parseTasks(text).map((task) => taskParts(task.text).key);
const checklist = (...rows: string[]): string => ["# Encargo", "", "## Tareas", ...rows, ""].join("\n");

// [CORE] La tarea actual es la que sigue a lo último hecho, no la primera casilla abierta.
const focus = focusOf(parseTasks(fixture));
assert.equal(focus.current && taskParts(focus.current.text).key, "T9", "una tarea del dueño abierta arriba no detiene el TODO");
assert.deepEqual(focus.behind.map((task) => taskParts(task.text).key), ["T5"], "la abierta que quedó atrás se señala");
assert.equal(focus.done, 6);
assert.equal(focus.total, 10);
assert.deepEqual(keys(fixture).slice(-1), ["T6"], "las casillas de otras secciones no son tareas");

const plain = focusOf(parseTasks(checklist("- [x] T1 · Uno", "- [x] T2 · Dos", "- [ ] T3 · Tres", "- [ ] T4 · Cuatro")));
assert.equal(plain.current?.text, "T3 · Tres", "en orden, la siguiente a la última hecha");
assert.deepEqual(plain.behind, []);

const fresh = focusOf(parseTasks(checklist("- [ ] Reproducir el defecto", "- [ ] Corregirlo")));
assert.equal(fresh.current?.text, "Reproducir el defecto", "sin nada hecho, la primera");

const wrapped = focusOf(parseTasks(checklist("- [x] T1 · Uno", "- [ ] T2 · Pendiente del dueño", "- [x] T3 · Tres")));
assert.equal(wrapped.current?.text, "T2 · Pendiente del dueño", "si después de lo hecho no queda nada, vuelve a la abierta");
assert.deepEqual(wrapped.behind, [], "la actual no se cuenta como abierta atrás");

const finished = focusOf(parseTasks(checklist("- [x] T1 · Uno", "- [X] T2 · Dos")));
assert.equal(finished.current, undefined);
assert.equal(finished.done, 2);

// [CORE] Id y título: el detalle tras « — » y lo bloqueado no caben en una fila.
assert.deepEqual(taskParts("T39 · Autoría, emojis y el porqué en la revisión — autoría propuesta y elegible. Blocked by: none."),
  { key: "T39", title: "Autoría, emojis y el porqué en la revisión" });
assert.deepEqual(taskParts("T8 · Correcciones — **diff** y protección. Blocked by: T7."), { key: "T8", title: "Correcciones" });
assert.deepEqual(taskParts("T2 · Render"), { key: "T2", title: "Render" });
assert.deepEqual(taskParts("**T3** · `apply` en el repo"), { key: "T3", title: "apply en el repo" }, "sin marcas de markdown");
assert.deepEqual(taskParts("Reproducir el defecto"), { key: "", title: "Reproducir el defecto" });
assert.deepEqual(taskParts("Revisar. Blocked by: T1."), { key: "", title: "Revisar" });
assert.equal(taskLabel("T9 · Autoría — detalle"), "T9 · Autoría");
assert.equal(taskLabel("Reproducir el defecto"), "Reproducir el defecto");

// [FLOW] La barra de estado de Claude lee la misma regla.
const project = mkdtempSync(join(tmpdir(), "n-ein-todo-core-"));
try {
  mkdirSync(join(project, ".git"));
  writeFileSync(join(project, "WORK.md"), fixture);
  const bar = spawnSync("bun", [join(root, "bin/n-ein-todo"), "--statusline"], {
    input: JSON.stringify({ workspace: { current_dir: project } }),
    env: { ...process.env, NO_COLOR: "1", N_EIN_WORK_DOC: "" },
    encoding: "utf8",
  });
  assert.equal(bar.status, 0, bar.stderr);
  assert.match(bar.stdout, /T9/, "la barra avanza con la regla compartida");
  assert.doesNotMatch(bar.stdout, /T5|Puesta en servicio/);
} finally {
  rmSync(project, { recursive: true, force: true });
}

console.log("todo core: la tarea actual sigue a lo hecho y se lee como id y título");
