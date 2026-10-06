import { stopTeam, storedTeam } from "./runtime.ts";
import { taskDetail } from "./view.ts";

export function teamSummary(cwd: string): string {
  const tasks = storedTeam(cwd);
  return tasks.length
    ? tasks
        .map((t) =>
          taskDetail({
            ...t,
            result:
              t.result && t.result.length > 2000
                ? t.result.slice(0, 2000) +
                  "\n[Detalle completo conservado en el registro del equipo.]"
                : t.result,
          }),
        )
        .join("\n\n")
    : "No hay frentes pendientes.";
}
if (import.meta.main) {
  try {
    await stopTeam(process.argv[2] || process.cwd());
    console.log(teamSummary(process.argv[2] || process.cwd()));
  } catch (error) {
    console.error(`El equipo no está listo para relevar: ${String(error)}`);
    process.exitCode = 1;
  }
}
