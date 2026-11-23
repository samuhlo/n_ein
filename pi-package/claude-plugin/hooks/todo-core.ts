// =============================================================================
// [UI] NÚCLEO DEL TODO
// Cómo se ve el documento de trabajo: el bloque bajo el editor de Pi y sobre el
// prompt de Claude, y la línea compacta de la barra de estado. Qué tareas hay
// y cuál toca ahora lo dice work-core.ts.
//
// POR QUÉ -> el plugin de Claude corre sin Node: este módulo solo importa otros
// núcleos puros, recibe datos y devuelve trozos con tono.
// =============================================================================

import { clip } from "./receipt-core.ts";
import { focusOf, taskParts, WORK_BUDGET_BYTES, type Focus, type WorkTask } from "./work-core.ts";

export type TodoView = { title: string; tasks: readonly WorkTask[]; bytes?: number };
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

/**
 * Ancho máximo de la barra de estado de Claude (bin/n-ein-todo): marca, modelo, rama y la línea
 * compacta. register.tsx reserva estas columnas en el pie para que el medidor no la parta.
 */
export const STATUS_COLUMNS = 90;

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

/** Recorta una fila de trozos a un ancho, con `…` en el trozo que lo cruza. */
export function fitSegments(parts: readonly TodoSegment[], room: number): TodoSegment[] {
  const out: TodoSegment[] = [];
  let left = room;
  for (const part of parts) {
    const size = [...part.text].length;
    if (size <= left) { out.push(part); left -= size; continue; }
    if (left > 0) out.push(span(part.tone, clip(part.text, left)));
    break;
  }
  return out;
}

/** Una línea para la barra de estado: la actual por su id (o su título recortado) y el avance. */
export function todoCompact(view: TodoView, room = 24): TodoSegment[] {
  const { current, waiting, done, total } = focusOf(view.tasks);
  if (!current && waiting.length > 0) return [span("muted", "en espera "), span("text", namesOf(waiting)), span("muted", " · "), span("structure", `${done}/${total}`)];
  if (!current) return [span("structure", "✓ "), span("muted", `${done}/${total} tareas`)];
  const label = keyOf(current) || clip(taskParts(current.text).title, room);
  return [span("accent", "▸ "), span("text", label), span("muted", " · "), span("structure", `${done}/${total}`)];
}

function header(view: TodoView, focus: Focus, width: number, phase?: string): TodoSegment[] {
  const progress = `${focus.done}/${focus.total}`;
  const right = !focus.current && focus.waiting.length === 0
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

/** Las tareas por su id (o su título corto), las tres primeras. */
function namesOf(tasks: readonly WorkTask[]): string {
  const names = tasks.slice(0, MORE_BEHIND).map((task) => keyOf(task) || clip(taskParts(task.text).title, 20));
  return `${names.join(", ")}${tasks.length > MORE_BEHIND ? ", …" : ""}`;
}

/** Lo que no es la actual pero no debe perderse de vista: abiertas que quedaron atrás, tareas en espera y un documento que pesa. */
function asideText(focus: Focus, bytes = 0): string {
  return [
    focus.behind.length ? `${focus.behind.length === 1 ? "abierta antes" : "abiertas antes"}: ${namesOf(focus.behind)}` : "",
    focus.waiting.length ? `en espera: ${namesOf(focus.waiting)}` : "",
    bytes > WORK_BUDGET_BYTES ? `${Math.round(bytes / 1024)} KB: toca compactar` : "",
  ].filter(Boolean).join(" · ");
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
  const aside = asideText(focus, view.bytes);
  if (!current) return aside && (options.maxLines ?? DEFAULT_LINES) > 1 ? [top, noteRow(aside, width)] : [top];

  const available = Math.max(1, (options.maxLines ?? DEFAULT_LINES) - 1);
  // Lo último hecho antes de la actual, aunque entre ellas quede algo en espera.
  const previous = view.tasks.slice(0, current.index - 1).reverse().find((task) => task.state === "done");
  const next = view.tasks.slice(current.index).filter((task) => task.state === "open");
  const layout = (withPrevious: boolean, withNote: boolean) => {
    const fixed = (withPrevious ? 1 : 0) + 1;
    const wantsNote = withNote && (aside !== "" || next.length > available - fixed);
    const shown = next.slice(0, Math.max(0, available - fixed - (wantsNote ? 1 : 0)));
    const hidden = next.length - shown.length;
    const note = wantsNote ? [hidden ? `${hidden} más` : "", aside].filter(Boolean).join(" · ") : "";
    return { withPrevious, shown, note, lines: fixed + shown.length + (note ? 1 : 0) };
  };
  const fits = (plan: ReturnType<typeof layout>) => plan.lines <= available;
  // Lo primero que cede es lo último hecho; después, la nota. La actual siempre se queda.
  const plan = [layout(previous !== undefined, true), layout(false, true)].find(fits) ?? layout(false, false);

  const visible = [...(plan.withPrevious && previous ? [previous] : []), current, ...plan.shown];
  const keyWidth = visible.some((task) => keyOf(task)) ? Math.max(...visible.map((task) => keyOf(task).length)) + 2 : 0;
  return [
    top,
    ...visible.map((task) => taskRow(task, task === current ? "current" : task.state === "done" ? "done" : "pending", keyWidth, width)),
    ...(plan.note ? [noteRow(plan.note, width)] : []),
  ];
}
