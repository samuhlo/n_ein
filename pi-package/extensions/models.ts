// =============================================================================
// [UI] SELECTOR DE MODELOS
// Un recorrido para el principal y el trabajador; Pi aporta el catálogo real.
// =============================================================================

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadModels, saveModelChoice, type Role } from "../models.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT = "Restablecer valor del paquete";
const CUSTOM = "Id de modelo personalizado…";
const THINKING = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_WORKER_CHILD === "1") return;

  pi.registerCommand("models", {
    description: "Seleccionar modelo y esfuerzo del principal o del trabajador",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Abre la TUI de Pi para usar /models.", "warning");
        return;
      }
      try {
        const current = loadModels(packageRoot);
        const roles = [
          `Principal · ${current.principal.model} · ${current.principal.thinking}`,
          `Trabajador · ${current.worker.model} · ${current.worker.thinking}`,
        ];
        const selectedRole = await ctx.ui.select("Configurar modelo", roles);
        const role: Role | undefined = selectedRole === roles[0] ? "principal" : selectedRole === roles[1] ? "worker" : undefined;
        if (!role) return;

        const active = current[role];
        const available = (await ctx.modelRegistry.getAvailable())
          .map((model) => `${model.provider}/${model.id}`)
          .sort((left, right) => left.localeCompare(right));
        if (available.length === 0) ctx.ui.notify("Catálogo vacío en este hogar de Pi; /login lo habilita.", "warning");
        const models = [...new Set([active.model, ...available]), CUSTOM, DEFAULT];
        const selectedModel = await ctx.ui.select(`Modelo de ${role}`, models);
        if (!selectedModel) return;
        if (selectedModel === DEFAULT) {
          saveModelChoice(packageRoot, role, null);
          ctx.ui.notify(`${role}: se aplicará el valor del paquete en la próxima sesión o delegación.`, "info");
          return;
        }
        const model = selectedModel === CUSTOM
          ? (await ctx.ui.input("Id proveedor/modelo"))?.trim()
          : selectedModel;
        if (!model) return;
        const effortOptions = [active.thinking, ...THINKING.filter((level) => level !== active.thinking)];
        const thinking = await ctx.ui.select(`Esfuerzo de ${role}`, effortOptions);
        if (!thinking) return;
        saveModelChoice(packageRoot, role, { model, thinking });
        const when = role === "principal" ? "Reinicia Pi para aplicarlo." : "Se aplicará al próximo encargo delegado.";
        ctx.ui.notify(`${role}: ${model} · ${thinking}. ${when}`, "info");
      } catch (error) {
        ctx.ui.notify(`[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}`, "warning");
      }
    },
  });
}
