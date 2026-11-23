// =============================================================================
// [DATA] DOCUMENTO DE TRABAJO
// Las casillas markdown son la fuente de verdad del TODO, dentro y fuera de Pi.
// Cada encargo tiene su documento en docs/work/; el activo se elige por la rama
// (work-core.ts), y el WORK.md de la raíz sigue valiendo en proyectos anteriores.
// =============================================================================

import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { TodoView } from "../claude-plugin/hooks/todo-core.ts";
import { branchFromHead, chooseWorkDoc, docTitle, parseHeader, parseTasks, TASKS_HEADING, WORK_DIR, type WorkCandidate, type WorkTask } from "../claude-plugin/hooks/work-core.ts";

export type { WorkTask };
export type WorkDoc = { path: string; tasks: WorkTask[] };

// La cabecera vive en las primeras líneas: no hace falta leer el registro entero de cada encargo.
const HEADER_BYTES = 4096;

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function projectRoot(cwd: string): string {
  let dir = resolve(cwd);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(cwd);
    dir = parent;
  }
}

function readStart(path: string): string {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    return buffer.toString("utf8", 0, readSync(fd, buffer, 0, HEADER_BYTES, 0));
  } finally {
    closeSync(fd);
  }
}

/**
 * La rama de .git/HEAD, sin lanzar Git: esto corre tras cada herramienta.
 * En un worktree, .git es un archivo que apunta a su propio HEAD.
 */
function currentBranch(root: string): string | null {
  try {
    const dotgit = join(root, ".git");
    const gitdir = isFile(dotgit) ? resolve(root, /^gitdir:\s*(.+)$/m.exec(readFileSync(dotgit, "utf8"))?.[1]?.trim() ?? "") : dotgit;
    return branchFromHead(readFileSync(join(gitdir, "HEAD"), "utf8"));
  } catch {
    return null;
  }
}

function workCandidates(root: string): WorkCandidate[] {
  const dir = join(root, WORK_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const path = join(dir, entry.name);
      const { status, branch } = parseHeader(readStart(path));
      return { path, status, branch };
    });
}

export function resolveWorkDoc(cwd: string, configured = process.env.N_EIN_WORK_DOC): string | null {
  if (configured) {
    const path = isAbsolute(configured) ? configured : resolve(cwd, configured);
    return isFile(path) ? path : null;
  }
  const root = projectRoot(cwd);
  const legacy = join(root, "WORK.md");
  return chooseWorkDoc(workCandidates(root), currentBranch(root), isFile(legacy) ? legacy : null);
}

export function readWorkDoc(path: string): WorkDoc {
  return { path, tasks: parseTasks(readFileSync(path, "utf8")) };
}

/** Lo que dibuja el TODO: el título del encargo y sus casillas. */
export function readTodoView(path: string): TodoView {
  const content = readFileSync(path, "utf8");
  return { title: docTitle(content), tasks: parseTasks(content), bytes: Buffer.byteLength(content) };
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
