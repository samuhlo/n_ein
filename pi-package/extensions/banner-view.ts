// =============================================================================
// [UI] BANNER DE ARRANQUE — vista
// El Panel abre la sesión y debajo entra el estado en cascada, como en Ein:
// primero lo que cambia entre arranques (rama, cambios, tarea), después lo
// estable (modelos). Sin marco: el aire separa y la columna alinea.
// Módulo puro: entra el estado, el instante y el ancho; salen líneas.
// =============================================================================

import { COLORS, INTRO_SECONDS, LARGE_WIDTH, heading, panelLarge, visible, wordmark, type Painter } from "./brand.ts";

export type BannerData = {
  channel: string;
  version: string;
  piVersion: string;
  cwd: string;
  /** undefined mientras Git no ha contestado: la fila espera en vez de inventar. */
  git?: { branch: string; changes: string };
  index: string;
  todo?: { current?: string; done: number; total: number };
  /** El principal y el modelo de cada clase de encargo; abierto solo si difiere de riesgo. */
  models: { principal: string; mecanico: string; ordinario: string; riesgo: string; abierto?: string; claude: string };
};

const BLOCK = 58;
const LABEL = 15;
const CASCADE_START = 0.3;
const CASCADE_STEP = 0.04;

function clip(text: string, room: number): string {
  const chars = [...text];
  return chars.length <= room ? text : chars.slice(0, Math.max(0, room - 1)).join("") + "…";
}

function statusRows(p: Painter, data: BannerData, room: number, compact = false): string[] {
  // En compacto se quitan los respiros: el estado entero vale más que el aire.
  const gap = compact ? [] : [""];
  const field = (label: string, value: string, tone = COLORS.concrete) =>
    `${p.fg(COLORS.muted, label.padEnd(LABEL))}${p.fg(tone, clip(value, room - LABEL))}`;
  const rows = [heading(p, 1, "PROYECTO"), ...gap];
  rows.push(data.git
    ? field("rama", `${data.git.branch} · ${data.git.changes}`)
    : field("rama", "consultando Git…", COLORS.faint));
  rows.push(field("índice", data.index));
  rows.push(field("ruta", data.cwd, COLORS.faint));
  if (data.todo) {
    rows.push(...gap, heading(p, 2, "TRABAJO"), ...gap);
    const counter = p.fg(COLORS.structure, `${data.todo.done}/${data.todo.total}`);
    rows.push(data.todo.current
      ? `${p.fg(COLORS.yellow, "▸")} ${p.fg(COLORS.concrete, clip(data.todo.current, room - 10))}  ${counter}`
      : `${p.fg(COLORS.structure, "✓")} ${p.fg(COLORS.muted, "tareas de WORK.md hechas")}  ${counter}`);
  }
  rows.push(...gap, heading(p, data.todo ? 3 : 2, "MODELOS"), ...gap);
  rows.push(field("principal", data.models.principal));
  rows.push(field("mecánico", data.models.mecanico));
  rows.push(field("ordinario", data.models.ordinario));
  rows.push(field("riesgo", data.models.riesgo));
  if (data.models.abierto) rows.push(field("abierto", data.models.abierto));
  rows.push(field("claude", data.models.claude));
  rows.push(...gap, p.fg(COLORS.concrete, clip("Cuéntame qué necesitas o di «ayúdame a pensarlo».", room)));
  rows.push(p.fg(COLORS.faint, clip("Modelos: /nein:models · detalle de herramientas: ctrl+o", room)));
  return rows;
}

/** Duración total de la apertura: Panel asentado y cascada del estado completa. */
export function bannerSeconds(data: BannerData, p: Painter): number {
  return Math.max(INTRO_SECONDS, CASCADE_START + statusRows(p, data, BLOCK).length * CASCADE_STEP) + 0.1;
}

// Por debajo de estas filas el Panel se iría por arriba de la pantalla: cede al wordmark, como el modo mínimo de Ein.
export const FULL_BANNER_ROWS = 36;

export function renderBanner(p: Painter, data: BannerData, t: number, width: number, rows = 0): string[] {
  const compact = rows > 0 && rows < FULL_BANNER_ROWS;
  const block = Math.min(BLOCK, Math.max(20, width - 2));
  const margin = " ".repeat(Math.max(0, Math.floor((width - block) / 2)));
  const centered = (text: string) => margin + " ".repeat(Math.max(0, Math.floor((block - visible(text)) / 2))) + text;
  const out = [""];
  // La marca cede por ancho: un Panel cortado no es un Panel, así que en estrecho queda el wordmark.
  if (width >= LARGE_WIDTH + 4 && !compact) {
    for (const line of panelLarge(p, t)) out.push(line ? centered(line) : "");
  } else {
    out.push(centered(wordmark(p)));
  }
  out.push("");
  const settled = t >= INTRO_SECONDS;
  out.push(settled ? centered(p.fg(COLORS.faint, "no hace falta tanto")) : "");
  const tag = `${data.channel} · ${data.version} · pi ${data.piVersion}`;
  out.push(settled ? centered(p.fg(COLORS.muted, clip(tag, block))) : "", "");
  statusRows(p, data, block, compact).forEach((row, index) => {
    out.push(t >= CASCADE_START + index * CASCADE_STEP ? margin + row : "");
  });
  out.push("");
  return out;
}
