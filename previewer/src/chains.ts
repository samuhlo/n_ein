// =============================================================================
// [FLOW] CADENAS DE CAMBIOS
// Una sesión conserva decisiones e hilos. Cada snapshot fija todos los rangos;
// los tramos se revisan en orden y la integración mira el conjunto al final.
// =============================================================================
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { review, REVIEWER, type ReviewOptions } from "./engine.ts";
import { ReviewStore, type RunStatus, type Session, type StoredFinding } from "./store.ts";

export type ChainStage = { name: string; kind: "change" | "integration"; base: string; head: string; baseSha: string; headSha: string; prUrl: string | null };
export type ChainPlan = { name: string; repo: string; stages: ChainStage[] };
export type ChainRevision = { id: string; sessionId: string; ordinal: number; fingerprint: string; plan: ChainPlan };
export type ChainEvent = { runId: string; revision: number; position: number; stage: string; headSha: string;
  kind: ChainStage["kind"]; outcome: "detected" | "persists" | "resolved" | "unchecked" | "reopened"; note: string };
export type ChainView = {
  name: string; revision: number; revisionId: string; complete: boolean; busy: boolean;
  stages: (ChainStage & { runId: string | null; status: RunStatus | "pending"; error: string | null })[];
  history: Record<string, ChainEvent[]>;
  lastReviewed: { stage: string; revision: number; headSha: string } | null;
  /** Refs movidas no cambian el snapshot ni convierten sus resultados en una revisión del nuevo código. */
  drift: string[];
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function label(v: unknown, field: string, fallback?: string): string {
  if (v === undefined && fallback) return fallback;
  if (typeof v !== "string" || !v.trim() || v.length > 200 || /[\x00-\x1f\x7f]/.test(v)) throw new Error(`${field}: texto no válido`);
  return v.trim();
}
function prUrl(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || v.length > 2000) throw new Error("URL de PR no válida");
  const url = new URL(v);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("URL de PR no válida");
  return url.href;
}

/** Solo Git local y lecturas: rechaza divergencias antes de crear sesiones o llamar al modelo. */
export function planChain(cwd: string, input: unknown): ChainPlan {
  if (!isObject(input) || !Array.isArray(input.steps) || input.steps.length < 2 || input.steps.length > 50)
    throw new Error("la cadena necesita entre 2 y 50 tramos ordenados");
  const repo = git(cwd, "rev-parse", "--show-toplevel");
  const resolve = (ref: string) => git(repo, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
  let base = label(input.base, "base");
  let baseSha = resolve(base);
  const stages: ChainStage[] = [];
  for (const [index, item] of input.steps.entries()) {
    if (!isObject(item)) throw new Error(`tramo ${index + 1}: no es un objeto`);
    if (item.base !== undefined && resolve(label(item.base, "base del tramo")) !== baseSha)
      throw new Error(`la base del tramo ${index + 1} no es el head del tramo anterior`);
    const head = label(item.head, "head"), headSha = resolve(head);
    if (baseSha === headSha) throw new Error(`tramo ${index + 1}: base y head son iguales`);
    if (git(repo, "merge-base", baseSha, headSha) !== baseSha)
      throw new Error(`tramo ${index + 1}: la base no es ancestro del head`);
    stages.push({ name: label(item.name, "nombre del tramo", `#${index + 1}`), kind: "change", base, head, baseSha, headSha, prUrl: prUrl(item.prUrl) });
    base = head; baseSha = headSha;
  }
  stages.push({ name: "Integración", kind: "integration", base: stages[0]!.base, baseSha: stages[0]!.baseSha,
    head: stages.at(-1)!.head, headSha: stages.at(-1)!.headSha, prUrl: null });
  return { name: label(input.name, "nombre de cadena"), repo, stages };
}

function alive(pid: number | null): boolean {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}
type RevisionRow = { id: string; session_id: string; ordinal: number; fingerprint: string; plan: string };
const revision = (r: RevisionRow): ChainRevision => ({ id: r.id, sessionId: r.session_id, ordinal: r.ordinal, fingerprint: r.fingerprint, plan: JSON.parse(r.plan) });

export class ChainStore {
  constructor(readonly store: ReviewStore) {}

  find(repo: string, name: string): Session | null {
    const row = this.store.db.query<{ session_id: string }, [string, string]>(
      "SELECT c.session_id FROM chains c JOIN sessions s ON s.id=c.session_id WHERE s.repo=? AND c.name=?").get(repo, name);
    return row ? this.store.session(row.session_id) : null;
  }

  list(repo: string): { session: Session; chain: ChainView }[] {
    return this.store.db.query<{ session_id: string }, [string]>(
      "SELECT c.session_id FROM chains c JOIN sessions s ON s.id=c.session_id WHERE s.repo=? ORDER BY c.rowid DESC").all(repo)
      .map(r => ({ session: this.store.session(r.session_id)!, chain: this.view(r.session_id)! }));
  }

  latest(sessionId: string): ChainRevision | null {
    const row = this.store.db.query<RevisionRow, [string]>(
      "SELECT * FROM chain_revisions WHERE session_id=? ORDER BY ordinal DESC LIMIT 1").get(sessionId);
    return row ? revision(row) : null;
  }

  location(runId: string): { name: string; revision: number } | null {
    const row = this.store.db.query<{ plan: string; ordinal: number; position: number }, [string]>(
      "SELECT r.plan,r.ordinal,c.position FROM chain_runs c JOIN chain_revisions r ON r.id=c.revision_id WHERE c.run_id=?").get(runId);
    return row ? { name: (JSON.parse(row.plan) as ChainPlan).stages[row.position]!.name, revision: row.ordinal } : null;
  }

  /** El lease solo protege esta cadena. Un proceso muerto deja evidencia de interrupción. */
  begin(plan: ChainPlan, fingerprint: string, again = false): { session: Session; revision: ChainRevision; token: string } {
    return this.store.db.transaction(() => {
      const session = this.store.openSession({ repo: plan.repo, branch: `chain:${plan.name}` });
      this.store.db.query("INSERT INTO chains(session_id,name) VALUES (?,?) ON CONFLICT(session_id) DO NOTHING").run(session.id, plan.name);
      const owner = this.store.db.query<{ lease_pid: number | null }, [string]>("SELECT lease_pid FROM chains WHERE session_id=?").get(session.id)!;
      if (alive(owner.lease_pid)) throw new Error(`la cadena «${plan.name}» ya tiene una revisión activa`);
      this.store.db.query("UPDATE runs SET status='failed',error='ejecución de cadena interrumpida',ended=? WHERE session_id=? AND status='running'")
        .run(new Date().toISOString(), session.id);
      let current = this.latest(session.id);
      if (!current || current.fingerprint !== fingerprint || again) {
        current = { id: randomUUID(), sessionId: session.id, ordinal: (current?.ordinal ?? 0) + 1, fingerprint, plan };
        this.store.db.query("INSERT INTO chain_revisions VALUES (?,?,?,?,?,?)")
          .run(current.id, session.id, current.ordinal, fingerprint, JSON.stringify(plan), new Date().toISOString());
      }
      const token = randomUUID();
      this.store.db.query("UPDATE chains SET lease_pid=?,lease_token=? WHERE session_id=?").run(process.pid, token, session.id);
      return { session, revision: current, token };
    }).immediate();
  }

  release(sessionId: string, token: string): void {
    this.store.db.query("UPDATE chains SET lease_pid=NULL,lease_token=NULL WHERE session_id=? AND lease_token=?").run(sessionId, token);
  }

  view(sessionId: string): ChainView | null {
    const snapshot = this.latest(sessionId);
    if (!snapshot) return null;
    const runs = this.store.runs(sessionId);
    const links = this.store.db.query<{ run_id: string; revision_id: string; position: number }, [string]>(
      "SELECT cr.* FROM chain_runs cr JOIN chain_revisions r ON r.id=cr.revision_id WHERE r.session_id=? ORDER BY cr.rowid").all(sessionId);
    const snapshots = new Map(this.store.db.query<RevisionRow, [string]>("SELECT * FROM chain_revisions WHERE session_id=?").all(sessionId).map(r => [r.id, revision(r)]));
    const place = new Map(links.map(link => {
      const rev = snapshots.get(link.revision_id)!;
      return [link.run_id, { stage: rev.plan.stages[link.position]!, position: link.position, revision: rev.ordinal }];
    }));
    const stages = snapshot.plan.stages.map((stage, position) => {
      const attempt = links.filter(l => l.revision_id === snapshot.id && l.position === position).at(-1);
      const run = attempt ? runs.find(r => r.id === attempt.run_id) : null;
      return { ...stage, runId: run?.id ?? null, status: run?.status ?? "pending" as const, error: run?.error ?? null };
    });
    const history: Record<string, ChainEvent[]> = {};
    const observed = this.store.db.query<{ thread: string; run_id: string; note: string; outcome: string; ordering: number }, [string, string]>(`
      SELECT f.thread,f.run_id,f.title AS note,'found' AS outcome,r.rowid AS ordering FROM findings f JOIN runs r ON r.id=f.run_id WHERE f.session_id=?
      UNION ALL SELECT c.thread,c.run_id,c.note,c.outcome,r.rowid AS ordering FROM checks c JOIN runs r ON r.id=c.run_id WHERE r.session_id=?
      ORDER BY ordering`).all(sessionId, sessionId);
    for (const event of observed) {
      const location = place.get(event.run_id);
      if (!location) continue;
      const events = history[event.thread] ??= [];
      const outcome = event.outcome === "found" ? events.length ? events.at(-1)?.outcome === "resolved" ? "reopened" : "persists" : "detected"
        : event.outcome === "persists" && events.at(-1)?.outcome === "resolved" ? "reopened" : event.outcome as ChainEvent["outcome"];
      events.push({ runId: event.run_id, revision: location.revision, position: location.position, stage: location.stage.name,
        kind: location.stage.kind, headSha: location.stage.headSha, outcome, note: event.note });
    }
    const owner = this.store.db.query<{ lease_pid: number | null }, [string]>("SELECT lease_pid FROM chains WHERE session_id=?").get(sessionId)!;
    const last = runs.filter(r => r.status === "done").at(-1);
    const lastPlace = last ? place.get(last.id) : null;
    const drift: string[] = [];
    for (const stage of snapshot.plan.stages.filter(s => s.kind === "change")) {
      for (const [ref, sha] of [[stage.base, stage.baseSha], [stage.head, stage.headSha]]) {
        try { if (git(snapshot.plan.repo, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`) !== sha) drift.push(ref!); }
        catch { drift.push(ref!); }
      }
    }
    return { name: snapshot.plan.name, revision: snapshot.ordinal, revisionId: snapshot.id,
      complete: stages.every(s => s.status === "done"), busy: alive(owner.lease_pid), stages, history,
      lastReviewed: last && lastPlace ? { stage: lastPlace.stage.name, revision: lastPlace.revision, headSha: last.headSha } : null,
      drift: [...new Set(drift)] };
  }
}

export type ChainOptions = Omit<ReviewOptions, "base" | "head" | "prUrl" | "chain"> & { definition: unknown; again?: boolean };
export async function reviewChain(options: ChainOptions): Promise<{ session: Session; chain: ChainView; findings: StoredFinding[] }> {
  const plan = planChain(options.cwd, options.definition);
  const store = options.store ?? ReviewStore.forPackage(options.packageRoot);
  const ownStore = !options.store;
  const chains = new ChainStore(store);
  const fingerprint = () => {
    const hash = createHash("sha256").update(JSON.stringify([plan, options.model ?? REVIEWER.model, options.thinking ?? REVIEWER.thinking]));
    for (const path of ["runtime.json", "previewer/src/engine.ts", "previewer/src/chains.ts", "previewer/src/store.ts",
      "previewer/src/probe-result.ts", "previewer/src/report.ts", "previewer/agent/reviewer.md", "previewer/src/runner.ts",
      "previewer/agent/guard.ts", "previewer/src/guard-rules.ts", "previewer/src/sandbox.ts",
      "pi-package/persona.md", "pi-package/extensions/codegraph.ts", "bin/n-ein-codegraph"])
      hash.update(readFileSync(join(options.packageRoot, path)));
    return hash.digest("hex");
  };
  let lease: ReturnType<ChainStore["begin"]> | null = null;
  try {
    lease = chains.begin(plan, fingerprint(), options.again);
    const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
    for (const [position, stage] of plan.stages.entries()) {
      if (options.signal?.aborted) break;
      if (fingerprint() !== lease.revision.fingerprint) throw new Error("el revisor cambió durante la cadena; reanuda con un snapshot nuevo");
      if (chains.view(lease.session.id)!.stages[position]!.status === "done") continue;
      log(`[CHAIN] >> STAGE_START :: stage: ${position + 1}/${plan.stages.length} | name: ${stage.name}`);
      const result = await review({ ...options, store, cwd: plan.repo, base: stage.baseSha, head: stage.headSha,
        chain: { sessionId: lease.session.id, revisionId: lease.revision.id, position, token: lease.token, stages: plan.stages } });
      if (result.run.status !== "done") break;
    }
    return { session: store.session(lease.session.id)!, chain: { ...chains.view(lease.session.id)!, busy: false }, findings: store.findings(lease.session.id) };
  } finally {
    if (lease) chains.release(lease.session.id, lease.token);
    if (ownStore) store.close();
  }
}
