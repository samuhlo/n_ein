// [BENCH] Dos heads reales de Prelo: la sonda antigua no debe forzar «sigue»
// cuando la PR 4 ya conserva el archivo cuya ausencia disparaba el fallo de PR 2.
// Runner de informe controlado; comandos reales en el aislamiento del producto.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { materialize } from "../bench.ts";
import { review } from "../../../previewer/src/engine.ts";
import { ReviewStore } from "../../../previewer/src/store.ts";
import { PROBE_PROTOCOL } from "../../../previewer/src/probe-result.ts";

const root = resolve(import.meta.dir, "../../..");
const out = join(root, ".n_ein", `prelo-evidence-${Date.now()}`);
const repo = join(out, "prelo");
const origin = process.env.PRELO_SOURCE ?? join(homedir(), "Documents/01_Proyectos/prelo");
process.env.N_EIN_HOME = join(out, "home");
const prs = JSON.parse(readFileSync(join(import.meta.dir, "manifest.json"), "utf8")).prs;
const initial = prs.find((p: any) => p.number === 2), fixed = prs.find((p: any) => p.number === 4);
materialize({ id: "prelo-upload", split: "dev", category: "bug", origin: "prelo-ob",
  source: { kind: "git", repo: origin, base: initial.base, head: initial.head } }, repo);
writeFileSync(join(out, "run.json"), JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  originalBase: initial.base, originalBroken: initial.head, originalFixed: fixed.head,
  runner: "controlled report, real sandboxed probes; no inference", started: new Date().toISOString(),
}, null, 2));
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const originBefore = execFileSync("git", ["status", "--porcelain"], { cwd: origin, encoding: "utf8" });
const store = new ReviewStore(join(out, "review.db"));
const file = ".previewer-probes/upload.py";
const probe = { command: `uv run --project server python ${file}`, file, protocol: PROBE_PROTOCOL, check: "pending-upload-recoverability" };
const lineOf = (path: string, needle: string) => readFileSync(join(repo, path), "utf8").split("\n").findIndex(line => line.includes(needle)) + 1;
const run = async (name: string, report: (cwd: string) => object) => {
  const outcome = await review({ packageRoot: root, cwd: repo, base: "main", head: "change", store, model: "fixture/prelo", log: console.log,
    runner: async req => ({ text: JSON.stringify({ summary: "Escenario del banco de Prelo", ...report(req.cwd) }), usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: null }) });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(outcome, null, 2));
  assert.equal(outcome.run.status, "done", outcome.run.error ?? "");
  return outcome;
};
try {
  const before = await run("before", cwd => {
    mkdirSync(join(cwd, ".previewer-probes"));
    writeFileSync(join(cwd, file), readFileSync(join(import.meta.dir, "probe-upload.py")));
    return { findings: [{ kind: "bug", severity: "high", title: "Subida bloqueada tras restaurar", plain: "La copia pierde el archivo y la orden ya no se puede cancelar.",
      condition: "restaurar una subida pendiente", consequence: "queda bloqueada", probe, verification: "",
      citations: [`server/margen/kobo.py@${git("rev-parse", "HEAD")}:L${lineOf("server/margen/kobo.py", "def cancel(")}`] }] };
  });
  const thread = before.findings[0]!;
  assert.equal(thread.probe?.outcome, "reproduced");
  store.select(thread.id, true); store.rate(thread.id, "vale", "Fixture automático del banco");
  git("rm", "-rq", ".");
  execFileSync("bash", ["-c", 'git -C "$1" archive "$2" | tar -x -C "$3"', "_", origin, fixed.head, repo]);
  git("add", "-A"); git("commit", "-qm", "Preserve pending uploads in backups (Prelo PR 4)");
  const after = await run("scenario-changed", () => ({}));
  assert.equal(after.findings[0]?.check?.probe?.outcome, "not_applicable");
  assert.equal(after.findings[0]?.status, "unchecked");
  assert.equal(after.findings[0]?.selected, true);
  const resolved = await run("code-confirmed", () => ({ resolved: [{ previous: "P1",
    note: "El backup guarda el EPUB pendiente que faltaba; los bytes restaurados coinciden en la comprobación.",
    citations: [`server/margen/library.py@${git("rev-parse", "HEAD")}:L${lineOf("server/margen/library.py", 'archive.write(file, ".uploads/"')}`] }] }));
  assert.equal(resolved.findings[0]?.status, "resolved");
  assert.match(resolved.findings[0]?.check?.note ?? "", /inspección/);
  assert.equal(store.selection(before.session.id).length, 0);
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: origin, encoding: "utf8" }), originBefore);
  console.log(`[BENCH] ++ PRELO_EVIDENCE_OK :: out: ${out}`);
} finally { store.close(); }
