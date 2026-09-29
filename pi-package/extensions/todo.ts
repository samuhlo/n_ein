import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { addWorkTask, markWorkTask, readWorkDoc, resolveWorkDoc } from "./work-doc";

const WIDGET = "n-ein-todo";

function refresh(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const path = resolveWorkDoc(ctx.cwd);
  if (!path) { ctx.ui.setWidget(WIDGET, undefined); return; }

  try {
    const { tasks } = readWorkDoc(path);
    if (tasks.length === 0) { ctx.ui.setWidget(WIDGET, undefined); return; }
    const done = tasks.filter((task) => task.done).length;
    const current = tasks.find((task) => !task.done);
    const line = current ? `▸ ${current.text}  ·  ${done}/${tasks.length}` : `✓ ${done}/${tasks.length} tareas`;
    ctx.ui.setWidget(WIDGET, [line], { placement: "belowEditor" });
  } catch (error) {
    ctx.ui.setWidget(WIDGET, undefined);
    ctx.ui.notify(`No se pudo leer el documento de trabajo: ${error instanceof Error ? error.message : String(error)}`, "warning");
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => refresh(ctx));
  pi.on("agent_end", (_event, ctx) => refresh(ctx));

  pi.registerCommand("todo", {
    description: "Muestra o actualiza las casillas de WORK.md: /todo, /todo done N, /todo add texto",
    handler: (args, ctx) => {
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
