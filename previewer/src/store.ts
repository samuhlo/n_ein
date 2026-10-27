// =============================================================================
// [DATA] SESIONES DEL REVISOR
// Una sesión por rama de un repositorio; cada revisión de un head es una
// ejecución. Vive en el hogar del canal, nunca en el repositorio revisado.
// Las valoraciones del usuario van en su propia tabla: volver a analizar no las toca,
// y un hallazgo de un head anterior no se borra, solo deja de estar vigente.
// Cada hallazgo pertenece a un hilo (el id de su primera aparición): si una
// revisión posterior lo ve otra vez, continúa el hilo y hereda valoración y
// selección; si lo da por resuelto, el hilo se cierra con su comprobación.
// =============================================================================

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { channelDir } from "../../pi-package/models.ts";
import type { Citation, Finding, Kind, Probe, Severity, TourStep } from "./finding.ts";
import { storedProbe } from "./probe-result.ts";

export const VERDICTS = ["vale", "descartar", "investigar"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type RunStatus = "running" | "done" | "failed" | "cancelled";
export type Usage = { input: number; output: number; cacheRead: number; usd: number };
/** Respecto a la última revisión terminada: nuevo, sigue, resuelto o sin comprobar desde un head anterior. */
export type Status = "new" | "persists" | "resolved" | "unchecked";
export type Outcome = "resolved" | "persists" | "unchecked";
/** Lo que una revisión posterior comprobó de un hilo sin volver a reportarlo. */
export type Check = { runId: string; outcome: Outcome; note: string; probe: Probe | null };

export type Session = {
  id: string;
  repo: string;
  branch: string;
  prUrl: string | null;
  baseSha: string | null;
  headSha: string | null;
  created: string;
};

export type Run = {
  id: string;
  sessionId: string;
  baseSha: string;
  headSha: string;
  model: string;
  thinking: string;
  status: RunStatus;
  error: string | null;
  summary: string;
  /** Recorrido guiado del cambio, en orden de lectura. */
  tour: TourStep[];
  gaps: string[];
  rejected: string[];
  usage: Usage | null;
  started: string;
  ended: string | null;
};

export type Rating = { verdict: Verdict; reason: string | null; at: string };

export type StoredFinding = Finding & {
  id: string;
  sessionId: string;
  runId: string;
  headSha: string;
  /** Id de la primera aparición; valoración y selección van por hilo. */
  thread: string;
  status: Status;
  /** Visto en el head vigente de la sesión. Uno antiguo sigue listado hasta que se decida. */
  current: boolean;
  /** Última comprobación posterior a esta aparición: por qué está resuelto o sigue. */
  check: Check | null;
  rating: Rating | null;
  selected: boolean;
};

export type RunResult = {
  status: Exclude<RunStatus, "running">;
  error?: string;
  summary?: string;
  tour?: TourStep[];
  gaps?: string[];
  rejected?: string[];
  usage?: Usage;
  /** `thread`: hilo de una revisión anterior que este hallazgo continúa. */
  findings?: (Finding & { thread?: string })[];
  checks?: { thread: string; outcome: Outcome; note: string; probe: Probe | null }[];
};

// La v4 cambia el significado de la evidencia y añade comprobaciones «unchecked».
// Un lector antiguo no debe interpretar not_applicable + exit 0 como un arreglo.
const SCHEMA = 5;

/** Base de datos del canal: `~/.n_ein/<canal>/previewer/previewer.db`. */
export function storePath(packageRoot: string): string {
  return process.env.N_EIN_PREVIEWER_DB || join(channelDir(packageRoot), "previewer", "previewer.db");
}

type SessionRow = { id: string; repo: string; branch: string; pr_url: string | null; base_sha: string | null; head_sha: string | null; created: string };
type RunRow = {
  id: string; session_id: string; base_sha: string; head_sha: string; model: string; thinking: string; status: RunStatus;
  error: string | null; summary: string; tour: string; gaps: string; rejected: string; usage: string | null; started: string; ended: string | null;
};
type FindingRow = {
  id: string; session_id: string; run_id: string; head_sha: string; kind: Kind; severity: Severity; title: string; plain: string;
  condition: string; consequence: string; citations: string; probe: string | null; verification: string; thread: string;
  verdict: Verdict | null; reason: string | null; rated: string | null; selected: number | null; run_order: number;
};
type CheckRow = { run_id: string; thread: string; outcome: Outcome; note: string; probe: string | null; run_order: number };

const now = (): string => new Date().toISOString();

function session(row: SessionRow): Session {
  return { id: row.id, repo: row.repo, branch: row.branch, prUrl: row.pr_url, baseSha: row.base_sha, headSha: row.head_sha, created: row.created };
}

function run(row: RunRow): Run {
  return {
    id: row.id, sessionId: row.session_id, baseSha: row.base_sha, headSha: row.head_sha, model: row.model, thinking: row.thinking,
    status: row.status, error: row.error, summary: row.summary, tour: JSON.parse(row.tour), gaps: JSON.parse(row.gaps), rejected: JSON.parse(row.rejected),
    usage: row.usage ? JSON.parse(row.usage) : null, started: row.started, ended: row.ended,
  };
}

function finding(row: FindingRow, status: Status, check: Check | null): StoredFinding {
  const citations: Citation[] = JSON.parse(row.citations);
  const probe: Probe | null = row.probe ? storedProbe(JSON.parse(row.probe)) : null;
  return {
    id: row.id, sessionId: row.session_id, runId: row.run_id, headSha: row.head_sha, kind: row.kind, severity: row.severity,
    title: row.title, plain: row.plain, condition: row.condition, consequence: row.consequence, citations, probe,
    verification: row.verification, thread: row.thread, status, current: status === "new" || status === "persists", check,
    rating: row.verdict && row.rated ? { verdict: row.verdict, reason: row.reason, at: row.rated } : null,
    selected: row.selected === 1,
  };
}

export class ReviewStore {
  readonly db: Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.migrate();
  }

  static forPackage(packageRoot: string): ReviewStore {
    return new ReviewStore(storePath(packageRoot));
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    const { user_version: version } = this.db.query<{ user_version: number }, []>("PRAGMA user_version").get() ?? { user_version: 0 };
    if (version > SCHEMA) throw new Error(`previewer.db usa el esquema ${version}; esta versión entiende hasta ${SCHEMA}`);
    if (version === SCHEMA) return;
    this.db.transaction(() => {
      if (version < 1) this.schemaV1();
      if (version < 2) {
        this.db.run("ALTER TABLE findings ADD COLUMN thread TEXT NOT NULL DEFAULT ''");
        this.db.run("UPDATE findings SET thread = id");
        this.db.run("CREATE INDEX findings_thread ON findings (thread)");
        // Desde aquí ratings.finding_id y selection.finding_id son el hilo: el id de su primera aparición.
        this.db.run(`CREATE TABLE checks (
          run_id TEXT NOT NULL REFERENCES runs(id), thread TEXT NOT NULL REFERENCES findings(id),
          outcome TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', probe TEXT, PRIMARY KEY (run_id, thread))`);
      }
      if (version < 3) this.db.run("ALTER TABLE runs ADD COLUMN tour TEXT NOT NULL DEFAULT '[]'");
      if (version < 5) {
        this.db.run(`CREATE TABLE chains (
          session_id TEXT PRIMARY KEY REFERENCES sessions(id), name TEXT NOT NULL,
          lease_pid INTEGER, lease_token TEXT)`);
        this.db.run(`CREATE TABLE chain_revisions (
          id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES chains(session_id),
          ordinal INTEGER NOT NULL, fingerprint TEXT NOT NULL, plan TEXT NOT NULL, created TEXT NOT NULL,
          UNIQUE(session_id, ordinal))`);
        this.db.run(`CREATE TABLE chain_runs (
          revision_id TEXT NOT NULL REFERENCES chain_revisions(id), position INTEGER NOT NULL,
          run_id TEXT PRIMARY KEY REFERENCES runs(id))`);
      }
      this.db.run(`PRAGMA user_version = ${SCHEMA}`);
    })();
  }

  private schemaV1(): void {
    this.db.run(`CREATE TABLE sessions (
      id TEXT PRIMARY KEY, repo TEXT NOT NULL, branch TEXT NOT NULL, pr_url TEXT,
      base_sha TEXT, head_sha TEXT, created TEXT NOT NULL, UNIQUE (repo, branch))`);
    this.db.run(`CREATE TABLE runs (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      base_sha TEXT NOT NULL, head_sha TEXT NOT NULL, model TEXT NOT NULL, thinking TEXT NOT NULL,
      status TEXT NOT NULL, error TEXT, summary TEXT NOT NULL DEFAULT '', gaps TEXT NOT NULL DEFAULT '[]',
      rejected TEXT NOT NULL DEFAULT '[]', usage TEXT, started TEXT NOT NULL, ended TEXT)`);
    this.db.run(`CREATE TABLE findings (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), run_id TEXT NOT NULL REFERENCES runs(id),
      head_sha TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, plain TEXT NOT NULL,
      condition TEXT NOT NULL, consequence TEXT NOT NULL, citations TEXT NOT NULL, probe TEXT,
      verification TEXT NOT NULL, position INTEGER NOT NULL)`);
    this.db.run(`CREATE TABLE ratings (
      finding_id TEXT PRIMARY KEY REFERENCES findings(id), verdict TEXT NOT NULL, reason TEXT, at TEXT NOT NULL)`);
    this.db.run(`CREATE TABLE selection (
      finding_id TEXT PRIMARY KEY REFERENCES findings(id), selected INTEGER NOT NULL, at TEXT NOT NULL)`);
    this.db.run("CREATE INDEX findings_session ON findings (session_id, position)");
  }

  /** Abre la sesión de una rama o la crea; el enlace a la PR se actualiza si llega uno. */
  openSession(input: { repo: string; branch: string; prUrl?: string | null }): Session {
    const existing = this.db.query<SessionRow, { repo: string; branch: string }>(
      "SELECT * FROM sessions WHERE repo = $repo AND branch = $branch").get({ repo: input.repo, branch: input.branch });
    if (existing) {
      if (input.prUrl && input.prUrl !== existing.pr_url)
        this.db.query("UPDATE sessions SET pr_url = $url WHERE id = $id").run({ url: input.prUrl, id: existing.id });
      return session({ ...existing, pr_url: input.prUrl || existing.pr_url });
    }
    const row: SessionRow = { id: randomUUID(), repo: input.repo, branch: input.branch, pr_url: input.prUrl ?? null, base_sha: null, head_sha: null, created: now() };
    this.db.query(`INSERT INTO sessions (id, repo, branch, pr_url, base_sha, head_sha, created)
      VALUES ($id, $repo, $branch, $pr_url, $base_sha, $head_sha, $created)`).run(row);
    return session(row);
  }

  /** La sesión de una rama, sin crearla: leer no deja rastro. */
  findSession(repo: string, branch: string): Session | null {
    const row = this.db.query<SessionRow, { repo: string; branch: string }>(
      "SELECT * FROM sessions WHERE repo = $repo AND branch = $branch").get({ repo, branch });
    return row ? session(row) : null;
  }

  session(id: string): Session | null {
    const row = this.db.query<SessionRow, { id: string }>("SELECT * FROM sessions WHERE id = $id").get({ id });
    return row ? session(row) : null;
  }

  sessions(): Session[] {
    return this.db.query<SessionRow, []>("SELECT * FROM sessions ORDER BY rowid DESC").all().map(session);
  }

  startRun(input: { sessionId: string; baseSha: string; headSha: string; model: string; thinking: string;
    chain?: { revisionId: string; position: number; token: string } }): Run {
    const id = randomUUID();
    this.db.transaction(() => {
      if (input.chain) {
        const revision = this.db.query<{ session_id: string; plan: string; lease_token: string | null }, [string]>(
          "SELECT r.session_id,r.plan,c.lease_token FROM chain_revisions r JOIN chains c ON c.session_id=r.session_id WHERE r.id=?").get(input.chain.revisionId);
        const stage = revision ? JSON.parse(revision.plan).stages[input.chain.position] : null;
        if (!revision || revision.session_id !== input.sessionId || revision.lease_token !== input.chain.token
          || !stage || stage.baseSha !== input.baseSha || stage.headSha !== input.headSha)
          throw new Error("el tramo no pertenece al snapshot o a la ejecución activa de la cadena");
        const attempts = this.db.query<{ position: number; status: RunStatus }, [string]>(
          "SELECT c.position,r.status FROM chain_runs c JOIN runs r ON r.id=c.run_id WHERE c.revision_id=? ORDER BY r.rowid DESC").all(input.chain.revisionId);
        if (attempts.some(a => a.position === input.chain!.position && a.status === "done")) throw new Error("el tramo ya está completado; repetir requiere otro snapshot");
        for (let before = 0; before < input.chain.position; before++)
          if (attempts.find(a => a.position === before)?.status !== "done") throw new Error("los tramos anteriores deben terminar antes de continuar");
      }
      this.db.query(`INSERT INTO runs (id, session_id, base_sha, head_sha, model, thinking, status, started)
        VALUES ($id, $session, $base, $head, $model, $thinking, 'running', $started)`).run({
        id, session: input.sessionId, base: input.baseSha, head: input.headSha, model: input.model, thinking: input.thinking, started: now(),
      });
      if (input.chain) this.db.query("INSERT INTO chain_runs VALUES (?,?,?)").run(input.chain.revisionId, input.chain.position, id);
    }).immediate();
    return this.run(id)!;
  }

  run(id: string): Run | null {
    const row = this.db.query<RunRow, { id: string }>("SELECT * FROM runs WHERE id = $id").get({ id });
    return row ? run(row) : null;
  }

  runs(sessionId: string): Run[] {
    return this.db.query<RunRow, { id: string }>("SELECT * FROM runs WHERE session_id = $id ORDER BY rowid").all({ id: sessionId }).map(run);
  }

  /**
   * Cierra una ejecución. Solo una terminada con éxito, y la última en empezar, mueve
   * el head vigente: un fallo o una revisión rezagada no dejan «antiguos» los buenos.
   */
  finishRun(runId: string, result: RunResult): StoredFinding[] {
    const current = this.run(runId);
    if (!current) throw new Error(`ejecución desconocida: ${runId}`);
    if (current.status !== "running") throw new Error(`la ejecución ${runId} ya terminó (${current.status})`);
    this.db.transaction(() => {
      this.db.query(`UPDATE runs SET status = $status, error = $error, summary = $summary, tour = $tour, gaps = $gaps,
        rejected = $rejected, usage = $usage, ended = $ended WHERE id = $id`).run({
        id: runId, status: result.status, error: result.error ?? null, summary: result.summary ?? "", tour: JSON.stringify(result.tour ?? []),
        gaps: JSON.stringify(result.gaps ?? []), rejected: JSON.stringify(result.rejected ?? []),
        usage: result.usage ? JSON.stringify(result.usage) : null, ended: now(),
      });
      if (result.status !== "done") return;
      const threads = new Set(this.db.query<{ thread: string }, { id: string }>(
        "SELECT DISTINCT thread FROM findings WHERE session_id = $id").all({ id: current.sessionId }).map((row) => row.thread));
      const used = new Set<string>();
      // BLINDAJE -> Solo se continúa un hilo de esta sesión, y una vez por revisión; lo demás abre hilo propio.
      const continues = (thread: string | undefined): thread is string => !!thread && threads.has(thread) && !used.has(thread);
      const insert = this.db.query(`INSERT INTO findings (id, session_id, run_id, head_sha, kind, severity, title, plain,
        condition, consequence, citations, probe, verification, position, thread)
        VALUES ($id, $session, $run, $head, $kind, $severity, $title, $plain, $condition, $consequence, $citations, $probe, $verification, $position, $thread)`);
      (result.findings ?? []).forEach((item, position) => {
        const id = randomUUID();
        const thread = continues(item.thread) ? item.thread : id;
        used.add(thread);
        insert.run({
          id, session: current.sessionId, run: runId, head: current.headSha, kind: item.kind, severity: item.severity,
          title: item.title, plain: item.plain, condition: item.condition, consequence: item.consequence,
          citations: JSON.stringify(item.citations), probe: item.probe ? JSON.stringify(item.probe) : null,
          verification: item.verification, position, thread,
        });
      });
      const check = this.db.query(`INSERT INTO checks (run_id, thread, outcome, note, probe) VALUES ($run, $thread, $outcome, $note, $probe)`);
      for (const item of result.checks ?? []) {
        if (!continues(item.thread)) continue;
        used.add(item.thread);
        check.run({ run: runId, thread: item.thread, outcome: item.outcome, note: item.note, probe: item.probe ? JSON.stringify(item.probe) : null });
      }
      // BLINDAJE -> Si una revisión posterior ya terminó, esta llega tarde y no le quita la vigencia.
      this.db.query(`UPDATE sessions SET base_sha = $base, head_sha = $head WHERE id = $id AND NOT EXISTS (
        SELECT 1 FROM runs later WHERE later.session_id = $id AND later.status = 'done'
          AND later.rowid > (SELECT rowid FROM runs WHERE id = $run))`)
        .run({ base: current.baseSha, head: current.headSha, id: current.sessionId, run: runId });
    })();
    return this.findings(current.sessionId).filter((item) => item.runId === runId);
  }

  /**
   * Un hallazgo por hilo, en su última aparición, del más reciente al más antiguo.
   * Nada desaparece: lo resuelto y lo no comprobado siguen listados con su estado.
   */
  findings(sessionId: string, throughRunId?: string): StoredFinding[] {
    const cutoff = throughRunId ? this.db.query<{ n: number }, [string, string]>(
      "SELECT rowid AS n FROM runs WHERE id=? AND session_id=? AND status='done'").get(throughRunId, sessionId)?.n : Number.MAX_SAFE_INTEGER;
    if (cutoff === undefined) throw new Error("la revisión histórica no pertenece a esta sesión o no terminó");
    const args = { id: sessionId, cutoff };
    const rows = this.db.query<FindingRow, typeof args>(`
      SELECT f.*, r.verdict, r.reason, r.at AS rated, s.selected, ru.rowid AS run_order
      FROM findings f
      JOIN runs ru ON ru.id = f.run_id
      LEFT JOIN ratings r ON r.finding_id = f.thread
      LEFT JOIN selection s ON s.finding_id = f.thread
      WHERE f.session_id = $id AND ru.rowid <= $cutoff ORDER BY ru.rowid DESC, f.position`).all(args);
    const checks = this.db.query<CheckRow, typeof args>(`
      SELECT c.*, ru.rowid AS run_order FROM checks c JOIN runs ru ON ru.id = c.run_id
      WHERE ru.session_id = $id AND ru.rowid <= $cutoff ORDER BY ru.rowid DESC`).all(args);
    // La vigente es la última revisión terminada: la misma regla que mueve el head de la sesión.
    const latest = this.db.query<{ run_order: number }, typeof args>(
      "SELECT rowid AS run_order FROM runs WHERE session_id = $id AND status = 'done' AND rowid <= $cutoff ORDER BY rowid DESC LIMIT 1").get(args);
    const seen = new Map<string, number>();
    for (const row of rows) seen.set(row.thread, (seen.get(row.thread) ?? 0) + 1);
    const result: StoredFinding[] = [];
    const listed = new Set<string>();
    for (const row of rows) {
      if (listed.has(row.thread)) continue;
      listed.add(row.thread);
      const later = checks.find((item) => item.thread === row.thread && item.run_order > row.run_order);
      const check: Check | null = later ? { runId: later.run_id, outcome: later.outcome, note: later.note, probe: later.probe ? storedProbe(JSON.parse(later.probe)) : null } : null;
      let status: Status = "unchecked";
      if (row.run_order === latest?.run_order) status = (seen.get(row.thread) ?? 0) > 1 ? "persists" : "new";
      else if (later?.outcome === "resolved") status = "resolved";
      else if (later?.outcome === "persists" && later.run_order === latest?.run_order) status = "persists";
      result.push(finding(row, status, check));
    }
    return result;
  }

  /** El estado actual del hilo al que pertenece `id`, en su última aparición. */
  finding(id: string): StoredFinding | null {
    const row = this.db.query<{ session_id: string; thread: string }, { id: string }>(
      "SELECT session_id, thread FROM findings WHERE id = $id").get({ id });
    return row ? (this.findings(row.session_id).find((item) => item.thread === row.thread) ?? null) : null;
  }

  rate(findingId: string, verdict: Verdict, reason: string | null = null): StoredFinding {
    if (!VERDICTS.includes(verdict)) throw new Error(`valoración desconocida: ${verdict}`);
    const { thread } = this.require(findingId);
    this.db.transaction(() => {
      this.db.query(`INSERT INTO ratings (finding_id, verdict, reason, at) VALUES ($id, $verdict, $reason, $at)
        ON CONFLICT (finding_id) DO UPDATE SET verdict = excluded.verdict, reason = excluded.reason, at = excluded.at`)
        .run({ id: thread, verdict, reason: reason?.trim() || null, at: now() });
      // BLINDAJE -> Descartar un hallazgo lo saca de lo que vuelve a n_ein.
      if (verdict === "descartar") this.db.query("DELETE FROM selection WHERE finding_id = $id").run({ id: thread });
    })();
    return this.require(findingId);
  }

  select(findingId: string, selected: boolean): StoredFinding {
    const item = this.require(findingId);
    if (selected && item.rating?.verdict === "descartar")
      throw new Error("un hallazgo descartado no se puede enviar a corregir");
    if (selected)
      this.db.query(`INSERT INTO selection (finding_id, selected, at) VALUES ($id, 1, $at)
        ON CONFLICT (finding_id) DO UPDATE SET selected = 1, at = excluded.at`).run({ id: item.thread, at: now() });
    else this.db.query("DELETE FROM selection WHERE finding_id = $id").run({ id: item.thread });
    return this.require(findingId);
  }

  /** Cambia con cada valoración o selección de la sesión: una pestaña abierta nota lo que se decidió en otra. */
  decisions(sessionId: string): string {
    const row = this.db.query<{ count: number; last: string | null }, { id: string }>(`
      SELECT COUNT(*) AS count, MAX(at) AS last FROM (
        SELECT r.at FROM ratings r JOIN findings f ON f.id = r.finding_id WHERE f.session_id = $id
        UNION ALL
        SELECT s.at FROM selection s JOIN findings f ON f.id = s.finding_id WHERE f.session_id = $id)`).get({ id: sessionId });
    return `${row?.count ?? 0}@${row?.last ?? ""}`;
  }

  /** Lo que el usuario eligió para que n_ein corrija y aún no está resuelto. */
  selection(sessionId: string): StoredFinding[] {
    return this.findings(sessionId).filter((item) => item.selected && item.status !== "resolved");
  }

  private require(findingId: string): StoredFinding {
    const item = this.finding(findingId);
    if (!item) throw new Error(`hallazgo desconocido: ${findingId}`);
    return item;
  }
}
