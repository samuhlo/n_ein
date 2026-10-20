// =============================================================================
// [FLOW] COPIA DE REVISIÓN
// El revisor ejecuta tests y sondas en una copia fijada al head, junto al
// repositorio en `<repo>-worktrees/` (CodeGraph no indexa temporales).
// Es un clon local sin remotos, no un `git worktree`: un worktree comparte
// ramas con el original y un `git branch -f` dentro movería la rama de Samu.
// Sin hardlinks: un objeto enlazado es el mismo fichero en los dos repositorios.
// =============================================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { git } from "./git.ts";

export type ReviewCopy = { path: string; remove: () => void };

const OWNER = "previewer-owner";

export function copiesRoot(repo: string): string {
  return join(dirname(repo), `${basename(repo)}-worktrees`);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

/** Borra copias de revisiones que murieron sin limpiar (proceso inexistente). */
export function sweepCopies(repo: string): string[] {
  const root = copiesRoot(repo);
  if (!existsSync(root)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(root)) {
    if (!name.startsWith("previewer-")) continue;
    const marker = join(root, name, ".git", OWNER);
    const pid = existsSync(marker) ? Number(readFileSync(marker, "utf8").trim()) : NaN;
    // BLINDAJE -> Sin marcador no hay forma de saber de quién es: se deja.
    if (!Number.isInteger(pid) || alive(pid)) continue;
    rmSync(join(root, name), { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

export function createCopy(repo: string, range: { baseSha: string; headSha: string }, id: string): ReviewCopy {
  const root = copiesRoot(repo);
  mkdirSync(root, { recursive: true });
  const path = join(root, `previewer-${id}`);
  const remove = (): void => {
    rmSync(path, { recursive: true, force: true });
    try {
      rmdirSync(root);
    } catch {
      // Otras copias o worktrees siguen ahí.
    }
  };
  try {
    git(root, "clone", "--quiet", "--local", "--no-hardlinks", "--no-checkout", repo, path);
    writeFileSync(join(path, ".git", OWNER), `${process.pid}\n`);
    git(path, "remote", "remove", "origin");
    // Sin remotos, la base solo se alcanza por este ref: así `git diff base head` funciona dentro.
    git(path, "update-ref", "refs/previewer/base", range.baseSha);
    git(path, "checkout", "--quiet", "--detach", range.headSha);
  } catch (error) {
    remove();
    throw error;
  }
  return { path, remove };
}
