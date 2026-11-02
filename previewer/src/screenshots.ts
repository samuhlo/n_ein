// =============================================================================
// [DATA] CAPTURAS DEL REVISOR
// Una e2e del proyecto deja sus capturas en la copia, que se borra al acabar.
// Antes, el motor guarda en la carpeta de la ejecución las que el revisor
// declara, solo si son imágenes de verdad, dentro de la copia y de tamaño
// acotado: el contenido viene de la rama revisada y no se fía de él.
// =============================================================================

import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export const MAX_SCREENSHOTS = 6;
const SCREENSHOT_LIMIT = 2 << 20;
const NAME = /^\d+\.(png|jpeg|webp)$/;

/** Lo que propone el revisor: una ruta de su copia. */
export type ProposedScreenshot = { file: string; caption: string; command: string };
/** Lo guardado: `name` en la carpeta de la ejecución, `source` la ruta que tenía en la copia. */
export type Screenshot = { name: string; caption: string; command: string; source: string };

type ImageType = "png" | "jpeg" | "webp";

/** Por la firma de los bytes, no por la extensión. SVG queda fuera: puede llevar código. */
function imageType(head: Buffer): ImageType | null {
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

function header(path: string): Buffer {
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(12);
    return head.subarray(0, readSync(fd, head, 0, head.length, 0));
  } finally {
    closeSync(fd);
  }
}

/** Copia a `dir` las capturas válidas, en el orden propuesto; las demás vuelven con su motivo. */
export function keepScreenshots(copy: string, dir: string, proposed: ProposedScreenshot[]): { kept: Screenshot[]; rejected: string[] } {
  const kept: Screenshot[] = [];
  const rejected: string[] = [];
  const root = realpathSync(copy);
  for (const item of proposed) {
    const label = `captura «${item.caption || item.file}»`;
    const path = resolve(copy, item.file);
    const rel = relative(copy, path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
      rejected.push(`${label}: fuera de la copia (${item.file})`);
      continue;
    }
    let size: number;
    try {
      const stat = lstatSync(path);
      // BLINDAJE -> Un enlace o una carpeta enlazada sacarían del disco del usuario un archivo ajeno a la copia.
      const real = relative(root, realpathSync(path));
      if (!stat.isFile() || real.startsWith("..") || isAbsolute(real)) {
        rejected.push(`${label}: no es un archivo normal de la copia`);
        continue;
      }
      size = stat.size;
    } catch {
      rejected.push(`${label}: no existe en la copia (${item.file})`);
      continue;
    }
    if (size > SCREENSHOT_LIMIT) {
      rejected.push(`${label}: pesa más de ${SCREENSHOT_LIMIT >> 20} MB`);
      continue;
    }
    const type = imageType(header(path));
    if (!type) {
      rejected.push(`${label}: no es una imagen PNG, JPEG ni WebP`);
      continue;
    }
    if (kept.length >= MAX_SCREENSHOTS) {
      rejected.push(`${label}: supera el máximo de ${MAX_SCREENSHOTS} capturas`);
      continue;
    }
    const name = `${kept.length + 1}.${type}`;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, name), readFileSync(path), { mode: 0o600 });
    kept.push({ name, caption: item.caption, command: item.command, source: rel });
  }
  return { kept, rejected };
}

/** La captura como `data:` para incrustarla en la web; null si ya no está. */
export function screenshotData(dir: string, shot: Screenshot): string | null {
  const type = NAME.exec(shot.name)?.[1];
  if (!type) return null;
  try {
    return `data:image/${type};base64,${readFileSync(join(dir, shot.name)).toString("base64")}`;
  } catch {
    return null;
  }
}
