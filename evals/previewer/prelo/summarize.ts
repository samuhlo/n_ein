// [DATA] Métricas desde las etiquetas explícitas, nunca desde «la sonda falló».
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const labels = JSON.parse(readFileSync(join(here, "labels.json"), "utf8"));
const references = JSON.parse(readFileSync(join(here, "references-dev.json"), "utf8")).defects as { id: string; pr: number }[];
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2;
};
const variants = ["baseline-clean", "candidate"];
const results = Object.fromEntries(variants.map(variant => {
  const rows = readFileSync(join(here, "results", `${variant}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
  if (rows.length !== 10 || new Set(rows.map(row => row.pr)).size !== 10 || rows.some(row => row.status !== "done"))
    throw new Error(`${variant}: faltan revisiones completas`);
  const cases = rows.map(row => {
    const judgments = labels.variants[variant]?.[String(row.pr)];
    if (!Array.isArray(judgments) || judgments.length !== row.findings.length
      || new Set(judgments.map((j: any) => j.finding)).size !== row.findings.length
      || judgments.some((j: any) => !["valid", "preexisting", "invalid", "unclear"].includes(j.verdict))
      || judgments.some((j: any) => !row.findings.some((f: any) => f.n === j.finding)))
      throw new Error(`${variant} PR ${row.pr}: faltan etiquetas o están duplicadas`);
    return { pr: row.pr, findings: row.findings.length, valid: judgments.filter((j: any) => j.verdict === "valid").map((j: any) => j.defect as string),
      preexisting: judgments.filter((j: any) => j.verdict === "preexisting").length,
      invalid: judgments.filter((j: any) => j.verdict === "invalid").length,
      unclear: judgments.filter((j: any) => j.verdict === "unclear").length,
      seconds: row.seconds, usd: row.usage?.usd ?? null, usage: row.usage,
      rejected: row.rejected.length, contamination: row.contamination,
      probesFailed: row.findings.filter((f: any) => f.probe?.reproduced).length };
  });
  const found = new Set<string>(cases.flatMap(c => c.valid));
  const known = references.filter(ref => found.has(ref.id)).map(ref => ref.id);
  return [variant, { cases, findings: cases.reduce((sum, c) => sum + c.findings, 0),
    valid: found.size, preexisting: cases.reduce((sum, c) => sum + c.preexisting, 0),
    invalid: cases.reduce((sum, c) => sum + c.invalid, 0), unclear: cases.reduce((sum, c) => sum + c.unclear, 0),
    seconds: cases.reduce((sum, c) => sum + c.seconds, 0), medianSeconds: median(cases.map(c => c.seconds)),
    maxSeconds: Math.max(...cases.map(c => c.seconds)),
    estimatedUsd: cases.every(c => c.usd !== null) ? cases.reduce((sum, c) => sum + c.usd!, 0) : null,
    knownDevelopment: { found: known, total: references.length, missed: references.filter(ref => !found.has(ref.id)).map(ref => ref.id), note: "Referencias de desarrollo; no mide recall reservado ni exhaustivo." },
  }];
}));
const base = new Set<string>(results["baseline-clean"].cases.flatMap((c: { valid: string[] }) => c.valid));
const candidate = new Set<string>(results.candidate.cases.flatMap((c: { valid: string[] }) => c.valid));
const metrics = { schema: 1, generatedAt: new Date().toISOString(), assessor: labels.assessor, results,
  paired: { common: [...base].filter(id => candidate.has(id)), candidateOnly: [...candidate].filter(id => !base.has(id)),
    baselineOnly: [...base].filter(id => !candidate.has(id)), union: [...new Set([...base, ...candidate])] },
  limitations: ["Una pasada por configuración; variación del modelo sin intervalo estadístico.", "Misma cadena, sin independencia entre PR.", "Etiquetas del agente con evidencia; sin validación humana de Samu.", "Importes estimados del runtime, no facturas."] };
writeFileSync(join(here, "results/metrics.json"), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
