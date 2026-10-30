// [UI] PALETA EN PI
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { actionDraft, actionsFor, type Action } from "../claude-plugin/hooks/actions.ts";
import { ActionsPanel } from "./actions-panel.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export default function (pi: ExtensionAPI) {
  let opened = false;
  const open = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI || opened) return;
    opened = true;
    try {
      const kit = await import("@earendil-works/pi-tui");
      const names = pi.getCommands().map(c => c.name);
      const result = await ctx.ui.custom<Action | null>((tui, _theme, _keys, done) =>
        new ActionsPanel(names, { ...kit, matchesKey: (s, k) => kit.matchesKey(s, k as never) }, done, () => tui.requestRender(), () => tui.terminal.rows),
      { overlay: true, overlayOptions: { anchor: "center", width: "85%", maxHeight: "90%" } });
      if (!result || !actionsFor("pi", pi.getCommands().map(c => c.name)).some(a => a.id === result.id)) return;
      if (result.prepare) ctx.ui.setEditorText(actionDraft(result, "pi", ctx.ui.getEditorText()));
      else pi.sendUserMessage(`/${result.pi}`, { expandPromptTemplates: true, deliverAs: "followUp" });
    } finally { opened = false; }
  };
  pi.registerCommand("nein:comandos", { description: "Buscar acciones de n_ein con explicación breve", handler: (_args, ctx) => open(ctx) });
  const shortcut = process.env.N_EIN_COMMANDS_KEY ?? "alt+k";
  if (shortcut && shortcut.toLowerCase() !== "off") pi.registerShortcut(shortcut as never, { description: "Comandos de n_ein", handler: open });
  pi.registerCommand("nein:revisor", { description: "Abrir la revisión guardada, sin inferencia", handler: async (_args, ctx) => {
    const r = await pi.exec(resolve(root, "bin/n-ein-previewer"), ["open", "--project", ctx.cwd]);
    ctx.ui.notify(r.stdout || r.stderr || "No hay revisión guardada.", r.code ? "warning" : "info");
  } });
}
