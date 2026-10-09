// =============================================================================
// [UI] MARCA EN PI
// La misma marca 004 Panel que launcher e instalador: palas que giran hasta
// asentarse en n_ein, con el `_` como único amarillo. La geometría vive en
// claude-plugin/hooks/brand-core.ts, compartida con Claude; port de go/internal/brand;
// tests/fixtures/panel-final.txt obliga a que los dos dibujen lo mismo.
// Módulo puro: sin Pi ni pi-tui, para probarlo con Bun.
// =============================================================================

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { panelCells, type BrandTone } from "../claude-plugin/hooks/brand-core.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function brandColors(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(resolve(packageRoot, "brand.json"), "utf8")).colors ?? {};
  } catch {
    return {};
  }
}

const base = brandColors();
// Los tres primeros vienen de brand.json; el resto es la escala de STYLE y los dos tonos de pala.
export const COLORS = {
  carbon: base.carbon ?? "#0B0B0B",
  concrete: base.concrete ?? "#FAF3F0",
  yellow: base.yellow ?? "#FFCA40",
  muted: "#9A9A9A",
  faint: "#5A5A5A",
  structure: "#3A3A3A",
  focusBand: "#1F1A0F",
  tileHigh: "#1A1A1A",
  tileLow: "#141414",
  tileCard: "#161616",
} as const;

export { INTRO_SECONDS, LARGE_HEIGHT, LARGE_WIDTH } from "../claude-plugin/hooks/brand-core.ts";

export type Painter = {
  color: boolean;
  fg(hex: string, text: string): string;
  bg(hex: string, text: string): string;
  bold(text: string): string;
};

export function painter(color = !("NO_COLOR" in process.env)): Painter {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(";");
  return {
    color,
    fg: (hex, text) => (color && text ? `\x1b[38;2;${rgb(hex)}m${text}\x1b[39m` : text),
    bg: (hex, text) => (color && text ? `\x1b[48;2;${rgb(hex)}m${text}\x1b[49m` : text),
    bold: (text) => (color && text ? `\x1b[1m${text}\x1b[22m` : text),
  };
}

export function heading(p: Painter, number: number, title: string): string {
  return `${p.fg(COLORS.yellow, "//")} ${p.fg(COLORS.structure, String(number).padStart(3, "0"))}  ${p.fg(COLORS.concrete, title)}`;
}

export function wordmark(p: Painter): string {
  return p.fg(COLORS.concrete, "n") + p.fg(COLORS.yellow, "_") + p.fg(COLORS.concrete, "ein");
}

const TONE: Record<BrandTone, string> = {
  concrete: COLORS.concrete,
  yellow: COLORS.yellow,
  muted: COLORS.muted,
  tileHigh: COLORS.tileHigh,
  tileLow: COLORS.tileLow,
};

/** Las seis filas del Panel grande en el instante t (segundos desde la apertura). */
export function panelLarge(p: Painter, t: number): string[] {
  return panelCells(t).map((row) => row.map((cell) => {
    if (!p.color || !cell.bg) return cell.glyph;
    return p.bg(TONE[cell.bg], cell.fg ? p.fg(TONE[cell.fg], cell.glyph) : cell.glyph);
  }).join("").replace(/ +$/, ""));
}

const ALPHABET = [..."abcdefghijklmnopqrstuvwxyz"];

/** Indicador de trabajo: una pala que sigue girando. */
export function flapIndicator(p: Painter, seconds: number): string {
  const letter = ALPHABET[Math.floor(seconds * 12) % ALPHABET.length];
  return p.color ? p.bg(COLORS.tileCard, p.fg(COLORS.yellow, letter)) : letter;
}

/** Ancho visible de un texto con secuencias ANSI de color (sin anchos dobles en nuestras marcas). */
export function visible(text: string): number {
  return [...text.replace(/\x1b\[[0-9;]*m/g, "")].length;
}
