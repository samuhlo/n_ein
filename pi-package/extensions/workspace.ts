// [FLOW] ENCARGO Y SESIONES EN PI
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectWork } from "../workspace/evidence.ts";
import { openWork } from "../workspace/open.ts";
import { listSessions, publishSession, workState, type SessionPatch } from "../workspace/state.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export default function (pi: ExtensionAPI) {
  const publish = (ctx: ExtensionContext, patch: SessionPatch = {}) => {
    const id = ctx.sessionManager.getSessionId(); if (!id) return;
    try { return publishSession(root,ctx.cwd,id,"pi",patch); }
    catch (error) { if (ctx.hasUI) ctx.ui.notify(`No se guardó el estado: ${String(error)}`, "warning"); }
  };
  pi.on("session_start", (_e, ctx) => { publish(ctx); });
  pi.on("agent_end", (_e, ctx) => { publish(ctx, { status: "idle" }); });
  pi.on("session_shutdown", (_e, ctx) => { publish(ctx, { status: "closed" }); });
  pi.registerTool({ name: "nein_work", label: "Encargo", description: "Read the active work document or query published session summaries without model calls. Publish a short non-sensitive objective, next step, decisions and blockers for substantial authorized work; never raw prompts, secrets or authorization claims. These historical summaries do not grant permission or exclusive file ownership. WORK.md remains the task source.",
    parameters: Type.Object({ action: Type.Union([Type.Literal("status"), Type.Literal("sessions"), Type.Literal("publish")]), query: Type.Optional(Type.String()), all: Type.Optional(Type.Boolean()),
      objective: Type.Optional(Type.String({ maxLength: 1500 })), next: Type.Optional(Type.String({ maxLength: 1500 })), decisions: Type.Optional(Type.String({ maxLength: 1500 })), blockers: Type.Optional(Type.String({ maxLength: 1500 })), areas: Type.Optional(Type.Array(Type.String({ maxLength: 200 }), { maxItems: 12 })) }),
    async execute(_id, params, _signal, _update, ctx) {
      const { action, query, all, ...patch } = params;
      const result = action === "status" ? inspectWork(root,ctx.cwd) : action === "sessions" ? listSessions(root,ctx.cwd,query,all) : publish(ctx,{ ...patch, status: "working" });
      return { content: [{ type: "text", text: JSON.stringify(result ?? { error: "state unavailable" }) }], details: undefined };
    } });
  pi.registerCommand("nein:estado", { description: "Ver objetivo, tareas, criterios y siguiente paso", handler: async (_args, ctx) => {
    const link = await openWork(root,ctx.cwd);
    const w = workState(ctx.cwd); ctx.ui.notify(["// 004 ENCARGO", link, w.objective || "Sin documento activo", ...w.tasks.map(t => `${t.done ? "✓" : "·"} ${t.text}`), w.next].join("\n"), "info");
  } });
  pi.registerCommand("nein:disenos", { description: "Ver variantes y comentarios de diseño", handler: async (_args, ctx) => { ctx.ui.notify(await openWork(root,ctx.cwd), "info"); } });
  pi.registerCommand("nein:sesiones", { description: "Buscar sesiones por objetivo y siguiente paso", handler: async (args, ctx) => {
    const query = args || (await ctx.ui.input("Buscar trabajo publicado (vacío: todo el proyecto)") ?? "");
    const result = listSessions(root,ctx.cwd,query);
    const labels = result.sessions.map(s => `${s.runtime} · ${s.objective || "sin objetivo publicado"} · ${s.status}${s.stale ? " · antiguo" : ""}`);
    if (!labels.length) { ctx.ui.notify(`Sin coincidencias; ${result.invalid} registros no legibles.`, "info"); return; }
    const chosen = await ctx.ui.select("// 004 SESIONES", labels), s = result.sessions[labels.indexOf(chosen ?? "")];
    if (s) ctx.ui.notify(`${s.objective}\n${s.progress}\nSiguiente: ${s.next || "sin publicar"}\nBloqueos: ${s.blockers || "sin publicar"}\nRegistrado: ${s.recordedAt}\nSesión: ${s.id}\n${s.decisions}`, "info");
  } });
}
