// =============================================================================
// [UI] NÚCLEO DE LA MARCA 004 PANEL
// Geometría de las palas que giran hasta asentarse en n_ein: qué celda lleva
// qué medio bloque y en qué tono. Pi la pinta con ANSI y el plugin de Claude
// con elementos de Ink; Go la dibuja por su lado y el fixture compara los tres.
//
// POR QUÉ -> el plugin de Claude corre sin Node: este módulo no importa nada.
// =============================================================================

export const INTRO_SECONDS = 2.2;
export const LARGE_WIDTH = 39;
export const LARGE_HEIGHT = 6;

/** Tonos de la marca por nombre; cada runtime los resuelve a su color. */
export type BrandTone = "concrete" | "yellow" | "muted" | "tileHigh" | "tileLow";
export type PanelCell = { glyph: string; fg?: BrandTone; bg?: BrandTone };

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

// Mismo hash que Go y que el diseño: el giro es pseudoaleatorio pero determinista.
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function flap(k: number, t: number): { visible: boolean; letter: string; settled: boolean } {
  if (t <= 0.1 + 0.06 * k) return { visible: false, letter: "", settled: false };
  if (t >= 0.55 + 0.3 * k) return { visible: true, letter: WORD[k] ?? "", settled: true };
  return { visible: true, letter: FLAP_POOL[Math.floor(hash(k, Math.floor(t * 16), 5) * FLAP_POOL.length)] ?? "", settled: false };
}

function letterTone(letter: string, settled: boolean): BrandTone {
  if (!settled) return "muted";
  return letter === "_" ? "yellow" : "concrete";
}

type Grid = { top: boolean; bottom: boolean; fg?: BrandTone; bg?: BrandTone }[][];

/** Las seis filas del Panel grande en el instante t (segundos desde la apertura), celda a celda. */
export function panelCells(t: number): PanelCell[][] {
  const tile = 7, gap = 1, height = LARGE_HEIGHT;
  const grid: Grid = Array.from({ length: height }, () => Array.from({ length: LARGE_WIDTH }, () => ({ top: false, bottom: false })));
  WORD.forEach((_, k) => {
    const state = flap(k, t);
    if (!state.visible) return;
    const left = k * (tile + gap);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < tile; x++) grid[y]![left + x]!.bg = y < height / 2 ? "tileHigh" : "tileLow";
    }
    const glyph = FONT[state.letter] ?? [];
    const offset = left + Math.floor((tile - (glyph[0]?.length ?? 0)) / 2);
    const tone = letterTone(state.letter, state.settled);
    glyph.forEach((row, gy) => [...row].forEach((pixel, gx) => {
      if (pixel !== "#") return;
      // La letra empieza dos píxeles por debajo del borde: queda centrada en la pala.
      const py = gy + 2;
      const cell = grid[Math.floor(py / 2)]![offset + gx]!;
      cell.fg = tone;
      if (py % 2 === 0) cell.top = true; else cell.bottom = true;
    }));
  });
  return grid.map((row) => {
    const cells: PanelCell[] = row.map((cell) => ({
      glyph: cell.top && cell.bottom ? "█" : cell.top ? "▀" : cell.bottom ? "▄" : " ",
      fg: cell.fg,
      bg: cell.bg,
    }));
    // Sin pala no hay fondo: los blancos del final sobran.
    while (cells.length && cells.at(-1)!.glyph === " " && !cells.at(-1)!.bg) cells.pop();
    return cells;
  });
}

export type PanelRun = { text: string; fg?: BrandTone; bg?: BrandTone };

/** Una fila en tramos del mismo tono: menos elementos que pintar que celda a celda. */
export function panelRuns(row: readonly PanelCell[]): PanelRun[] {
  const runs: PanelRun[] = [];
  for (const cell of row) {
    const last = runs.at(-1);
    if (last && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.glyph;
    else runs.push({ text: cell.glyph, fg: cell.fg, bg: cell.bg });
  }
  return runs;
}
