// =============================================================================
// [FLOW] ABRIR EL REVISOR
// Un servidor por canal, en segundo plano, que sobrevive a quien lo abrió y se
// apaga solo tras un rato sin uso. Si ya hay uno vivo, se reutiliza.
// =============================================================================

import { spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { serverBuildId, statePath, type ServerState } from "./server.ts";

const START_TIMEOUT_MS = 20_000;

function readState(path: string): ServerState | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof value !== "object" || value === null) return null;
    const { pid, port, token } = { pid: undefined, port: undefined, token: undefined, ...value };
    return typeof pid === "number" && typeof port === "number" && typeof token === "string" ? { pid, port, token } : null;
  } catch {
    return null;
  }
}

async function version(state: ServerState): Promise<{ buildId: string | null } | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/api/health`, { headers: { "x-previewer-token": state.token }, signal: AbortSignal.timeout(1_500) });
    const data: unknown = await response.json();
    if (!response.ok || typeof data !== "object" || data === null || !("pid" in data) || data.pid !== state.pid) return null;
    return { buildId: "buildId" in data && typeof data.buildId === "string" ? data.buildId : null };
  } catch {
    return null;
  }
}

/** Devuelve un servidor vivo: el que ya había o uno nuevo. */
export async function ensureServer(packageRoot: string): Promise<ServerState> {
  const path = statePath(packageRoot);
  const expected = serverBuildId(packageRoot);
  const current = readState(path);
  const active = current ? await version(current) : null;
  if (current && active?.buildId === expected) return current;
  if (current && active) {
    // Solo se para el servidor que acredita token y PID; nunca un proceso inferido de un fichero viejo.
    if (!Number.isInteger(current.pid) || current.pid <= 1 || current.pid === process.pid) throw new Error("identidad de servidor no segura para renovarlo");
    try { process.kill(current.pid, "SIGTERM"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
    let stopped = false;
    for (let i = 0; i < 30; i++) {
      await Bun.sleep(100);
      try { process.kill(current.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") { stopped = true; break; } }
    }
    if (!stopped) throw new Error("el servidor anterior no se ha detenido; se conserva su estado");
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const log = openSync(join(dirname(path), "server.log"), "a", 0o600);
  const child = spawn(process.execPath, [join(packageRoot, "previewer/src/server.ts")], { detached: true, stdio: ["ignore", log, log], env: process.env });
  child.unref();
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await Bun.sleep(100);
    const state = readState(path);
    if (state && state.pid === child.pid && (await version(state))?.buildId === expected) return state;
    if (child.exitCode !== null) break;
  }
  throw new Error(`el servidor del revisor no arrancó; detalle en ${join(dirname(path), "server.log")}`);
}

export function reviewerLink(state: ServerState, sessionId: string): string {
  return `http://127.0.0.1:${state.port}/s/${sessionId}#t=${state.token}`;
}
