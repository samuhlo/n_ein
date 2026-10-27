// =============================================================================
// [FLOW] ENTRADA DEL REVISOR
// uso: n-ein-previewer review [--base REF] [--head REF] [--pr URL] [--no-open] [--json]
//      n-ein-previewer open | handoff [--json] | status | check
// El usuario entra por `nein previewer` o el Panel; el agente, por bin/n-ein-previewer.
// `status` y `check` son para el Panel y `doctor`: leen, no revisan ni crean nada.
// =============================================================================

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { review } from "./engine.ts";
import { probeLabel } from "./probe-result.ts";
import { git, resolveRange } from "./git.ts";
import { handoffBrief } from "./handoff.ts";
import { ensureServer, reviewerLink } from "./open.ts";
import { sandboxFor } from "./sandbox.ts";
import { bundle } from "./server.ts";
import { ReviewStore, storePath } from "./store.ts";
import { ChainStore, planChain, reviewChain } from "./chains.ts";

const packageRoot = resolve(import.meta.dir, "../..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    head: { type: "string" },
    pr: { type: "string" },
    project: { type: "string" },
    file: { type: "string" },
    chain: { type: "string" },
    plan: { type: "boolean", default: false },
    again: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    "no-open": { type: "boolean", default: false },
  },
});

const USAGE = "uso: n-ein-previewer review [--base REF] [--head REF] [--pr URL] [--no-open] [--json]\n       n-ein-previewer chain --file MANIFIESTO [--plan] [--again] [--no-open] [--json]\n       n-ein-previewer chains\n       n-ein-previewer open [--chain NOMBRE]\n       n-ein-previewer handoff [--chain NOMBRE] [--json]\n       n-ein-previewer status [--chain NOMBRE]\n       n-ein-previewer check\n";
const VERBS = ["review", "chain", "chains", "open", "handoff", "status", "check"];
if (!VERBS.includes(positionals[0] ?? "")) {
  process.stderr.write(USAGE);
  process.exit(64);
}
if ((values.chain && !["open", "handoff", "status"].includes(positionals[0]!))
  || ((values.file || values.plan || values.again) && positionals[0] !== "chain")
  || (positionals[0] === "chain" && (values.base || values.head || values.pr))) {
  process.stderr.write(USAGE); process.exit(64);
}

/** Repositorio, head y rama del proyecto; un head suelto se nombra como lo hace el motor, `detached@<sha>`. */
function current(): { repo: string; head: string; branch: string } {
  const repo = git(values.project ?? process.cwd(), "rev-parse", "--show-toplevel");
  const head = git(repo, "rev-parse", "HEAD");
  try {
    return { repo, head, branch: git(repo, "symbolic-ref", "--quiet", "--short", "HEAD") };
  } catch {
    return { repo, head, branch: `detached@${head.slice(0, 12)}` };
  }
}

async function link(sessionId: string): Promise<string> {
  return reviewerLink(await ensureServer(packageRoot), sessionId);
}

if (positionals[0] === "chains") {
  try {
    const path = storePath(packageRoot);
    const store = existsSync(path) ? new ReviewStore(path) : null;
    const rows = store ? new ChainStore(store).list(current().repo) : [];
    console.log(JSON.stringify(rows, null, 2)); store?.close(); process.exit(0);
  } catch (error) { console.error(String(error)); process.exit(1); }
}

if (positionals[0] === "chain") {
  const controller = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
  try {
    if (!values.file) throw new Error("indica el manifiesto con --file");
    const definition: unknown = JSON.parse(readFileSync(values.file, "utf8"));
    const cwd = values.project ?? process.cwd();
    if (values.plan) { console.log(JSON.stringify(planChain(cwd, definition), null, 2)); process.exit(0); }
    const result = await reviewChain({ packageRoot, cwd, definition, again: values.again, signal: controller.signal });
    const opened = !values["no-open"] ? await link(result.session.id).catch(error => { console.error(`[WARN] :: OPEN_FAIL :: ${String(error)}`); return null; }) : null;
    if (values.json) console.log(JSON.stringify({ ...result, link: opened }, null, 2));
    else {
      console.log(`// 000 CADENA · ${result.chain.name} · ${result.chain.complete ? "integración revisada" : "parcial: integración pendiente"}`);
      result.chain.stages.forEach((stage, i) => console.log(`▏ ${i + 1}. ${stage.name} · ${stage.status} · ${stage.baseSha.slice(0, 12)} → ${stage.headSha.slice(0, 12)}${stage.error ? ` · ${stage.error}` : ""}`));
      if (result.chain.drift.length) console.log(`▏ referencias cambiadas desde el snapshot: ${result.chain.drift.join(", ")}`);
      result.findings.forEach(f => {
        const history = result.chain.history[f.thread] ?? [];
        console.log(`\n${f.status} · ${f.title}\n▏ ${f.plain}\n▏ ${history.map(e => `${e.stage}: ${e.outcome}`).join(" → ")}`);
      });
      if (opened) console.log(`\n// 001 REVISOR\n▏ ${opened}`);
    }
    process.exit(result.chain.complete && !controller.signal.aborted ? 0 : 1);
  } catch (error) { console.error(`[ERR] :: CHAIN_FAIL :: ${String(error)}`); process.exit(1); }
}

if (positionals[0] === "open") {
  try {
    const { repo, branch } = current();
    const store = ReviewStore.forPackage(packageRoot);
    const session = values.chain ? new ChainStore(store).find(repo, values.chain) : store.findSession(repo, branch);
    store.close();
    if (!session) {
      process.stdout.write(`No hay revisiones de ${values.chain ? `la cadena ${values.chain}` : branch}: pide una con «${values.chain ? "chain --file" : "review"}».\n`);
      process.exit(1);
    }
    process.stdout.write(`// 000  REVISOR · ${branch}\n▏ ${await link(session.id)}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[ERR] :: OPEN_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// El Panel lo lee en cada apertura: sin almacén no lo crea, y una rama sin cambios propios no se ofrece.
if (positionals[0] === "status") {
  try {
    const { repo, head, branch } = current();
    let reason = "";
    try {
      if (!values.chain)
      resolveRange(repo);
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    const path = storePath(packageRoot);
    const store = existsSync(path) ? new ReviewStore(path) : null;
    const session = store ? values.chain ? new ChainStore(store).find(repo, values.chain) : store.findSession(repo, branch) : null;
    const chain = session && store && values.chain ? new ChainStore(store).view(session.id) : null;
    if (values.chain && !chain) reason = "cadena no registrada";
    const findings = session && store ? store.findings(session.id) : [];
    const reviewed = values.chain && !chain?.complete ? null : session && store ? (store.runs(session.id).filter((run) => run.status === "done").at(-1)?.headSha ?? null) : null;
    store?.close();
    const open = findings.filter((item) => item.rating?.verdict !== "descartar");
    process.stdout.write(`${JSON.stringify({
      branch, head, reviewable: reason === "", reason, session: session?.id ?? null, reviewed,
      current: open.filter((item) => item.current).length,
      unchecked: open.filter((item) => item.status === "unchecked").length,
      selected: findings.filter((item) => item.selected && item.status !== "resolved").length,
      ...(values.chain ? { chain } : {}),
    })}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[ERR] :: STATUS_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Para `doctor`: el aislamiento que tendrían las sondas aquí y la web compilando desde el paquete instalado.
if (positionals[0] === "check") {
  const area = mkdtempSync(join(tmpdir(), "nein-previewer-check-"));
  let line = "";
  try {
    for (const name of ["copy", "origin"]) mkdirSync(join(area, name));
    const { kind } = sandboxFor(join(area, "copy"), join(area, "origin"));
    await bundle();
    const isolation = kind === "none"
      ? `sin aislamiento: las revisiones no ejecutan tests ni sondas${process.platform === "linux" ? "; instala bubblewrap" : ""}`
      : `aislamiento ${kind}`;
    line = `// 003 REVISOR · ${isolation} · web compila\n`;
  } catch (error) {
    process.stderr.write(`[ERR] :: CHECK_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  // process.exit no pasa por un finally: el temporal se borra antes de salir.
  rmSync(area, { recursive: true, force: true });
  process.stdout.write(line);
  process.exit(line ? 0 : 1);
}

if (positionals[0] === "handoff") {
  try {
    const { repo, head, branch } = current();
    const store = ReviewStore.forPackage(packageRoot);
    const session = values.chain ? new ChainStore(store).find(repo, values.chain) : store.findSession(repo, branch);
    if (!session) {
      process.stdout.write(`No p_reviewer session exists for ${values.chain ? `chain:${values.chain}` : branch}. Nothing to apply: offer to open the reviewer first.\n`);
      process.exit(0);
    }
    const selection = store.selection(session.id);
    const chain = values.chain ? new ChainStore(store).view(session.id) : null;
    if (values.json) process.stdout.write(`${JSON.stringify({ session, selection, ...(chain ? { chain } : {}) }, null, 2)}\n`);
    else process.stdout.write(handoffBrief(session, selection, head, chain));
    store.close();
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[ERR] :: HANDOFF_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());

try {
  const outcome = await review({
    packageRoot, cwd: values.project ?? process.cwd(), base: values.base, head: values.head, prUrl: values.pr,
    signal: controller.signal,
  });
  // El enlace abre la sesión de esta rama; si el servidor no arranca, la revisión ya está guardada igual.
  const opened = outcome.run.status === "done" && !values["no-open"]
    ? await link(outcome.session.id).catch((error: unknown) => {
      process.stderr.write(`[WARN] :: OPEN_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    })
    : null;
  if (values.json) process.stdout.write(`${JSON.stringify({ ...outcome, link: opened }, null, 2)}\n`);
  else {
    const { run, findings } = outcome;
    console.log(`// 000  REVISIÓN ${run.status.toUpperCase()}`);
    if (run.error) console.log(`▏ ${run.error}`);
    if (run.summary) console.log(`\n${run.summary}`);
    if (run.tour.length) console.log("\n// 001  RECORRIDO");
    run.tour.forEach((step, index) => {
      console.log(`\n${index + 1}. ${step.title}`);
      console.log(`▏ ${step.plain}${step.why ? ` ${step.why}` : ""}`);
      console.log(`▏ ${step.files.join(" · ")}`);
    });
    if (findings.length) console.log("\n// 002  HALLAZGOS");
    const label = { new: "nuevo", persists: "sigue", resolved: "resuelto", unchecked: "sin comprobar" } as const;
    findings.forEach((item, index) => {
      const probe = item.check?.probe ?? item.probe;
      const shown = probe ? ` · ${probeLabel(probe)}` : "";
      console.log(`\n${String(index + 1).padStart(2, "0")} ${label[item.status]} · ${item.severity} · ${item.kind} · ${item.title}${shown}`);
      console.log(`▏ ${item.plain}`);
      if (probe?.reason) console.log(`▏ ${probe.reason}`);
      if (probe?.baseline) console.log(`▏ base ${probe.baseline.sha.slice(0, 12)}: ${probeLabel({ ...probe, ...probe.baseline })} · ${probe.baseline.reason}`);
      if (item.check) console.log(`▏ ${item.check.note}`);
      if (item.status !== "resolved") for (const citation of item.citations) console.log(`▏ ${citation.ref}`);
    });
    for (const gap of run.gaps) console.log(`\n· pendiente: ${gap}`);
    if (run.rejected.length) console.log(`\n· apartados: ${run.rejected.length} (sin citas válidas o mal formados)`);
    if (opened) console.log(`\n// 003  REVISOR\n▏ ${opened}`);
  }
  process.exit(outcome.run.status === "done" ? 0 : 1);
} catch (error) {
  process.stderr.write(`[ERR] :: REVIEW_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
