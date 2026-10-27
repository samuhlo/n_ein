// [BENCH] PR 2→3→4 de Prelo: hilos, escenario obsoleto e integración con comandos
// reales. Informes controlados; no se atribuye capacidad de detección a este ensayo.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ChainStore, planChain, reviewChain } from "../../../previewer/src/chains.ts";
import { ReviewStore } from "../../../previewer/src/store.ts";

const root = resolve(import.meta.dir, "../../..");
const origin = process.env.PRELO_SOURCE ?? join(homedir(), "Documents/01_Proyectos/prelo");
const out = join(root, ".n_ein", `prelo-chain-${Date.now()}`), repo = join(out, "prelo");
mkdirSync(out, { recursive: true }); process.env.N_EIN_HOME = join(out, "home");
const original = (...args: string[]) => execFileSync("git", args, { cwd: origin, encoding: "utf8" }).trim();
const before = { status: original("status", "--porcelain"), refs: original("show-ref") };
const prs = JSON.parse(readFileSync(join(import.meta.dir, "manifest.json"), "utf8")).prs as { number: number; base: string; head: string; url: string }[];
const all = { name: "Prelo beta", base: prs[0]!.base, steps: prs.map(p => ({ name: `PR ${p.number}`, base: p.base, head: p.head, prUrl: p.url })) };
writeFileSync(join(out, "ten-pr-plan.json"), JSON.stringify(planChain(origin, all), null, 2));
execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", origin, repo]);
execFileSync("git", ["remote", "remove", "origin"], { cwd: repo });
const subset = prs.filter(p => p.number >= 2 && p.number <= 4);
const definition = { name: "Prelo upload", base: subset[0]!.base,
  steps: subset.map(p => ({ name: `PR ${p.number}`, base: p.base, head: p.head, prUrl: p.url })) };
const store = new ReviewStore(join(out, "review.db"));
const file = ".previewer-probes/upload.py";
let thread: string | undefined;
try {
  const result = await reviewChain({ packageRoot: root, cwd: repo, definition, store, model: "fixture/prelo", runner: async req => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: req.cwd, encoding: "utf8" }).trim();
    const session = new ChainStore(store).find(repo, definition.name)!;
    const known = store.findings(session.id)[0];
    if (known && !thread) { thread = known.thread; store.rate(known.id, "vale", "Fixture del banco"); store.select(known.id, true); }
    const previous = req.prompt.match(/^(P\d+)\. Subida bloqueada/m)?.[1];
    const line = (path: string, needle: string) => readFileSync(join(req.cwd, path), "utf8").split("\n").findIndex(l => l.includes(needle)) + 1;
    mkdirSync(join(req.cwd, ".previewer-probes"), { recursive: true }); writeFileSync(join(req.cwd, file), readFileSync(join(import.meta.dir, "probe-upload.py")));
    const findings = head === subset[0]!.head || head === subset[1]!.head ? [{ kind: "bug", severity: "high", title: "Subida bloqueada",
      plain: "La orden restaurada no tiene archivo y no se puede cancelar.", condition: "restaurar una subida pendiente", consequence: "queda bloqueada",
      citations: [`server/margen/kobo.py@${head}:L${line("server/margen/kobo.py", "def cancel(")}`], previous,
      probe: { command: `uv run --project server python ${file}`, file, protocol: "nein-probe-v1", check: "pending-upload-recoverability" }, verification: "" }] : [];
    // En PR 4 la sonda declara «no aplica»; la integración aporta la evidencia actual del arreglo.
    const resolved = req.prompt.includes("final integration review") ? [{ previous, note: "El backup incluye los EPUB pendientes y la restauración conserva los bytes.",
      citations: [`server/margen/library.py@${head}:L${line("server/margen/library.py", 'archive.write(file, ".uploads/"')}`] }] : [];
    return { text: JSON.stringify({ summary: "Caso de Prelo", findings, resolved }), error: null, usage: { input: 0, output: 0, cacheRead: 0, usd: 0 } };
  } });
  writeFileSync(join(out, "result.json"), JSON.stringify(result, null, 2));
  assert.equal(result.chain.complete, true); assert.equal(result.findings.length, 1);
  assert.ok(thread); assert.equal(result.findings[0]?.thread, thread);
  assert.equal(result.findings[0]?.selected, true); assert.equal(result.findings[0]?.status, "resolved");
  assert.deepEqual(result.chain.history[thread]?.map(e => e.outcome), ["detected", "persists", "unchecked", "resolved"]);
  assert.equal(store.selection(result.session.id).length, 0);
  assert.deepEqual({ status: original("status", "--porcelain"), refs: original("show-ref") }, before);
  console.log(`[BENCH] ++ PRELO_CHAIN_OK :: out: ${out}`);
} finally { store.close(); }
