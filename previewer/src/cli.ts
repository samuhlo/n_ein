// =============================================================================
// [FLOW] ENTRADA PROVISIONAL DEL REVISOR
// uso: n-ein-previewer review [--base REF] [--head REF] [--model P/M]
//      [--thinking NIVEL] [--pr URL] [--no-open] [--json]
//      n-ein-previewer open
//      n-ein-previewer handoff [--json]
// `nein previewer` la llevará al launcher; el agente usa bin/n-ein-previewer.
// =============================================================================

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { review } from "./engine.ts";
import { git } from "./git.ts";
import { handoffBrief } from "./handoff.ts";
import { ensureServer, reviewerLink } from "./open.ts";
import { ReviewStore } from "./store.ts";

const packageRoot = resolve(import.meta.dir, "../..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    head: { type: "string" },
    model: { type: "string" },
    thinking: { type: "string" },
    pr: { type: "string" },
    project: { type: "string" },
    json: { type: "boolean", default: false },
    "no-open": { type: "boolean", default: false },
  },
});

const USAGE = "uso: n-ein-previewer review [--base REF] [--head REF] [--model P/M] [--thinking NIVEL] [--pr URL] [--no-open] [--json]\n       n-ein-previewer open\n       n-ein-previewer handoff [--json]\n";
if (positionals[0] !== "review" && positionals[0] !== "handoff" && positionals[0] !== "open") {
  process.stderr.write(USAGE);
  process.exit(64);
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

if (positionals[0] === "open") {
  try {
    const { repo, branch } = current();
    const store = ReviewStore.forPackage(packageRoot);
    const session = store.findSession(repo, branch);
    store.close();
    if (!session) {
      process.stdout.write(`No hay revisiones de ${branch}: lanza primero n-ein-previewer review.\n`);
      process.exit(1);
    }
    process.stdout.write(`// 000  REVISOR · ${branch}\n▏ ${await link(session.id)}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[ERR] :: OPEN_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

if (positionals[0] === "handoff") {
  try {
    const { repo, head, branch } = current();
    const store = ReviewStore.forPackage(packageRoot);
    const session = store.findSession(repo, branch);
    if (!session) {
      process.stdout.write(`No p_reviewer session exists for ${branch}. Nothing to apply: offer to open the reviewer first.\n`);
      process.exit(0);
    }
    const selection = store.selection(session.id);
    if (values.json) process.stdout.write(`${JSON.stringify({ session, selection }, null, 2)}\n`);
    else process.stdout.write(handoffBrief(session, selection, head));
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
    model: values.model, thinking: values.thinking, signal: controller.signal,
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
      const shown = probe ? (probe.reproduced ? " · sonda falla: demostrado" : probe.exitCode === 0 ? " · sonda pasa" : " · sonda no reproduce") : "";
      console.log(`\n${String(index + 1).padStart(2, "0")} ${label[item.status]} · ${item.severity} · ${item.kind} · ${item.title}${shown}`);
      console.log(`▏ ${item.plain}`);
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
