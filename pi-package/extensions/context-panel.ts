// [UI] CONTEXTO MEDIDO Y CONTINUACIÓN EXPLÍCITA
// El aviso observa el uso del host; no delega ni cambia de modelo. Renovar la
// sesión solo ocurre por una acción del usuario y conserva el estado de ruta.
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { workState, section } from "../workspace/state.ts";
import { stopSessionJobs } from "./jobs-core.ts";
import { stopTeam } from "../agents/runtime.ts";
export function contextLevel(
  tokens: number | null | undefined,
  window: number | undefined,
  threshold = 0.6,
) {
  if (
    typeof tokens !== "number" ||
    !Number.isFinite(tokens) ||
    tokens < 0 ||
    !window ||
    !Number.isFinite(window) ||
    window <= 0
  )
    return null;
  return {
    tokens,
    window,
    fraction: tokens / window,
    high: tokens / window >= threshold,
  };
}
export function continuationNote(cwd: string): string {
  const w = workState(cwd);
  if (!w.path || !w.objective || !w.next)
    throw new Error(
      "Para renovar contexto, guarda primero el objetivo y siguiente paso en WORK.md.",
    );
  const content = readFileSync(w.path, "utf8"),
    authorization = section(content, "Autorización", "Authorization");
  if (!authorization)
    throw new Error(
      "Falta la autorización vigente en el documento; no se renueva a ciegas.",
    );
  return [
    "Continue the existing job after reading its work document and checking Git. This session reset grants no additional implementation or delivery permission.",
    `Work document: ${JSON.stringify(w.path)}`,
    `Goal: ${w.objective}`,
    `Recorded authorization (verify against the current request): ${authorization}`,
    `Next: ${w.next}`,
    "Keep completed work, explicit model choice and valid evidence. Read the decisions, limits and criteria from the document; do not restart a settled interview. Use nein_work status to identify stale checks.",
  ].join("\n\n");
}
export default function (pi: ExtensionAPI) {
  let last = 0,
    notified = false;
  const raw = Number(process.env.N_EIN_CONTEXT_NOTICE ?? 0.6),
    threshold = raw > 0 && raw <= 1 ? raw : 0.6;
  const measure = (ctx: ExtensionContext) => {
    try {
      const u = ctx.getContextUsage();
      return contextLevel(u?.tokens, u?.contextWindow, threshold);
    } catch {
      return null;
    }
  };
  pi.on("session_start", () => {
    last = 0;
    notified = false;
  });
  pi.on("tool_result", (_event, ctx) => {
    if (Date.now() - last < 5000) return;
    last = Date.now();
    const usage = measure(ctx);
    if (!usage) return;
    if (!usage.high) {
      notified = false;
      return;
    }
    if (notified) return;
    notified = true;
    try {
      pi.appendEntry("nein.context", {
        ...usage,
        at: new Date().toISOString(),
      });
    } catch {
      /* Medir contexto no es una condición para trabajar. */
    }
    if (ctx.hasUI)
      ctx.ui.notify(
        `Contexto: ${Math.round(usage.fraction * 100)} %. /nein:contexto muestra el uso; puedes continuar en una sesión nueva cuando hayas guardado el avance.`,
        "info",
      );
  });
  pi.registerCommand("nein:contexto", {
    description: "Ver contexto medido y modelo actual",
    handler: async (_args, ctx) => {
      const u = measure(ctx),
        model = ctx.model
          ? `${ctx.model.provider}/${ctx.model.id}`
          : "desconocido";
      ctx.ui.notify(
        `// 004 CONTEXTO\n${u ? `${u.tokens.toLocaleString()} / ${u.window.toLocaleString()} tokens · ${Math.round(u.fraction * 100)} %` : "Uso desconocido"}\nModelo del host: ${model}\nEsfuerzo: ${pi.getThinkingLevel()}\n/nein:continuar renueva la sesión a partir de WORK.md; no cambia el encargo.`,
        "info",
      );
    },
  });
  pi.registerCommand("nein:continuar", {
    description:
      "Continuar el encargo en una sesión nueva conservando guía y modelo",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();
      const note = continuationNote(ctx.cwd),
        draft = ctx.ui.getEditorText();
      const state = ctx.sessionManager
        .getBranch()
        .findLast(
          (e) =>
            e.type === "custom" && e.customType === "pi.virtual-model-state",
        );
      const model = ctx.model,
        thinking = pi.getThinkingLevel();
      await stopSessionJobs(ctx.sessionManager.getSessionId() ?? "");
      await stopTeam(ctx.cwd, pi.events);
      if (ctx.hasPendingMessages()) {
        ctx.ui.notify(
          "Llegó otra indicación; se conserva esta sesión.",
          "info",
        );
        return;
      }
      const result = await ctx.newSession({
        parentSession: ctx.sessionManager.getSessionFile(),
        setup: async (manager) => {
          if (state?.type === "custom")
            manager.appendCustomEntry(state.customType, state.data);
        },
        withSession: async (fresh) => {
          if (model && !(await pi.setModel(model))) {
            fresh.ui.setEditorText(draft);
            fresh.ui.notify(
              "La sesión está preparada, pero el modelo anterior no está disponible. No se ha iniciado trabajo con otro modelo.",
              "warning",
            );
            return;
          }
          pi.setThinkingLevel(thinking);
          fresh.ui.setEditorText(draft);
          await fresh.sendUserMessage(note);
        },
      });
      if (result.cancelled)
        ctx.ui.notify("Se conserva la sesión anterior.", "info");
    },
  });
}
