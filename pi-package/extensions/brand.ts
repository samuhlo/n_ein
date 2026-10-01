// =============================================================================
// [UI] MARCA EN PI
// La misma marca 004 Panel que launcher e instalador: palas que giran hasta
// asentarse en n_ein, con el `_` como único amarillo. Port de go/internal/brand;
// tests/fixtures/panel-final.txt obliga a que los dos dibujen lo mismo.
// Módulo puro: sin Pi ni pi-tui, para probarlo con Bun.
// =============================================================================

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export const INTRO_SECONDS = 2.2;
export const LARGE_WIDTH = 39;
export const LARGE_HEIGHT = 6;

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

// Letras de 5 × 7 píxeles (la i mide 3); un píxel es una celda de ancho y media de alto.
const FONT: Record<string, string[]> = {
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  i: [".#.", "...", "##.", ".#.", ".#.", ".#.", "###"],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"],
};
const WORD = [..."n_ein"];
const FLAP_POOL = [..."aostrunei_"];
const ALPHABET = [..."abcdefghijklmnopqrstuvwxyz"];

// Mismo hash que Go y que el diseño: el giro es pseudoaleatorio pero determinista.
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function flap(k: number, t: number, pool: string[]): { visible: boolean; letter: string; settled: boolean } {
  if (t <= 0.1 + 0.06 * k) return { visible: false, letter: "", settled: false };
  if (t >= 0.55 + 0.3 * k) return { visible: true, letter: WORD[k], settled: true };
  return { visible: true, letter: pool[Math.floor(hash(k, Math.floor(t * 16), 5) * pool.length)], settled: false };
}

function letterColor(letter: string, settled: boolean): string {
  if (!settled) return COLORS.muted;
  return letter === "_" ? COLORS.yellow : COLORS.concrete;
}

type Cell = { top: boolean; bottom: boolean; bg: string; fg: string; tile: boolean };

/** Las seis filas del Panel grande en el instante t (segundos desde la apertura). */
export function panelLarge(p: Painter, t: number): string[] {
  const tile = 7, gap = 1, height = LARGE_HEIGHT;
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: LARGE_WIDTH }, () => ({ top: false, bottom: false, bg: "", fg: "", tile: false })));
  WORD.forEach((_, k) => {
    const state = flap(k, t, FLAP_POOL);
    if (!state.visible) return;
    const left = k * (tile + gap);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < tile; x++) grid[y][left + x] = { ...grid[y][left + x], tile: true, bg: y < height / 2 ? COLORS.tileHigh : COLORS.tileLow };
    }
    const glyph = FONT[state.letter];
    const offset = left + Math.floor((tile - glyph[0].length) / 2);
    const color = letterColor(state.letter, state.settled);
    glyph.forEach((row, gy) => [...row].forEach((pixel, gx) => {
      if (pixel !== "#") return;
      // La letra empieza dos píxeles por debajo del borde: queda centrada en la pala.
      const py = gy + 2;
      const cell = grid[Math.floor(py / 2)][offset + gx];
      cell.fg = color;
      if (py % 2 === 0) cell.top = true; else cell.bottom = true;
    }));
  });
  return grid.map((row) => row.map((cell) => {
    const glyph = cell.top && cell.bottom ? "█" : cell.top ? "▀" : cell.bottom ? "▄" : " ";
    if (!p.color || !cell.tile) return glyph;
    return p.bg(cell.bg, cell.fg ? p.fg(cell.fg, glyph) : glyph);
  }).join("").replace(/ +$/, ""));
}

/** Indicador de trabajo: una pala que sigue girando. */
export function flapIndicator(p: Painter, seconds: number): string {
  const letter = ALPHABET[Math.floor(seconds * 12) % ALPHABET.length];
  return p.color ? p.bg(COLORS.tileCard, p.fg(COLORS.yellow, letter)) : letter;
}

/** Ancho visible de un texto con secuencias ANSI de color (sin anchos dobles en nuestras marcas). */
export function visible(text: string): number {
  return [...text.replace(/\x1b\[[0-9;]*m/g, "")].length;
}
