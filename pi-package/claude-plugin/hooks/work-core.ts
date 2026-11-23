// =============================================================================
// [CORE] DOCUMENTO DE TRABAJO
// Un documento por encargo en docs/work/: cabecera, pedidos, decisiones, tareas
// y el registro al final. Este módulo lo lee (también el formato anterior de
// WORK.md), dice en qué estado está cada tarea y elige el documento activo.
// Lo comparten Pi, Claude y el banner; el launcher en Go repite la elección y
// la regla de tarea actual contra los fixtures de tests/fixtures/.
//
// POR QUÉ -> el plugin de Claude corre sin Node: aquí no se lee ningún archivo;
// entra texto y salen datos.
// =============================================================================

export type TaskState = "open" | "done" | "waiting" | "dropped";
export type WorkTask = { index: number; line: number; done: boolean; state: TaskState; text: string };
export type TaskParts = { key: string; title: string };
export type WorkStatus = "active" | "waiting" | "closed" | "";
export type WorkHeader = { status: WorkStatus; branch: string; authorization: string; objective: string; next: string };
export type Work = WorkHeader & {
  title: string;
  asks: string;
  decisions: string;
  limits: string;
  /** El registro (o la evidencia del formato anterior): lo que crece y no hace falta para seguir. */
  log: string;
  /** Todo menos el registro: lo que se lee para retomar. */
  live: string;
  tasks: WorkTask[];
};
export type Focus = { current?: WorkTask; behind: WorkTask[]; waiting: WorkTask[]; done: number; total: number };
export type WorkCandidate = { path: string; status: WorkStatus; branch: string };

/** Abiertos aquí, uno por encargo; al cerrarse pasan a closed/ y ya no se eligen. */
export const WORK_DIR = "docs/work";
export const CLOSED_DIR = "docs/work/closed";

// Los documentos siguen el idioma de los artefactos: cada título y clave vale en castellano o en inglés.
export const TASKS_HEADING = /^##\s+(Tareas|Tasks|Checklist)\s*$/i;
const LOG_TITLES = ["Registro", "Log"];
const LEGACY_LOG_TITLES = ["Evidencia", "Evidence"];
const LIST_KEYS = /^(Estado|Status|Rama|Branch|Tests?)\s*:/i;
const LINE_KEYS = /^(Autorizaci[oó]n|Authorization|Objetivo|Objective|Goal|Siguiente|Next)\s*:\s*(.*)$/i;
const WAITING = /\s—\s*(en espera|espera|waiting)\s*:/i;
const DROPPED = /\s—\s*(descartada|dropped)\s*:/i;

export function parseTasks(content: string): WorkTask[] {
  const tasks: WorkTask[] = [];
  let inChecklist = false;
  for (const [line, text] of content.split(/\r?\n/).entries()) {
    if (TASKS_HEADING.test(text)) { inChecklist = true; continue; }
    if (/^#{1,2}\s+/.test(text)) inChecklist = false;
    if (!inChecklist) continue;
    const match = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(text);
    if (!match?.[1] || !match[2]) continue;
    const body = match[2];
    // Descartada manda sobre la casilla: lo descartado nunca cuenta como hecho.
    const state: TaskState = DROPPED.test(body) ? "dropped" : match[1] !== " " ? "done" : WAITING.test(body) ? "waiting" : "open";
    tasks.push({ index: tasks.length + 1, line, done: state === "done", state, text: body });
  }
  return tasks;
}

/** El cuerpo de una sección `## Título`, hasta la siguiente de nivel 1 o 2. */
export function section(content: string, ...titles: string[]): string {
  const lines = content.split(/\r?\n/);
  const wanted = titles.map((title) => `## ${title}`.toLowerCase());
  const start = lines.findIndex((line) => wanted.includes(line.trim().toLowerCase()));
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s+/.test(lines[end] ?? "")) end++;
  return lines.slice(start + 1, end).join("\n").trim();
}

function normalStatus(value: string): WorkStatus {
  const text = value.toLowerCase();
  if (/cerrad|closed|hecho|done/.test(text)) return "closed";
  if (/espera|waiting|hold/.test(text)) return "waiting";
  return text ? "active" : "";
}

/** Las líneas entre el título y la primera sección: `Estado: activo · Rama: feat/x`, `Objetivo: …`. */
export function parseHeader(content: string): WorkHeader {
  const header: WorkHeader = { status: "", branch: "", authorization: "", objective: "", next: "" };
  for (const line of content.split(/\r?\n/)) {
    if (/^##\s/.test(line)) break;
    const text = line.trim();
    // Solo las claves cortas comparten línea con « · »; un objetivo o una autorización es texto libre.
    const fields = LIST_KEYS.test(text) ? text.split(" · ") : [text];
    for (const field of fields) {
      const list = /^(Estado|Status|Rama|Branch)\s*:\s*(.*)$/i.exec(field.trim());
      if (list?.[1] && list[2] !== undefined) {
        if (/^(estado|status)$/i.test(list[1])) header.status = normalStatus(list[2].trim());
        else header.branch = list[2].replace(/`/g, "").trim();
        continue;
      }
      const free = LINE_KEYS.exec(field.trim());
      if (!free?.[1] || free[2] === undefined) continue;
      const key = free[1].toLowerCase();
      const value = free[2].trim();
      if (key.startsWith("autoriz") || key === "authorization") header.authorization = value;
      else if (key.startsWith("sig") || key === "next") header.next = value;
      else header.objective = value;
    }
  }
  return header;
}

/** El título del documento, sin marcas: lo que dice de qué va el encargo. */
export function docTitle(content: string): string {
  const heading = /^#\s+(.+)$/m.exec(content)?.[1];
  return heading ? heading.replace(/\*\*|__|`/g, "").trim() : "WORK.md";
}

/** Lo vivo: hasta el registro; en el formato anterior, todo menos la evidencia. */
function liveText(content: string): string {
  const lines = content.split(/\r?\n/);
  const heading = (titles: string[]) => (line: string) => titles.some((title) => line.trim().toLowerCase() === `## ${title.toLowerCase()}`);
  const log = lines.findIndex(heading(LOG_TITLES));
  if (log >= 0) return lines.slice(0, log).join("\n").trim();
  const evidence = lines.findIndex(heading(LEGACY_LOG_TITLES));
  if (evidence < 0) return content.trim();
  let end = evidence + 1;
  while (end < lines.length && !/^#{1,2}\s+/.test(lines[end] ?? "")) end++;
  return [...lines.slice(0, evidence), ...lines.slice(end)].join("\n").trim();
}

export function parseWork(content: string): Work {
  const header = parseHeader(content);
  return {
    ...header,
    title: docTitle(content),
    authorization: header.authorization || section(content, "Autorización", "Authorization"),
    objective: header.objective || section(content, "Objetivo", "Goal", "Acuerdo confirmado", "Confirmed agreement"),
    next: header.next || section(content, "Siguiente paso", "Next step", "Pendiente", "Pending"),
    asks: section(content, "Pedidos", "Asks", "Criterios", "Criteria", "Criterios observables", "Acceptance criteria"),
    decisions: section(content, "Decisiones", "Decisions"),
    limits: section(content, "Límites", "Limits"),
    log: section(content, ...LOG_TITLES) || section(content, ...LEGACY_LOG_TITLES),
    live: liveText(content),
    tasks: parseTasks(content),
  };
}

/**
 * La tarea actual es la primera abierta tras la última hecha; si no queda
 * ninguna después, la primera abierta. Las abiertas anteriores van aparte, y
 * las que esperan a alguien también: ninguna de las dos es la actual.
 *
 * POR QUÉ -> «la primera sin marcar» dejaba el TODO clavado en una tarea del
 * propietario (puesta en servicio, prueba de dos semanas) mientras el trabajo
 * iba treinta tareas más abajo.
 */
export function focusOf(tasks: readonly WorkTask[]): Focus {
  const counted = tasks.filter((task) => task.state !== "dropped");
  const open = (task: WorkTask): boolean => task.state === "open";
  let lastDone = -1;
  tasks.forEach((task, position) => { if (task.state === "done") lastDone = position; });
  const current = tasks.slice(lastDone + 1).find(open) ?? tasks.find(open);
  return {
    current,
    behind: current ? tasks.filter((task) => open(task) && task.index < current.index) : [],
    waiting: tasks.filter((task) => task.state === "waiting"),
    done: counted.filter((task) => task.state === "done").length,
    total: counted.length,
  };
}

/** `T39 · Título — detalle. Blocked by: …` → `{ key: "T39", title: "Título" }`. */
export function taskParts(text: string): TaskParts {
  const clean = text.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
  const id = /^(T\d+[a-z]?)\s*·\s*(.*)$/i.exec(clean);
  const rest = id?.[2] ?? clean;
  const title = (rest.split(" — ")[0] ?? "").replace(/\s*Blocked by:.*$/i, "").replace(/\.$/, "").trim();
  return { key: id?.[1] ?? "", title: title || rest };
}

/** A qué espera una tarea en espera: lo que sigue a `— espera:`. */
export function waitingFor(text: string): string {
  return text.split(/\s—\s*(?:en espera|espera|waiting)\s*:/i)[1]?.trim() ?? "";
}

/** El nombre corto de una tarea: id y título, sin el detalle. */
export function taskLabel(text: string): string {
  const { key, title } = taskParts(text);
  return key ? `${key} · ${title}` : title;
}

/** La rama de un `.git/HEAD`; con HEAD suelto, ninguna. */
export function branchFromHead(head: string): string | null {
  return /^ref:\s*refs\/heads\/(.+)$/m.exec(head)?.[1]?.trim() ?? null;
}

/**
 * El documento activo: el abierto de la rama actual (el más reciente si hay
 * varios); si ninguno es suyo, el WORK.md de la raíz; si no, el único abierto
 * que no esté en espera. Con varios y ninguno de la rama no se adivina.
 */
export function chooseWorkDoc(candidates: readonly WorkCandidate[], branch: string | null, legacy: string | null): string | null {
  const open = candidates.filter((candidate) => candidate.status !== "closed");
  const mine = branch ? open.filter((candidate) => candidate.branch === branch).map((candidate) => candidate.path).sort() : [];
  if (mine.length > 0) return mine[mine.length - 1] ?? null;
  if (legacy) return legacy;
  const active = open.filter((candidate) => candidate.status !== "waiting");
  return active.length === 1 ? (active[0]?.path ?? null) : null;
}
