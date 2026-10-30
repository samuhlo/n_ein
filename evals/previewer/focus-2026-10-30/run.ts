// [BENCH] FOCO DE REVISIÓN, SIN CAMBIAR EL MODELO
// Misma fuente, dos bases de datos, orden alternado. La candidata se congela
// antes de ejecutar; las etiquetas no se entregan al revisor.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { materialize, type Case } from "../bench.ts";
import { review, REVIEWER } from "../../../previewer/src/engine.ts";
import { piRunner } from "../../../previewer/src/runner.ts";
import { ReviewStore } from "../../../previewer/src/store.ts";
const root = resolve(import.meta.dir, "../../.."),
  output = join(root, ".n_ein/focus-20261030");
mkdirSync(output, { recursive: true });
const candidate = readFileSync(join(import.meta.dir, "candidate.md"), "utf8");
const hash = createHash("sha256").update(candidate).digest("hex");
const manifest = JSON.parse(
  readFileSync(join(root, "evals/previewer/cases.json"), "utf8"),
);
const ids = ["lang-dev-01", "lang-eval-02", "plan-fechas", "nein-receipts"];
const cases: Case[] = ids.map((id) =>
  manifest.cases.find((c: Case) => c.id === id),
);
for (const [id, category, message] of [
  [
    "reserved-race",
    "bug",
    "Simplify registry cleanup without changing replacement semantics",
  ],
  [
    "reserved-unicode",
    "correct",
    "Fix truncation to count Unicode code points",
  ],
] as const) {
  cases.push({
    id,
    category,
    split: "reserved",
    origin: "fresh-fixture",
    source: { kind: "dir", path: `focus-2026-10-30/${id}`, message },
  });
  ids.push(id);
}
process.env.N_EIN_HOME = join(output, "home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_AGENT_DIR = join(homedir(), ".n_ein/dev/pi-agent");
process.env.N_EIN_PI_BIN = join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
process.env.N_EIN_CODEGRAPH_BIN = join(
  homedir(),
  ".n_ein/runtimes/codegraph/1.6.1/bin/codegraph",
);
const metadata = {
  candidate: hash,
  model: REVIEWER,
  cases: ids,
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
};
const meta = join(output, "manifest.json");
if (
  existsSync(meta) &&
  JSON.parse(readFileSync(meta, "utf8")).candidate !== hash
)
  throw new Error("Candidata distinta; conserva la ejecución anterior");
if (!existsSync(meta)) writeFileSync(meta, JSON.stringify(metadata, null, 2));
const stop = new AbortController();
process.once("SIGINT", () => stop.abort());
process.once("SIGTERM", () => stop.abort());
const runner = piRunner(root);
for (let i = 0; i < cases.length; i++) {
  const item = cases[i],
    repo = join(output, "repos", item.id);
  if (!existsSync(repo)) materialize(item, repo);
  for (const variant of i % 2
    ? ["candidate", "baseline"]
    : ["baseline", "candidate"]) {
    const file = join(output, `${item.id}-${variant}.json`);
    if (existsSync(file) || stop.signal.aborted) continue;
    console.log(`[BENCH] >> REVIEW :: case: ${item.id} | variant: ${variant}`);
    const store = new ReviewStore(join(output, `${item.id}-${variant}.db`)),
      started = Date.now();
    try {
      const result = await review({
        packageRoot: root,
        cwd: repo,
        base: "main",
        head: "change",
        store,
        signal: stop.signal,
        timeoutMs: 300000,
        runner: (r) =>
          runner({
            ...r,
            prompt:
              r.prompt + (variant === "candidate" ? `\n\n${candidate}` : ""),
          }),
      });
      writeFileSync(
        file,
        JSON.stringify(
          {
            case: item.id,
            split: item.split,
            variant,
            candidate: hash,
            seconds: (Date.now() - started) / 1000,
            ...result,
          },
          null,
          2,
        ),
      );
      console.log(
        `[BENCH] ++ RESULT :: status: ${result.run.status} | findings: ${result.findings.length}`,
      );
      if (
        result.run.error &&
        /quota|unauthorized|authentication|not logged/i.test(result.run.error)
      ) {
        stop.abort();
        break;
      }
    } finally {
      store.close();
    }
  }
}
