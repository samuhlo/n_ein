// [FLOW] ENTRADA PORTABLE DEL ENCARGO
// La CLI sirve a ambos hosts y al launcher. stdout se reserva al resultado.
import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listSessions, publishSession, workState } from "./state.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values: v, positionals: p } = parseArgs({ allowPositionals: true, options: {
  project: { type: "string" }, json: { type: "boolean" }, all: { type: "boolean" }, query: { type: "string" },
  id: { type: "string" }, runtime: { type: "string" }, data: { type: "string" },
} });
const cwd = resolve(v.project ?? process.cwd());
try {
  let result: unknown;
  if (p[0] === "sessions") result = listSessions(root,cwd,v.query,v.all);
  else if (p[0] === "publish") {
    if (!v.id || !["pi","claude"].includes(v.runtime ?? "")) throw new Error("Indica --id y --runtime pi|claude");
    result = publishSession(root,cwd,v.id,v.runtime as "pi" | "claude", JSON.parse(v.data ?? "{}"));
  } else if (p[0] === "status") result = workState(cwd);
  else throw new Error("uso: n-ein-work status | sessions [--query texto] [--all] | publish --id ID --runtime pi|claude --data JSON [--json]");
  if (v.json || p[0] === "publish") console.log(JSON.stringify(result));
  else if (p[0] === "status") {
    const w = result as ReturnType<typeof workState>;
    console.log(["// 004 ENCARGO", w.objective || "Sin documento activo", ...w.tasks.map(t => `${t.done ? "✓" : "·"} ${t.text}`), "", "Siguiente paso", w.next || "Sin publicar"].join("\n"));
  } else {
    const rows = result as ReturnType<typeof listSessions>;
    console.log(["// 004 SESIONES", ...rows.sessions.map(s => `${s.runtime} · ${s.objective || "sin objetivo publicado"}\n  ${s.progress} · ${s.next || "sin siguiente paso"}\n  ${s.recordedAt}${s.stale ? " · resumen antiguo" : ""} · ${s.id}`), `${rows.invalid} no legibles · ${rows.omitted} omitidas`].join("\n"));
  }
} catch (error) { console.error(`[ERR] :: WORK_FAIL :: ${String(error)}`); process.exitCode = 1; }
