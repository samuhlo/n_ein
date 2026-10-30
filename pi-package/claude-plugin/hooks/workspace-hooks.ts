// [FLOW] CONTINUIDAD DE CLAUDE POR LA CLI DEL PAQUETE
// El hook no copia prompts ni decide qué ejecutar. Los resúmenes son históricos.
import type { EngineInterface, On } from "claude-code";
export async function publishClaude($: EngineInterface, status: "idle" | "closed"): Promise<void> {
  const root = await $.env.get("N_EIN_ROOT"); if (!root) return;
  try {
    await $.env.set("N_EIN_SESSION_ID", await $.session.id());
    await $.process.run([`${root}/bin/n-ein-work`, "publish", "--id", await $.session.id(), "--runtime", "claude", "--data", JSON.stringify({ status })], { cwd: await $.session.cwd(), timeoutMs: 5000 });
  } catch { /* Un resumen auxiliar no bloquea el trabajo. */ }
}
async function run($: EngineInterface, verb: string, query = "") {
  const root = await $.env.get("N_EIN_ROOT");
  if (!root) return { text: "Abre Claude desde nein para consultar el encargo." };
  const result = await $.process.run([`${root}/bin/n-ein-work`, verb, ...(query ? ["--query", query] : [])], { cwd: await $.session.cwd(), timeoutMs: 10000 });
  return { text: result.stdout || result.stderr || "Sin datos disponibles." };
}
export function registerWorkspace(on: On): void {
  on("command.run", { command: "nein-estado" }, $ => run($, "status"));
  on("command.run", { command: "nein-sesiones" }, ($, e) => run($, "sessions", e.args));
  on("command.run", { command: "nein-revisor" }, async ($) => {
    const root = await $.env.get("N_EIN_ROOT"); if (!root) return { text: "Abre Claude desde nein." };
    const result = await $.process.run([`${root}/bin/n-ein-previewer`, "open"], { cwd: await $.session.cwd(), timeoutMs: 10000 });
    return { text: result.stdout || result.stderr };
  });
  on("session.end", async ($, e, next) => { await publishClaude($,"closed"); return next(e); });
}
