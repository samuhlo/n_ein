// =============================================================================
// [BENCH] DIEZ PR ENCADENADAS DE PRELO
// Fija los árboles de cada PR sin exponer los commits siguientes al revisor.
// Una base de datos por variante evita pasarle los hallazgos del comparador.
// Uso: bun evals/previewer/prelo/run.ts baseline|candidate [1,2,...,10]
// =============================================================================

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { materialize, contamination, type Case } from "../bench.ts";
import { review, REVIEWER } from "../../../previewer/src/engine.ts";
import { ReviewStore } from "../../../previewer/src/store.ts";

const root = resolve(import.meta.dir, "../../..");
const manifest = JSON.parse(readFileSync(join(import.meta.dir, "manifest.json"), "utf8")) as {
  prs: { number: number; url: string; base: string; head: string; split: "dev" | "reserved" }[];
};
const variant = process.argv[2];
if (!variant || !/^[a-z][a-z0-9-]*$/.test(variant)) throw new Error("indica una variante: baseline o candidate");
const selected = process.argv[3]?.split(",").map(Number) ?? manifest.prs.map(p => p.number);
if (selected.some(n => !manifest.prs.some(p => p.number === n))) throw new Error("PR desconocida");
const source = process.env.PRELO_SOURCE ?? join(homedir(), "Documents/01_Proyectos/prelo");
const out = join(root, ".n_ein/prelo-bench-20261027");
const results = join(out, variant);
mkdirSync(results, { recursive: true });

// Datos aislados, credenciales en su hogar nativo: nunca se copian al banco.
process.env.N_EIN_HOME = join(out, "home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_AGENT_DIR ??= join(homedir(), ".n_ein/dev/pi-agent");
process.env.N_EIN_PI_BIN ??= join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
process.env.N_EIN_CODEGRAPH_BIN ??= join(homedir(), ".n_ein/runtimes/codegraph/1.6.1/bin/codegraph");
const git = (repo: string, ...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const fingerprint = () => Object.fromEntries([
  "previewer/agent/reviewer.md", "previewer/src/engine.ts", "previewer/src/runner.ts", "previewer/src/report.ts",
  "bin/n-ein-codegraph", "pi-package/extensions/codegraph.ts", "previewer/agent/guard.ts", "previewer/src/sandbox.ts",
  "previewer/src/probe-result.ts",
].map(path => [path, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")]));
const hashes = fingerprint();
const metadata = join(results, "run.json");
if (existsSync(metadata)) {
  if (JSON.stringify(JSON.parse(readFileSync(metadata, "utf8")).hashes) !== JSON.stringify(hashes))
    throw new Error("la variante ya existe con otro código: usa otro nombre");
} else {
  writeFileSync(metadata, JSON.stringify({ variant, started: new Date().toISOString(), commit: git(root, "rev-parse", "HEAD"), ...REVIEWER, hashes }, null, 2));
  writeFileSync(join(results, "reviewer.md"), readFileSync(join(root, "previewer/agent/reviewer.md")));
}
const original = { status: git(source, "status", "--porcelain"), refs: git(source, "show-ref") };
const store = new ReviewStore(join(results, "previewer.db"));
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
  for (const pr of manifest.prs.filter(p => selected.includes(p.number))) {
    if (controller.signal.aborted || existsSync(join(results, "STOP"))) break;
    const target = join(results, `pr-${pr.number}.json`);
    // No sobrescribir intentos fallidos ni cobrar de nuevo sin dejar rastro.
    if (existsSync(target)) continue;
    if (JSON.stringify(fingerprint()) !== JSON.stringify(hashes)) throw new Error("cambió el revisor durante la ejecución");
    const item: Case = { id: `prelo-${pr.number}`, split: pr.split, category: "context", origin: "prelo-ob",
      source: { kind: "git", repo: source, base: pr.base, head: pr.head } };
    const repo = join(out, "repos", item.id);
    if (!existsSync(repo)) materialize(item, repo);
    // Verifica los árboles: los SHA sintéticos cambian, el código no.
    if (git(repo, "rev-parse", "main^{tree}") !== git(source, "rev-parse", `${pr.base}^{tree}`)
      || git(repo, "rev-parse", "change^{tree}") !== git(source, "rev-parse", `${pr.head}^{tree}`))
      throw new Error(`árbol distinto en PR ${pr.number}`);
    console.log(`[BENCH] >> PR_START :: variant: ${variant} | pr: ${pr.number}`);
    const started = Date.now();
    const outcome = await review({ packageRoot: root, cwd: repo, base: "main", head: "change", prUrl: pr.url, store, signal: controller.signal });
    const runDir = join(process.env.N_EIN_HOME, "dev/previewer/runs", outcome.run.id);
    const result = { pr: pr.number, originalBase: pr.base, originalHead: pr.head, seconds: (Date.now() - started) / 1000,
      contamination: contamination(runDir, item), runDir, ...outcome };
    writeFileSync(target, JSON.stringify(result, null, 2));
    console.log(`[BENCH] ++ PR_DONE :: variant: ${variant} | pr: ${pr.number} | status: ${outcome.run.status} | findings: ${outcome.findings.length} | seconds: ${result.seconds.toFixed(1)}`);
    if (outcome.run.status !== "done") throw new Error(outcome.run.error ?? "revisión incompleta");
  }
} finally {
  store.close();
  const after = { status: git(source, "status", "--porcelain"), refs: git(source, "show-ref") };
  writeFileSync(join(results, "source-integrity.json"), JSON.stringify({ before: original, after, unchanged: JSON.stringify(original) === JSON.stringify(after) }, null, 2));
}
