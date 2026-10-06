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
  String(value ?? "desconocido")
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, " ");
export function teamLines(
  tasks: (TaskRecord & { activeHere?: boolean })[],
  width = 100,
  now = Date.now(),
): string[] {
  if (!tasks.length) return [];
  const priority = (t: TaskRecord & { activeHere?: boolean }) =>
    t.status === "running" && t.activeHere !== false
      ? 0
      : t.status === "queued"
        ? 1
        : t.status === "ready"
          ? 2
          : 3;
  const pending = tasks
    .filter((t) => t.status !== "integrated")
    .sort((a, b) => priority(a) - priority(b));
  const shown = pending.length ? pending : tasks.slice(-2);
  const lines = [
    "// 005 EQUIPO · Ctrl+Shift+G para ver y detener",
    ...shown.slice(0, 4).flatMap((t) => {
      const seconds = Math.max(
        0,
        Math.floor(
          ((t.status === "running" ? now : Date.parse(t.ended || t.updated)) -
            Date.parse(t.started || t.created)) /
            1000,
        ),
      );
      const usage =
        t.usageKnown && Number.isFinite(t.tokens) && Number.isFinite(t.cost)
          ? `${t.tokens} tok · $${t.cost.toFixed(3)}`
          : "consumo pendiente";
      const state =
        t.status === "running" && t.activeHere === false
          ? "estado por comprobar"
          : labels[t.status];
      const time =
        ((t.status === "interrupted" ||
          (t.status === "running" && t.activeHere === false)) &&
          !t.ended) ||
        !Number.isFinite(seconds)
          ? "tiempo desconocido"
          : `${seconds}s`;
      const title = `${clean(t.label)} · ${state}`;
      const model = `${t.model} ${t.thinking}`;
      return width < 90
        ? [`${title} · ${time}`, `${usage} · ${model}`]
        : [`${title} · ${model} · ${time} · ${usage}`];
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

/** La TUI muestra una tarjeta breve; el modelo conserva el resultado estructurado. */
export function resultLines(
  content: unknown,
  expanded = false,
  width = 100,
): string[] {
  let tasks: any[];
  try {
    const parsed =
      typeof content === "string" ? JSON.parse(content) : undefined;
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch {
    tasks = [];
  }
  const lines = ["// 005 RESULTADO DEL EQUIPO"];
  for (const task of tasks) {
    lines.push(
      `${clean(task.label)} · ${labels[task.status] ?? "estado desconocido"}`,
    );
    if (expanded) {
      lines.push(`${clean(task.model)} · ${clean(task.branch)}`);
      for (const line of String(task.result ?? task.error ?? "").split("\n"))
        lines.push(clean(line));
      if (task.record) lines.push(`Detalle: ${clean(task.record)}`);
    } else {
      const first = String(task.result ?? task.error ?? "")
        .split("\n")
        .find((l) => l.trim());
      if (first) lines.push(clean(first));
    }
  }
  if (!tasks.length)
    lines.push("Consulta el equipo para recuperar el resultado.");
  const columns = Math.max(1, width);
  return lines.flatMap((line) =>
    expanded
      ? Array.from(
          { length: Math.max(1, Math.ceil(line.length / columns)) },
          (_, i) => line.slice(i * columns, (i + 1) * columns),
        )
      : [
          line.length > columns
            ? line.slice(0, Math.max(0, columns - 1)) + "…"
            : line,
        ],
  );
}
