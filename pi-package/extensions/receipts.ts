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
import {
  baseName, clip, diffCount, dirName, firstText, GLYPH, humanName, LABEL_WIDTH, lastLine, lineCount, oneLine, plural, record,
  shortPath as corePath, str, type Outcome, type Receipt,
} from "../claude-plugin/hooks/receipt-core.ts";

export { clip, GLYPH, LABEL_WIDTH, oneLine, receiptLine, type Outcome, type Paint, type Receipt } from "../claude-plugin/hooks/receipt-core.ts";
export type ToolResultLike = { content?: unknown; details?: unknown; isError?: boolean };

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

/** La ruta como la lee la persona: relativa al proyecto, o con `~` fuera de él. */
export function shortPath(path: string, cwd: string): string {
  return corePath(path, cwd, homedir());
}

export function resultText(result: ToolResultLike | undefined): string {
  if (!result || !Array.isArray(result.content)) return "";
  return result.content.map((part) => str(record(part).text)).filter(Boolean).join("\n");
}

/** Verbo y objeto de la llamada. Funciona con argumentos a medio llegar. */
export function receiptFor(tool: string, rawArgs: unknown, cwd = ""): Receipt {
  const args = record(rawArgs);
  const path = shortPath(str(args.file_path) || str(args.path), cwd);
  switch (tool) {
    case "read": {
      if (baseName(path) === "SKILL.md") return { label: "skill", target: baseName(dirName(path)) || path };
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
      if (baseName(str(args.file_path) || str(args.path)) === "SKILL.md") return { meta: "cargada", bad };
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
      return { meta: diffCount(str(details.diff).split("\n")) || "editado", bad };
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
