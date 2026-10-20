// =============================================================================
// [CORE] MOTOR DE REVISIÓN
// Una revisión fija base y head por SHA, crea una copia aparte, deja trabajar
// al agente revisor y solo guarda lo que se sostiene: citas que existen en el
// SHA y sondas que el propio motor vuelve a ejecutar antes de borrar la copia.
// =============================================================================

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { channelDir, loadModels } from "../../pi-package/models.ts";
import { makeCitationChecker } from "./citations.ts";
import { createCopy, sweepCopies, type ReviewCopy } from "./copy.ts";
import type { Citation, Finding, Probe } from "./finding.ts";
import { branchTip, commitsOf, diffOf, resolveRange, type Range } from "./git.ts";
import { reviewGuard } from "./guard-rules.ts";
import { parseReport, type ProposedFinding } from "./report.ts";
import { sandboxFor, type Sandbox } from "./sandbox.ts";
import { piRunner, type AgentRunner } from "./runner.ts";
import { ReviewStore, type Run, type RunResult, type Session, type StoredFinding } from "./store.ts";

export type ReviewOptions = {
  packageRoot: string;
  /** Cualquier ruta dentro del repositorio revisado. */
  cwd: string;
  base?: string;
  head?: string;
  prUrl?: string;
  model?: string;
  thinking?: string;
  runner?: AgentRunner;
  store?: ReviewStore;
  signal?: AbortSignal;
  timeoutMs?: number;
  probeTimeoutMs?: number;
  /** Solo para tests: sustituye el aislamiento detectado. Sin aislamiento la revisión es de solo lectura. */
  sandbox?: Sandbox;
  log?: (line: string) => void;
};

export type ReviewOutcome = { session: Session; run: Run; findings: StoredFinding[] };

const DIFF_LIMIT = 80_000;
const PROBE_OUTPUT_LIMIT = 4_000;
const PROBE_SOURCE_LIMIT = 20_000;
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_PROBE_TIMEOUT_MS = 2 * 60_000;

const short = (sha: string): string => sha.slice(0, 12);
const tail = (text: string, limit: number): string => (text.length > limit ? `…${text.slice(-limit)}` : text);

export function reviewPrompt(range: Range, execute = true): string {
  const diff = diffOf(range);
  const truncated = diff.length > DIFF_LIMIT;
  return [
    `Review the branch ${range.branch || "(detached head)"} of ${basename(range.repo)}.`,
    `Base: ${range.baseSha} (refs/previewer/base)\nHead: ${range.headSha} (checked out here)`,
    `Commits, oldest first:\n${commitsOf(range)}`,
    `Changed files:\n${diffOf(range, "--stat=200")}`,
    `Diff from base to head${truncated ? `, truncated at ${DIFF_LIMIT} characters: read the rest with \`git diff ${short(range.baseSha)} ${short(range.headSha)} -- <path>\`` : ""}:`,
    "```diff\n" + (truncated ? diff.slice(0, DIFF_LIMIT) : diff) + "\n```",
    execute ? "" : "This review is read-only: no OS sandbox is available, so you cannot run commands, tests or probes. Omit `probe` and list what you would have run in `gaps`.",
  ].filter(Boolean).join("\n\n");
}

type ProbeContext = { copy: string; guard: ReturnType<typeof reviewGuard>; sandbox: Sandbox; timeoutMs: number };
type Execution = { exitCode: number | null; output: string };

/** Ejecuta en su propio grupo de procesos y lo mata entero al acabar: nada de la sonda sobrevive a la revisión. */
function runGrouped(file: string, args: string[], cwd: string, timeoutMs: number): Promise<Execution> {
  return new Promise((done) => {
    const child = spawn(file, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    const collect = (chunk: Buffer): void => {
      output = tail(output + chunk.toString("utf8"), PROBE_OUTPUT_LIMIT * 2);
    };
    const killGroup = (): void => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        // El grupo ya no existe.
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timer);
      done({ exitCode: null, output: error.message });
    });
    let exit: { code: number | null; signal: NodeJS.Signals | null } = { code: null, signal: null };
    child.once("exit", (code, signal) => {
      exit = { code, signal };
      clearTimeout(timer);
      // BLINDAJE -> Lo que la sonda dejó en segundo plano muere con ella; si no, retendría la salida abierta.
      killGroup();
    });
    child.once("close", () => {
      clearTimeout(timer);
      done({ exitCode: timedOut || exit.signal ? null : exit.code, output: tail(output.trim(), PROBE_OUTPUT_LIMIT) });
    });
  });
}

/**
 * Repite la sonda en la copia: un hallazgo «demostrado» lo es porque falló aquí,
 * no porque el agente lo diga. Pasa por la misma guardia y aislamiento que su bash.
 */
async function rerunProbe(context: ProbeContext, proposed: NonNullable<ProposedFinding["probe"]>): Promise<Probe> {
  const { copy } = context;
  let source: string | null = null;
  let file: string | null = null;
  if (proposed.file) {
    const path = resolve(copy, proposed.file);
    const rel = relative(copy, path);
    if (!rel.startsWith("..") && !isAbsolute(rel)) {
      file = rel;
      if (existsSync(path)) source = tail(readFileSync(path, "utf8"), PROBE_SOURCE_LIMIT);
    }
  }
  const skipped = (reason: string): Probe => ({ command: proposed.command, file, source, exitCode: null, output: `no ejecutada: ${reason}`, reproduced: false });
  if (context.sandbox.kind === "none") return skipped("sin aislamiento del sistema no se ejecuta nada");
  const blocked = context.guard("bash", { command: proposed.command }, copy);
  if (blocked) return skipped(blocked.reason);
  const { file: bin, args } = context.sandbox.wrap(proposed.command);
  const { exitCode, output } = await runGrouped(bin, args, copy, context.timeoutMs);
  // BLINDAJE -> 126 y 127 son «no se pudo ejecutar» y «comando inexistente»: la sonda no llegó a comprobar nada.
  if (exitCode === 126 || exitCode === 127)
    return { command: proposed.command, file, source, exitCode, output: `la sonda no pudo ejecutarse\n${output}`, reproduced: false };
  return { command: proposed.command, file, source, exitCode, output, reproduced: exitCode !== null && exitCode !== 0 };
}

export async function review(options: ReviewOptions): Promise<ReviewOutcome> {
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const range = resolveRange(options.cwd, { base: options.base, head: options.head });
  const store = options.store ?? ReviewStore.forPackage(options.packageRoot);
  const routed = loadModels(options.packageRoot).routing.riesgo;
  const model = options.model ?? routed.model;
  const thinking = options.thinking ?? (options.model ? "high" : routed.thinking);
  const signal = options.signal ?? new AbortController().signal;
  const session = store.openSession({ repo: range.repo, branch: range.branch || `detached@${short(range.headSha)}`, prUrl: options.prUrl });
  const run = store.startRun({ sessionId: session.id, baseSha: range.baseSha, headSha: range.headSha, model, thinking });
  const runDir = join(channelDir(options.packageRoot), "previewer", "runs", run.id);
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  log(`[REVIEW] >> RUN_START :: run: ${run.id.slice(0, 8)} | head: ${short(range.headSha)} | base: ${short(range.baseSha)} | model: ${model}`);

  for (const name of sweepCopies(range.repo)) log(`[REVIEW] :: COPY_SWEPT :: copy: ${name}`);
  const tipBefore = branchTip(range.repo, range.branch);
  const started = Date.now();
  let copy: ReviewCopy | null = null;
  let result: RunResult;
  try {
    copy = createCopy(range.repo, range, run.id.slice(0, 8));
    // BLINDAJE -> Sin aislamiento del sistema no se ejecuta nada: la guardia de texto sola no basta.
    const sandbox = options.sandbox ?? sandboxFor(copy.path, range.repo);
    const execute = sandbox.kind !== "none";
    if (!execute) log("[WARN] :: SANDBOX_NONE :: mode: read-only");
    const agent = await (options.runner ?? piRunner(options.packageRoot))({
      cwd: copy.path, origin: range.repo, prompt: reviewPrompt(range, execute), runDir, model, thinking, signal, execute,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    if (signal.aborted) result = { status: "cancelled", error: "cancelada", usage: agent.usage };
    else if (agent.error) result = { status: "failed", error: agent.error, usage: agent.usage };
    else {
      const report = (() => {
        try {
          return parseReport(agent.text);
        } catch (error) {
          // BLINDAJE -> El texto ilegible se guarda: sin él no hay forma de saber qué falló.
          writeFileSync(join(runDir, "final.txt"), agent.text);
          throw new Error(`informe ilegible: ${error instanceof Error ? error.message : String(error)}`);
        }
      })();
      const check = makeCitationChecker(range.repo, [range.headSha, range.baseSha]);
      const rejected = [...report.rejected];
      const probes: ProbeContext = { copy: copy.path, guard: reviewGuard(copy.path, range.repo), sandbox, timeoutMs: options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS };
      const findings: Finding[] = [];
      for (const item of report.findings) {
        const citations: Citation[] = [];
        for (const ref of item.citations) {
          const verdict = check(ref);
          if (verdict.ok) citations.push(verdict.citation);
          else rejected.push(`${item.title}: cita ${verdict.ref} rechazada (${verdict.reason})`);
        }
        if (!citations.length) {
          rejected.push(`${item.title}: ninguna cita existe en el SHA revisado`);
          continue;
        }
        const probe = item.probe ? await rerunProbe(probes, item.probe) : null;
        if (probe) log(`[REVIEW] :: PROBE :: finding: ${item.title.slice(0, 60)} | exit: ${probe.exitCode ?? "timeout"} | reproduced: ${probe.reproduced}`);
        findings.push({ ...item, citations, probe });
      }
      const gaps = execute
        ? report.gaps
        : [...report.gaps, "sin aislamiento del sistema (sandbox-exec o bwrap utilizable): revisión solo de lectura, sin tests ni sondas"];
      result = { status: "done", summary: report.summary, gaps, rejected, usage: agent.usage, findings };
    }
  } catch (error) {
    result = { status: signal.aborted ? "cancelled" : "failed", error: error instanceof Error ? error.message : String(error) };
  } finally {
    // BLINDAJE -> La copia se borra también si el agente falla o se cancela.
    copy?.remove();
  }

  const tipAfter = branchTip(range.repo, range.branch);
  if (tipBefore !== tipAfter) {
    // El head revisado está fijado por SHA: los hallazgos siguen valiendo para él, pero hay que saberlo.
    result.gaps = [...(result.gaps ?? []), `la rama ${range.branch} cambió durante la revisión (${short(tipBefore ?? "?")} → ${short(tipAfter ?? "?")}); lo revisado es ${short(range.headSha)}`];
    log(`[WARN] :: BRANCH_MOVED :: branch: ${range.branch} | reviewed: ${short(range.headSha)}`);
  }
  const findings = store.finishRun(run.id, result);
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.status === "done")
    log(`[REVIEW] ++ RUN_DONE :: findings: ${findings.length} | rejected: ${result.rejected?.length ?? 0} | seconds: ${seconds} | usd: ${(result.usage?.usd ?? 0).toFixed(2)}`);
  else log(`[ERR] :: RUN_${result.status === "cancelled" ? "CANCEL" : "FAIL"} :: run: ${run.id.slice(0, 8)} | seconds: ${seconds} | reason: ${result.error}`);
  return { session: store.session(session.id) ?? session, run: store.run(run.id) ?? run, findings };
}
