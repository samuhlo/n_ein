// [DATA] Exporta evidencia revisable sin sesiones, credenciales ni bases SQLite.
// Las valoraciones se guardan aparte: ninguna puntuación se infiere de un exit 1.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const bank = join(root, ".n_ein/prelo-bench-20261027");
const out = join(import.meta.dir, "results");
const notes = JSON.parse(readFileSync(join(import.meta.dir, "variants.json"), "utf8"));
mkdirSync(out, { recursive: true });
const variants = process.argv.slice(2);
if (!variants.length) throw new Error("indica las variantes que quieres exportar");
const sanitize = (value: unknown): unknown => JSON.parse(JSON.stringify(value).replaceAll(root, "<n_ein>"));
for (const variant of variants) {
  if (!/^[a-z][a-z0-9-]*$/.test(variant)) throw new Error("variante inválida");
  const folder = join(bank, variant);
  const rows = readdirSync(folder).filter(n => /^pr-\d+\.json$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0])).map(name => {
    const data = JSON.parse(readFileSync(join(folder, name), "utf8"));
    const probes = new Map<string, string>();
    const path = join(data.runDir, "events.jsonl");
    if (existsSync(path)) for (const line of readFileSync(path, "utf8").split("\n")) {
      try {
        const event = JSON.parse(line);
        if (event.type === "tool_execution_start" && event.toolName === "write"
          && /^\.previewer-probes\/[^.]/.test(event.args?.path) && typeof event.args?.content === "string")
          probes.set(event.args.path, event.args.content);
      } catch { /* Una línea final cortada no borra las anteriores. */ }
    }
    // La fuente que el motor conservó es posterior a los posibles edit del agente.
    for (const finding of data.findings) if (finding.probe?.file && finding.probe.source)
      probes.set(finding.probe.file, finding.probe.source);
    return sanitize({ variant, evaluationContext: notes[variant] ?? null, pr: data.pr, originalBase: data.originalBase, originalHead: data.originalHead,
      reviewedBase: data.run.baseSha, reviewedHead: data.run.headSha, seconds: data.seconds,
      status: data.run.status, error: data.run.error, model: data.run.model, thinking: data.run.thinking,
      usage: data.run.usage ?? null, summary: data.run.summary, gaps: data.run.gaps, rejected: data.run.rejected,
      contamination: data.contamination, tour: data.run.tour,
      findings: data.findings.map((f: any, i: number) => ({ n: i + 1, kind: f.kind, severity: f.severity, title: f.title,
        plain: f.plain, condition: f.condition, consequence: f.consequence, citations: f.citations,
        probe: f.probe, verification: f.verification })),
      scratchWrites: Object.fromEntries(probes), scratchWritesNote: "Auxiliary write events; later edits to non-primary helper files may not be reflected. Full events remain local.",
    });
  });
  writeFileSync(join(out, `${variant}.jsonl`), rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  writeFileSync(join(out, `${variant}-run.json`), JSON.stringify(sanitize(JSON.parse(readFileSync(join(folder, "run.json"), "utf8"))), null, 2));
  writeFileSync(join(out, `${variant}-reviewer.md`), readFileSync(join(folder, "reviewer.md")));
  console.log(`[BENCH] ++ EXPORTED :: variant: ${variant} | reviews: ${rows.length}`);
}
const validation = join(bank, "validation");
if (existsSync(validation)) {
  const rows = readdirSync(validation).filter(name => name.endsWith(".json")).sort().map(name => ({
    file: name, evidence: sanitize(JSON.parse(readFileSync(join(validation, name), "utf8"))),
  }));
  writeFileSync(join(out, "replays.jsonl"), rows.map(row => JSON.stringify(row)).join("\n") + "\n");
}
