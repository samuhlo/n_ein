// =============================================================================
// [BENCH] S4a · QUÉ COSTÓ RETOMAR
// uso: bun s4-report.ts <variante>...
// Reanudación = métricas acumuladas del hogar tras retomar − métricas al cortar
// (Codex guarda sus eventos por ejecución y se mide directamente). Primera
// escritura: posición de la primera llamada de edición en la sesión retomada.
// =============================================================================
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const bench = process.env.N_EIN_BENCH ?? "/Users/samu/Documents/01_Proyectos/n_ein-bench";
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };
const WRITE = new Set(["edit", "write", "multiedit", "apply_patch"]);

function newestSession(home: string): string | null {
  const found: { f: string; t: number }[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p);
    if (s.isDirectory()) { if (n !== "npm" && n !== "gentle-agents") walk(p); } else if (n.endsWith(".jsonl")) found.push({ f: p, t: s.birthtimeMs }); } };
  if (existsSync(home)) walk(home);
  return found.sort((a, b) => b.t - a.t)[0]?.f ?? null;
}

for (const arm of process.argv.slice(2)) {
  const cut = `s3-${arm}-r1-cut`, log = join(bench, "logs", cut);
  if (!existsSync(join(log, "metrics-cut.json")) || !existsSync(join(bench, "logs", `s3-${arm}-r1-resume`, "meta.json"))) { console.log(arm, "pendiente"); continue; }
  const before = JSON.parse(readFileSync(join(log, "metrics-cut.json"), "utf8"));
  const after = JSON.parse(readFileSync(join(log, "metrics.json"), "utf8"));
  const resumeMeta = JSON.parse(readFileSync(join(bench, "logs", `s3-${arm}-r1-resume`, "meta.json"), "utf8"));
  let usage: Record<string, number>, firstWrite = -1, firstRead: string[] = [];
  if (arm === "C") {
    // Codex: los eventos de la reanudación están en su propio log.
    usage = { input: 0, cacheRead: 0, output: 0, cacheWrite: 0 };
    let i = 0;
    for (const line of readFileSync(join(bench, "logs", `s3-${arm}-r1-resume`, "events-1.jsonl"), "utf8").split("\n").filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.type === "turn.completed") { const c = e.usage.cached_input_tokens ?? 0; usage.input += e.usage.input_tokens - c; usage.cacheRead += c; usage.output += e.usage.output_tokens; }
      if (e.type === "item.completed" && e.item) { i++; if (e.item.type === "file_change" && firstWrite < 0) firstWrite = i; if (e.item.type === "command_execution" && firstRead.length < 4) firstRead.push(String(e.item.command).slice(0, 70)); }
    }
  } else {
    usage = Object.fromEntries(Object.keys(after.usage.total).map((k) => [k, after.usage.total[k] - before.usage.total[k]]));
    const session = newestSession(join(bench, "homes", cut));
    let i = 0;
    for (const line of readFileSync(session!, "utf8").split("\n").filter(Boolean)) {
      const e = JSON.parse(line); const m = e.message;
      if (e.type !== "message" || m?.role !== "assistant") continue;
      for (const c of m.content ?? []) if (c.type === "toolCall") {
        i++;
        if (WRITE.has(c.name) && firstWrite < 0) firstWrite = i;
        if (firstRead.length < 4) firstRead.push(`${c.name} ${String(c.arguments?.path ?? c.arguments?.command ?? c.arguments?.query ?? "").slice(0, 60)}`);
      }
    }
  }
  const usd = ((usage.input ?? 0) * PRICE.input + (usage.output ?? 0) * PRICE.output + (usage.cacheRead ?? 0) * PRICE.cacheRead + (usage.cacheWrite ?? 0) * PRICE.cacheWrite) / 1e6;
  const atCut = readFileSync(join(log, "git-at-cut.txt"), "utf8").trim().split("\n").length - 1;
  console.log(JSON.stringify({ arm, cutAt: before.wall_s, resumeWall: resumeMeta.wall_s, resumeUsd: Number(usd.toFixed(3)), resumeTokens: Math.round(((usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.output ?? 0)) / 1000) + "k",
    firstWriteAtTool: firstWrite, firstLooks: firstRead, commitsAtCut: atCut, commitsAfter: after.git.commits, docs: after.docs }));
}
