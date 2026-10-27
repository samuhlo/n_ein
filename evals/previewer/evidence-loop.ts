// =============================================================================
// [BENCH] REVISIÓN REAL → ARREGLO → CONFIRMACIÓN
// Reutiliza un caso mínimo conocido. Solo se modifica su reconstrucción aislada;
// el modelo y la guardia son los del producto. No mide cobertura de detección.
// =============================================================================
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { materialize, contamination, type Case } from "./bench.ts";
import { review } from "../../previewer/src/engine.ts";
import { ReviewStore } from "../../previewer/src/store.ts";
import { handoffBrief } from "../../previewer/src/handoff.ts";

const root = resolve(import.meta.dir, "../..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = join(root, ".n_ein", `evidence-loop-${stamp}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "run.json"), JSON.stringify({ started: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  files: Object.fromEntries(["previewer/src/engine.ts", "previewer/src/probe-result.ts", "previewer/agent/reviewer.md"].map(path =>
    [path, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")])),
  purpose: "Functional acceptance, known bug; not a detection benchmark", runtime: JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")),
}, null, 2));
process.env.N_EIN_HOME = join(out, "home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_AGENT_DIR ??= join(homedir(), ".n_ein/dev/pi-agent");
process.env.N_EIN_PI_BIN ??= join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
process.env.N_EIN_CODEGRAPH_BIN ??= join(homedir(), ".n_ein/runtimes/codegraph/1.6.1/bin/codegraph");
const repo = join(out, "quote");
const item: Case = { id: "quote", split: "dev", category: "bug", origin: "acceptance",
  source: { kind: "dir", path: "lang/dev-01", message: "Simplify the returned quote without changing checkout behaviour." } };
materialize(item, repo);
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const store = new ReviewStore(join(out, "review.db"));
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
async function run(label: string) {
  const result = await review({ packageRoot: root, cwd: repo, base: "main", head: "change", store, signal: controller.signal });
  const runDir = join(process.env.N_EIN_HOME!, "dev/previewer/runs", result.run.id);
  writeFileSync(join(out, `${label}.json`), JSON.stringify({ ...result, contamination: contamination(runDir, item) }, null, 2));
  assert.equal(result.run.status, "done", result.run.error ?? "");
  assert.deepEqual(contamination(runDir, item), []);
  return result;
}
try {
  console.log(`[BENCH] >> EVIDENCE_LOOP :: out: ${out}`);
  const first = await run("before");
  const finding = first.findings.find(f => f.probe?.outcome === "reproduced");
  assert.ok(finding, "el revisor real debe generar una sonda explícita que reproduzca el fallo conocido");
  store.rate(finding.id, "vale", "Valoración automática del fixture de aceptación, no decisión del usuario.");
  store.select(finding.id, true);
  writeFileSync(join(out, "handoff.txt"), handoffBrief(first.session, store.selection(first.session.id), git("rev-parse", "HEAD")));
  // Arreglo conocido del fixture; no se usa como contexto de la primera revisión.
  writeFileSync(join(repo, "pricing.py"), readFileSync(join(root, "evals/previewer/lang/dev-01/base/pricing.py")));
  git("add", "pricing.py"); git("commit", "-qm", "Restore the quote contract required by checkout");
  const second = await run("after");
  const updated = second.findings.find(f => f.thread === finding.thread);
  assert.equal(updated?.status, "resolved");
  assert.equal(updated?.check?.probe?.outcome, "passed");
  assert.equal(updated?.selected, true);
  assert.equal(updated?.rating?.verdict, "vale");
  assert.equal(store.selection(first.session.id).length, 0);
  assert.equal(git("status", "--porcelain"), "");
  console.log(`[BENCH] ++ EVIDENCE_LOOP_OK :: thread: ${finding.thread} | out: ${out}`);
} finally { store.close(); }
