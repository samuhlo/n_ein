// =============================================================================
// [BENCH] BANCO DEL REVISOR
// uso: bun evals/previewer/bench.ts run --split dev|reserved|all [--case ID]...
//        [--model P/M] [--thinking NIVEL] [--label NOMBRE]
//      bun evals/previewer/bench.ts run --resume <ejecución>
//      bun evals/previewer/bench.ts grade <ejecución> [--judge opus|pi:P/M]
//      bun evals/previewer/bench.ts agree <ejecución> <juez> <juez>
//      bun evals/previewer/bench.ts build <caso> <carpeta>
// Cada caso se reconstruye como un repositorio nuevo de dos commits, base y
// cambio: sin la historia posterior, el arreglo no se puede leer. Las
// referencias se quedan en n_ein y solo las ve el juez.
// =============================================================================

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { channelDir } from "../../pi-package/models.ts";
import { review } from "../../previewer/src/engine.ts";
import { ReviewStore, type StoredFinding } from "../../previewer/src/store.ts";

const root = resolve(import.meta.dir, "../..");
const here = import.meta.dir;
const REFERENCE_MARKER = "REFERENCE_ONLY_DO_NOT_SEND_TO_REVIEWER";
const DIFF_LIMIT = 60_000;

type Source =
  | { kind: "dir"; path: string; message: string }
  | { kind: "git"; repo: string; base: string; head: string; fix?: string };
export type Case = { id: string; split: "dev" | "reserved"; category: "bug" | "correct" | "context"; origin: string; source: Source };
type Defect = { id: string; condition: string; consequence: string; evidence_paths: string[] };
type Reference = { defects: Defect[]; context_gaps: string[]; rubric?: string; note?: string };
type Shown = Pick<StoredFinding, "kind" | "severity" | "title" | "plain" | "condition" | "consequence"> & {
  citations: { ref: string; text: string }[];
  probe: { command: string; exitCode: number | null; reproduced: boolean } | null;
};
type Result = {
  case: string; model: string; thinking: string; status: string; error: string | null; seconds: number; usd: number;
  findings: Shown[]; gaps: string[]; rejected: number; contamination: string[]; runDir: string;
};

const manifest: { version: string; cases: Case[] } = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const reference = (id: string): Reference => JSON.parse(readFileSync(join(here, "references", `${id}.json`), "utf8"));
const expand = (path: string): string => (path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);
const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const log = (line: string): void => void process.stderr.write(`${line}\n`);

// --- Reconstrucción ----------------------------------------------------------------------------

function commitAll(repo: string, message: string): void {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "--allow-empty", "-m", message);
}

/** Base en `main`, el cambio en `change`: lo mismo que vería el revisor en una rama real. */
export function materialize(item: Case, repo: string): void {
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "n_ein bench");
  git(repo, "config", "user.email", "bench@n-ein.invalid");
  git(repo, "config", "commit.gpgsign", "false");
  const source = item.source;
  const extract = (sha: string): void => {
    const origin = expand(source.kind === "git" ? source.repo : "");
    execFileSync("bash", ["-c", 'git -C "$1" archive "$2" | tar -x -C "$3"', "_", origin, sha, repo]);
  };
  if (source.kind === "dir") cpSync(join(here, source.path, "base"), repo, { recursive: true });
  else extract(source.base);
  commitAll(repo, "base");
  git(repo, "switch", "-q", "-c", "change");
  if (source.kind === "dir") {
    // En el corpus de lang-pr-review, head trae solo los archivos que sustituyen a los de base.
    cpSync(join(here, source.path, "head"), repo, { recursive: true });
    commitAll(repo, source.message);
  } else {
    git(repo, "rm", "-rq", "--ignore-unmatch", ".");
    extract(source.head);
    commitAll(repo, git(expand(source.repo), "log", "-1", "--format=%B", source.head));
  }
}

// --- Contaminación -----------------------------------------------------------------------------

/** Herramientas que nombran las referencias o los repositorios de origen, donde está el arreglo. */
export function contamination(runDir: string, item: Case): string[] {
  const path = join(runDir, "events.jsonl");
  if (!existsSync(path)) return [];
  const forbidden = [REFERENCE_MARKER, "evals/previewer", "lang-pr-review", join(root, "evals")];
  if (item.source.kind === "git") forbidden.push(expand(item.source.repo));
  const hits = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.includes('"tool_execution_start"')) continue;
    try {
      const event: { type?: string; args?: unknown } = JSON.parse(line);
      if (event.type !== "tool_execution_start") continue;
      const args = JSON.stringify(event.args ?? "");
      for (const needle of forbidden) if (args.includes(needle)) hits.add(`${needle} :: ${args.slice(0, 200)}`);
    } catch {
      // Una línea cortada no invalida el resto.
    }
  }
  return [...hits];
}

// --- run ---------------------------------------------------------------------------------------

async function run(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      split: { type: "string", default: "dev" }, case: { type: "string", multiple: true },
      model: { type: "string" }, thinking: { type: "string" }, label: { type: "string" }, resume: { type: "string" },
    },
  });
  // Reanudar repite solo lo que no terminó, con el modelo y los casos de la ejecución original.
  if (values.resume) {
    const meta: { cases: string[]; model: string | null; thinking: string | null } = JSON.parse(readFileSync(join(values.resume, "run.json"), "utf8"));
    const done = (id: string): boolean => {
      const path = join(values.resume ?? "", "results", `${id}.json`);
      return existsSync(path) && JSON.parse(readFileSync(path, "utf8")).status === "done";
    };
    Object.assign(values, { case: meta.cases.filter((id) => !done(id)), model: meta.model ?? undefined, thinking: meta.thinking ?? undefined });
    if (!values.case?.length) throw new Error(`${values.resume}: no queda nada por revisar`);
  }
  const chosen = manifest.cases.filter((item) =>
    values.case?.length ? values.case.includes(item.id) : values.split === "all" || item.split === values.split);
  if (!chosen.length) throw new Error(`ningún caso para ${values.split}${values.case ? ` / ${values.case.join(",")}` : ""}`);
  const label = values.label ?? (values.model ?? "por-defecto").replace(/[^\w.-]+/g, "_");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const out = values.resume ? resolve(values.resume) : join(channelDir(root), "bench", "previewer", `${stamp}-${label}`);
  mkdirSync(join(out, "results"), { recursive: true });
  if (!values.resume) writeFileSync(join(out, "run.json"), JSON.stringify({
    corpus: manifest.version, split: values.split, cases: chosen.map((item) => item.id), model: values.model ?? null,
    thinking: values.thinking ?? null, commit: git(root, "rev-parse", "HEAD"), started: new Date().toISOString(),
  }, null, 2));
  const store = new ReviewStore(join(out, "previewer.db"));
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  log(`[BENCH] >> RUN_START :: cases: ${chosen.length} | out: ${out}`);
  for (const item of chosen) {
    if (controller.signal.aborted) break;
    const repo = join(out, "repos", item.id);
    if (!existsSync(repo)) materialize(item, repo);
    const started = Date.now();
    log(`[BENCH] :: CASE_START :: case: ${item.id} | split: ${item.split} | category: ${item.category}`);
    let result: Result;
    try {
      const outcome = await review({
        packageRoot: root, cwd: repo, base: "main", head: "change", store, model: values.model, thinking: values.thinking,
        signal: controller.signal, log: (line) => log(`  ${line}`),
      });
      const runDir = join(channelDir(root), "previewer", "runs", outcome.run.id);
      result = {
        case: item.id, model: outcome.run.model, thinking: outcome.run.thinking, status: outcome.run.status, error: outcome.run.error,
        seconds: Math.round((Date.now() - started) / 1000), usd: outcome.run.usage?.usd ?? 0,
        findings: outcome.findings.filter((finding) => finding.current).map((finding) => ({
          kind: finding.kind, severity: finding.severity, title: finding.title, plain: finding.plain,
          condition: finding.condition, consequence: finding.consequence,
          citations: finding.citations.map((citation) => ({ ref: citation.ref, text: citation.text })),
          probe: finding.probe ? { command: finding.probe.command, exitCode: finding.probe.exitCode, reproduced: finding.probe.reproduced } : null,
        })),
        gaps: outcome.run.gaps, rejected: outcome.run.rejected.length, contamination: contamination(runDir, item), runDir,
      };
    } catch (error) {
      result = {
        case: item.id, model: values.model ?? "", thinking: values.thinking ?? "", status: "failed", error: error instanceof Error ? error.message : String(error),
        seconds: Math.round((Date.now() - started) / 1000), usd: 0, findings: [], gaps: [], rejected: 0, contamination: [], runDir: "",
      };
    }
    writeFileSync(join(out, "results", `${item.id}.json`), JSON.stringify(result, null, 2));
    log(`[BENCH] :: CASE_DONE :: case: ${item.id} | status: ${result.status} | findings: ${result.findings.length} | seconds: ${result.seconds} | usd: ${result.usd.toFixed(2)}${result.contamination.length ? ` | CONTAMINATED: ${result.contamination.length}` : ""}`);
  }
  store.close();
  log(`[BENCH] ++ RUN_DONE :: out: ${out}`);
  console.log(out);
}

// --- grade -------------------------------------------------------------------------------------

type Verdict = {
  defects: { id: string; found_by: number[]; note: string }[];
  findings: { n: number; verdict: "valid" | "invalid" | "unclear"; why: string }[];
};

function judgePrompt(item: Case, ref: Reference, result: Result, diff: string): string {
  const findings = result.findings.map((finding, index) => [
    `### Hallazgo ${index + 1} · ${finding.kind} · ${finding.severity}`,
    `Título: ${finding.title}`, `Explicación: ${finding.plain}`, `Condición: ${finding.condition}`, `Consecuencia: ${finding.consequence}`,
    ...finding.citations.map((citation) => `Cita ${citation.ref}:\n${citation.text}`),
    finding.probe ? `Sonda: \`${finding.probe.command}\` · ${finding.probe.reproduced ? "falló: fallo demostrado" : `código ${finding.probe.exitCode ?? "tiempo agotado"}`}` : "Sonda: ninguna",
  ].join("\n")).join("\n\n");
  const known = ref.defects.length
    ? ref.defects.map((defect) => `- ${defect.id}: si ${defect.condition}, entonces ${defect.consequence} (en ${defect.evidence_paths.join(", ")})`).join("\n")
    : "- Ninguno conocido.";
  const category = {
    bug: "El cambio contiene al menos un defecto conocido.",
    correct: "No se conoce ningún defecto en este cambio; el revisor no debería alarmar sin motivo.",
    context: "Al cambio le falta contexto externo. Señalar un riesgo condicionado es razonable; afirmar como probado un fallo que depende de ese contexto es exceso de certeza.",
  }[item.category];
  return [
    "Eres el juez de un banco de revisión de código. Un revisor automático revisó un cambio y devolvió hallazgos. Tu trabajo es decidir, con el material de abajo, qué defectos conocidos encontró y si cada hallazgo es válido.",
    "",
    `## Caso · ${category}`,
    ref.note ? `Nota: ${ref.note}` : "",
    ref.rubric ? `Criterio: ${ref.rubric}` : "",
    ref.context_gaps.length ? `Huecos de contexto conocidos:\n${ref.context_gaps.map((gap) => `- ${gap}`).join("\n")}` : "",
    "",
    "## Defectos conocidos (la lista no es exhaustiva)",
    known,
    "",
    "## Diff del cambio",
    "```diff", diff, "```",
    "",
    "## Hallazgos del revisor",
    findings || "(ninguno)",
    "",
    "## Reglas",
    "- Un hallazgo encuentra un defecto conocido si describe la misma causa y el mismo fallo, aunque lo diga con otras palabras o lo cuente en parte, siempre que corregir lo que pide arreglara ese defecto. Nombrar el archivo o la zona sin explicar el fallo no basta.",
    "- Un hallazgo es `valid` si describe un defecto, un riesgo real o un hueco razonable de este cambio, sostenido por el diff o las citas, aunque no esté en la lista de conocidos. `invalid` si es falso, si afirma como seguro algo especulativo, o si trata de código que el cambio no toca y no le afecta. `unclear` solo si el material no basta para decidir.",
    "- Juzga cada hallazgo por separado. No premies la extensión ni el tono.",
    "",
    "Responde solo con un objeto JSON, sin texto alrededor:",
    '{"defects":[{"id":"<id conocido>","found_by":[<números de hallazgo>],"note":"<una frase>"}],"findings":[{"n":<número>,"verdict":"valid|invalid|unclear","why":"<una frase>"}]}',
    "Incluye todos los defectos conocidos (found_by vacío si ninguno lo encontró) y todos los hallazgos.",
  ].filter((line) => line !== "").join("\n");
}

/** Opus por Claude Code o, con `pi:<proveedor/modelo>`, un juez de otra familia por Pi; ninguno usa herramientas. */
function judge(prompt: string, cwd: string, model: string): Verdict {
  let text: string;
  if (model.startsWith("pi:")) {
    const pi = process.env.N_EIN_PI_BIN || join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), "runtimes/pi", JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi.version, "bin/pi");
    const response = spawnSync(pi, ["-p", "--no-tools", "--no-extensions", "--no-skills", "--no-context-files", "--no-session", "--model", model.slice(3), "--thinking", "high", prompt], {
      encoding: "utf8", maxBuffer: 64 << 20, cwd, timeout: 15 * 60_000,
      env: { ...process.env, PI_CODING_AGENT_DIR: process.env.N_EIN_AGENT_DIR || join(channelDir(root), "pi-agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1" },
    });
    writeFileSync(join(cwd, "raw.txt"), response.stdout ?? "");
    text = response.stdout ?? "";
  } else {
    const response = spawnSync("claude", ["-p", "--model", model, "--output-format", "json", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--setting-sources", "project"], {
      input: prompt, encoding: "utf8", maxBuffer: 64 << 20, cwd, timeout: 15 * 60_000,
    });
    writeFileSync(join(cwd, "raw.json"), response.stdout ?? "");
    text = JSON.parse(response.stdout).result;
  }
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

/** Cada juez guarda aparte: el de por defecto en `grade/`, los demás en `grade-<juez>/`. */
const gradeDir = (out: string, model: string): string => join(out, model === "opus" ? "grade" : `grade-${model.replace(/[^\w.-]+/g, "_")}`);

function grade(argv: string[]): void {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { judge: { type: "string", default: "opus" } } });
  const out = positionals[0];
  if (!out || !existsSync(join(out, "results"))) throw new Error("indica la carpeta de una ejecución del banco");
  const rows: { item: Case; result: Result; verdict: Verdict; ref: Reference }[] = [];
  for (const file of readdirSync(join(out, "results")).filter((name) => name.endsWith(".json")).sort()) {
    const result: Result = JSON.parse(readFileSync(join(out, "results", file), "utf8"));
    const item = manifest.cases.find((candidate) => candidate.id === result.case);
    if (!item) throw new Error(`caso desconocido: ${result.case}`);
    const ref = reference(item.id);
    const dir = join(gradeDir(out, values.judge), item.id);
    mkdirSync(dir, { recursive: true });
    const cached = join(dir, "verdict.json");
    let verdict: Verdict;
    if (existsSync(cached)) verdict = JSON.parse(readFileSync(cached, "utf8"));
    else if (result.status !== "done") verdict = { defects: ref.defects.map((defect) => ({ id: defect.id, found_by: [], note: "la revisión no terminó" })), findings: [] };
    else {
      const diff = git(join(out, "repos", item.id), "diff", "--no-color", "-M", "main", "change").slice(0, DIFF_LIMIT);
      const prompt = judgePrompt(item, ref, result, diff);
      writeFileSync(join(dir, "prompt.md"), prompt);
      log(`[BENCH] :: JUDGE :: case: ${item.id} | findings: ${result.findings.length}`);
      verdict = judge(prompt, dir, values.judge);
      writeFileSync(cached, JSON.stringify(verdict, null, 2));
    }
    rows.push({ item, result, verdict, ref });
  }
  const report = summarize(out, rows, values.judge);
  writeFileSync(join(gradeDir(out, values.judge), "report.md"), report);
  console.log(report);
}

function summarize(out: string, rows: { item: Case; result: Result; verdict: Verdict; ref: Reference }[], judgeModel: string): string {
  const meta = JSON.parse(readFileSync(join(out, "run.json"), "utf8"));
  const count = (verdict: Verdict, kind: "valid" | "invalid" | "unclear"): number => verdict.findings.filter((item) => item.verdict === kind).length;
  const defects = rows.flatMap(({ verdict }) => verdict.defects);
  const found = defects.filter((defect) => defect.found_by.length > 0).length;
  const valid = rows.reduce((sum, { verdict }) => sum + count(verdict, "valid"), 0);
  const invalid = rows.reduce((sum, { verdict }) => sum + count(verdict, "invalid"), 0);
  const unclear = rows.reduce((sum, { verdict }) => sum + count(verdict, "unclear"), 0);
  const falseAlarms = rows.filter(({ item }) => item.category === "correct").reduce((sum, { verdict }) => sum + count(verdict, "invalid"), 0);
  const seconds = rows.map(({ result }) => result.seconds).sort((a, b) => a - b);
  const usd = rows.reduce((sum, { result }) => sum + result.usd, 0);
  const pct = (part: number, whole: number): string => (whole ? `${Math.round((100 * part) / whole)} %` : "—");
  const model = rows.find(({ result }) => result.model)?.result.model ?? meta.model ?? "por defecto";
  const lines = [
    `# Banco del revisor · ${model} · ${meta.split}`,
    "",
    `Corpus ${meta.corpus} · commit ${String(meta.commit).slice(0, 7)} · ${rows.length} casos · juez ${judgeModel} · ${out}`,
    "",
    "| Caso | Parte | Tipo | Estado | Tiempo | Coste | Hallazgos | Válidos / inválidos / dudosos | Defectos encontrados |",
    "|---|---|---|---|---:|---:|---:|---|---|",
    ...rows.map(({ item, result, verdict }) => {
      const known = verdict.defects.length ? `${verdict.defects.filter((defect) => defect.found_by.length).length}/${verdict.defects.length}` : "—";
      const status = result.contamination.length ? `${result.status} · CONTAMINADO` : result.status;
      return `| ${item.id} | ${item.split} | ${item.category} | ${status} | ${result.seconds} s | ${result.usd.toFixed(2)} $ | ${result.findings.length} | ${count(verdict, "valid")} / ${count(verdict, "invalid")} / ${count(verdict, "unclear")} | ${known} |`;
    }),
    "",
    `- **Detección:** ${found}/${defects.length} defectos conocidos (${pct(found, defects.length)}; umbral 70 %).`,
    `- **Precisión:** ${valid}/${valid + invalid} avisos válidos entre los decididos (${pct(valid, valid + invalid)}; umbral 70 %); contando los dudosos como inválidos, ${pct(valid, valid + invalid + unclear)}.`,
    `- **Falsas alarmas en cambios correctos:** ${falseAlarms}.`,
    `- **Citas apartadas por no existir en el SHA:** ${rows.reduce((sum, { result }) => sum + result.rejected, 0)} (se rechazan antes de enseñarse).`,
    `- **Tiempo:** mediana ${seconds[Math.floor(seconds.length / 2)] ?? 0} s, máximo ${seconds.at(-1) ?? 0} s (umbral 600 s). **Coste:** ${usd.toFixed(2)} $.`,
    `- **Sin terminar:** ${rows.filter(({ result }) => result.status !== "done").map(({ item, result }) => `${item.id} (${result.error ?? result.status})`).join(", ") || "ninguno"}.`,
    `- **Contaminación:** ${rows.filter(({ result }) => result.contamination.length).map(({ item }) => item.id).join(", ") || "ninguna"}.`,
    "",
    "## Por caso",
    ...rows.flatMap(({ item, result, verdict }) => [
      "",
      `### ${item.id}`,
      ...verdict.defects.map((defect) => `- defecto ${defect.id}: ${defect.found_by.length ? `encontrado por ${defect.found_by.join(", ")}` : "no encontrado"}. ${defect.note}`),
      ...verdict.findings.map((judged) => `- ${judged.n}. ${result.findings[judged.n - 1]?.title ?? "?"} · **${judged.verdict}** · ${judged.why}`),
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

/** Cuánto coinciden dos jueces: si un juez solo está de acuerdo consigo mismo, su cifra no vale. */
function agree(argv: string[]): void {
  const [out, first, second] = argv;
  if (!out || !first || !second) throw new Error("uso: agree <ejecución> <juez> <juez>");
  let defects = 0, defectsSame = 0, findings = 0, findingsSame = 0;
  const differences: string[] = [];
  for (const id of readdirSync(gradeDir(out, first))) {
    const a = join(gradeDir(out, first), id, "verdict.json"), b = join(gradeDir(out, second), id, "verdict.json");
    if (!existsSync(a) || !existsSync(b)) continue;
    const left: Verdict = JSON.parse(readFileSync(a, "utf8")), right: Verdict = JSON.parse(readFileSync(b, "utf8"));
    for (const defect of left.defects) {
      const other = right.defects.find((item) => item.id === defect.id);
      defects++;
      if ((defect.found_by.length > 0) === ((other?.found_by.length ?? 0) > 0)) defectsSame++;
      else differences.push(`${id} · defecto ${defect.id}: ${first} ${defect.found_by.length ? "encontrado" : "no"} / ${second} ${other?.found_by.length ? "encontrado" : "no"}`);
    }
    for (const finding of left.findings) {
      const other = right.findings.find((item) => item.n === finding.n);
      findings++;
      if (other?.verdict === finding.verdict) findingsSame++;
      else differences.push(`${id} · hallazgo ${finding.n}: ${first} ${finding.verdict} / ${second} ${other?.verdict ?? "—"} · ${other?.why ?? ""}`);
    }
  }
  console.log(`Defectos: ${defectsSame}/${defects} iguales · Hallazgos: ${findingsSame}/${findings} iguales`);
  for (const line of differences) console.log(`- ${line}`);
}

// --- Entrada -----------------------------------------------------------------------------------

const [verb, ...rest] = process.argv.slice(2);
if (import.meta.main) try {
  if (verb === "run") await run(rest);
  else if (verb === "grade") grade(rest);
  else if (verb === "agree") agree(rest);
  else if (verb === "build" && rest.length === 2) {
    // Reconstruye un caso sin revisarlo: para mirar qué recibe el revisor.
    const item = manifest.cases.find((candidate) => candidate.id === rest[0]);
    if (!item) throw new Error(`caso desconocido: ${rest[0]}`);
    materialize(item, resolve(rest[1] ?? ""));
    console.log(git(resolve(rest[1] ?? ""), "log", "--format=%h %s", "--all"));
  }
  else {
    process.stderr.write("uso: bun evals/previewer/bench.ts run --split dev|reserved|all [--case ID]... [--model P/M] [--thinking NIVEL] [--label NOMBRE]\n       bun evals/previewer/bench.ts grade <ejecución> [--judge opus|pi:P/M]\n       bun evals/previewer/bench.ts agree <ejecución> <juez> <juez>\n       bun evals/previewer/bench.ts build <caso> <carpeta>\n");
    process.exit(64);
  }
} catch (error) {
  process.stderr.write(`[ERR] :: BENCH_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
