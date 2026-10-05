// =============================================================================
// [UI] SELECTOR DE MODELOS — /nein:models
// Abre el panel de modelos sobre la conversación: el principal, el modelo de
// cada clase de encargo y el esfuerzo de Claude. Pi aporta el catálogo real y
// lo elegido se guarda en models.json del canal, fuera del código instalado.
// =============================================================================

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadModels, saveClaudeEffort, saveModelChoice } from "../models.ts";
import { painter } from "./brand.ts";
import { ModelsPanel, type Draft, type ModelChoice, type ModelRole, type PanelKit, type PanelResult, type PanelSlot } from "./models-panel.ts";

const SLOTS: PanelSlot[] = [
  { key: "principal", label: "principal" },
  { key: "mecanico", label: "mecánico" },
  { key: "ordinario", label: "ordinario" },
  { key: "riesgo", label: "riesgo" },
  { key: "abierto", label: "abierto" },
];
const slots = (): PanelSlot[] => SLOTS;
const LABELS = Object.fromEntries(SLOTS.map((slot) => [slot.key, slot.label]));

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function savedDraft(): { saved: Draft; defaults: Record<ModelRole, ModelChoice> } {
  const effective = loadModels(packageRoot);
  const fromPackage = loadModels(packageRoot, undefined, { ignoreSettings: true });
  const saved = { claude: effective.claudeEffort } as Draft;
  const defaults = {} as Record<ModelRole, ModelChoice>;
  // Una clase vive en la tabla de enrutado; el principal, en su propio campo.
  const pick = (models: typeof effective, key: string): ModelChoice => (key in models.routing ? models.routing[key as never] : models[key as "principal"]);
  for (const { key } of slots()) {
    saved[key] = effective.overridden.includes(key as never) ? pick(effective, key) : null;
    defaults[key] = pick(fromPackage, key);
  }
  return { saved, defaults };
}

function persist(saved: Draft, draft: Draft): string[] {
  const applied: string[] = [];
  for (const { key: role } of slots()) {
    if (JSON.stringify(saved[role]) === JSON.stringify(draft[role])) continue;
    saveModelChoice(packageRoot, role as never, draft[role] ?? null);
    const value = draft[role] ? `${draft[role]!.model} · ${draft[role]!.thinking}` : "valor del paquete";
    applied.push(`${LABELS[role]}: ${value} (${role === "principal" ? "reinicia Pi" : "próximo encargo"})`);
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
      (tui, _theme, _keybindings, done) => new ModelsPanel(slots(), draft, state.defaults, state.saved, models, kit, painter(), done, () => tui.requestRender()),
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

  pi.registerCommand("nein:models", {
    description: "Modelo y esfuerzo del principal y de cada clase de encargo (mecánico, ordinario, riesgo, abierto); esfuerzo de Claude",
    handler: async (_args, ctx) => {
      const { matchesKey, truncateToWidth, visibleWidth } = await import("@earendil-works/pi-tui");
      await openModels(ctx, { matchesKey: (data, key) => matchesKey(data, key as never), truncateToWidth, visibleWidth });
    },
  });
}
