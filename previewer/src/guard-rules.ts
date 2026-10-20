// =============================================================================
// [AUTH] REGLAS DE LA GUARDIA
// Qué llamadas salen de la copia de revisión. Sin dependencias de Pi: las usan
// la extensión del agente y el motor al repetir sondas.
// =============================================================================

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

/** Git que publica, trae o cambia la configuración o el árbol de worktrees. */
const OUTWARD_GIT = /\bgit\b[^|;&\n]*\b(push|pull|fetch|remote|clone|worktree|config|submodule)\b/;
/** `gh` publicaría en GitHub en nombre de Samu. */
const GITHUB_CLI = /(^|[\s;&|(])gh\s/;

function canonical(path: string): string {
  let ancestor = path;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  return resolve(realpathSync(ancestor), relative(ancestor, path));
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
