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
import { CLASSES, classify, loadRouting, parseOverride, type Classification, type JobClass, type Route, type RoutingTable } from "../router.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RANK: Record<JobClass, number> = { mecanico: 0, ordinario: 1, riesgo: 2, abierto: 2 };

export type RouterState = Classification;
type Message = ModelRouteRequest["messages"][number];

function lastUserText(messages: readonly Message[]): string {
  const content = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  if (typeof content === "string") return content;
  return content.flatMap((block: { type: string; text?: string }) => (block.type === "text" && block.text ? [block.text] : [])).join("\n");
}

/** Decide la clase del encargo para esta petición. Pura: la extensión y los tests la comparten. */
export function nextState(request: Pick<ModelRouteRequest<RouterState>, "reason" | "state" | "messages">, pending: { escalate?: string; force?: JobClass }): RouterState {
  const current = request.state;
  if (pending.force) return { clase: pending.force, motivo: "elegido con /nein:modo", fuente: "usuario" };
  if (pending.escalate) return { clase: "riesgo", motivo: `escalado: ${pending.escalate}`, fuente: "regla" };
  if (request.reason !== "user" && current) return current;
  const text = lastUserText(request.messages);
  const override = parseOverride(text);
  if (override.clase) return { clase: override.clase, motivo: "pedido en el mensaje", fuente: "usuario" };
  const found = classify(text);
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
  try { return loadModels(packageRoot).routing; } catch { return loadRouting(packageRoot); }
}

export default function (pi: ExtensionAPI, table: RoutingTable = effectiveRouting()) {
  if (process.env.N_EIN_WORKER_CHILD === "1") return;
  // Pi corre una sesión por proceso: lo pendiente vale para la próxima petición de esta sesión.
  const pending: { escalate?: string; force?: JobClass } = {};

  pi.registerVirtualModel<RouterState>({
    provider: "nein",
    id: "auto",
    name: "n_ein · un modelo por encargo",
    thinkingLevels: ["medium"],
    contextWindow: 272_000,
    maxTokens: 128_000,
    route(request, ctx) {
      // Resúmenes de compactación y llamadas fuera del bucle: el modelo barato basta.
      if (request.reason === "direct") return { model: physical(ctx, table.mecanico), thinkingLevel: table.mecanico.thinking as never };
      const state = nextState(request, pending);
      delete pending.escalate; delete pending.force;
      const route = table[state.clase];
      const changed = !request.state || request.state.clase !== state.clase || request.state.motivo !== state.motivo;
      return { model: physical(ctx, route), thinkingLevel: route.thinking as never, state: changed ? state : undefined };
    },
  });

  pi.registerTool({
    name: "nein_escalate",
    label: "Escalar el encargo",
    description: "Pass the rest of this job to the high-risk model. Call it once, before the first write, when looking shows the change touches stored data or migrations, users, permissions or authentication, contracts others consume, concurrency, or delivery. Harmless if the job already runs on that model.",
    parameters: Type.Object({ reason: Type.String({ description: "What makes this change high risk, in a few words" }) }),
    async execute(_toolCallId, params) {
      pending.escalate = String(params.reason).slice(0, 200);
      const route = table.riesgo;
      return { content: [{ type: "text", text: `El encargo sigue en ${route.model} (${route.thinking}) desde la próxima petición: ${pending.escalate}` }], details: undefined };
    },
  });

  pi.registerCommand("nein:modo", {
    description: `Fija el modelo del encargo: ${CLASSES.join(", ")} (o luna, sol, sol high)`,
    handler: async (args, ctx) => {
      const { clase } = parseOverride(`[${String(args ?? "").trim()}]`);
      if (!clase) { ctx.ui.notify(`Clases: ${CLASSES.join(", ")} · atajos: luna, sol, sol high`, "warning"); return; }
      pending.force = clase;
      ctx.ui.notify(`El encargo pasa a ${clase} → ${table[clase].model} (${table[clase].thinking})`, "info");
    },
  });
}
