// =============================================================================
// [UI] RECIBOS DE HERRAMIENTA
// Una llamada, una línea: verbo, objeto y lo que salió. Es la regla de Ein
// para sus tools, extendida a todas las de la sesión.
//
// POR QUÉ -> el texto de una herramienta tiene dos públicos: el modelo, que
// necesita el resultado íntegro, y la persona, que necesita saber qué pasó.
// El recibo solo decide lo que se pinta; el contenido llega entero al modelo y
// el detalle nativo de Pi sigue a un Ctrl+O o un clic.
//
// Módulo puro: entra la llamada, sale texto. Sin Pi ni pi-tui, para probarlo con Bun.
// =============================================================================

import { homedir } from "node:os";
import { basename, dirname, isAbsolute, relative } from "node:path";

export type Receipt = { label: string; target: string };
export type Outcome = { meta: string; bad: boolean };
export type ToolResultLike = { content?: unknown; details?: unknown; isError?: boolean };

/** Gramática de STYLE: lo pendiente apagado, el foco con ▸, lo comprobado con ✓ y lo fallido con ×. */
export const GLYPH = { running: "▸", done: "✓", failed: "×", sep: "·" } as const;
export const LABEL_WIDTH = 9;

const TEAM_STATUS: Record<string, string> = {
  queued: "en cola",
  running: "trabajando",
  ready: "listo para integrar",
  blocked: "bloqueado",
  stopped: "detenido",
  failed: "falló",
  interrupted: "por recuperar",
  integrated: "integrado",
  complete: "investigación terminada",
};

const TEAM_ACTION: Record<string, string> = {
  start: "arranca",
  status: "estado",
  stop: "detiene",
  resume: "reanuda",
  steer: "orienta",
  integrate: "integra",
  limit: "límite",
  view: "vista",
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Una sola línea imprimible: el recibo nunca rompe la fila ni arrastra escapes de terminal. */
export function oneLine(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function clip(text: string, room: number): string {
  const chars = [...text];
  if (room <= 0) return "";
  return chars.length <= room ? text : chars.slice(0, Math.max(0, room - 1)).join("") + "…";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function shortPath(path: string, cwd: string): string {
  if (!path) return "";
  const absolute = isAbsolute(path);
  const inside = absolute && cwd ? relative(cwd, path) : path;
  if (absolute && inside && !inside.startsWith("..") && !isAbsolute(inside)) return inside;
  const home = homedir();
  return absolute && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

export function resultText(result: ToolResultLike | undefined): string {
  if (!result || !Array.isArray(result.content)) return "";
  return result.content.map((part) => str(record(part).text)).filter(Boolean).join("\n");
}

function lineCount(text: string): number {
  const trimmed = text.replace(/\n+$/, "");
  return trimmed ? trimmed.split("\n").length : 0;
}

function lastLine(text: string): string {
  return oneLine(text.trim().split("\n").filter((line) => line.trim()).at(-1) ?? "");
}

function humanName(tool: string): string {
  return tool.replace(/^mcp__/, "").replace(/__/g, " · ").replace(/_/g, " ");
}

function firstText(args: Record<string, unknown>): string {
  return Object.values(args).find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
}

/** Verbo y objeto de la llamada. Funciona con argumentos a medio llegar. */
export function receiptFor(tool: string, rawArgs: unknown, cwd = ""): Receipt {
  const args = record(rawArgs);
  const path = shortPath(str(args.file_path) || str(args.path), cwd);
  switch (tool) {
    case "read": {
      if (basename(path) === "SKILL.md") return { label: "skill", target: basename(dirname(path)) || path };
      const offset = typeof args.offset === "number" ? args.offset : undefined;
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      const range = offset !== undefined || limit !== undefined
        ? `:${offset ?? 1}${limit !== undefined ? `-${(offset ?? 1) + limit - 1}` : ""}`
        : "";
      return { label: "lee", target: path + range };
    }
    case "bash":
    case "powershell":
      return { label: "ejecuta", target: oneLine(str(args.command)) };
    case "edit":
      return { label: "edita", target: path };
    case "write":
      return { label: "escribe", target: path };
    case "grep":
      return { label: "busca", target: [oneLine(str(args.pattern)), path || str(args.glob)].filter(Boolean).join(" en ") };
    case "find":
      return { label: "localiza", target: [oneLine(str(args.pattern)), path].filter(Boolean).join(" en ") };
    case "ls":
      return { label: "lista", target: path || "." };
    case "codegraph_explore":
      return { label: "explora", target: oneLine(str(args.query)) };
    case "nein_set_task":
      return { label: "encargo", target: str(args.clase) };
    case "nein_escalate":
      return { label: "escala", target: oneLine(str(args.reason)) };
    case "nein_handoff":
      return { label: "relevo", target: `a ${str(args.destination) || "claude"}` };
    case "nein_team": {
      const action = str(args.action);
      const tasks = Array.isArray(args.tasks) ? args.tasks.map((task) => oneLine(str(record(task).label))).filter(Boolean) : [];
      const verb = TEAM_ACTION[action] ?? action;
      const object = tasks.length ? tasks.join(` ${GLYPH.sep} `) : action === "limit" && typeof args.limit === "number" ? String(args.limit) : "";
      return { label: "equipo", target: [verb, object].filter(Boolean).join(" ") };
    }
    default:
      return { label: clip(humanName(tool), LABEL_WIDTH - 1), target: oneLine(firstText(args)) };
  }
}

function teamOutcome(text: string, bad: boolean): Outcome {
  try {
    const rows = JSON.parse(text);
    if (Array.isArray(rows) && rows.length) {
      const states = [...new Set(rows.map((row) => TEAM_STATUS[str(record(row).status)] ?? "estado desconocido"))];
      const labels = rows.map((row) => oneLine(str(record(row).label))).filter(Boolean);
      const who = rows.length === 1 && labels[0] ? `${labels[0]} ${GLYPH.sep} ` : rows.length > 1 ? `${plural(rows.length, "tarea", "tareas")} ${GLYPH.sep} ` : "";
      return { meta: who + states.join(", "), bad };
    }
  } catch {
    // El equipo también contesta en texto llano (límite, errores): se resume por su última línea.
  }
  return { meta: lastLine(text) || (bad ? "falló" : "hecho"), bad };
}

/** Lo que salió, en pocas palabras. Las herramientas propias contestan al modelo en inglés: aquí se resumen en castellano. */
export function outcomeFor(tool: string, rawArgs: unknown, result: ToolResultLike): Outcome {
  const args = record(rawArgs);
  const details = record(result.details);
  const text = resultText(result);
  const bad = result.isError === true;
  if (bad && !tool.startsWith("nein_")) {
    const exit = text.match(/exited with code (\d+)/i);
    return { meta: exit ? `salió con código ${exit[1]}` : lastLine(text) || "falló", bad };
  }
  switch (tool) {
    case "read": {
      if (basename(str(args.file_path) || str(args.path)) === "SKILL.md") return { meta: "cargada", bad };
      if (Array.isArray(result.content) && result.content.some((part) => record(part).type === "image")) return { meta: "imagen", bad };
      const lines = lineCount(text);
      return { meta: record(details.truncation).truncated ? `${plural(lines, "línea", "líneas")} ${GLYPH.sep} recortado` : plural(lines, "línea", "líneas"), bad };
    }
    case "bash":
    case "powershell": {
      const lines = lineCount(text.replace(/\n\n\[[^\n]*\]$/, ""));
      return { meta: lines ? plural(lines, "línea", "líneas") : "sin salida", bad };
    }
    case "edit": {
      const diff = str(details.diff).split("\n");
      const added = diff.filter((line) => /^\+(?!\+\+)/.test(line)).length;
      const removed = diff.filter((line) => /^-(?!--)/.test(line)).length;
      return { meta: added || removed ? `+${added} −${removed}` : "editado", bad };
    }
    case "write":
      return { meta: plural(lineCount(str(args.content)), "línea", "líneas"), bad };
    case "grep":
    case "find":
    case "ls": {
      if (/^No (matches|files) found/i.test(text.trim()) || !text.trim()) return { meta: "sin resultados", bad };
      return { meta: plural(text.trim().split("\n").filter((line) => line.trim()).length, "resultado", "resultados"), bad };
    }
    case "codegraph_explore": {
      if (text.startsWith("[ERR]")) return { meta: "índice no disponible", bad: true };
      const found = text.match(/Found (\d+) symbols? across (\d+) files?/);
      return { meta: found ? `${plural(Number(found[1]), "símbolo", "símbolos")} ${GLYPH.sep} ${plural(Number(found[2]), "archivo", "archivos")}` : "explorado", bad };
    }
    case "nein_set_task":
    case "nein_escalate":
      if (bad) return { meta: /manual/i.test(text) ? "modelo manual: se mantiene" : "sin cambio", bad: !/manual/i.test(text) };
      return { meta: tool === "nein_escalate" ? "riesgo desde la próxima petición" : "desde la próxima petición", bad };
    case "nein_handoff":
      return bad ? { meta: "no preparado", bad } : { meta: "al terminar esta respuesta", bad };
    case "nein_team":
      return teamOutcome(text, bad);
    default:
      return { meta: bad ? lastLine(text) || "falló" : "hecho", bad };
  }
}

export type Paint = (token: "accent" | "success" | "error" | "text" | "muted" | "dim", text: string) => string;

/**
 * Fila del recibo: `▸ verbo    objeto  · lo que salió`. El objeto es lo que se
 * recorta: el verbo y el resultado son lo que se lee de un vistazo.
 */
export function receiptLine(receipt: Receipt, outcome: Outcome | undefined, width: number, paint: Paint): string {
  const glyph = !outcome
    ? paint("accent", GLYPH.running)
    : outcome.bad ? paint("error", GLYPH.failed) : paint("dim", GLYPH.done);
  const label = receipt.label.padEnd(LABEL_WIDTH - 1);
  const meta = outcome?.meta ? `  ${GLYPH.sep} ${outcome.meta}` : "";
  const fixed = 1 + 2 + LABEL_WIDTH;
  const metaRoom = Math.max(0, Math.min([...meta].length, width - fixed - 12));
  const metaShown = clip(meta, metaRoom);
  const target = clip(receipt.target, width - fixed - [...metaShown].length);
  const tone = outcome?.bad ? "error" : "dim";
  return ` ${glyph} ${paint("text", label)} ${paint("muted", target)}${paint(tone, metaShown)}`;
}
