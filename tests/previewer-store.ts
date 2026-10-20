import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "../previewer/src/finding.ts";
import { ReviewStore, storePath } from "../previewer/src/store.ts";

const sample = (title: string): Finding => ({
  kind: "bug",
  severity: "high",
  title,
  plain: "explicación llana",
  condition: "si el texto lleva tildes",
  consequence: "se corta a mitad de letra",
  citations: [{ ref: "src/a.ts@abc:L3", path: "src/a.ts", sha: "abc", start: 3, end: 3, text: "slice(0, 10)" }],
  probe: null,
  verification: "",
});

// El almacén vive en el hogar del canal, no en el repositorio revisado.
const home = mkdtempSync(join(tmpdir(), "nein-previewer-home-"));
process.env.N_EIN_HOME = home;
process.env.N_EIN_CHANNEL = "dev";
assert.equal(storePath("/no/importa"), join(home, "dev/previewer/previewer.db"));

const path = join(mkdtempSync(join(tmpdir(), "nein-previewer-")), "nested/previewer.db");
let store = new ReviewStore(path);
const session = store.openSession({ repo: "/repo", branch: "feat/x" });
assert.equal(store.openSession({ repo: "/repo", branch: "feat/x", prUrl: "https://example.test/pr/1" }).id, session.id, "una sesión por rama");
assert.equal(store.session(session.id)?.prUrl, "https://example.test/pr/1");

// Primera revisión con dos hallazgos.
const first = store.startRun({ sessionId: session.id, baseSha: "base", headSha: "h1", model: "openai-codex/gpt-6-sol", thinking: "high" });
assert.equal(first.status, "running");
const [a, b] = store.finishRun(first.id, { status: "done", summary: "resumen", findings: [sample("A"), sample("B")], usage: { input: 1, output: 2, cacheRead: 3, usd: 0.5 } });
assert.ok(a && b);
assert.deepEqual(a.citations[0]?.ref, "src/a.ts@abc:L3");
assert.equal(a.current, true);
assert.equal(store.session(session.id)?.headSha, "h1");
assert.throws(() => store.finishRun(first.id, { status: "done" }), /ya terminó/);

// Valoración y selección.
store.rate(a.id, "vale", "  lo vi también  ");
assert.equal(store.finding(a.id)?.rating?.reason, "lo vi también");
store.select(a.id, true);
store.select(b.id, true);
assert.deepEqual(store.selection(session.id).map((f) => f.title), ["A", "B"]);
store.rate(b.id, "descartar");
assert.deepEqual(store.selection(session.id).map((f) => f.title), ["A"], "descartar lo saca de la selección");
assert.throws(() => store.select(b.id, true), /descartado/);
assert.throws(() => store.rate("nope", "vale"), /desconocido/);

// Un fallo no cambia el head vigente ni añade hallazgos.
const failed = store.startRun({ sessionId: session.id, baseSha: "base", headSha: "h2", model: "m/x", thinking: "high" });
store.finishRun(failed.id, { status: "failed", error: "timeout", findings: [sample("C")] });
assert.equal(store.session(session.id)?.headSha, "h1");
assert.equal(store.findings(session.id).length, 2);
assert.equal(store.run(failed.id)?.error, "timeout");

// Segunda revisión buena: lo anterior sigue listado, no vigente, y conserva su valoración.
const second = store.startRun({ sessionId: session.id, baseSha: "base", headSha: "h3", model: "m/x", thinking: "high" });
store.finishRun(second.id, { status: "done", findings: [sample("D")] });
const all = store.findings(session.id);
assert.deepEqual(all.map((f) => [f.title, f.current]), [["D", true], ["A", false], ["B", false]]);
assert.equal(all.find((f) => f.title === "A")?.rating?.verdict, "vale", "volver a analizar no toca la valoración");
assert.equal(store.runs(session.id).length, 3);

// Dos revisiones a la vez: la que empezó antes y termina después no recupera la vigencia.
const slow = store.startRun({ sessionId: session.id, baseSha: "base", headSha: "h4", model: "m/x", thinking: "high" });
const fast = store.startRun({ sessionId: session.id, baseSha: "base", headSha: "h5", model: "m/x", thinking: "high" });
store.finishRun(fast.id, { status: "done", findings: [sample("E")] });
store.finishRun(slow.id, { status: "done", findings: [sample("F")] });
assert.equal(store.session(session.id)?.headSha, "h5");
assert.deepEqual(store.findings(session.id).filter((f) => f.current).map((f) => f.title), ["E"]);

// Persistencia entre aperturas.
store.close();
store = new ReviewStore(path);
assert.equal(store.findings(session.id).length, 5);
assert.equal(store.selection(session.id).length, 1);
store.close();

// --- Segunda revisión: hilos que siguen, se resuelven o quedan sin comprobar --------------
{
  const threads = new ReviewStore(":memory:");
  const branch = threads.openSession({ repo: "/repo", branch: "feat/hilos" });
  const r1 = threads.startRun({ sessionId: branch.id, baseSha: "base", headSha: "h1", model: "m/x", thinking: "high" });
  const [keep, fixed, idle, dismissed] = threads.finishRun(r1.id, { status: "done", findings: [sample("Sigue"), sample("Arreglado"), sample("Callado"), sample("Falsa alarma")] });
  assert.ok(keep && fixed && idle && dismissed);
  assert.deepEqual([keep.status, keep.thread], ["new", keep.id]);
  threads.rate(keep.id, "vale", "pasa de verdad");
  threads.select(keep.id, true);
  threads.select(fixed.id, true);
  threads.select(idle.id, true);
  threads.rate(dismissed.id, "descartar");

  const r2 = threads.startRun({ sessionId: branch.id, baseSha: "base", headSha: "h2", model: "m/x", thinking: "high" });
  const probe = { command: "bash p.sh", file: "p.sh", source: "exit 0", exitCode: 0, output: "", reproduced: false };
  threads.finishRun(r2.id, {
    status: "done",
    findings: [{ ...sample("Sigue, con otras palabras"), thread: keep.thread }, { ...sample("Hilo ajeno"), thread: "no-existe" }, sample("Nuevo")],
    checks: [{ thread: fixed.thread, outcome: "resolved", note: "ya no recorta", probe }],
  });
  const byTitle = new Map(threads.findings(branch.id).map((item) => [item.title, item]));
  assert.equal(threads.findings(branch.id).length, 6, "un hilo que sigue no se lista dos veces");
  const still = byTitle.get("Sigue, con otras palabras");
  assert.deepEqual([still?.status, still?.thread, still?.current], ["persists", keep.thread, true]);
  assert.equal(still?.rating?.reason, "pasa de verdad", "el hilo hereda la valoración");
  assert.equal(still?.selected, true, "y la selección");
  assert.equal(byTitle.get("Hilo ajeno")?.status, "new", "un hilo desconocido abre uno propio");
  const done = byTitle.get("Arreglado");
  assert.deepEqual([done?.status, done?.current, done?.check?.note, done?.check?.probe?.exitCode], ["resolved", false, "ya no recorta", 0]);
  assert.deepEqual([byTitle.get("Callado")?.status, byTitle.get("Callado")?.current], ["unchecked", false]);
  assert.equal(threads.finding(keep.id)?.title, "Sigue, con otras palabras", "por cualquier id se llega a la última aparición");
  assert.deepEqual(threads.selection(branch.id).map((item) => item.title).sort(), ["Callado", "Sigue, con otras palabras"], "lo resuelto sale de la selección; lo no comprobado se queda");

  // El mismo head otra vez: lo que no se vuelve a ver deja de estar vigente, y lo resuelto sigue resuelto.
  const r3 = threads.startRun({ sessionId: branch.id, baseSha: "base", headSha: "h2", model: "m/x", thinking: "high" });
  threads.finishRun(r3.id, { status: "done", findings: [], checks: [{ thread: idle.thread, outcome: "persists", note: "la sonda sigue fallando", probe: null }] });
  const again = new Map(threads.findings(branch.id).map((item) => [item.title, item]));
  assert.deepEqual([again.get("Sigue, con otras palabras")?.status, again.get("Sigue, con otras palabras")?.current], ["unchecked", false]);
  assert.equal(again.get("Arreglado")?.status, "resolved");
  assert.deepEqual([again.get("Callado")?.status, again.get("Callado")?.current], ["persists", true], "una sonda que sigue fallando lo mantiene vigente");
  threads.close();
}

// --- Migración desde el esquema 1 ------------------------------------------------------------
{
  const v1 = join(mkdtempSync(join(tmpdir(), "nein-previewer-v1-")), "previewer.db");
  const { Database } = await import("bun:sqlite");
  const old = new Database(v1, { create: true });
  old.run("CREATE TABLE sessions (id TEXT PRIMARY KEY, repo TEXT NOT NULL, branch TEXT NOT NULL, pr_url TEXT, base_sha TEXT, head_sha TEXT, created TEXT NOT NULL, UNIQUE (repo, branch))");
  old.run("CREATE TABLE runs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), base_sha TEXT NOT NULL, head_sha TEXT NOT NULL, model TEXT NOT NULL, thinking TEXT NOT NULL, status TEXT NOT NULL, error TEXT, summary TEXT NOT NULL DEFAULT '', gaps TEXT NOT NULL DEFAULT '[]', rejected TEXT NOT NULL DEFAULT '[]', usage TEXT, started TEXT NOT NULL, ended TEXT)");
  old.run("CREATE TABLE findings (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), run_id TEXT NOT NULL REFERENCES runs(id), head_sha TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, plain TEXT NOT NULL, condition TEXT NOT NULL, consequence TEXT NOT NULL, citations TEXT NOT NULL, probe TEXT, verification TEXT NOT NULL, position INTEGER NOT NULL)");
  old.run("CREATE TABLE ratings (finding_id TEXT PRIMARY KEY REFERENCES findings(id), verdict TEXT NOT NULL, reason TEXT, at TEXT NOT NULL)");
  old.run("CREATE TABLE selection (finding_id TEXT PRIMARY KEY REFERENCES findings(id), selected INTEGER NOT NULL, at TEXT NOT NULL)");
  old.run("INSERT INTO sessions VALUES ('s', '/repo', 'feat/v1', NULL, 'b', 'h', 'ayer')");
  old.run("INSERT INTO runs (id, session_id, base_sha, head_sha, model, thinking, status, started) VALUES ('r', 's', 'b', 'h', 'm/x', 'high', 'done', 'ayer')");
  old.run("INSERT INTO findings VALUES ('f', 's', 'r', 'h', 'bug', 'high', 'Antiguo', 'a', 'b', 'c', '[]', NULL, '', 0)");
  old.run("INSERT INTO ratings VALUES ('f', 'vale', NULL, 'ayer')");
  old.run("PRAGMA user_version = 1");
  old.close();
  const migrated = new ReviewStore(v1);
  const [kept] = migrated.findings("s");
  assert.deepEqual([kept?.title, kept?.thread, kept?.status, kept?.rating?.verdict], ["Antiguo", "f", "new", "vale"]);
  migrated.close();
}

console.log("previewer store: OK");
