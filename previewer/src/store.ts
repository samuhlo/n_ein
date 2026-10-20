// =============================================================================
// [DATA] SESIONES DEL REVISOR
// Una sesión por rama de un repositorio; cada revisión de un head es una
// ejecución. Vive en el hogar del canal, nunca en el repositorio revisado.
// Las valoraciones de Samu van en su propia tabla: volver a analizar no las toca,
// y un hallazgo de un head anterior no se borra, solo deja de estar vigente.
// =============================================================================

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { channelDir } from "../../pi-package/models.ts";
import type { Citation, Finding, Kind, Probe, Severity } from "./finding.ts";

export const VERDICTS = ["vale", "descartar", "investigar"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type RunStatus = "running" | "done" | "failed" | "cancelled";
export type Usage = { input: number; output: number; cacheRead: number; usd: number };

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
  /** Visto en el head vigente de la sesión. Uno antiguo sigue listado hasta que se decida. */
  current: boolean;
  rating: Rating | null;
  selected: boolean;
};

export type RunResult = {
  status: Exclude<RunStatus, "running">;
  error?: string;
  summary?: string;
  gaps?: string[];
  rejected?: string[];
  usage?: Usage;
  findings?: Finding[];
};

const SCHEMA = 1;

/** Base de datos del canal: `~/.n_ein/<canal>/previewer/previewer.db`. */
export function storePath(packageRoot: string): string {
  return process.env.N_EIN_PREVIEWER_DB || join(channelDir(packageRoot), "previewer", "previewer.db");
}

type SessionRow = { id: string; repo: string; branch: string; pr_url: string | null; base_sha: string | null; head_sha: string | null; created: string };
type RunRow = {
  id: string; session_id: string; base_sha: string; head_sha: string; model: string; thinking: string; status: RunStatus;
  error: string | null; summary: string; gaps: string; rejected: string; usage: string | null; started: string; ended: string | null;
};
type FindingRow = {
  id: string; session_id: string; run_id: string; head_sha: string; kind: Kind; severity: Severity; title: string; plain: string;
  condition: string; consequence: string; citations: string; probe: string | null; verification: string;
  verdict: Verdict | null; reason: string | null; rated: string | null; selected: number | null; current_head: string | null;
};

const now = (): string => new Date().toISOString();

function session(row: SessionRow): Session {
  return { id: row.id, repo: row.repo, branch: row.branch, prUrl: row.pr_url, baseSha: row.base_sha, headSha: row.head_sha, created: row.created };
}

function run(row: RunRow): Run {
  return {
    id: row.id, sessionId: row.session_id, baseSha: row.base_sha, headSha: row.head_sha, model: row.model, thinking: row.thinking,
    status: row.status, error: row.error, summary: row.summary, gaps: JSON.parse(row.gaps), rejected: JSON.parse(row.rejected),
    usage: row.usage ? JSON.parse(row.usage) : null, started: row.started, ended: row.ended,
  };
}

function finding(row: FindingRow): StoredFinding {
  const citations: Citation[] = JSON.parse(row.citations);
  const probe: Probe | null = row.probe ? JSON.parse(row.probe) : null;
  return {
    id: row.id, sessionId: row.session_id, runId: row.run_id, headSha: row.head_sha, kind: row.kind, severity: row.severity,
    title: row.title, plain: row.plain, condition: row.condition, consequence: row.consequence, citations, probe,
    verification: row.verification, current: row.head_sha === row.current_head,
    rating: row.verdict && row.rated ? { verdict: row.verdict, reason: row.reason, at: row.rated } : null,
    selected: row.selected === 1,
  };
}

const FINDING_SELECT = `
  SELECT f.*, r.verdict, r.reason, r.at AS rated, s.selected, ses.head_sha AS current_head
  FROM findings f
  JOIN sessions ses ON ses.id = f.session_id
  LEFT JOIN ratings r ON r.finding_id = f.id
  LEFT JOIN selection s ON s.finding_id = f.id`;

export class ReviewStore {
  readonly db: Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
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
      this.db.run(`PRAGMA user_version = ${SCHEMA}`);
    })();
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

  session(id: string): Session | null {
    const row = this.db.query<SessionRow, { id: string }>("SELECT * FROM sessions WHERE id = $id").get({ id });
    return row ? session(row) : null;
  }

  sessions(): Session[] {
    return this.db.query<SessionRow, []>("SELECT * FROM sessions ORDER BY rowid DESC").all().map(session);
  }

  startRun(input: { sessionId: string; baseSha: string; headSha: string; model: string; thinking: string }): Run {
    const id = randomUUID();
    this.db.query(`INSERT INTO runs (id, session_id, base_sha, head_sha, model, thinking, status, started)
      VALUES ($id, $session, $base, $head, $model, $thinking, 'running', $started)`).run({
      id, session: input.sessionId, base: input.baseSha, head: input.headSha, model: input.model, thinking: input.thinking, started: now(),
    });
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
      this.db.query(`UPDATE runs SET status = $status, error = $error, summary = $summary, gaps = $gaps,
        rejected = $rejected, usage = $usage, ended = $ended WHERE id = $id`).run({
        id: runId, status: result.status, error: result.error ?? null, summary: result.summary ?? "",
        gaps: JSON.stringify(result.gaps ?? []), rejected: JSON.stringify(result.rejected ?? []),
        usage: result.usage ? JSON.stringify(result.usage) : null, ended: now(),
      });
      if (result.status !== "done") return;
      const insert = this.db.query(`INSERT INTO findings (id, session_id, run_id, head_sha, kind, severity, title, plain,
        condition, consequence, citations, probe, verification, position)
        VALUES ($id, $session, $run, $head, $kind, $severity, $title, $plain, $condition, $consequence, $citations, $probe, $verification, $position)`);
      (result.findings ?? []).forEach((item, position) => insert.run({
        id: randomUUID(), session: current.sessionId, run: runId, head: current.headSha, kind: item.kind, severity: item.severity,
        title: item.title, plain: item.plain, condition: item.condition, consequence: item.consequence,
        citations: JSON.stringify(item.citations), probe: item.probe ? JSON.stringify(item.probe) : null,
        verification: item.verification, position,
      }));
      // BLINDAJE -> Si una revisión posterior ya terminó, esta llega tarde y no le quita la vigencia.
      this.db.query(`UPDATE sessions SET base_sha = $base, head_sha = $head WHERE id = $id AND NOT EXISTS (
        SELECT 1 FROM runs later WHERE later.session_id = $id AND later.status = 'done'
          AND later.rowid > (SELECT rowid FROM runs WHERE id = $run))`)
        .run({ base: current.baseSha, head: current.headSha, id: current.sessionId, run: runId });
    })();
    return this.findings(current.sessionId).filter((item) => item.runId === runId);
  }

  /** Todos los hallazgos de la sesión, del más reciente al más antiguo; los antiguos llevan `current: false`. */
  findings(sessionId: string): StoredFinding[] {
    return this.db.query<FindingRow, { id: string }>(`${FINDING_SELECT}
      JOIN runs ru ON ru.id = f.run_id WHERE f.session_id = $id ORDER BY ru.rowid DESC, f.position`).all({ id: sessionId }).map(finding);
  }

  finding(id: string): StoredFinding | null {
    const row = this.db.query<FindingRow, { id: string }>(`${FINDING_SELECT} WHERE f.id = $id`).get({ id });
    return row ? finding(row) : null;
  }

  rate(findingId: string, verdict: Verdict, reason: string | null = null): StoredFinding {
    if (!VERDICTS.includes(verdict)) throw new Error(`valoración desconocida: ${verdict}`);
    this.require(findingId);
    this.db.transaction(() => {
      this.db.query(`INSERT INTO ratings (finding_id, verdict, reason, at) VALUES ($id, $verdict, $reason, $at)
        ON CONFLICT (finding_id) DO UPDATE SET verdict = excluded.verdict, reason = excluded.reason, at = excluded.at`)
        .run({ id: findingId, verdict, reason: reason?.trim() || null, at: now() });
      // BLINDAJE -> Descartar un hallazgo lo saca de lo que vuelve a n_ein.
      if (verdict === "descartar") this.db.query("DELETE FROM selection WHERE finding_id = $id").run({ id: findingId });
    })();
    return this.finding(findingId)!;
  }

  select(findingId: string, selected: boolean): StoredFinding {
    const item = this.require(findingId);
    if (selected && item.rating?.verdict === "descartar")
      throw new Error("un hallazgo descartado no se puede enviar a corregir");
    if (selected)
      this.db.query(`INSERT INTO selection (finding_id, selected, at) VALUES ($id, 1, $at)
        ON CONFLICT (finding_id) DO UPDATE SET selected = 1, at = excluded.at`).run({ id: findingId, at: now() });
    else this.db.query("DELETE FROM selection WHERE finding_id = $id").run({ id: findingId });
    return this.finding(findingId)!;
  }

  /** Lo que Samu eligió para que n_ein corrija. */
  selection(sessionId: string): StoredFinding[] {
    return this.findings(sessionId).filter((item) => item.selected);
  }

  private require(findingId: string): StoredFinding {
    const item = this.finding(findingId);
    if (!item) throw new Error(`hallazgo desconocido: ${findingId}`);
    return item;
  }
}
