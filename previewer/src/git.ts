// =============================================================================
// [DATA] GIT DEL REPOSITORIO REVISADO
// Solo lecturas: el revisor nunca escribe en el repositorio de Samu.
// =============================================================================

import { execFileSync } from "node:child_process";

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

function tryGit(cwd: string, ...args: string[]): string | null {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}

export type Range = {
  repo: string;
  /** Rama revisada; vacía si el head no es la punta de una rama. */
  branch: string;
  baseSha: string;
  headSha: string;
};

/**
 * Fija base y head por SHA. Sin base explícita, la base es el ancestro común
 * con la rama principal: lo que la rama añade, no lo que main avanzó después.
 */
export function resolveRange(cwd: string, options: { base?: string; head?: string } = {}): Range {
  const repo = git(cwd, "rev-parse", "--show-toplevel");
  const head = options.head ?? "HEAD";
  const headSha = git(repo, "rev-parse", "--verify", `${head}^{commit}`);
  const branch = options.head
    ? (tryGit(repo, "rev-parse", "--abbrev-ref", "--verify", "--quiet", `${options.head}`) ?? "")
    : (tryGit(repo, "symbolic-ref", "--quiet", "--short", "HEAD") ?? "");
  let baseSha: string;
  if (options.base) baseSha = git(repo, "merge-base", git(repo, "rev-parse", "--verify", `${options.base}^{commit}`), headSha);
  else {
    const main = ["main", "master"].find((name) => tryGit(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${name}`) !== null);
    if (!main) throw new Error("no encuentro main ni master: indica la base con --base");
    baseSha = git(repo, "merge-base", main, headSha);
  }
  if (baseSha === headSha) throw new Error("la rama no tiene commits propios respecto a la base: no hay nada que revisar");
  return { repo, branch: branch === "HEAD" ? "" : branch, baseSha, headSha };
}

/** Contenido literal de un archivo en un commit, o null si no existía ahí. Sin recortar: las citas cuentan sus líneas. */
export function fileAt(repo: string, sha: string, path: string): string | null {
  try {
    return execFileSync("git", ["show", `${sha}:${path}`], { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

export function commitsOf(range: Range): string {
  return git(range.repo, "log", "--reverse", "--format=%h %s", `${range.baseSha}..${range.headSha}`);
}

export function diffOf(range: Range, ...extra: string[]): string {
  return git(range.repo, "diff", "--no-color", "--no-ext-diff", ...extra, range.baseSha, range.headSha);
}

/** Archivos que cambian entre base y head, en el orden del diff. */
export function changedFiles(range: Range): string[] {
  return git(range.repo, "diff", "--name-only", "--no-color", "-M", range.baseSha, range.headSha).split("\n").filter(Boolean);
}

/** Punta de una rama, para comprobar después que la revisión no la movió. */
export function branchTip(repo: string, branch: string): string | null {
  return branch ? tryGit(repo, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) : null;
}
