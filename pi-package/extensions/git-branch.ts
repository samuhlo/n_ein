// =============================================================================
// [DATA] RAMA ACTUAL
// La rama donde trabaja el agente, para la línea de estado de Pi y la barra de
// Claude (bin/n-ein-todo). Con HEAD suelto, su commit corto; fuera de Git, nada.
// =============================================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { clip } from "../claude-plugin/hooks/receipt-core.ts";
import type { TodoSegment } from "../claude-plugin/hooks/todo-core.ts";

export type Branch = { name: string; detached: boolean };

const run = promisify(execFile);
// Cabe junto al modelo y al TODO dentro de STATUS_COLUMNS.
const BRANCH_ROOM = 28;

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, timeout: 2000 });
  return stdout.trim();
}

export async function branchOf(cwd: string): Promise<Branch | null> {
  // symbolic-ref también responde en un repositorio sin commits, donde rev-parse falla.
  const name = await git(cwd, "symbolic-ref", "--quiet", "--short", "HEAD").catch(() => "");
  if (name) return { name, detached: false };
  const sha = await git(cwd, "rev-parse", "--short", "HEAD").catch(() => "");
  return sha ? { name: sha, detached: true } : null;
}

/** `rama feat/x`, o `HEAD a1b2c3d` con HEAD suelto: la gramática del banner. */
export function branchSegments(branch: Branch): TodoSegment[] {
  return [{ tone: "muted", text: branch.detached ? "HEAD " : "rama " }, { tone: "text", text: clip(branch.name, BRANCH_ROOM) }];
}
