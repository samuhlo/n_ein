// =============================================================================
// [UI] TODO EN CLAUDE CODE
// El mismo bloque que Pi dibuja bajo su editor, en la franja sobre el prompt
// cuando la marca de apertura se retira. Debajo del prompt Claude solo deja la
// barra de estado, que se queda con la línea compacta (bin/n-ein-todo).
//
// POR QUÉ -> el plugin no tiene Node: lee el documento con $.fs y lo interpreta
// con work-core.ts y todo-core.ts, los mismos núcleos que usa Pi.
// =============================================================================

import { atom, read, update } from "claude-code";
import type { EngineInterface, RenderInput } from "claude-code";

import { todoRows, type TodoTone, type TodoView } from "./todo-core.ts";
import { branchFromHead, chooseWorkDoc, docTitle, parseHeader, parseTasks, WORK_DIR, type WorkCandidate } from "./work-core.ts";

const NO_TODO: TodoView | null = null;
const todo = atom({ plugin: "n-ein", key: "todo" } as const, NO_TODO);

/** El bloque cabe en la franja sin empujar la conversación: cabecera y cinco filas. */
const BAND_LINES = 6;
// Ediciones de fuera de la sesión (otra terminal, el editor) llegan con la siguiente pasada.
const RELOAD_MS = 30_000;
// Hex de la marca para el acento; claves del tema para el resto, que deben leerse en temas claros.
const TONE: Record<TodoTone, string> = { accent: "#FFCA40", text: "text", muted: "inactive", faint: "subtle", structure: "subtle" };

const parent = (dir: string): string => dir.replace(/\/[^/]+\/?$/, "") || "/";

/** La rama de .git/HEAD; en un worktree, .git es un archivo que apunta a su HEAD propio. */
async function headBranch($: EngineInterface, root: string): Promise<string | null> {
  try {
    const dotgit = `${root}/.git`;
    let gitdir = dotgit;
    if ((await $.fs.stat(dotgit)).kind === "file") {
      const target = /^gitdir:\s*(.+)$/m.exec(await $.fs.read(dotgit))?.[1]?.trim() ?? "";
      gitdir = target.startsWith("/") ? target : `${root}/${target}`;
    }
    return branchFromHead(await $.fs.read(`${gitdir}/HEAD`));
  } catch {
    return null;
  }
}

async function workCandidates($: EngineInterface, root: string): Promise<WorkCandidate[]> {
  const dir = `${root}/${WORK_DIR}`;
  if (!(await $.fs.exists(dir))) return [];
  const entries = (await $.fs.list(dir)).filter((entry) => entry.kind === "file" && entry.name.endsWith(".md"));
  return Promise.all(entries.map(async (entry) => {
    const path = `${dir}/${entry.name}`;
    const { status, branch } = parseHeader(await $.fs.read(path));
    return { path, status, branch };
  }));
}

/** Como resolveWorkDoc de work-doc.ts: N_EIN_WORK_DOC, o el documento de docs/work/ que elige la rama. */
async function workDocPath($: EngineInterface): Promise<string | null> {
  const cwd = await $.session.cwd();
  const configured = await $.env.get("N_EIN_WORK_DOC");
  if (configured) return configured.startsWith("/") ? configured : `${cwd}/${configured}`;
  let root = cwd;
  for (let dir = cwd; ; dir = parent(dir)) {
    if (await $.fs.exists(`${dir}/.git`)) { root = dir; break; }
    if (dir === "/") break;
  }
  const legacy = `${root}/WORK.md`;
  return chooseWorkDoc(await workCandidates($, root), await headBranch($, root), (await $.fs.exists(legacy)) ? legacy : null);
}

export async function reloadTodo($: EngineInterface): Promise<void> {
  let next: TodoView | null = null;
  try {
    const path = await workDocPath($);
    if (path && (await $.fs.exists(path))) {
      const content = await $.fs.read(path);
      const tasks = parseTasks(content);
      if (tasks.length) next = { title: docTitle(content), tasks };
    }
  } catch { /* Un documento ilegible deja la franja al motor; el trabajo sigue. */ }
  // Solo un cambio real redibuja la franja.
  await update($, todo, (current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
}

/** La franja sobre el prompt con el TODO; sin documento, o con una encuesta, se queda para el motor. */
export async function todoBand($: EngineInterface, e: RenderInput<"AbovePrompt">, phase?: string) {
  const view = await read($, todo);
  if (!view || e.props.hasSurvey) return null;
  const rows = todoRows(view, { width: e.props.bodyColumns, maxLines: Math.min(BAND_LINES, e.props.maxRows), phase });
  if (rows.length === 0) return null;
  const { Box, Text } = $.ui.resolve(e);
  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box flexDirection="row">
          {row.map((part) => <Text color={TONE[part.tone]}>{part.text}</Text>)}
        </Box>
      ))}
    </Box>
  );
}

let reloading: { cancel: () => void } | undefined;

/** Al abrir la sesión: primera lectura y pasada periódica. Lo llama el session.start de register.tsx. */
export async function startTodo($: EngineInterface): Promise<void> {
  await reloadTodo($);
  reloading?.cancel();
  reloading = $.clock.every(RELOAD_MS, () => { void reloadTodo($).catch(() => {}); });
}
