// =============================================================================
// [UI] TODO EN PI
// El bloque de Ein debajo del editor: el encargo, su avance y por dónde va,
// dibujado al ancho real con la escala de STYLE. Lo que se ve y cómo vive en
// claude-plugin/hooks/todo-core.ts, compartido con Claude.
// =============================================================================

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { ACTIVITY_EVENT } from "../claude-plugin/hooks/activity-core.ts";
import { todoRows, type TodoTone, type TodoView } from "../claude-plugin/hooks/todo-core.ts";
import { COLORS, painter } from "./brand.ts";
import { addWorkTask, markWorkTask, readTodoView, readWorkDoc, resolveWorkDoc } from "./work-doc";

const WIDGET = "n-ein-todo";
const TONE: Record<TodoTone, string> = {
  accent: COLORS.yellow,
  text: COLORS.concrete,
  muted: COLORS.muted,
  faint: COLORS.faint,
  structure: COLORS.structure,
};

export default function (pi: ExtensionAPI) {
  let view: TodoView | undefined;
  // La fase de la última herramienta mientras el agente trabaja; la manda activity.ts.
  let phase: string | undefined;
  let context: ExtensionContext | undefined;
  // Lo último enviado: el widget se refresca tras cada herramienta y repintar lo idéntico es parpadeo gratis.
  let painted = "";
  let failure = "";

  const paint = (ctx: ExtensionContext): void => {
    const sent = JSON.stringify([view, phase, "NO_COLOR" in process.env]);
    if (sent === painted) return;
    painted = sent;
    if (!view) { ctx.ui.setWidget(WIDGET, undefined); return; }
    const shown = view;
    const current = phase;
    const p = painter();
    ctx.ui.setWidget(WIDGET, () => ({
      render: (width: number) => todoRows(shown, { width, phase: current })
        .map((row) => truncateToWidth(row.map((part) => p.fg(TONE[part.tone], part.text)).join(""), width)),
      invalidate() {},
    }), { placement: "belowEditor" });
  };

  const refresh = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return;
    context = ctx;
    const path = resolveWorkDoc(ctx.cwd);
    try {
      const next = path ? readTodoView(path) : undefined;
      view = next?.tasks.length ? next : undefined;
      failure = "";
    } catch (error) {
      view = undefined;
      const message = error instanceof Error ? error.message : String(error);
      // Un documento ilegible avisa una vez, no tras cada herramienta.
      if (message !== failure) ctx.ui.notify(`No se pudo leer el documento de trabajo: ${message}`, "warning");
      failure = message;
    }
    paint(ctx);
  };

  // CORTE -> al abrir, la interfaz es nueva aunque el contenido sea el mismo: no se da por pintado.
  pi.on("session_start", (_event, ctx) => { painted = ""; refresh(ctx); });
  // Donde una casilla puede cambiar: tras cada herramienta y al cerrar cada turno, no solo al final de la respuesta.
  pi.on("tool_execution_end", (_event, ctx) => refresh(ctx));
  pi.on("turn_end", (_event, ctx) => refresh(ctx));
  pi.on("agent_end", (_event, ctx) => refresh(ctx));
  pi.events.on(ACTIVITY_EVENT, (data) => {
    phase = typeof data === "string" ? data : undefined;
    if (context) paint(context);
  });

  pi.registerCommand("todo", {
    description: "Muestra o actualiza las casillas de WORK.md: /todo, /todo done N, /todo add texto",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;
      const path = resolveWorkDoc(ctx.cwd);
      if (!path) { ctx.ui.notify("No hay WORK.md activo; el TODO no aparece para trabajos pequeños.", "info"); return; }

      const input = args.trim();
      try {
        if (input.startsWith("done ")) {
          const index = Number(input.slice(5).trim());
          if (!Number.isSafeInteger(index) || index < 1) throw new Error("Usa /todo done N con un número de la lista.");
          markWorkTask(path, index);
          ctx.ui.notify(`Tarea ${index} marcada en ${path}.`, "info");
        } else if (input.startsWith("add ")) {
          addWorkTask(path, input.slice(4));
          ctx.ui.notify(`Tarea añadida en ${path}.`, "info");
        } else if (input && input !== "refresh") {
          throw new Error("Usa /todo, /todo done N, /todo add texto o /todo refresh.");
        } else {
          const { tasks } = readWorkDoc(path);
          ctx.ui.notify(tasks.length ? tasks.map((task) => `${task.index}. [${task.done ? "x" : " "}] ${task.text}`).join("\n") : "WORK.md no tiene tareas.", "info");
        }
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
      refresh(ctx);
    },
  });
}
