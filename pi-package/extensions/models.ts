// =============================================================================
// [UI] SELECTOR DE MODELOS — /nein:models
// Abre el panel de roles sobre la conversación. Pi aporta el catálogo real y
// lo elegido se guarda en models.json del canal, fuera del código instalado.
// =============================================================================

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadModels, saveClaudeEffort, saveModelChoice } from "../models.ts";
import { painter } from "./brand.ts";
import { ModelsPanel, type Draft, type ModelChoice, type PanelKit, type PanelResult } from "./models-panel.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function savedDraft(): { saved: Draft; defaults: { principal: ModelChoice; worker: ModelChoice } } {
  const effective = loadModels(packageRoot);
  const fromPackage = loadModels(packageRoot, undefined, { ignoreSettings: true });
  return {
    saved: {
      principal: effective.overridden.includes("principal") ? effective.principal : null,
      worker: effective.overridden.includes("worker") ? effective.worker : null,
      claude: effective.claudeEffort,
    },
    defaults: { principal: fromPackage.principal, worker: fromPackage.worker },
  };
}

function persist(saved: Draft, draft: Draft): string[] {
  const applied: string[] = [];
  for (const role of ["principal", "worker"] as const) {
    if (JSON.stringify(saved[role]) === JSON.stringify(draft[role])) continue;
    saveModelChoice(packageRoot, role, draft[role]);
    const value = draft[role] ? `${draft[role]!.model} · ${draft[role]!.thinking}` : "valor del paquete";
    applied.push(role === "principal" ? `principal: ${value} (reinicia Pi)` : `trabajador: ${value} (próximo encargo)`);
  }
  if (saved.claude !== draft.claude) {
    saveClaudeEffort(packageRoot, draft.claude);
    applied.push(`claude: ${draft.claude ?? "esfuerzo por defecto"} (al abrir Claude)`);
  }
  return applied;
}

export async function openModels(ctx: ExtensionContext, kit: PanelKit): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Abre la TUI de Pi para usar /nein:models.", "warning");
    return;
  }
  let state;
  try {
    state = savedDraft();
  } catch (error) {
    ctx.ui.notify(`[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}`, "warning");
    return;
  }
  const models = (await ctx.modelRegistry.getAvailable())
    .map((model) => `${model.provider}/${model.id}`)
    .sort((left, right) => left.localeCompare(right));
  if (models.length === 0) ctx.ui.notify("Catálogo vacío en este hogar de Pi; /login lo habilita.", "warning");

  let draft: Draft = { ...state.saved };
  // El id personalizado necesita el input nativo de Pi: el panel se cierra, se pregunta y se reabre con el borrador.
  while (true) {
    const result = await ctx.ui.custom<PanelResult>(
      (tui, _theme, _keybindings, done) => new ModelsPanel(draft, state.defaults, state.saved, models, kit, painter(), done, () => tui.requestRender()),
      { overlay: true, overlayOptions: { anchor: "center", width: "80%", minWidth: 70, maxHeight: "85%" } },
    );
    if (result.kind === "cancel") return;
    if (result.kind === "custom") {
      draft = result.draft;
      const model = (await ctx.ui.input("Id proveedor/modelo"))?.trim();
      if (model) {
        const current = draft[result.role] ?? state.defaults[result.role];
        draft = { ...draft, [result.role]: { model, thinking: current.thinking } };
      }
      continue;
    }
    try {
      const applied = persist(state.saved, result.draft);
      ctx.ui.notify(applied.length ? applied.join("\n") : "Sin cambios.", "info");
    } catch (error) {
      ctx.ui.notify(`[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}`, "warning");
    }
    return;
  }
}

export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_WORKER_CHILD === "1") return;

  pi.registerCommand("nein:models", {
    description: "Modelo y esfuerzo del principal y del trabajador, y esfuerzo de Claude",
    handler: async (_args, ctx) => {
      const { matchesKey, truncateToWidth, visibleWidth } = await import("@earendil-works/pi-tui");
      await openModels(ctx, { matchesKey: (data, key) => matchesKey(data, key as never), truncateToWidth, visibleWidth });
    },
  });
}
