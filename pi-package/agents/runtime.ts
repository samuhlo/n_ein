// [FLOW] El relevo y la extensión comparten la misma frontera de parada.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TeamManager } from "./manager.ts";
import { TeamStore, type TaskRecord } from "./store.ts";
export const teams = new Map<string, TeamManager>();
export function storedTeam(cwd: string): TaskRecord[] {
  let store: TeamStore;
  try {
    store = new TeamStore(cwd);
  } catch {
    return [];
  }
  return store.list().filter((t) => t.status !== "integrated");
}
export async function stopTeam(cwd: string) {
  let store: TeamStore;
  try {
    store = new TeamStore(cwd);
  } catch {
    return;
  }
  await teams.get(store.origin)?.shutdown();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const host = existsSync(join(root, "bin/n-ein"))
    ? join(root, "bin/n-ein")
    : join(root, "dist/n-ein");
  for (const t of store.list().filter((t) => t.status !== "integrated")) {
    if (!existsSync(t.cwd)) continue;
    try {
      execFileSync(host, ["--worker-probe", "--project", t.cwd], {
        stdio: "pipe",
        timeout: 3000,
        env: { ...process.env, N_EIN_LEASE_FD: "" },
      });
    } catch {
      throw new Error(`Cannot transfer: worker exit unconfirmed: ${t.cwd}`);
    }
  }
}
