// =============================================================================
// [UI] RECIBOS PARA LAS HERRAMIENTAS DE CLAUDE CODE
// Traduce cada llamada de Claude (`Bash`, `Read`, `Edit`…) y su resultado al
// recibo de n_ein. La fila la compone receipt-core.ts, la misma que en Pi.
//
// Módulo puro: entra la llamada como la ve el hook, sale un recibo. Bun lo
// prueba sin el motor de Claude.
// =============================================================================

import {
  baseName, diffCount, dirName, firstText, GLYPH, humanName, LABEL_WIDTH, clip, lineCount, oneLine, plural, record, shortPath, str,
  type Outcome, type Receipt,
} from "./receipt-core.ts";

export type Place = { cwd: string; home: string };

/** Herramientas cuyo resultado es la conversación misma: se dejan como las dibuja Claude. */
export const NATIVE_TOOLS: ReadonlySet<string> = new Set(["AskUserQuestion", "ExitPlanMode", "EnterPlanMode"]);

const CODEGRAPH = /(^|__)codegraph_explore$/;

/** El texto de una salida que no tiene forma conocida: cadena, bloques MCP o `{ content }`. */
export function outputText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((part) => typeof part === "string" ? part : str(record(part).text)).filter(Boolean).join("\n");
  const content = record(output).content;
  return Array.isArray(content) || typeof content === "string" ? outputText(content) : "";
}

function hostAndPath(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Verbo y objeto de la llamada. Funciona con la entrada a medio llegar. */
export function receiptFor(tool: string, rawInput: unknown, place: Place): Receipt {
  const input = record(rawInput);
  const path = shortPath(str(input.file_path) || str(input.notebook_path) || str(input.path), place.cwd, place.home);
  switch (tool) {
    case "Read": {
      if (baseName(path) === "SKILL.md") return { label: "skill", target: baseName(dirName(path)) || path };
      const offset = typeof input.offset === "number" ? input.offset : undefined;
      const limit = typeof input.limit === "number" ? input.limit : undefined;
      const range = offset !== undefined || limit !== undefined
        ? `:${offset ?? 1}${limit !== undefined ? `-${(offset ?? 1) + limit - 1}` : ""}`
        : str(input.pages) ? ` p. ${str(input.pages)}` : "";
      return { label: "lee", target: path + range };
    }
    case "Bash":
    case "PowerShell":
      return { label: "ejecuta", target: oneLine(str(input.command)) };
    case "Edit":
    case "NotebookEdit":
      return { label: "edita", target: path };
    case "Write":
      return { label: "escribe", target: path };
    case "Grep":
      return { label: "busca", target: [oneLine(str(input.pattern)), path || str(input.glob)].filter(Boolean).join(" en ") };
    case "Glob":
      return { label: "localiza", target: [oneLine(str(input.pattern)), path].filter(Boolean).join(" en ") };
    case "Skill":
      return { label: "skill", target: str(input.skill) };
    case "TodoWrite": {
      const todos = Array.isArray(input.todos) ? input.todos.map(record) : [];
      const current = todos.find((todo) => todo.status === "in_progress");
      return { label: "tareas", target: oneLine(str(current?.activeForm) || str(current?.content)) };
    }
    case "ToolSearch":
      return { label: "carga", target: oneLine(str(input.query)) };
    case "WebFetch":
      return { label: "consulta", target: hostAndPath(str(input.url)) };
    case "WebSearch":
      return { label: "busca web", target: oneLine(str(input.query)) };
    case "Agent":
      return { label: "agente", target: oneLine(str(input.description)) };
    default:
      if (CODEGRAPH.test(tool)) return { label: "explora", target: oneLine(str(input.query)) };
      return { label: clip(humanName(tool), LABEL_WIDTH - 1), target: oneLine(firstText(input)) };
  }
}

function patchCount(patch: unknown): string {
  return Array.isArray(patch) ? diffCount(patch.flatMap((hunk) => {
    const lines = record(hunk).lines;
    return Array.isArray(lines) ? lines.filter((line): line is string => typeof line === "string") : [];
  })) : "";
}

/** Por qué falló, en pocas palabras: el código de salida, un rechazo o la primera línea. */
function failure(text: string): string {
  const exit = text.match(/exit code (\d+)/i);
  if (exit) return `salió con código ${exit[1]}`;
  if (/doesn't want to proceed|rejected|denied|permission/i.test(text)) return "rechazado";
  return oneLine(text.trim().split("\n").find((line) => line.trim()) ?? "") || "falló";
}

export type CallState = { isRunning: boolean; isErrored: boolean; isInterrupted: boolean; output?: unknown };

/** Lo que salió, en pocas palabras. Mientras corre no hay resultado: la fila lleva `▸`. */
export function outcomeFor(tool: string, rawInput: unknown, call: CallState): Outcome | undefined {
  if (call.isInterrupted) return { meta: "interrumpido", bad: true };
  if (call.isRunning || call.output === undefined) return call.isErrored ? { meta: "falló", bad: true } : undefined;
  if (call.isErrored) return { meta: failure(outputText(call.output)), bad: true };
  const input = record(rawInput);
  const output = record(call.output);
  switch (tool) {
    case "Read": {
      const file = record(output.file);
      if (output.type === "image") return { meta: "imagen", bad: false };
      if (output.type === "pdf" || output.type === "parts") return { meta: "pdf", bad: false };
      if (output.type === "file_unchanged") return { meta: "sin cambios desde la última lectura", bad: false };
      if (output.type === "notebook") return { meta: plural(Array.isArray(file.cells) ? file.cells.length : 0, "celda", "celdas"), bad: false };
      if (baseName(str(input.file_path)) === "SKILL.md") return { meta: "cargada", bad: false };
      const lines = typeof file.numLines === "number" ? file.numLines : lineCount(str(file.content));
      return { meta: plural(lines, "línea", "líneas") + (file.truncatedByTokenCap ? ` ${GLYPH.sep} recortado` : ""), bad: false };
    }
    case "Bash":
    case "PowerShell": {
      if (str(output.backgroundTaskId)) return { meta: "en segundo plano", bad: false };
      const git = record(output.gitOperation);
      const commit = record(git.commit), pr = record(git.pr), push = record(git.push);
      if (typeof pr.number === "number") return { meta: `PR #${pr.number} ${str(pr.action)}`.trim(), bad: false };
      if (str(commit.sha)) return { meta: `commit ${str(commit.sha).slice(0, 7)}`, bad: false };
      if (str(push.branch)) return { meta: `push a ${str(push.branch)}`, bad: false };
      if (output.interrupted === true) return { meta: "interrumpido", bad: true };
      const lines = lineCount(str(output.stdout)) + lineCount(str(output.stderr));
      return { meta: lines ? plural(lines, "línea", "líneas") : "sin salida", bad: false };
    }
    case "Edit":
    case "NotebookEdit":
      return { meta: patchCount(output.structuredPatch) || "editado", bad: false };
    case "Write":
      return output.type === "create"
        ? { meta: `nuevo ${GLYPH.sep} ${plural(lineCount(str(input.content)), "línea", "líneas")}`, bad: false }
        : { meta: patchCount(output.structuredPatch) || "reescrito", bad: false };
    case "Skill":
      return { meta: "cargada", bad: false };
    case "TodoWrite": {
      const todos = Array.isArray(output.newTodos) ? output.newTodos.map(record) : [];
      return { meta: `${todos.filter((todo) => todo.status === "completed").length}/${todos.length}`, bad: false };
    }
    case "ToolSearch":
      return { meta: plural(Array.isArray(output.matches) ? output.matches.length : 0, "herramienta", "herramientas"), bad: false };
    case "WebFetch":
      return { meta: typeof output.code === "number" ? `${output.code} ${str(output.codeText)}`.trim() : "hecho", bad: typeof output.code === "number" && output.code >= 400 };
    case "WebSearch": {
      const results = Array.isArray(output.results) ? output.results.flatMap((entry) => {
        const content = record(entry).content;
        return Array.isArray(content) ? content : [];
      }) : [];
      return { meta: results.length ? plural(results.length, "resultado", "resultados") : "sin resultados", bad: false };
    }
    case "Grep":
    case "Glob": {
      const count = typeof output.numFiles === "number" ? output.numFiles : typeof output.numMatches === "number" ? output.numMatches : undefined;
      if (count !== undefined) return { meta: count ? plural(count, "resultado", "resultados") : "sin resultados", bad: false };
      const text = outputText(call.output).trim();
      return { meta: text ? plural(text.split("\n").filter((line) => line.trim()).length, "resultado", "resultados") : "sin resultados", bad: false };
    }
    default: {
      if (CODEGRAPH.test(tool)) {
        const text = outputText(call.output);
        if (text.startsWith("[ERR]")) return { meta: "índice no disponible", bad: true };
        const found = text.match(/Found (\d+) symbols? across (\d+) files?/);
        return { meta: found ? `${plural(Number(found[1]), "símbolo", "símbolos")} ${GLYPH.sep} ${plural(Number(found[2]), "archivo", "archivos")}` : "explorado", bad: false };
      }
      return { meta: "hecho", bad: false };
    }
  }
}

/** El grupo plegado en una línea: `lee 3 · busca 2`, en el orden en que llegaron. */
export function groupSummary(calls: readonly { tool: string; input: unknown }[], place: Place): string {
  const counts = new Map<string, number>();
  for (const call of calls) {
    const verb = receiptFor(call.tool, call.input, place).label;
    counts.set(verb, (counts.get(verb) ?? 0) + 1);
  }
  return [...counts].map(([verb, count]) => `${verb} ${count}`).join(` ${GLYPH.sep} `);
}
