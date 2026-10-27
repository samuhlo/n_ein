// [CHECK] Repite sondas guardadas en árboles congelados, dentro del aislamiento.
// Uso: bun evals/previewer/prelo/replay.ts <variante> <PR> base|head|tip
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createCopy } from "../../../previewer/src/copy.ts";
import { reviewGuard } from "../../../previewer/src/guard-rules.ts";
import { sandboxFor } from "../../../previewer/src/sandbox.ts";
import { probeExecutionFailure } from "../../../previewer/src/probe-result.ts";
import { materialize } from "../bench.ts";

const root = resolve(import.meta.dir, "../../..");
const bank = join(root, ".n_ein/prelo-bench-20261027");
const [variant, n, side] = process.argv.slice(2);
const adapted = process.argv[5] === "adapt";
const overrides = adapted ? JSON.parse(readFileSync(join(import.meta.dir, "tip-fixtures.json"), "utf8")) : {};
if (!variant || !/^[a-z][a-z0-9-]*$/.test(variant) || !n || !/^\d+$/.test(n) || !["base", "head", "tip"].includes(side ?? ""))
  throw new Error("uso: replay.ts variante PR base|head|tip");
const local = join(bank, variant, `pr-${n}.json`);
const data = existsSync(local) ? JSON.parse(readFileSync(local, "utf8"))
  : readFileSync(join(import.meta.dir, "results", `${variant}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line)).find(row => row.pr === Number(n));
if (!data) throw new Error("no hay evidencia guardada de esa PR");
const repo = join(bank, "repos", `prelo-${side === "tip" ? 10 : n}`);
const source = process.env.PRELO_SOURCE ?? join(homedir(), "Documents/01_Proyectos/prelo");
if (!existsSync(repo)) {
  const pr = JSON.parse(readFileSync(join(import.meta.dir, "manifest.json"), "utf8")).prs.find((p: any) => p.number === Number(side === "tip" ? 10 : n));
  if (!pr) throw new Error("PR fuera del manifiesto");
  materialize({ id: `prelo-${pr.number}`, split: pr.split, category: "context", origin: "prelo-ob",
    source: { kind: "git", repo: source, base: pr.base, head: pr.head } }, repo);
}
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const sha = git("rev-parse", side === "base" ? "main" : "change");
const copy = createCopy(repo, { baseSha: git("rev-parse", "main"), headSha: sha }, `replay-${process.pid}`);
try {
  const guard = reviewGuard(copy.path, repo);
  const sandbox = sandboxFor(copy.path, repo);
  if (sandbox.kind === "none") throw new Error("la repetición necesita aislamiento del sistema");
  // Solo se leen dependencias ya instaladas. La fuente del proyecto viene del SHA.
  const modules = join(copy.path, "plugin/node_modules");
  if (!existsSync(modules)) symlinkSync(join(source, "plugin/node_modules"), modules, "dir");
  const results = [];
  for (const [index, finding] of data.findings.entries()) {
    const probe = finding.probe;
    if (!probe?.file || !probe.source) continue;
    if (guard("write", { path: probe.file }, copy.path)) throw new Error("ruta de sonda fuera de la copia");
    mkdirSync(dirname(join(copy.path, probe.file)), { recursive: true });
    let probeSource = probe.source as string;
    const adjustments = overrides[`${variant}:${n}:${index + 1}`] ?? [];
    for (const { before, after } of adjustments) {
      if (!probeSource.includes(before)) throw new Error("el ajuste de fixture no coincide con la sonda guardada");
      probeSource = probeSource.replaceAll(before, after);
    }
    writeFileSync(join(copy.path, probe.file), probeSource);
    // Sustituye solo el lanzador Python por el entorno local, sin sincronizar locks.
    const python = join(source, "server/.venv/bin/python");
    const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
    const command = probe.command.replace(/^npm (?:--prefix plugin ci|ci --prefix plugin)(?: --no-audit| --no-fund| --ignore-scripts)* && /, "")
      .replace(/(^|[\s;&])(?:server\/)?\.venv\/bin\/python(?=\s|$)/g,
      (_: string, before: string) => before + quote(python)).replace(/uv run(?: --project server)?(?: --group dev)? (pytest|python)\b/g,
      (_: string, tool: string) => `${quote(python)}${tool === "pytest" ? " -m pytest" : ""}`);
    if (guard("bash", { command }, copy.path)) throw new Error("comando fuera del alcance de revisión");
    const wrapped = sandbox.wrap(command);
    const result = spawnSync(wrapped.file, wrapped.args, { cwd: copy.path, encoding: "utf8", timeout: 120_000,
      env: { ...process.env, PYTHONPATH: join(copy.path, "server"), PYTHONDONTWRITEBYTECODE: "1" }, maxBuffer: 2 << 20 });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    results.push({ n: index + 1, title: finding.title, originalCommand: probe.command, command, adjustments, source: probeSource, exit: result.status,
      executionFailure: probeExecutionFailure(result.status, output), output });
    console.log(`[BENCH] :: REPLAY :: pr: ${n} | side: ${side} | finding: ${index + 1} | exit: ${result.status}`);
  }
  const out = join(bank, "validation");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${variant}-pr-${n}-${side}${adapted ? "-adapted" : ""}.json`), JSON.stringify({ variant, pr: Number(n), side, sha, results }, null, 2));
} finally {
  copy.remove();
}
