// [FLOW] SESIÓN PARA VOLVER
// El lanzador imprime al salir cómo reabrir esta sesión con n_ein (pi-package/resume.ts); aquí se
// le dice cuál es. Gana la última escritura: tras /new, /resume o /fork queda la sesión nueva.
import { writeFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  const record = process.env.N_EIN_RESUME_FILE;
  // BLINDAJE -> Solo el Pi que arrancó el lanzador: un Pi de un test o de un trabajador hereda la
  // variable y pisaría el id de la sesión del usuario.
  if (!record || process.env.N_EIN_RESUME_OWNER !== String(process.ppid)) return;
  const remember = (ctx: ExtensionContext): void => {
    const id = ctx.sessionManager.getSessionId();
    const file = ctx.sessionManager.getSessionFile();
    if (!id || !file) return;
    try {
      writeFileSync(record, `${id}\n${file}\n`);
    } catch {
      // Sin la pista se vuelve igual desde Sesiones del launcher.
    }
  };
  pi.on("session_start", (_event, ctx) => remember(ctx));
  pi.on("session_shutdown", (_event, ctx) => remember(ctx));
}
