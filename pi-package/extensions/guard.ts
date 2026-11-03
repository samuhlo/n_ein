// =============================================================================
// [AUTH] GUARDA DE COMANDOS DESTRUCTIVOS
// Pi ejecuta los comandos sin preguntar. Lo que no se deshace pide la
// confirmación del usuario; sin interfaz que pregunte, se detiene.
// =============================================================================

import { homedir, tmpdir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dangerous } from "./guard-core.ts";

function scratchDirs(): string[] {
  return [tmpdir(), process.env.TMPDIR, "/tmp", "/private/tmp"].filter((dir): dir is string => Boolean(dir));
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Los procesos en segundo plano lanzan comandos igual que bash.
    const input = event.input as { command?: unknown };
    const command = event.toolName === "bash" || event.toolName === "nein_job" ? input.command : undefined;
    if (typeof command !== "string" || command.trim() === "") return;
    const danger = dangerous(command, { cwd: ctx.cwd, scratch: scratchDirs(), home: homedir() });
    if (!danger) return;
    if (ctx.hasUI && (await ctx.ui.confirm("Comando destructivo", `${danger.label}.\n\n${command}\n\n¿Lo ejecuto?`))) return;
    return {
      block: true,
      reason: ctx.hasUI
        ? `The user declined this command: ${danger.reason}. Do not retry it or rephrase it to avoid the check; explain what it would do and ask how to proceed.`
        : `Stopped: ${danger.reason}, and this session cannot ask the user. Do not rephrase it to avoid the check; report the exact command and let the user run or authorize it.`,
    };
  });
}
