// [BENCH] Cadena pequeña con Sol 6.1 real: detectar → conservar → corregir → integrar.
// Es aceptación del producto, no una estimación de cobertura de detección.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { materialize } from "./bench.ts";
import { ChainStore, reviewChain } from "../../previewer/src/chains.ts";
import { ReviewStore } from "../../previewer/src/store.ts";
import { piRunner } from "../../previewer/src/runner.ts";

const root = resolve(import.meta.dir, "../..");
const out = join(root, ".n_ein", `chain-live-${Date.now()}`), repo = join(out, "quote");
mkdirSync(out, { recursive: true });
process.env.N_EIN_HOME = join(out, "home"); process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_AGENT_DIR ??= join(homedir(), ".n_ein/dev/pi-agent");
process.env.N_EIN_PI_BIN ??= join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
process.env.N_EIN_CODEGRAPH_BIN ??= join(homedir(), ".n_ein/runtimes/codegraph/1.6.1/bin/codegraph");
materialize({ id: "quote", split: "dev", category: "bug", origin: "acceptance", source: {
  kind: "dir", path: "lang/dev-01", message: "Simplify quote output while preserving checkout behaviour",
} }, repo);
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("branch", "one"); git("switch", "-qc", "two");
writeFileSync(join(repo, "README.md"), "Checkout returns the number of cents supplied by its caller.\n");
git("add", "."); git("commit", "-qm", "Document the checkout contract"); git("switch", "-qc", "three");
writeFileSync(join(repo, "pricing.py"), readFileSync(join(root, "evals/previewer/lang/dev-01/base/pricing.py")));
git("add", "."); git("commit", "-qm", "Restore the quote contract used by checkout");
const store = new ReviewStore(join(out, "review.db"));
const definition = { name: "Quote acceptance", base: "main", steps: [{ name: "PR 1", head: "one" }, { name: "PR 2", head: "two" }, { name: "PR 3", head: "three" }] };
writeFileSync(join(out, "input.json"), JSON.stringify(definition, null, 2));
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
let chosen: string | undefined;
const native = piRunner(root);
console.log(`[BENCH] >> CHAIN_LIVE :: out: ${out}`);
try {
  const result = await reviewChain({ packageRoot: root, cwd: repo, definition, store, signal: controller.signal,
    runner: async request => {
      const session = new ChainStore(store).find(repo, definition.name)!;
      const previous = store.findings(session.id).find(f => f.probe?.outcome === "reproduced");
      if (!chosen && previous) {
        chosen = previous.thread;
        store.rate(previous.id, "vale", "Fixture de aceptación, decisión automática sin representar al usuario.");
        store.select(previous.id, true);
      }
      return native(request);
    } });
  writeFileSync(join(out, "result.json"), JSON.stringify(result, null, 2));
  writeFileSync(join(out, "runs.json"), JSON.stringify(store.runs(result.session.id), null, 2));
  assert.equal(result.chain.complete, true);
  assert.ok(chosen, "el primer tramo debe producir una reproducción explícita");
  const finding = result.findings.find(f => f.thread === chosen)!;
  assert.equal(finding.status, "resolved");
  assert.equal(finding.selected, true);
  assert.equal(finding.rating?.verdict, "vale");
  assert.equal(result.findings.length, 1, "el mismo fallo no debe abrir otros hilos entre tramos");
  assert.deepEqual(result.chain.history[chosen]?.map(e => e.stage), ["PR 1", "PR 2", "PR 3", "Integración"]);
  const runs = store.runs(result.session.id).length;
  const resumed = await reviewChain({ packageRoot: root, cwd: repo, definition, store });
  assert.equal(resumed.chain.complete, true);
  assert.equal(store.runs(result.session.id).length, runs, "abrir de nuevo el snapshot completo no hace inferencia");
  assert.equal(git("status", "--porcelain"), "");
  console.log(`[BENCH] ++ CHAIN_LIVE_OK :: out: ${out}`);
} finally { store.close(); }
