import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fitSegments, STATUS_COLUMNS, todoCompact, todoRows, type TodoSegment } from "../pi-package/claude-plugin/hooks/todo-core.ts";
import { docTitle, focusOf, parseTasks, taskLabel, taskParts } from "../pi-package/claude-plugin/hooks/work-core.ts";

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

// [UI] El bloque de Ein: cabecera con qué y avance, filas con ▏ ✓ ▸, recorte al ancho real.
const view = { title: docTitle(fixture), tasks: parseTasks(fixture) };
const lines = (rows: TodoSegment[][]): string[] => rows.map((row) => row.map((part) => part.text).join(""));
const width = (line: string): number => [...line].length;
const block = todoRows(view, { width: 80 });
const drawn = lines(block);
assert.equal(drawn.length, 6, drawn.join("\n"));
assert.match(drawn[0], /^ {2}Encargo de prueba +6\/10$/);
assert.equal(width(drawn[0]), 80, "la cabecera ancla el avance al margen derecho");
assert.match(drawn[1], /^ {2}▏ {2}✓ {2}T8 {3}Correcciones$/, "lo último hecho da contexto");
assert.match(drawn[2], /^ {2}▏ {2}▸ {2}T9 {3}Autoría y emojis en la revisión$/);
assert.match(drawn[3], /^ {2}▏ {5}T10 {2}El sitio de cada nota$/);
assert.match(drawn[4], /^ {2}▏ {5}T6 {3}Prueba de dos semanas$/);
assert.match(drawn[5], /^ {2}▏ {5}abierta antes: T5$/);
assert.ok(block[2].some((part) => part.tone === "accent" && part.text.includes("Autoría")), "la fila actual lleva el acento");
assert.ok(block[1].every((part) => part.tone !== "accent"), "lo hecho no compite con el foco");
assert.ok(drawn.every((line) => !line.includes("—") && !line.includes("Blocked")), "el detalle se queda en el documento");

const phased = lines(todoRows(view, { width: 80, phase: "coding" }));
assert.match(phased[0], /^ {2}Encargo de prueba +▸ coding {3}6\/10$/, "la fase va junto al avance");

const tight = lines(todoRows(view, { width: 80, maxLines: 4 }));
assert.deepEqual(tight.map((line) => line.trim().split(/ {2,}/).at(-1)), ["6/10", "Correcciones", "Autoría y emojis en la revisión", "2 más · abierta antes: T5"]);

const narrow = lines(todoRows(view, { width: 36 }));
assert.ok(narrow.every((line) => width(line) <= 36), narrow.join("\n"));
assert.ok(narrow.some((line) => line.endsWith("T9   Autoría y emojis en la…")), "el título se recorta con …");

assert.deepEqual(lines(todoRows(view, { width: 24 })), ["▸ T9 · 6/10"], "sin sitio, una línea compacta");
assert.deepEqual(lines(todoRows({ title: "Hecho", tasks: parseTasks(checklist("- [x] T1 · Uno", "- [x] T2 · Dos")) }, { width: 60 })),
  [`  Hecho${" ".repeat(48)}✓ 2/2`]);
const unnamed = lines(todoRows({ title: "Encargo", tasks: parseTasks(checklist("- [ ] Reproducir el defecto", "- [ ] Corregirlo")) }, { width: 60 }));
assert.match(unnamed[1], /^ {2}▏ {2}▸ {2}Reproducir el defecto$/, "sin ids no hay columna de id");
assert.equal(docTitle("Sin título\n\n## Tareas\n"), "WORK.md");
assert.equal(docTitle("# **Miolo** · volver\n"), "Miolo · volver");

assert.deepEqual(lines([todoCompact(view)]), ["▸ T9 · 6/10"]);
assert.deepEqual(lines([fitSegments([{ tone: "text", text: "abc" }, { tone: "muted", text: "defgh" }], 6)]), ["abcde…"]);
assert.deepEqual(lines([fitSegments([{ tone: "text", text: "abc" }], 3)]), ["abc"]);
assert.deepEqual(lines([todoCompact({ title: "E", tasks: parseTasks(checklist("- [ ] Reproducir el defecto con calma y con datos")) }, 20)]), ["▸ Reproducir el defec… · 0/1"]);

// [UI] Lo que espera a alguien se ve aparte, sin ser la actual ni contar como hecho.
const waitingView = { title: "Encargo", tasks: parseTasks(checklist("- [x] T1 · Uno", "- [ ] T2 · Puesta en servicio — espera: el propietario", "- [ ] T3 · Tres", "- [ ] T4 · Vieja — descartada: sobra")) };
const waitingRows = lines(todoRows(waitingView, { width: 60 }));
assert.match(waitingRows[0]!, /1\/3$/, "la descartada no cuenta");
assert.match(waitingRows[1]!, /✓ {2}T1 {2}Uno$/, "lo último hecho, aunque en medio quede algo en espera");
assert.match(waitingRows[2]!, /▸ {2}T3 {2}Tres$/);
assert.equal(waitingRows.at(-1)?.trim(), "▏     en espera: T2");
const onlyWaiting = { title: "Encargo", tasks: parseTasks(checklist("- [x] T1 · Uno", "- [ ] T2 · Puesta en servicio — espera: el propietario")) };
assert.deepEqual(lines(todoRows(onlyWaiting, { width: 60 })), [`  Encargo${" ".repeat(48)}1/2`, "  ▏     en espera: T2"], "sin trabajo propio no hay ✓: falta lo que espera");
assert.deepEqual(lines([todoCompact(onlyWaiting)]), ["en espera T2 · 1/2"]);

// [UI] Un documento que pasa del presupuesto lo dice en la nota: toca compactar.
const heavy = lines(todoRows({ ...view, bytes: 40 * 1024 }, { width: 80 }));
assert.match(heavy.at(-1)!, /abierta antes: T5 · 40 KB: toca compactar$/);
assert.ok(!lines(todoRows({ ...view, bytes: 20 * 1024 }, { width: 80 })).join("\n").includes("KB"), "dentro del presupuesto no se menciona");

// [FLOW] La barra de estado de Claude lee la misma regla.
const project = mkdtempSync(join(tmpdir(), "n-ein-todo-core-"));
try {
  mkdirSync(join(project, ".git"));
  writeFileSync(join(project, "WORK.md"), fixture);
  const bar = (input: object, env: Record<string, string> = {}): string => {
    const run = spawnSync("bun", [join(root, "bin/n-ein-todo"), "--statusline"], {
      input: JSON.stringify(input),
      env: { ...process.env, NO_COLOR: "1", N_EIN_WORK_DOC: "", N_EIN_CLAUDE_EFFORT: "", ...env },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.trimEnd();
  };
  assert.equal(bar({ workspace: { current_dir: project } }), "n_ein   ▸ T9 · 6/10", "la barra avanza con la regla compartida y queda compacta");
  assert.equal(bar({ workspace: { current_dir: project }, model: { display_name: "Opus 5.5" } }, { N_EIN_CLAUDE_EFFORT: "xhigh" }), "n_ein   Opus 5.5 · xhigh   ▸ T9 · 6/10");
  const long = bar({ workspace: { current_dir: project }, model: { display_name: "M".repeat(120) } });
  assert.equal([...long].length, STATUS_COLUMNS, "nunca más ancha que lo que reserva el pie");
  assert.ok(long.endsWith("…"));
  assert.equal(bar({ workspace: { current_dir: tmpdir() } }), "n_ein", "sin WORK.md, solo la marca");
} finally {
  rmSync(project, { recursive: true, force: true });
}

console.log("todo core: la tarea actual sigue a lo hecho y se lee como id y título");
