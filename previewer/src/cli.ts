// =============================================================================
// [FLOW] ENTRADA PROVISIONAL DEL REVISOR
// uso: bun previewer/src/cli.ts review [--base REF] [--head REF] [--model P/M]
//      [--thinking NIVEL] [--pr URL] [--json]
// `nein previewer` la sustituirá cuando el launcher la incorpore.
// =============================================================================

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { review } from "./engine.ts";

const packageRoot = resolve(import.meta.dir, "../..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    head: { type: "string" },
    model: { type: "string" },
    thinking: { type: "string" },
    pr: { type: "string" },
    project: { type: "string" },
    json: { type: "boolean", default: false },
  },
});

if (positionals[0] !== "review") {
  process.stderr.write("uso: bun previewer/src/cli.ts review [--base REF] [--head REF] [--model P/M] [--thinking NIVEL] [--pr URL] [--json]\n");
  process.exit(64);
}

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());

try {
  const outcome = await review({
    packageRoot, cwd: values.project ?? process.cwd(), base: values.base, head: values.head, prUrl: values.pr,
    model: values.model, thinking: values.thinking, signal: controller.signal,
  });
  if (values.json) process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  else {
    const { run, findings } = outcome;
    console.log(`// 000  REVISIÓN ${run.status.toUpperCase()}`);
    if (run.error) console.log(`▏ ${run.error}`);
    if (run.summary) console.log(`\n${run.summary}`);
    findings.forEach((item, index) => {
      const probe = item.probe ? (item.probe.reproduced ? " · sonda falla: demostrado" : " · sonda no reproduce") : "";
      console.log(`\n${String(index + 1).padStart(2, "0")} ${item.severity} · ${item.kind} · ${item.title}${probe}`);
      console.log(`▏ ${item.plain}`);
      for (const citation of item.citations) console.log(`▏ ${citation.ref}`);
    });
    for (const gap of run.gaps) console.log(`\n· pendiente: ${gap}`);
    if (run.rejected.length) console.log(`\n· apartados: ${run.rejected.length} (sin citas válidas o mal formados)`);
  }
  process.exit(outcome.run.status === "done" ? 0 : 1);
} catch (error) {
  process.stderr.write(`[ERR] :: REVIEW_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
