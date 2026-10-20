// =============================================================================
// [AUTH] REGLAS DE LA GUARDIA
// Qué llamadas salen de la copia de revisión. Sin dependencias de Pi: las usan
// la extensión del agente y el motor al repetir sondas.
// =============================================================================

import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

/** Git que publica, trae o cambia la configuración o el árbol de worktrees. */
const OUTWARD_GIT = /\bgit\b[^|;&\n]*\b(push|pull|fetch|remote|clone|worktree|config|submodule)\b/;
/** `gh` publicaría en GitHub en nombre del usuario. */
const GITHUB_CLI = /(^|[\s;&|(])gh\s/;

const MAX_LINKS = 40;

function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ruta real de un destino que quizá no existe todavía. Sigue también enlaces
 * rotos: `write` sobre un enlace a un archivo inexistente crearía ese archivo
 * donde apunta el enlace, no dentro de la copia.
 */
function canonical(path: string, depth = 0): string {
  if (depth > MAX_LINKS) throw new Error(`demasiados enlaces simbólicos: ${path}`);
  let ancestor = path;
  const rest: string[] = [];
  while (!present(ancestor) && dirname(ancestor) !== ancestor) {
    rest.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  if (lstatSync(ancestor).isSymbolicLink() && !existsSync(ancestor))
    return canonical(resolve(dirname(ancestor), readlinkSync(ancestor), ...rest), depth + 1);
  return resolve(realpathSync(ancestor), ...rest);
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export type Verdict = { block: true; reason: string } | undefined;

/** Decide si una llamada a herramienta sale de la copia. Separada de Pi para poder probarla. */
export function reviewGuard(copy: string, origin: string): (tool: string, input: unknown, cwd: string) => Verdict {
  const root = realpathSync(copy);
  // La copia vive en `<repo>-worktrees/`: nombrar la copia no es nombrar el original.
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const originPath = new RegExp(`(${[...new Set([origin, realpathSync(origin)])].map(escape).join("|")})(?![\\w.-])`);
  return (tool, input, cwd) => {
    const fields: Record<string, unknown> = typeof input === "object" && input !== null ? { ...input } : {};
    if (tool === "write" || tool === "edit") {
      const target = canonical(resolve(cwd, String(fields.path ?? "")));
      if (!inside(root, target)) return { block: true, reason: "Review probes are written only inside the review copy." };
      return undefined;
    }
    if (tool !== "bash") return undefined;
    const command = String(fields.command ?? "");
    if (originPath.test(command))
      return { block: true, reason: "The author's repository is off limits; work only in the review copy." };
    if (OUTWARD_GIT.test(command) || GITHUB_CLI.test(command))
      return { block: true, reason: "The review copy has no remotes and nothing is published from a review." };
    return undefined;
  };
}
