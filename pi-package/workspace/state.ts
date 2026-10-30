// =============================================================================
// [DATA] CONTINUIDAD COMPARTIDA
// Resúmenes pequeños y fechados, fuera del paquete. No se copia la conversación
// ni se convierte un resumen en autorización o propiedad exclusiva del proyecto.
// =============================================================================
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { channelDir } from "../models.ts";
import { readWorkDoc, resolveWorkDoc } from "../extensions/work-doc.ts";
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export function projectRoot(cwd: string): string {
  try { return realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim()); }
  catch { return realpathSync(cwd); }
}
export function dataDir(root: string, cwd: string): string { return join(channelDir(root), "workspaces", digest(projectRoot(cwd))); }
export function atomicJSON(file: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2) + "\n";
  const parent = resolve(file, ".."); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temp, text, { mode: 0o600, flag: "wx" }); renameSync(temp, file);
}
export function smallJSON(file: string): unknown {
  if (statSync(file).size > 64 * 1024) throw new Error("Registro demasiado grande");
  return JSON.parse(readFileSync(file, "utf8"));
}
export function section(content: string, ...titles: string[]): string {
  const lines = content.split(/\r?\n/), start = lines.findIndex(l => titles.some(t => l.trim().toLowerCase() === `## ${t.toLowerCase()}`));
  if (start < 0) return "";
  let end = start + 1; while (end < lines.length && !/^#{1,2} /.test(lines[end])) end++;
  return lines.slice(start + 1, end).join("\n").trim();
}
export function workState(cwd: string) {
  const path = resolveWorkDoc(cwd), content = path ? readFileSync(path, "utf8") : "";
  const tasks = path ? readWorkDoc(path).tasks : [];
  return { path, objective: section(content, "Objetivo", "Goal"), decisions: section(content, "Decisiones", "Decisions"),
    criteria: section(content, "Criterios", "Criteria"), next: section(content, "Siguiente paso", "Next step"), tasks };
}
export type SessionNote = { schema: 1; id: string; runtime: "pi" | "claude"; project: string; objective: string; progress: string;
  next: string; blockers: string; decisions: string; areas: string[]; status: "working" | "idle" | "closed"; recordedAt: string };
export type SessionPatch = Partial<Pick<SessionNote, "objective" | "progress" | "next" | "blockers" | "decisions" | "areas" | "status">>;
function text(value: unknown, max = 1500): string {
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) throw new Error("Resumen inválido o demasiado largo");
  return value.trim();
}
function validNote(raw: unknown): SessionNote {
  const n = raw as SessionNote;
  if (!n || n.schema !== 1 || !["pi", "claude"].includes(n.runtime) || !["working", "idle", "closed"].includes(n.status)
    || !n.id || !n.project || !Number.isFinite(Date.parse(n.recordedAt)) || !Array.isArray(n.areas) || n.areas.length > 12) throw new Error("Sesión inválida");
  for (const key of ["objective", "progress", "next", "blockers", "decisions"] as const) text(n[key]);
  n.areas.forEach(a => text(a, 200)); return n;
}
export function publishSession(root: string, cwd: string, id: string, runtime: SessionNote["runtime"], patch: SessionPatch): SessionNote {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some(k => !["objective","progress","next","blockers","decisions","areas","status"].includes(k))) throw new Error("Campos de resumen inválidos");
  text(id, 256); if (!id) throw new Error("Falta identidad de sesión");
  const project = projectRoot(cwd), file = join(dataDir(root,cwd), "sessions", `${digest(`${runtime}:${id}`)}.json`);
  const before = existsSync(file) ? validNote(smallJSON(file)) : undefined;
  if (before && (before.id !== id || before.runtime !== runtime || before.project !== project)) throw new Error("Identidad de sesión distinta");
  const work = workState(cwd), done = work.tasks.filter(t => t.done).length;
  const note = validNote({ schema: 1, id, runtime, project, objective: before?.objective ?? "", next: before?.next ?? "", blockers: before?.blockers ?? "",
    decisions: before?.decisions ?? "", areas: before?.areas ?? [], status: before?.status ?? "idle", ...patch,
    progress: patch.progress ?? (work.tasks.length ? `${done}/${work.tasks.length} tareas` : before?.progress ?? ""), recordedAt: new Date().toISOString() });
  atomicJSON(file, note); return note;
}
export function listSessions(root: string, cwd: string, query = "", all = false) {
  const base = join(channelDir(root), "workspaces"), current = projectRoot(cwd);
  const dirs = all && existsSync(base) ? readdirSync(base).filter(n => /^[a-f0-9]{64}$/.test(n)).map(n => join(base,n)) : [dataDir(root,cwd)];
  const records: SessionNote[] = []; let invalid = 0;
  for (const dir of dirs) {
    const sessions = join(dir,"sessions"); if (!existsSync(sessions)) continue;
    for (const file of readdirSync(sessions).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
      try {
        const n = validNote(smallJSON(join(sessions,file)));
        if (digest(n.project) !== dir.split(/[\\/]/).at(-1) || digest(`${n.runtime}:${n.id}`) + ".json" !== file) throw new Error("Identidad incorrecta");
        if ((!all && n.project !== current) || !`${n.objective} ${n.progress} ${n.next} ${n.areas.join(" ")} ${n.project}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
        records.push(n);
      } catch { invalid++; }
    }
  }
  records.sort((a,b) => b.recordedAt.localeCompare(a.recordedAt));
  return { sessions: records.slice(0,100).map(n => ({ ...n, stale: Date.now() - Date.parse(n.recordedAt) > 5 * 60_000 })), invalid, omitted: Math.max(0, records.length - 100) };
}
