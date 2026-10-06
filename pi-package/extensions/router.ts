// =============================================================================
// [FLOW] nein/auto · UN MODELO POR ENCARGO
// Modelo virtual de Pi: elige el modelo físico con la primera petición del
// usuario y lo mantiene durante el encargo, para no perder la caché del prompt.
// Solo sube de clase, nunca baja sola: subir cuesta una pérdida de caché;
// bajar sin pedirlo podría dejar un cambio de riesgo en un modelo barato.
// =============================================================================

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { loadModels } from "../models.ts";
import { stopTeam } from "../agents/runtime.ts";
import { CLASSES, classify, newJobText, parseOverride, type Classification, type JobClass, type Route, type RoutingTable } from "../router.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RANK: Record<JobClass, number> = { mecanico: 0, ordinario: 1, riesgo: 2, abierto: 2 };

export type RouterState = Classification & { route?: Route };
type TaskChoice = { clase: JobClass; transition: "new_job" | "start_implementation" | "reassess" | "user_choice"; reason: string };
type PendingRoute = { escalate?: string; force?: JobClass; newJob?: boolean; choice?: TaskChoice };
type Message = ModelRouteRequest["messages"][number];

function lastUserText(messages: readonly Message[]): string {
  const content = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  if (typeof content === "string") return content;
  return content.flatMap((block: { type: string; text?: string }) => (block.type === "text" && block.text ? [block.text] : [])).join("\n");
}

/** Decide la clase del encargo para esta petición. Pura: la extensión y los tests la comparten. */
export function nextState(request: Pick<ModelRouteRequest<RouterState>, "reason" | "state" | "messages">, pending: PendingRoute): RouterState {
  const text = lastUserText(request.messages);
  const fresh = request.reason === "user" ? newJobText(text) : undefined;
  const current = request.reason === "user" && (pending.newJob || fresh) ? undefined : request.state;
  if (pending.force) return { clase: pending.force, motivo: "elegido con /nein:modo", fuente: "usuario" };
  if (pending.escalate) return { clase: "riesgo", motivo: `escalado: ${pending.escalate}`, fuente: "regla" };
  if (pending.choice) {
    const { clase, transition, reason } = pending.choice;
    const mayLower = transition === "new_job" || transition === "user_choice" || (transition === "start_implementation" && current?.clase === "abierto");
    if (current && !mayLower && RANK[clase] < RANK[current.clase]) return current;
    return { clase, motivo: `${transition}: ${reason}`, fuente: transition === "user_choice" ? "usuario" : "regla" };
  }
  if (request.reason !== "user" && current) return current;
  const override = parseOverride(fresh ?? text);
  if (override.clase) return { clase: override.clase, motivo: "pedido en el mensaje", fuente: "usuario" };
  const found = classify(fresh ?? text);
  if (!current) return found;
  // Una petición nueva en el mismo encargo solo puede subir de clase.
  return RANK[found.clase] > RANK[current.clase] ? found : current;
}

function physical(ctx: ExtensionContext, route: Route) {
  const slash = route.model.indexOf("/");
  const model = ctx.modelRegistry.find(route.model.slice(0, slash), route.model.slice(slash + 1));
  if (!model) throw new Error(`[ERR] :: ROUTE_MODEL :: modelo ${route.model} fuera del catálogo`);
  return model;
}

/** La tabla del canal, con los cambios hechos en /nein:models; sin ella, la del paquete. */
function effectiveRouting(): RoutingTable {
  return loadModels(packageRoot).routing;
}

export default function (pi: ExtensionAPI, fixedTable?: RoutingTable) {
  // Pi corre una sesión por proceso: lo pendiente vale para la próxima petición de esta sesión.
  const pending: PendingRoute = {};
  let table = fixedTable;
  const routing = (refresh = false): RoutingTable => {
    if (!table || (refresh && !fixedTable)) table = fixedTable ?? effectiveRouting();
    return table;
  };
  pi.on("session_start", () => { delete pending.escalate; delete pending.force; delete pending.newJob; delete pending.choice; table = fixedTable; });

  pi.registerVirtualModel<RouterState>({
    provider: "nein",
    id: "auto",
    name: "n_ein · un modelo por encargo",
    thinkingLevels: ["medium"],
    contextWindow: 272_000,
    maxTokens: 128_000,
    route(request, ctx) {
      // Resúmenes de compactación y llamadas fuera del bucle: el modelo barato basta.
      if (request.reason === "direct") return { model: physical(ctx, routing().mecanico), thinkingLevel: routing().mecanico.thinking as never };
      const fresh = (request.reason === "user" && (pending.newJob || newJobText(lastUserText(request.messages)) !== undefined))
        || Boolean(pending.force) || ["new_job", "start_implementation", "user_choice"].includes(pending.choice?.transition ?? "");
      const state = nextState(request, pending);
      // El modelo físico se conserva al continuar o reanudar. La siguiente elección lee los ajustes nuevos.
      const route = !fresh && request.state?.clase === state.clase && request.state.route ? request.state.route : routing(Boolean(fresh))[state.clase];
      const model = physical(ctx, route);
      delete pending.escalate; delete pending.force; delete pending.choice;
      if (request.reason === "user") delete pending.newJob;
      const changed = !request.state || request.state.clase !== state.clase || request.state.motivo !== state.motivo
        || request.state.route?.model !== route.model || request.state.route?.thinking !== route.thinking;
      if (changed && ctx.hasUI) ctx.ui.notify(`${state.clase} → ${route.model} (${route.thinking}) · ${state.motivo}`, "info");
      return { model, thinkingLevel: route.thinking as never, state: changed ? { ...state, route } : undefined };
    },
  });

  pi.registerTool({
    name: "nein_set_task",
    label: "Elegir modelo del encargo",
    description: "Adjust the model class when the understood task needs it. The first request and clear 'another task' prefixes are already routed: do not call just to announce or repeat that choice. A new_job transition also stops previous workers while retaining a manual model. With nein/auto, use this for another explicit job not already recognized, after an agreed design is authorized for implementation, when exploration changes the assessed risk, or when the user explicitly requests a different model. Quote their latest request. Mechanical means text/style without new logic; ordinary means bounded behaviour; risk means stored data, permissions, existing contracts or deployment; open means unresolved design. Reassessing ongoing work only raises capability. This never grants implementation permission or discards pending work.",
    parameters: Type.Object({
      clase: Type.Union(CLASSES.map((value) => Type.Literal(value))),
      transition: Type.Union(["new_job", "start_implementation", "reassess", "user_choice"].map((value) => Type.Literal(value))),
      request: Type.String({ description: "Exact relevant words from the latest user message" }),
      reason: Type.String({ description: "Why this capability fits the known scope" }),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      const automatic = ctx.model?.provider === "nein" && ctx.model?.id === "auto";
      if (!automatic && params.transition !== "new_job") return { isError: true, content: [{ type: "text", text: "The session uses a manually selected model. Keep that explicit selection; automatic task routing is not active." }], details: undefined };
      const branch = ctx.sessionManager.getBranch();
      const last = branch.findLast((entry) => entry.type === "message" && entry.message.role === "user");
      const message = last?.type === "message" ? last.message : undefined;
      const text = message ? lastUserText([message] as Message[]) : "";
      const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
      if (!normalize(params.request) || !normalize(text).includes(normalize(params.request))) return { isError: true, content: [{ type: "text", text: "The quoted request is not in the latest user message. Keep the current task and inspect that message before choosing a transition." }], details: undefined };
      if (params.transition === "new_job") await stopTeam(ctx.cwd, pi.events);
      if (!automatic) { pending.newJob = true; return { content: [{type:"text",text:"New job recorded; previous workers stopped with their work preserved. Keep the manually selected model."}], details: undefined }; }
      pending.choice = { clase: params.clase, transition: params.transition, reason: params.reason.slice(0, 240) };
      return { content: [{ type: "text", text: `Task assessment recorded: ${params.clase} — ${pending.choice.reason}. It applies on the next request; an ongoing task can only move up unless the user explicitly changes the model. Keep its scope and pending work.` }], details: undefined };
    },
  });

  pi.registerTool({
    name: "nein_escalate",
    label: "Escalar el encargo",
    description: "Pass the rest of this job to the high-risk model. Call before writing further when exploration reveals migrations, changes to existing stored data, users, permissions, authentication, existing contracts, concurrency or delivery. Also use it when two corrective attempts brought no new evidence and model capability is the limit; expected red TDD tests do not count. Saving new records or adding an optional field alone is not high risk. Harmless if already on that model.",
    parameters: Type.Object({ reason: Type.String({ description: "What makes this change high risk, in a few words" }) }),
    async execute(_toolCallId, params, _signal, _update, ctx) {
      if (ctx && (ctx.model?.provider !== "nein" || ctx.model?.id !== "auto")) return { isError: true, content: [{ type: "text", text: "Automatic task routing is not active; the session has a manually selected model. Keep that explicit choice." }], details: undefined };
      pending.escalate = String(params.reason).slice(0, 200);
      const route = routing().riesgo;
      return { content: [{ type: "text", text: `El encargo sigue en ${route.model} (${route.thinking}) desde la próxima petición: ${pending.escalate}` }], details: undefined };
    },
  });

  pi.registerCommand("nein:modo", {
    description: `Fija el modelo del encargo: ${CLASSES.join(", ")} (o luna, sol, sol high)`,
    handler: async (args, ctx) => {
      const { clase } = parseOverride(`[${String(args ?? "").trim()}]`);
      if (!clase) { ctx.ui.notify(`Clases: ${CLASSES.join(", ")} · atajos: luna, sol, sol high`, "warning"); return; }
      pending.force = clase;
      const route = routing(true)[clase];
      ctx.ui.notify(`El encargo pasa a ${clase} → ${route.model} (${route.thinking})`, "info");
    },
  });

  pi.registerCommand("nein:nuevo", {
    description: "Comienza otro encargo y elige de nuevo su modelo: /nein:nuevo [petición]",
    handler: async (args, ctx) => {
      await stopTeam(ctx.cwd, pi.events);
      await ctx.waitForIdle();
      delete pending.escalate; delete pending.force; delete pending.choice;
      pending.newJob = true;
      const text = String(args ?? "").trim();
      if (text) pi.sendUserMessage(text);
      else ctx.ui.notify("La próxima petición comienza otro encargo; su modelo se elegirá de nuevo.", "info");
    },
  });
}
