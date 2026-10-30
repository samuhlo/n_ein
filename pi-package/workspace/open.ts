// [FLOW] ABRIR EL ENCARGO SIN INFERENCIA
import { spawn } from "node:child_process";
import { join } from "node:path";
import { buildId, serverPath, type WorkServer } from "./server.ts";
import { smallJSON } from "./state.ts";
async function existing(
  root: string,
  cwd: string,
): Promise<WorkServer | undefined> {
  try {
    const s = smallJSON(serverPath(root, cwd)) as WorkServer;
    if (
      !Number.isInteger(s.port) ||
      s.port < 1 ||
      s.port > 65535 ||
      typeof s.token !== "string"
    )
      return;
    const r = await fetch(`http://127.0.0.1:${s.port}/health`, {
      headers: { authorization: `Bearer ${s.token}` },
      signal: AbortSignal.timeout(1000),
    });
    if (r.ok && (await r.json()).build === buildId(root)) return s;
  } catch {}
}
export async function openWork(root: string, cwd: string): Promise<string> {
  let s = await existing(root, cwd);
  if (!s) {
    const child = spawn(
      join(root, "bin/n-ein-work"),
      ["serve", "--project", cwd],
      { cwd, detached: true, stdio: "ignore", env: process.env },
    );
    child.unref();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      s = await existing(root, cwd);
      if (s) break;
    }
  }
  if (!s)
    throw new Error(
      "El servidor del encargo no arrancó; prueba n-ein-work serve para ver el error.",
    );
  return `http://127.0.0.1:${s.port}/#${s.token}`;
}
