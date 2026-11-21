// =============================================================================
// [DATA] DOCUMENTO DE TRABAJO
// Las casillas markdown son la fuente de verdad del TODO, dentro y fuera de Pi.
// =============================================================================

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { docTitle, parseTasks, TASKS_HEADING, type TodoView, type WorkTask } from "../claude-plugin/hooks/todo-core.ts";

export type { WorkTask };
export type WorkDoc = { path: string; tasks: WorkTask[] };

function projectRoot(cwd: string): string {
  let dir = resolve(cwd);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(cwd);
    dir = parent;
  }
}

export function resolveWorkDoc(cwd: string, configured = process.env.N_EIN_WORK_DOC): string | null {
  const path = configured
    ? isAbsolute(configured) ? configured : resolve(cwd, configured)
    : join(projectRoot(cwd), "WORK.md");
  return existsSync(path) && statSync(path).isFile() ? path : null;
}

export function readWorkDoc(path: string): WorkDoc {
  return { path, tasks: parseTasks(readFileSync(path, "utf8")) };
}

/** Lo que dibuja el TODO: el título del encargo y sus casillas. */
export function readTodoView(path: string): TodoView {
  const content = readFileSync(path, "utf8");
  return { title: docTitle(content), tasks: parseTasks(content) };
}

export function markWorkTask(path: string, index: number): WorkDoc {
  const content = readFileSync(path, "utf8");
  const task = parseTasks(content).find((item) => item.index === index);
  if (!task) throw new Error(`No existe la tarea ${index}.`);
  if (task.done) return readWorkDoc(path);
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  lines[task.line] = lines[task.line].replace(/^(\s*[-*]\s+\[) (\]\s+)/, "$1x$2");
  writeFileSync(path, lines.join(newline));
  return readWorkDoc(path);
}

export function addWorkTask(path: string, description: string): WorkDoc {
  const task = description.replace(/\s+/g, " ").trim();
  if (!task) throw new Error("La tarea no puede estar vacía.");
  const content = readFileSync(path, "utf8");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => TASKS_HEADING.test(line));
  if (start < 0) {
    const separator = content.endsWith(newline) ? newline : newline + newline;
    // WORK.md sigue el idioma de los artefactos: la sección nueva usa el de los títulos que ya tenga.
    const heading = /^##\s+(Goal|Decisions|Criteria|Evidence)\s*$/im.test(content) ? "Tasks" : "Tareas";
    writeFileSync(path, `${content}${separator}## ${heading}${newline}${newline}- [ ] ${task}${newline}`);
  } else {
    let end = start + 1;
    while (end < lines.length && !/^#{1,2}\s+/.test(lines[end])) end++;
    while (end > start + 1 && lines[end - 1] === "") end--;
    lines.splice(end, 0, `- [ ] ${task}`);
    writeFileSync(path, lines.join(newline));
  }
  return readWorkDoc(path);
}
