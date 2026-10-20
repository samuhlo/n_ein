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

// Persistencia entre aperturas.
store.close();
store = new ReviewStore(path);
assert.equal(store.findings(session.id).length, 3);
assert.equal(store.selection(session.id).length, 1);
store.close();

console.log("previewer store: OK");
