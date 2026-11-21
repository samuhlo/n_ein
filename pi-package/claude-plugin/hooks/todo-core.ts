// =============================================================================
// [CORE] NÚCLEO DEL TODO
// Las casillas de WORK.md como tareas, cuál toca ahora y cómo se nombra cada
// una. Lo comparten el widget de Pi, la barra y la franja de Claude y el banner;
// el launcher en Go repite la misma regla contra tests/fixtures/work-focus.md.
//
// POR QUÉ -> el plugin de Claude corre sin Node: este módulo solo importa otro
// núcleo puro, recibe el texto del documento y devuelve datos y trozos con tono.
// =============================================================================

import { clip } from "./receipt-core.ts";

export type WorkTask = { index: number; line: number; done: boolean; text: string };
export type TaskParts = { key: string; title: string };
export type Focus = { current?: WorkTask; behind: WorkTask[]; done: number; total: number };
export type TodoView = { title: string; tasks: readonly WorkTask[] };
/** La escala de STYLE: acento, primario, secundario, apagado y estructura. */
export type TodoTone = "accent" | "text" | "muted" | "faint" | "structure";
export type TodoSegment = { tone: TodoTone; text: string };
export type TodoOptions = {
  width: number;
  /** Alto máximo del bloque, cabecera incluida. */
  maxLines?: number;
  /** Qué hace el agente ahora (coding, testing…), junto al avance. */
  phase?: string;
};

// WORK.md sigue el idioma de los artefactos: la sección de tareas vale en castellano o en inglés.
export const TASKS_HEADING = /^##\s+(Tareas|Tasks|Checklist)\s*$/i;

export function parseTasks(content: string): WorkTask[] {
  const lines = content.split(/\r?\n/);
  const tasks: WorkTask[] = [];
  let inChecklist = false;
  for (let line = 0; line < lines.length; line++) {
    if (TASKS_HEADING.test(lines[line])) { inChecklist = true; continue; }
    if (/^#{1,2}\s+/.test(lines[line])) inChecklist = false;
    if (!inChecklist) continue;
    const match = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.+)$/.exec(lines[line]);
    if (match) tasks.push({ index: tasks.length + 1, line, done: match[2].toLowerCase() === "x", text: match[4] });
  }
  return tasks;
}

/**
 * La tarea actual es la primera abierta tras la última hecha; si no queda
 * ninguna después, la primera abierta. Las abiertas anteriores van aparte.
 *
 * POR QUÉ -> «la primera sin marcar» dejaba el TODO clavado en una tarea del
 * propietario (puesta en servicio, prueba de dos semanas) mientras el trabajo
 * iba treinta tareas más abajo.
 */
export function focusOf(tasks: readonly WorkTask[]): Focus {
  const done = tasks.filter((task) => task.done).length;
  let lastDone = -1;
  tasks.forEach((task, position) => { if (task.done) lastDone = position; });
  const current = tasks.slice(lastDone + 1).find((task) => !task.done) ?? tasks.find((task) => !task.done);
  const behind = current ? tasks.filter((task) => !task.done && task.index < current.index) : [];
  return { current, behind, done, total: tasks.length };
}

/** `T39 · Título — detalle. Blocked by: …` → `{ key: "T39", title: "Título" }`. */
export function taskParts(text: string): TaskParts {
  const clean = text.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
  const id = /^(T\d+[a-z]?)\s*·\s*(.*)$/i.exec(clean);
  const rest = id ? id[2] : clean;
  const title = rest.split(" — ")[0].replace(/\s*Blocked by:.*$/i, "").replace(/\.$/, "").trim();
  return { key: id ? id[1] : "", title: title || rest };
}

/** El nombre corto de una tarea: id y título, sin el detalle. */
export function taskLabel(text: string): string {
  const { key, title } = taskParts(text);
  return key ? `${key} · ${title}` : title;
}

/** El título del documento, sin marcas: lo que dice de qué va el encargo. */
export function docTitle(content: string): string {
  const heading = /^#\s+(.+)$/m.exec(content);
  return heading ? heading[1].replace(/\*\*|__|`/g, "").trim() : "WORK.md";
}

// -----------------------------------------------------------------------------
// [UI] EL BLOQUE DE EIN
// Cabecera con qué a la izquierda y fase y avance a la derecha; debajo lo último
// hecho, la actual y las siguientes, cada fila abierta por `▏`, su marca y su id.
// -----------------------------------------------------------------------------

const INDENT = "  ";
const RULE = "▏";
const DEFAULT_LINES = 6;
/** Por debajo no cabe una fila legible: queda la línea compacta. */
const MIN_WIDTH = 32;
const MORE_BEHIND = 3;

const span = (tone: TodoTone, text: string): TodoSegment => ({ tone, text });
const cells = (parts: readonly TodoSegment[]): number => parts.reduce((sum, part) => sum + [...part.text].length, 0);
const keyOf = (task: WorkTask): string => taskParts(task.text).key;

/** Una línea para la barra de estado: la actual por su id (o su título recortado) y el avance. */
export function todoCompact(view: TodoView, room = 24): TodoSegment[] {
  const { current, done, total } = focusOf(view.tasks);
  if (!current) return [span("structure", "✓ "), span("muted", `${done}/${total} tareas`)];
  const label = keyOf(current) || clip(taskParts(current.text).title, room);
  return [span("accent", "▸ "), span("text", label), span("muted", " · "), span("structure", `${done}/${total}`)];
}

function header(view: TodoView, focus: Focus, width: number, phase?: string): TodoSegment[] {
  const progress = `${focus.done}/${focus.total}`;
  const right = !focus.current
    ? [span("structure", "✓ "), span("muted", progress)]
    : [...(phase ? [span("accent", `▸ ${phase}`), span("text", "   ")] : []), span("muted", progress)];
  const room = width - INDENT.length - cells(right) - 2;
  const left = room >= 8 ? [span("text", clip(view.title, room))] : [];
  const pad = Math.max(1, width - INDENT.length - cells(left) - cells(right));
  return [span("text", INDENT), ...left, span("text", " ".repeat(pad)), ...right];
}

/**
 * Fila de tarea, abierta por la izquierda: regla, marca, id y título.
 *
 * POR QUÉ -> en Ein el `▸` llegó a pintarse al final de la línea, a ochenta
 * columnas de la fila que marcaba; la lectura empieza por la izquierda.
 */
function taskRow(task: WorkTask, state: "done" | "current" | "pending", keyWidth: number, width: number): TodoSegment[] {
  const { key, title } = taskParts(task.text);
  const mark = state === "done" ? span("structure", "✓") : state === "current" ? span("accent", "▸") : span("text", " ");
  const prefix = [
    span("text", INDENT), span(state === "current" ? "accent" : "structure", RULE), span("text", "  "), mark, span("text", "  "),
    ...(keyWidth ? [span("structure", key.padEnd(keyWidth))] : []),
  ];
  const tone: TodoTone = state === "current" ? "accent" : state === "done" ? "faint" : "text";
  return [...prefix, span(tone, clip(title, width - cells(prefix)))];
}

function noteRow(text: string, width: number): TodoSegment[] {
  const prefix = [span("text", INDENT), span("structure", RULE), span("text", "     ")];
  return [...prefix, span("faint", clip(text, width - cells(prefix)))];
}

/** Las abiertas que quedaron atrás, por su id: una tarea del dueño no debe perderse de vista. */
function behindText(behind: readonly WorkTask[]): string {
  if (behind.length === 0) return "";
  const names = behind.slice(0, MORE_BEHIND).map((task) => keyOf(task) || clip(taskParts(task.text).title, 20));
  const more = behind.length > MORE_BEHIND ? ", …" : "";
  return `${behind.length === 1 ? "abierta antes" : "abiertas antes"}: ${names.join(", ")}${more}`;
}

/**
 * Las líneas del TODO para un ancho. Sin tareas, nada; sin sitio, la línea
 * compacta; todo hecho, solo la cabecera.
 *
 * Se conservan lo último hecho, la actual y las siguientes abiertas: lo hecho
 * antes ya no informa, y lo que no cabe se cuenta en la nota final junto a las
 * abiertas que quedaron atrás.
 */
export function todoRows(view: TodoView, options: TodoOptions): TodoSegment[][] {
  if (view.tasks.length === 0) return [];
  const { width, phase } = options;
  if (width < MIN_WIDTH) return [todoCompact(view)];
  const focus = focusOf(view.tasks);
  const top = header(view, focus, width, phase);
  const { current } = focus;
  if (!current) return [top];

  const available = Math.max(1, (options.maxLines ?? DEFAULT_LINES) - 1);
  const previous = view.tasks[current.index - 2];
  const next = view.tasks.slice(current.index).filter((task) => !task.done);
  const layout = (withPrevious: boolean, withNote: boolean) => {
    const fixed = (withPrevious ? 1 : 0) + 1;
    const wantsNote = withNote && (focus.behind.length > 0 || next.length > available - fixed);
    const shown = next.slice(0, Math.max(0, available - fixed - (wantsNote ? 1 : 0)));
    const hidden = next.length - shown.length;
    const note = wantsNote ? [hidden ? `${hidden} más` : "", behindText(focus.behind)].filter(Boolean).join(" · ") : "";
    return { withPrevious, shown, note, lines: fixed + shown.length + (note ? 1 : 0) };
  };
  const fits = (plan: ReturnType<typeof layout>) => plan.lines <= available;
  const candidates = [layout(Boolean(previous?.done), true), layout(false, true), layout(false, false)];
  const plan = candidates.find(fits) ?? candidates[2];

  const visible = [...(plan.withPrevious && previous ? [previous] : []), current, ...plan.shown];
  const keyWidth = visible.some((task) => keyOf(task)) ? Math.max(...visible.map((task) => keyOf(task).length)) + 2 : 0;
  return [
    top,
    ...visible.map((task) => taskRow(task, task === current ? "current" : task.done ? "done" : "pending", keyWidth, width)),
    ...(plan.note ? [noteRow(plan.note, width)] : []),
  ];
}
