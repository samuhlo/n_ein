// =============================================================================
// [FLOW] RELEVO ENTRE RUNTIMES
// El resumen se escribe después de que Pi termine el turno y sus herramientas.
// =============================================================================

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readWorkDoc, resolveWorkDoc } from "./work-doc";

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
    "## Comprobaciones",
    section(content, "Evidencia", "Evidence") || "No constan comprobaciones en el documento.",
    "Vigencia: desconocida hasta contrastar con el diff y el código actual. Los archivos nuevos también figuran en el estado Git. Conserva lo terminado; verifica solo lo que falte o haya quedado invalidado.",
    document === "ninguno" ? "No hay documento de trabajo; usa la petición reciente como punto de partida." : `Lee ${document} para el detalle vigente; este resumen es una instantánea.`,
    "",
    "El lanzador espera la salida del origen antes de abrir el destino. Detén cualquier escritor independiente antes del relevo; esperar el turno de Pi no acredita que un proceso externo haya terminado. Este resumen no autoriza una implementación que el usuario solo hubiera pedido discutir.",
    "",
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("handoff", {
    description: "Prepara el relevo a Claude: /handoff claude",
    handler: async (args, ctx) => {
      if (args.trim() !== "claude") {
        ctx.ui.notify("Uso: /handoff claude", "error");
        return;
      }

      // BLINDAJE -> Ningún hijo debe seguir escribiendo cuando Claude reciba el relevo.
      await ctx.waitForIdle();
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
    },
  });
}
