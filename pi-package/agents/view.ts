// [UI] La actividad no equivale a aceptación: listo significa listo para integrar.
import type { TaskRecord } from "./store.ts";
import { dirname, join } from "node:path";
const labels: Record<string, string> = {
  queued: "en cola",
  running: "trabajando",
  ready: "listo para integrar",
  blocked: "bloqueado",
  stopped: "detenido",
  failed: "falló",
  interrupted: "por recuperar",
  integrated: "integrado",
};
const clean = (value: string) =>
  value.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/[\x00-\x1f\x7f]/g, " ");
export function teamLines(
  tasks: (TaskRecord & { activeHere?: boolean })[],
  width = 100,
  now = Date.now(),
): string[] {
  if (!tasks.length) return [];
  const pending = tasks.filter((t) => t.status !== "integrated");
  const shown = pending.length ? pending : tasks.slice(-2);
  const lines = [
    "// Equipo · Ctrl+Shift+G para ver y detener",
    ...shown.slice(0, 4).map((t) => {
      const seconds = Math.max(
        0,
        Math.floor(
          ((t.status === "running" ? now : Date.parse(t.ended || t.updated)) -
            Date.parse(t.started || t.created)) /
            1000,
        ),
      );
      const usage = t.usageKnown
        ? `${t.tokens} tok · $${t.cost.toFixed(3)}`
        : "consumo pendiente";
      return `${clean(t.label)} · ${t.status === "running" && t.activeHere === false ? "estado por comprobar" : labels[t.status]} · ${seconds}s · ${usage}`;
    }),
  ];
  if (shown.length > 4)
    lines.push(`+ ${shown.length - 4} tareas en el detalle`);
  return lines.map((line) =>
    line.length > width ? line.slice(0, Math.max(0, width - 1)) + "…" : line,
  );
}
export function taskDetail(t: TaskRecord): string {
  return [
    t.label,
    labels[t.status],
    `Asignación: ${t.taskId}`,
    `Encargo y evidencia: ${t.recordPath || join(dirname(dirname(t.cwd)), "team", `${t.id}.json`)}`,
    `Modelo: ${t.model} · ${t.thinking}`,
    `Intentos: ${t.attempt}. El consumo mostrado acumula todos los intentos.`,
    `Árbol: ${t.cwd}`,
    `Rama: ${t.branch}`,
    `Commit: ${t.head || "pendiente"}`,
    t.dirty ? `Cambios pendientes:\n${t.dirty}` : "",
    t.result || "",
    t.error ? `Error: ${t.error}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
