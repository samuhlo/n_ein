// =============================================================================
// [DATA] CITAS VERIFICABLES
// Un hallazgo se apoya en líneas que existen en el SHA revisado. La cita que no
// existe se rechaza aquí y nunca llega a la pantalla.
// =============================================================================

import type { Citation } from "./finding.ts";
import { fileAt } from "./git.ts";

const PATTERN = /^(?<path>[^@\s]+)@(?<sha>[0-9a-f]{7,40}):L(?<start>\d+)(?:-L?(?<end>\d+))?$/;
/** Un tramo más largo deja de señalar algo concreto. */
const MAX_SPAN = 60;

export type CitationCheck = { ok: true; citation: Citation } | { ok: false; ref: string; reason: string };

export function makeCitationChecker(repo: string, allowed: readonly string[]): (ref: string) => CitationCheck {
  const files = new Map<string, string[] | null>();
  const linesOf = (sha: string, path: string): string[] | null => {
    const key = `${sha}:${path}`;
    if (!files.has(key)) {
      const content = fileAt(repo, sha, path);
      // El salto de línea final cierra la última línea; no abre otra.
      // Un archivo vacío no tiene ninguna línea que citar.
      files.set(key, content === null ? null : content === "" ? [] : (content.endsWith("\n") ? content.slice(0, -1) : content).split("\n"));
    }
    return files.get(key) ?? null;
  };
  return (raw: string): CitationCheck => {
    const ref = raw.trim().replace(/^`|`$/g, "");
    const match = PATTERN.exec(ref);
    if (!match?.groups) return { ok: false, ref, reason: "formato distinto de ruta@SHA:Lnn" };
    const { path = "", sha: short = "", start: first = "", end: last } = match.groups;
    // BLINDAJE -> Solo los SHA de esta revisión: una cita a otro commit no se puede comprobar contra el diff.
    const sha = allowed.find((full) => full.startsWith(short));
    if (!sha) return { ok: false, ref, reason: "SHA ajeno a la revisión" };
    const start = Number(first);
    const end = last === undefined ? start : Number(last);
    if (start < 1 || end < start || end - start >= MAX_SPAN) return { ok: false, ref, reason: "tramo de líneas inválido" };
    const lines = linesOf(sha, path);
    if (!lines) return { ok: false, ref, reason: "el archivo no existe en ese SHA" };
    if (end > lines.length) return { ok: false, ref, reason: `el archivo tiene ${lines.length} líneas` };
    return { ok: true, citation: { ref, path, sha, start, end, text: lines.slice(start - 1, end).join("\n") } };
  };
}
