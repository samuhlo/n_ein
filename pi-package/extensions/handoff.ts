// =============================================================================
// [FLOW] RELEVO ENTRE RUNTIMES
// El resumen se escribe después de que Pi termine el turno y sus herramientas.
// =============================================================================

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readWorkDoc, resolveWorkDoc } from "./work-doc";
import { stopTeam } from "../agents/runtime.ts";
import { teamSummary } from "../agents/summary.ts";

type GitState = { root: string; head: string; status: string; diffStat: string };

function gitValue(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 }).trim();
}

function gitState(cwd: string): GitState {
  try {
    return {
      root: gitValue(cwd, ["rev-parse", "--show-toplevel"]),
      head: gitValue(cwd, ["rev-parse", "HEAD"]),
      status: gitValue(cwd, ["status", "--short"]) || "limpio",
      diffStat: gitValue(cwd, ["diff", "--stat", "HEAD"]) || "sin diff rastreado",
    };
  } catch {
    return { root: cwd, head: "desconocido", status: "desconocido", diffStat: "desconocido" };
  }
}

function lastText(branch: Array<any>, role: "user" | "assistant"): string {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message" || entry.message?.role !== role) continue;
    const content = entry.message.content;
    const text = typeof content === "string" ? content : Array.isArray(content)
      ? content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n") : "";
    if (text.trim()) return text.trim();
  }
  return "desconocido";
}

function section(content: string, ...titles: string[]): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => titles.some((title) => line.trim().toLowerCase() === `## ${title.toLowerCase()}`));
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s+/.test(lines[end])) end++;
  return lines.slice(start + 1, end).join("\n").trim();
}

function summary(cwd: string, branch: Array<any>): string {
  const git = gitState(cwd);
  const workDoc = resolveWorkDoc(cwd);
  const document = workDoc && existsSync(workDoc) ? workDoc : "ninguno";
  const content = workDoc ? readFileSync(workDoc, "utf8") : "";
  const tasks = workDoc ? readWorkDoc(workDoc).tasks : [];
  const done = tasks.filter((task) => task.done).map((task) => `- ${task.text}`);
  const pending = tasks.filter((task) => !task.done).map((task) => `- ${task.text}`);
  const request = lastText(branch, "user");
  const goal = section(content, "Objetivo", "Goal", "Acuerdo confirmado", "Confirmed agreement") || request;
  return [
    "# Relevo n_ein → Claude",
    "",
    `Proyecto: ${git.root}`,
    `Commit de origen: ${git.head}`,
    `Documento de trabajo: ${document}`,
    "",
    "## Objetivo",
    goal,
    "",
    "## Autorización",
    section(content, "Autorización", "Authorization") || "Contrasta la petición original citada y la conversación: el acuerdo de diseño por sí solo no autoriza construir. Una autorización ya dada sigue vigente dentro de su alcance.",
    "",
    "## Decisiones y límites",
    section(content, "Decisiones", "Decisions", "Acuerdo confirmado", "Confirmed agreement") || "No constan decisiones en el documento; revisa la conversación y el proyecto.",
    section(content, "Límites", "Limits"),
    "",
    "## Hecho",
    done.length ? done.join("\n") : "No hay tareas marcadas como terminadas.",
    `Última respuesta del agente: ${lastText(branch, "assistant")}`,
    "",
    "## Pendiente y siguiente paso",
    section(content, "Siguiente paso", "Next step", "Pendiente", "Pending") || "Contrastar estado y acordar siguiente paso.",
    pending.join("\n"),
    "",
    "## Criterios de aceptación",
    section(content, "Criterios", "Criteria", "Criterios observables", "Acceptance criteria") || "No constan en el documento; comprueba el encargo original.",
    "",
    "## Última petición del usuario",
    request === goal ? "Coincide con el objetivo anterior; se conserva allí íntegra." : request,
    "",
    "## Estado Git al cerrar Pi",
    "```text",
    git.status,
    "```",
    "Diff rastreado:",
    "```text",
    git.diffStat,
    "```",
    "",
    "## Frentes del equipo pendientes",
    teamSummary(cwd),
    "El destino puede continuar secuencialmente en estos árboles; conserva sus cambios y comprueba la integración antes de cerrar WORK.md.",
    "",
    "## Comprobaciones",
    section(content, "Evidencia", "Evidence") || "No constan comprobaciones en el documento.",
    "Vigencia: desconocida hasta contrastar con el diff y el código actual. Los archivos nuevos también figuran en el estado Git. Conserva lo terminado; verifica solo lo que falte o haya quedado invalidado.",
    document === "ninguno" ? "No hay documento de trabajo; usa la petición reciente como punto de partida." : `Lee ${document} para el detalle vigente; este resumen es una instantánea.`,
    "",
    "El lanzador espera la salida del origen antes de abrir el destino. Detén cualquier escritor independiente antes del relevo; esperar el turno de Pi no acredita que un proceso externo haya terminado. Este resumen no autoriza una implementación que el usuario solo hubiera pedido discutir.",
    "",
  ].join("\n");
}

async function prepare(ctx: ExtensionContext): Promise<void> {
  const request = lastText(ctx.sessionManager.getBranch(), "user");
  await stopTeam(ctx.cwd);
  if (ctx.signal?.aborted || ctx.hasPendingMessages?.() || lastText(ctx.sessionManager.getBranch(), "user") !== request) throw new Error("Nueva indicación durante la parada; se conserva este runtime.");
  const home = process.env.PI_CODING_AGENT_DIR;
  const dir = home ? join(home, "handoffs") : join(ctx.cwd, ".n_ein", "handoffs");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `${randomUUID()}.md`);
  writeFileSync(file, summary(ctx.cwd, ctx.sessionManager.getBranch()), { mode: 0o600 });
  const signal = process.env.N_EIN_HANDOFF_SIGNAL;
  if (signal) {
    writeFileSync(signal, `claude\n${file}\n`, { mode: 0o600 });
    ctx.ui.notify(`Relevo listo: ${file}. Cerrando Pi para abrir Claude.`, "info");
    ctx.shutdown();
  } else {
    ctx.ui.notify(`Relevo listo en ${file}. Abre Claude después de cerrar Pi.`, "info");
  }
}

export default function (pi: ExtensionAPI) {
  let pending: { request: string } | undefined;
  pi.on("session_start", () => { pending = undefined; });
  pi.registerTool({
    name: "nein_handoff",
    label: "Continuar con Claude",
    description: "Prepare the existing Pi→Claude handoff ONLY when the user explicitly asks to switch or continue with Claude, including ordinary language. A question about Claude is not a transfer request. Finish or stop writers and update the current work document before calling. Quote the relevant words from the latest user message. After calling, finish the response without more tools; Pi will save the summary and shut down when this agent loop settles and workers have stopped, then the launcher opens Claude. This does not grant implementation permission.",
    parameters: Type.Object({ destination: Type.Literal("claude"), request: Type.String({ description: "Exact words of the user's request to continue with Claude" }) }),
    async execute(_id, params, _signal, _update, ctx) {
      const request = lastText(ctx.sessionManager.getBranch(), "user");
      const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
      if (!normalize(params.request) || !normalize(request).includes(normalize(params.request))) return { isError: true, content: [{ type: "text", text: "The quoted transfer request is not in the latest user message. Keep this runtime and inspect what the user asked." }], details: undefined };
      if (!process.env.N_EIN_HANDOFF_SIGNAL) return { isError: true, content: [{ type: "text", text: "This session has no n_ein launcher to perform the switch. Keep the work saved; explain that opening it through nein enables automatic handoff." }], details: undefined };
      pending = { request };
      return { content: [{ type: "text", text: "Handoff queued for the end of this response. Finish now; the launcher will open Claude after Pi exits. Preserve the current authorization and pending work." }], details: undefined };
    },
  });
  // BLINDAJE -> agent_end puede preceder a un retry o una continuación.
  pi.on("agent_end", (event, ctx) => {
    const last = event.messages.findLast(message => message.role === "assistant");
    if (ctx.signal?.aborted || last?.stopReason === "error" || last?.stopReason === "aborted") pending = undefined;
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    if (!pending || event.continue || ctx.hasPendingMessages?.()) return;
    const transfer = pending;
    pending = undefined;
    if (event.outcome !== "completed" || ctx.signal?.aborted || ctx.hasPendingMessages?.() || lastText(ctx.sessionManager.getBranch(), "user") !== transfer.request) return;
    try { await prepare(ctx); }
    catch (error) { ctx.ui.notify(`El relevo no está listo: ${String(error)}. Conserva los árboles pendientes.`, "error"); }
  });

  pi.registerCommand("handoff", {
    description: "Prepara el relevo a Claude: /handoff claude",
    handler: async (args, ctx) => {
      if (args.trim() !== "claude") {
        ctx.ui.notify("Uso: /handoff claude", "error");
        return;
      }

      // El comando manual conserva el mismo resumen y el mismo cierre que la conversación.
      await ctx.waitForIdle();
      pending = undefined;
      await prepare(ctx);
    },
  });
}
