// =============================================================================
// [UI] RAMA EN PI
// La rama donde trabaja el agente, en la línea de estado con la escala de
// STYLE. El pie nativo de Pi ya la pone entre paréntesis junto a la ruta, en
// gris; esta la deja a la vista. Se relee cuando pudo cambiar: al abrir, tras
// un comando y al acabar la respuesta.
// =============================================================================

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { COLORS, painter } from "./brand.ts";
import { branchOf, branchSegments } from "./git-branch.ts";

const STATUS = "nein-branch";
const COMMANDS = new Set(["bash", "nein_job"]);

export default function (pi: ExtensionAPI) {
  const refresh = async (ctx: ExtensionContext): Promise<void> => {
    if (!ctx.hasUI) return;
    const branch = await branchOf(ctx.cwd);
    const p = painter();
    ctx.ui.setStatus(STATUS, branch
      ? branchSegments(branch).map((part) => p.fg(part.tone === "muted" ? COLORS.muted : COLORS.concrete, part.text)).join("")
      : undefined);
  };

  pi.on("session_start", (_event, ctx) => refresh(ctx));
  pi.on("tool_execution_end", (event, ctx) => (COMMANDS.has(event.toolName) ? refresh(ctx) : undefined));
  pi.on("agent_end", (_event, ctx) => refresh(ctx));
}
