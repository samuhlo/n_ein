// [FLOW] El relevo y la extensión comparten la misma frontera de parada.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TeamStore, taskLease, taskPending, type TaskRecord } from "./store.ts";
export const STOP_TEAM = "n_ein:stop-team";
export type StopTeamRequest = { origin: string; pending: Promise<void>[] };
export function storedTeam(cwd: string): TaskRecord[] {
  let store: TeamStore;
  try {
    store = new TeamStore(cwd);
  } catch {
    return [];
  }
  return store.list().filter(taskPending);
}
export async function stopTeam(cwd: string, events?: ExtensionAPI["events"]) {
  let store: TeamStore;
  try {
    store = new TeamStore(cwd);
  } catch {
    return;
  }
  const request: StopTeamRequest = { origin: store.origin, pending: [] };
  events?.emit(STOP_TEAM, request);
  await Promise.all(request.pending);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const host = existsSync(join(root, "bin/n-ein"))
    ? join(root, "bin/n-ein")
    : join(root, "dist/n-ein");
  for (const t of store.list().filter(taskPending)) {
    if (!existsSync(t.cwd)) continue;
    try {
      execFileSync(
        host,
        ["--worker-probe", "--project", taskLease(t), "--worker-cwd", t.cwd],
        {
          stdio: "pipe",
          timeout: 3000,
          env: { ...process.env, N_EIN_LEASE_FD: "" },
        },
      );
    } catch {
      throw new Error(`Cannot transfer: worker exit unconfirmed: ${t.cwd}`);
    }
  }
}
