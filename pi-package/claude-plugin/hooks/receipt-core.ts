// =============================================================================
// [UI] NÚCLEO DE LOS RECIBOS
// La gramática de una fila de recibo, compartida por Pi y por el plugin de
// Claude Code: glifos, recortes y el orden `▸ verbo    objeto  · lo que salió`.
//
// POR QUÉ -> el plugin de Claude corre sin Node ni DOM. Este módulo no importa
// nada, así que los dos runtimes pintan la misma fila desde el mismo código.
// =============================================================================

export type Receipt = { label: string; target: string };
export type Outcome = { meta: string; bad: boolean };
export type Tone = "accent" | "success" | "error" | "text" | "muted" | "dim";
export type Paint = (token: Tone, text: string) => string;
export type Segment = { tone: Tone; text: string };

/** Gramática de STYLE: lo pendiente apagado, el foco con ▸, lo comprobado con ✓ y lo fallido con ×. */
export const GLYPH = { running: "▸", done: "✓", failed: "×", sep: "·" } as const;
export const LABEL_WIDTH = 9;

// Secuencias CSI, OSC y escapes de un carácter: lo que una salida de terminal puede arrastrar.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Una sola línea imprimible: el recibo nunca rompe la fila ni arrastra escapes de terminal. */
export function oneLine(text: string): string {
  return text.replace(ANSI, "").replace(/[\x00-\x1f\x7f-\x9f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function clip(text: string, room: number): string {
  const chars = [...text];
  if (room <= 0) return "";
  return chars.length <= room ? text : chars.slice(0, Math.max(0, room - 1)).join("") + "…";
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function lineCount(text: string): number {
  const trimmed = text.replace(/\n+$/, "");
  return trimmed ? trimmed.split("\n").length : 0;
}

export function lastLine(text: string): string {
  return oneLine(text.trim().split("\n").filter((line) => line.trim()).at(-1) ?? "");
}

export function humanName(tool: string): string {
  return tool.replace(/^mcp__/, "").replace(/__/g, " · ").replace(/_/g, " ");
}

export function firstText(args: Record<string, unknown>): string {
  return Object.values(args).find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
}

export function baseName(path: string): string {
  return path.replace(/\/+$/, "").split("/").at(-1) ?? "";
}

export function dirName(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") || "/" : ".";
}

/** Ruta relativa al proyecto si cae dentro; si no, con `~` para la carpeta personal. */
export function shortPath(path: string, cwd: string, home = ""): string {
  if (!path) return "";
  if (!path.startsWith("/")) return path;
  const root = cwd.replace(/\/+$/, "");
  if (root && path.startsWith(root + "/")) return path.slice(root.length + 1);
  const base = home.replace(/\/+$/, "");
  return base && (path === base || path.startsWith(base + "/")) ? `~${path.slice(base.length)}` : path;
}

/** Recuento de líneas de un diff unificado, sin contar las cabeceras `+++`/`---`. */
export function diffCount(lines: readonly string[]): string {
  const added = lines.filter((line) => /^\+(?!\+\+)/.test(line)).length;
  const removed = lines.filter((line) => /^-(?!--)/.test(line)).length;
  return added || removed ? `+${added} −${removed}` : "";
}

/**
 * Trozos de la fila con su tono. El objeto es lo que se recorta: el verbo y el
 * resultado son lo que se lee de un vistazo.
 */
export function receiptSegments(receipt: Receipt, outcome: Outcome | undefined, width: number): Segment[] {
  const glyph: Segment = !outcome
    ? { tone: "accent", text: GLYPH.running }
    : outcome.bad ? { tone: "error", text: GLYPH.failed } : { tone: "dim", text: GLYPH.done };
  const label = clip(oneLine(receipt.label), LABEL_WIDTH - 1).padEnd(LABEL_WIDTH - 1);
  const meta = outcome?.meta ? `  ${GLYPH.sep} ${oneLine(outcome.meta)}` : "";
  const fixed = 1 + 2 + LABEL_WIDTH;
  const metaRoom = Math.max(0, Math.min([...meta].length, width - fixed - 12));
  const metaShown = clip(meta, metaRoom);
  const target = clip(oneLine(receipt.target), width - fixed - [...metaShown].length);
  return [
    { tone: "text", text: " " },
    glyph,
    { tone: "text", text: ` ${label} ` },
    { tone: "muted", text: target },
    { tone: outcome?.bad ? "error" : "dim", text: metaShown },
  ];
}

export function receiptLine(receipt: Receipt, outcome: Outcome | undefined, width: number, paint: Paint): string {
  return receiptSegments(receipt, outcome, width).map((part) => paint(part.tone, part.text)).join("");
}
