// =============================================================================
// [CORE] NÚCLEO DEL TODO
// Las casillas de WORK.md como tareas, cuál toca ahora y cómo se nombra cada
// una. Lo comparten el widget de Pi, la barra y la franja de Claude y el banner;
// el launcher en Go repite la misma regla contra tests/fixtures/work-focus.md.
//
// POR QUÉ -> el plugin de Claude corre sin Node: este módulo no importa nada,
// recibe el texto del documento y devuelve datos.
// =============================================================================

export type WorkTask = { index: number; line: number; done: boolean; text: string };
export type TaskParts = { key: string; title: string };
export type Focus = { current?: WorkTask; behind: WorkTask[]; done: number; total: number };

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
