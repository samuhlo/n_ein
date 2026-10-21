// =============================================================================
// [CORE] MOTOR DE REVISIÓN
// Una revisión fija base y head por SHA, crea una copia aparte, deja trabajar
// al agente revisor y solo guarda lo que se sostiene: citas que existen en el
// SHA y sondas que el propio motor vuelve a ejecutar antes de borrar la copia.
// En una segunda revisión, cada hallazgo abierto se comprueba en el nuevo head:
// sigue, resuelto o sin comprobar. Su sonda anterior vuelve a la copia y su
// resultado pesa más que la palabra del agente.
// =============================================================================

import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { channelDir, loadModels } from "../../pi-package/models.ts";
import { makeCitationChecker } from "./citations.ts";
import { createCopy, sweepCopies, type ReviewCopy } from "./copy.ts";
import type { Citation, Finding, Probe, TourStep } from "./finding.ts";
import { branchTip, changedFiles, commitsOf, diffOf, resolveRange, type Range } from "./git.ts";
import { reviewGuard } from "./guard-rules.ts";
import { parseReport, type ProposedFinding } from "./report.ts";
import { sandboxFor, type Sandbox } from "./sandbox.ts";
import { piRunner, type AgentRunner } from "./runner.ts";
import { ReviewStore, type Run, type RunResult, type Session, type StoredFinding } from "./store.ts";

type Check = NonNullable<RunResult["checks"]>[number];

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

/** `findings`: todos los hilos de la sesión tras esta revisión, con su estado. */
export type ReviewOutcome = { session: Session; run: Run; findings: StoredFinding[] };

/** Hallazgos abiertos de revisiones anteriores; `key` es como los ve el agente (`P1`…). */
export type Previous = { pending: { key: string; item: StoredFinding }[]; dismissed: StoredFinding[] };

const DIFF_LIMIT = 80_000;
const PROBE_OUTPUT_LIMIT = 4_000;
const PROBE_SOURCE_LIMIT = 20_000;
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_PROBE_TIMEOUT_MS = 2 * 60_000;

const short = (sha: string): string => sha.slice(0, 12);
/** Como existsSync, pero un enlace roto también cuenta: ahí hay algo del head. */
const lexists = (path: string): boolean => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};
const tail = (text: string, limit: number): string => (text.length > limit ? `…${text.slice(-limit)}` : text);

function previousSection(previous: Previous, execute: boolean): string {
  if (!previous.pending.length && !previous.dismissed.length) return "";
  const rated = (item: StoredFinding): string =>
    item.rating ? ` [user: ${item.rating.verdict}${item.rating.reason ? `, ${item.rating.reason}` : ""}]` : "";
  const lines = previous.pending.map(({ key, item }) => {
    const probe = item.probe ? `\n   Probe${item.probe.reproduced ? " (failed then: demonstrated)" : ""}: \`${item.probe.command}\`${item.probe.file ? ` (restored at ${item.probe.file})` : ""}` : "";
    return `${key}. ${item.title}${rated(item)}\n   Condition: ${item.condition}\n   Cited: ${item.citations.map((c) => c.ref).join(", ")}${probe}`;
  });
  return [
    lines.length ? [
      "Earlier reviews of this branch left these findings open. For each one, decide whether this head still has it:",
      "- still present: report it again in `findings` with `\"previous\": \"P<n>\"`, citing this head;",
      "- fixed: add `{\"previous\": \"P<n>\", \"note\": \"plain explanation of what fixed it\"}` to `resolved`.",
      execute ? "Run a restored probe again before deciding; p_reviewer reruns it too, and a probe that still fails keeps the finding open." : "",
      lines.join("\n"),
    ].filter(Boolean).join("\n") : "",
    previous.dismissed.length
      ? `The user dismissed these earlier findings as not valid. Do not report them again unless this head makes them real in a new way:\n${previous.dismissed.map((item) => `- ${item.title}${rated(item)}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

export function reviewPrompt(range: Range, execute = true, previous: Previous = { pending: [], dismissed: [] }): string {
  const diff = diffOf(range);
  const truncated = diff.length > DIFF_LIMIT;
  return [
    `Review the branch ${range.branch || "(detached head)"} of ${basename(range.repo)}.`,
    `Base: ${range.baseSha} (refs/previewer/base)\nHead: ${range.headSha} (checked out here)`,
    `Commits, oldest first:\n${commitsOf(range)}`,
    `Changed files:\n${diffOf(range, "--stat=200")}`,
    `Diff from base to head${truncated ? `, truncated at ${DIFF_LIMIT} characters: read the rest with \`git diff ${short(range.baseSha)} ${short(range.headSha)} -- <path>\`` : ""}:`,
    "```diff\n" + (truncated ? diff.slice(0, DIFF_LIMIT) : diff) + "\n```",
    previousSection(previous, execute),
    execute ? "" : "This review is read-only: no OS sandbox is available, so you cannot run commands, tests or probes. Omit `probe` and list what you would have run in `gaps`.",
  ].filter(Boolean).join("\n\n");
}

type ProbeContext = { copy: string; guard: Guard; sandbox: Sandbox; timeoutMs: number };
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
 * El recorrido solo nombra archivos que el diff cambia, cada uno una vez; lo que
 * deja sin explicar va a un último paso para que nada quede escondido.
 */
export function settleTour(proposed: TourStep[], changed: string[]): { tour: TourStep[]; dropped: string[] } {
  const pending = new Set(changed);
  const tour: TourStep[] = [];
  const dropped: string[] = [];
  for (const step of proposed) {
    const files = step.files.filter((file) => pending.delete(file));
    if (files.length) tour.push({ ...step, files });
    else dropped.push(`recorrido: «${step.title}» no nombra ningún archivo cambiado que quede por explicar`);
  }
  if (pending.size) tour.push({ title: "Archivos sin explicar", plain: "El recorrido no cuenta qué hacen estos archivos; míralos por tu cuenta.", why: "", files: [...pending] });
  return { tour, dropped };
}

type Guard = ReturnType<typeof reviewGuard>;

/**
 * Devuelve a la copia el archivo de una sonda anterior, solo si cabe entero y queda
 * dentro de la copia. Devuelve si lo escribió.
 */
function restoreProbe(copy: string, guard: Guard, probe: Probe): boolean {
  if (!probe.file || !probe.source || probe.source.startsWith("…")) return false;
  // BLINDAJE -> El motor escribe sin aislamiento: un enlace en esa ruta (del head o del agente) lo sacaría de la copia.
  if (guard("write", { path: probe.file }, copy)) return false;
  const path = resolve(copy, probe.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, probe.source);
  return true;
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
      // BLINDAJE -> Un enlace (en el archivo o en una carpeta) llevaría a guardar y enseñar un archivo de fuera de la copia.
      const real = existsSync(path) ? relative(realpathSync(copy), realpathSync(path)) : "..";
      if (!real.startsWith("..") && !isAbsolute(real)) source = tail(readFileSync(path, "utf8"), PROBE_SOURCE_LIMIT);
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

  // Lo abierto de revisiones anteriores; lo descartado por el usuario solo se menciona para no repetirlo.
  const open = store.findings(session.id).filter((item) => item.status !== "resolved");
  const previous: Previous = {
    pending: open.filter((item) => item.rating?.verdict !== "descartar").map((item, index) => ({ key: `P${index + 1}`, item })),
    dismissed: open.filter((item) => item.rating?.verdict === "descartar"),
  };

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
    const reviewCopy = copy.path;
    const guard = reviewGuard(reviewCopy, range.repo);
    // BLINDAJE -> Una sonda anterior no pisa un archivo que el head ya tiene con ese nombre.
    const restorable = new Set(previous.pending.filter(({ item }) => item.probe?.file && !lexists(resolve(reviewCopy, item.probe.file))).map(({ item }) => item.thread));
    for (const { item } of previous.pending) if (item.probe && restorable.has(item.thread) && !restoreProbe(reviewCopy, guard, item.probe)) restorable.delete(item.thread);
    const agent = await (options.runner ?? piRunner(options.packageRoot))({
      cwd: copy.path, origin: range.repo, prompt: reviewPrompt(range, execute, previous), runDir, model, thinking, signal, execute,
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
      const { tour, dropped } = settleTour(report.tour, changedFiles(range));
      const rejected = [...report.rejected, ...dropped];
      const probes: ProbeContext = { copy: reviewCopy, guard, sandbox, timeoutMs: options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS };
      const findings: (Finding & { thread?: string })[] = [];
      const keys = new Map(previous.pending.map(({ key, item }) => [key, item]));
      const continued = new Set<string>();
      // La sonda anterior se repite con su contenido original: el agente pudo tocarla en la copia.
      const earlierProbe = async (item: StoredFinding): Promise<Probe | null> => {
        if (!item.probe?.reproduced) return null;
        if (item.probe.file && !(restorable.has(item.thread) && restoreProbe(reviewCopy, guard, item.probe))) return null;
        return rerunProbe(probes, { command: item.probe.command, file: item.probe.file });
      };
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
        const earlier = item.previous ? keys.get(item.previous) : undefined;
        if (item.previous && (!earlier || continued.has(earlier.thread))) rejected.push(`${item.title}: referencia ${item.previous} desconocida o repetida; queda como nuevo`);
        const thread = earlier && !continued.has(earlier.thread) ? earlier.thread : undefined;
        if (thread) continued.add(thread);
        // Si sigue y no trae sonda propia, la de antes sirve de prueba.
        const probe = item.probe ? await rerunProbe(probes, item.probe) : earlier && thread ? await earlierProbe(earlier) : null;
        if (probe) log(`[REVIEW] :: PROBE :: finding: ${item.title.slice(0, 60)} | exit: ${probe.exitCode ?? "timeout"} | reproduced: ${probe.reproduced}`);
        findings.push({ ...item, citations, probe, thread });
      }
      const gaps = [...report.gaps];
      const checks: Check[] = [];
      for (const { key, item } of previous.pending) {
        if (continued.has(item.thread)) continue;
        const claim = report.resolved.find((resolution) => resolution.previous === key);
        const probe = await earlierProbe(item);
        let check: Check | null = null;
        if (probe?.reproduced)
          check = { thread: item.thread, outcome: "persists", probe, note: claim ? `El revisor lo dio por resuelto, pero la sonda anterior sigue fallando. ${claim.note}`.trim() : "La sonda anterior sigue fallando en este head." };
        else if (probe?.exitCode === 0) check = { thread: item.thread, outcome: "resolved", probe, note: claim?.note || "La sonda anterior ya no falla." };
        else if (claim) check = { thread: item.thread, outcome: "resolved", probe, note: claim.note };
        if (check) {
          checks.push(check);
          log(`[REVIEW] :: CHECK :: previous: ${key} | outcome: ${check.outcome} | probe: ${probe ? (probe.exitCode ?? "timeout") : "none"}`);
        } else gaps.push(`${key} «${item.title}», de una revisión anterior, no se comprobó en este head`);
      }
      if (!execute) gaps.push("sin aislamiento del sistema (sandbox-exec o bwrap utilizable): revisión solo de lectura, sin tests ni sondas");
      result = { status: "done", summary: report.summary, tour, gaps, rejected, usage: agent.usage, findings, checks };
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
  const added = store.finishRun(run.id, result);
  const findings = store.findings(session.id);
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.status === "done")
    log(`[REVIEW] ++ RUN_DONE :: findings: ${added.length} | resolved: ${findings.filter((item) => item.status === "resolved" && item.check?.runId === run.id).length} | rejected: ${result.rejected?.length ?? 0} | seconds: ${seconds} | usd: ${(result.usage?.usd ?? 0).toFixed(2)}`);
  else log(`[ERR] :: RUN_${result.status === "cancelled" ? "CANCEL" : "FAIL"} :: run: ${run.id.slice(0, 8)} | seconds: ${seconds} | reason: ${result.error}`);
  return { session: store.session(session.id) ?? session, run: store.run(run.id) ?? run, findings };
}
