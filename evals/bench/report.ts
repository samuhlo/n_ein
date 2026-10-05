// =============================================================================
// [BENCH] TABLAS DEL INFORME
// uso: bun report.ts   → tablas en Markdown por escenario y variante
// Media de las repeticiones válidas (sin `discarded`); juez: suma de las tandas.
// =============================================================================
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const bench = process.env.N_EIN_BENCH ?? "/Users/samu/Documents/01_Proyectos/n_ein-bench";
const logs = join(bench, "logs");
const read = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const ARMS = ["A", "N1", "N1L", "N2", "N3", "G", "GE", "M", "C"];

const judged: Record<string, number[]> = {};
for (const dir of existsSync(join(bench, "judge")) ? readdirSync(join(bench, "judge")) : []) {
  const v = read(join(bench, "judge", dir, "verdict.json"));
  for (const p of v ?? []) {
    if (p.source.startsWith("control:")) continue;
    (judged[p.source] ??= []).push(p.correccion + p.tests + p.alcance + p.legibilidad + p.documentacion);
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
for (const s of ["s1", "s2", "s3"]) {
  console.log(`\n### ${s.toUpperCase()}\n\n| Variante | n | Coste | Tiempo | Tokens | Oculta | Tests rotos | Juez (0–25) | Commits | Hijos | Doc |\n|---|---:|---:|---:|---:|---|---|---|---:|---:|---|`);
  for (const arm of ARMS) {
    const runs = [1, 2].map((r) => `${s}-${arm}-r${r}`).filter((r) => existsSync(join(logs, r, "metrics.json")) && !existsSync(join(logs, r, "discarded")));
    if (!runs.length) continue;
    const M = runs.map((r) => read(join(logs, r, "metrics.json")));
    const G = runs.map((r) => read(join(logs, r, "grade.json")) ?? {});
    const J = runs.flatMap((r) => judged[r] ?? []);
    const tok = mean(M.map((m) => m.usage.total.input + m.usage.total.cacheRead + m.usage.total.output)) / 1e6;
    console.log(`| ${arm} | ${runs.length} | $${mean(M.map((m) => m.usage.usd)).toFixed(2)} | ${Math.round(mean(M.map((m) => m.wall_s)))} s | ${tok.toFixed(2)}M | ${G.map((g) => g.hidden ?? "?").join(" · ")} | ${G.map((g) => g.suiteFailed ?? "?").join(" · ")} | ${J.length ? J.join(" · ") : "—"} | ${M.map((m) => m.git.commits).join(" · ")} | ${M.map((m) => Object.values(m.childRoles as Record<string, number>).reduce((a, b) => a + b, 0)).join(" · ")} | ${M.map((m) => (m.docs.length ? "sí" : "no")).join(" · ")} |`);
  }
}

console.log(`\n### S4a\n\n| Variante | Corte | Coste al retomar | Tiempo al retomar | Oculta final | Doc final | Test montado |\n|---|---:|---:|---:|---|---|---|`);
for (const arm of ARMS) {
  const cut = `s3-${arm}-r1-cut`;
  const before = read(join(logs, cut, "metrics-cut.json")), after = read(join(logs, cut, "metrics.json"));
  const resume = read(join(logs, `s3-${arm}-r1-resume`, "meta.json")), g = read(join(logs, cut, "grade.json"));
  if (!before || !resume) continue;
  const resumeUsd = arm === "C" ? NaN : after.usage.usd - before.usage.usd;
  console.log(`| ${arm} | ${before.wall_s} s | ${Number.isNaN(resumeUsd) ? "ver s4-report" : "$" + resumeUsd.toFixed(2)} | ${resume.wall_s} s | ${g?.hidden ?? "?"} | ${g?.extra?.docFixed ?? "?"} | ${g?.extra?.mount ? `${g.extra.mount.mounts ? "monta" : "texto"} · ${g.extra.mount.mutantsKilled}/2` : "?"} |`);
}
