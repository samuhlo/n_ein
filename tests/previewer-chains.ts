// [CHECK] Una cadena fija sus rangos antes de gastar modelo y mantiene un solo hilo.
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { planChain, reviewChain, ChainStore } from "../previewer/src/chains.ts";
import { ReviewStore } from "../previewer/src/store.ts";
import { createHandler } from "../previewer/src/server.ts";
import { renderPage, type SessionView } from "../previewer/web/view.ts";
import { text } from "../previewer/web/html.ts";
import { handoffBrief } from "../previewer/src/handoff.ts";

const root = resolve(import.meta.dir, "..");
const area = realpathSync(mkdtempSync(join(tmpdir(), "nein-chain-")));
process.env.N_EIN_HOME = join(area, "home");
const repo = join(area, "repo"); mkdirSync(repo);
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "-q", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@local");
function commit(value: number, message: string) { writeFileSync(join(repo, "value.cjs"), `module.exports = ${value};\n`); writeFileSync(join(repo, "step.txt"), message); git("add", "."); git("commit", "-qm", message); return git("rev-parse", "HEAD"); }
const base = commit(0, "base");
git("switch", "-qc", "one"); const one = commit(1, "introduce regression");
git("switch", "-qc", "two"); const two = commit(1, "another change");
git("switch", "-qc", "three"); const three = commit(0, "fix regression");
const definition = { name: "Serie de prueba", base: "main", steps: [
  { name: "PR 1", head: "one", prUrl: "https://example.test/pull/1" },
  { name: "PR 2", head: "two" }, { name: "PR 3", head: "three" },
] };
const plan = planChain(repo, definition);
const manifest = join(area, "chain.json"), db = join(area, "review.db");
writeFileSync(manifest, JSON.stringify(definition));
process.env.N_EIN_PREVIEWER_DB = db;
const cli = (...args: string[]) => spawnSync(join(root, "bin/n-ein-previewer"), [...args, "--project", repo], { encoding: "utf8", env: process.env });
const planned = cli("chain", "--file", manifest, "--plan");
assert.equal(planned.status, 0, planned.stderr);
assert.equal(JSON.parse(planned.stdout).stages.length, 4);
assert.equal(existsSync(db), false, "--plan no crea el almacén ni consume modelo");
assert.deepEqual(plan.stages.map(s => [s.baseSha, s.headSha]), [[base, one], [one, two], [two, three], [base, three]]);
assert.equal(plan.stages.at(-1)?.kind, "integration");
assert.throws(() => planChain(repo, { ...definition, steps: [{ head: "one" }, { base: "main", head: "two" }] }), /base/i);
assert.throws(() => planChain(repo, { ...definition, steps: [{ head: "two" }, { head: "one" }] }), /ancestro|ancestor/i);
assert.throws(() => planChain(repo, { ...definition, steps: [{ head: "one", prUrl: "javascript:bad()" }, { head: "two" }] }), /URL/);

console.log("previewer chain planning: OK");

const store = new ReviewStore(db);
const chains = new ChainStore(store);
let failOnce = true;
const visited: string[] = [];
const source = `const value = require('../value.cjs');
console.log('NEIN_PROBE_RESULT ' + JSON.stringify({check:'zero',outcome:value ? 'reproduced':'passed',reason:'observed value '+value}));
process.exit(value ? 1 : 0);`;
const options = { packageRoot: root, cwd: repo, definition, store, model: "test/reviewer", log: () => {},
  sandbox: { kind: "injected" as const, wrap: (command: string) => ({ file: "/bin/bash", args: ["-c", command] }) } };
const runner: NonNullable<Parameters<typeof reviewChain>[0]["runner"]> = async request => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: request.cwd, encoding: "utf8" }).trim();
  const integrated = request.prompt.includes("final integration review");
  visited.push(integrated ? "integration" : sha);
  const session = chains.find(repo, definition.name)!;
  if (sha === two) {
    const finding = store.findings(session.id)[0]!;
    store.rate(finding.id, "vale", "decisión conservada entre tramos"); store.select(finding.id, true);
    await assert.rejects(reviewChain({ ...options, runner }), /revisión activa/);
    if (failOnce) { failOnce = false; return { text: "", error: "fallo controlado", usage: { input: 0, output: 0, cacheRead: 0, usd: 0 } }; }
  }
  if (integrated) {
    assert.ok(request.prompt.includes(base) && request.prompt.includes(three));
    assert.match(request.prompt, /contracts changed in different stages/);
  }
  const probeFile = ".previewer-probes/zero.cjs";
  mkdirSync(join(request.cwd, ".previewer-probes"), { recursive: true }); writeFileSync(join(request.cwd, probeFile), source);
  const findings = sha === one || sha === two ? [{ kind: "bug", severity: "high", title: sha === one ? "Valor incorrecto" : "Mismo problema con otro título",
    plain: "El resultado debe ser cero.", condition: "al pedir el valor", consequence: "devuelve un resultado incorrecto",
    citations: [`value.cjs@${sha}:L1`], probe: { command: `node ${probeFile}`, file: probeFile, protocol: "nein-probe-v1", check: "zero" }, verification: "" }] : [];
  return { text: JSON.stringify({ summary: integrated ? "Integración revisada" : "Tramo revisado", findings, gaps: [] }), error: null,
    usage: { input: 0, output: 0, cacheRead: 0, usd: 0 } };
};
const partial = await reviewChain({ ...options, runner });
assert.equal(partial.chain.complete, false);
assert.deepEqual(partial.chain.stages.map(s => s.status), ["done", "failed", "pending", "pending"]);
assert.equal(partial.findings.length, 1);
const thread = partial.findings[0]!.thread;
assert.equal(partial.findings[0]?.selected, true);
assert.match(handoffBrief(partial.session, store.selection(partial.session.id), base, partial.chain), /Integration NOT completed/);
assert.match(handoffBrief(partial.session, store.selection(partial.session.id), base, partial.chain), /Do not edit an earlier PR/);
const completed = await reviewChain({ ...options, runner });
assert.deepEqual(visited, [one, two, two, three, "integration"], "reanudar no repite la PR 1");
assert.equal(completed.chain.complete, true);
assert.equal(completed.findings.length, 1, "el aviso repetido sin previous inequívoco conserva el mismo hilo");
assert.equal(completed.findings[0]?.thread, thread);
assert.equal(completed.findings[0]?.status, "resolved");
assert.equal(completed.findings[0]?.selected, true);
assert.equal(completed.findings[0]?.rating?.reason, "decisión conservada entre tramos");
assert.deepEqual(completed.chain.history[thread]?.map(e => [e.stage, e.outcome]), [["PR 1", "detected"], ["PR 2", "persists"], ["PR 3", "resolved"], ["Integración", "resolved"]]);
assert.equal(store.selection(completed.session.id).length, 0);
const cliStatus = cli("status", "--chain", definition.name);
assert.equal(cliStatus.status, 0, cliStatus.stderr);
assert.equal(JSON.parse(cliStatus.stdout).chain.complete, true);
assert.equal(JSON.parse(cliStatus.stdout).reviewed, three);
assert.match(cli("handoff", "--chain", definition.name).stdout, /Target work: three at/);
assert.equal(JSON.parse(cli("chains").stdout).length, 1);
const firstRun = completed.chain.stages[0]!.runId!;
assert.equal(store.findings(completed.session.id, firstRun)[0]?.status, "new", "el historial conserva el estado del primer tramo");
assert.equal(store.findings(completed.session.id, firstRun)[0]?.selected, true, "las decisiones son del hilo, no de una foto antigua");
assert.throws(() => store.findings(completed.session.id, "another-session"), /histórica/);

const token = "t".repeat(48), port = 4321;
const handle = await createHandler({ packageRoot: root, store, token, port: () => port });
const fetchView = async (suffix = "") => {
  const response = await handle(new Request(`http://127.0.0.1:${port}/api/sessions/${completed.session.id}${suffix}`,
    { headers: { host: `127.0.0.1:${port}`, "x-previewer-token": token } }));
  return response;
};
const finalView = await (await fetchView()).json() as SessionView;
assert.equal(finalView.chain?.complete, true);
assert.equal(finalView.findings[0]?.status, "resolved");
const page = text(renderPage(finalView));
assert.match(page, /Integración revisada/);
assert.match(page, /Historial del hallazgo/);
assert.match(page, /detectado en: PR 1/);
assert.match(page, new RegExp(`href="\\?run=${firstRun}"`));
const historical = await (await fetchView(`?run=${firstRun}`)).json() as SessionView;
assert.equal(historical.historical, true);
assert.equal(historical.run?.headSha, one);
assert.equal(historical.reviewLabel?.name, "PR 1");
assert.match(text(renderPage(historical)), /Evidencia histórica/);
assert.match(text(renderPage(historical)), /data-action="select" disabled/);
assert.equal((await fetchView("?run=not-in-this-session")).status, 404);
await reviewChain({ ...options, runner });
assert.equal(visited.length, 5, "mismo snapshot completo: no consume modelo");
const repeated = await reviewChain({ ...options, runner, again: true });
assert.equal(repeated.chain.revision, 2);
assert.equal(repeated.findings.length, 1);
assert.ok(repeated.chain.history[thread]?.some(e => e.revision === 2 && e.outcome === "reopened"));

// Cambiar una ref nunca reescribe el snapshot ni etiqueta el nuevo código como revisado.
git("branch", "-f", "one", two);
assert.ok(chains.view(completed.session.id)?.drift.includes("one"));
assert.equal(chains.view(completed.session.id)?.stages[0]?.headSha, one);
git("branch", "-f", "one", one);

// Un proceso muerto se reanuda, y deja el intento abandonado identificado como fallo.
const last = chains.latest(completed.session.id)!;
const abandoned = chains.begin(plan, last.fingerprint, true);
const stopped = store.startRun({ sessionId: completed.session.id, baseSha: base, headSha: one, model: "test/reviewer", thinking: "high",
  chain: { revisionId: abandoned.revision.id, position: 0, token: abandoned.token } });
assert.throws(() => store.startRun({ sessionId: completed.session.id, baseSha: base, headSha: three, model: "test/reviewer", thinking: "high",
  chain: { revisionId: abandoned.revision.id, position: 3, token: abandoned.token } }), /anteriores/);
store.db.query("UPDATE chains SET lease_pid=? WHERE session_id=?").run(999999999, completed.session.id);
const resumed = await reviewChain({ ...options, runner });
assert.equal(resumed.chain.revision, 3);
assert.equal(resumed.chain.complete, true);
assert.equal(store.run(stopped.id)?.status, "failed");
assert.match(store.run(stopped.id)?.error ?? "", /interrumpida/);

git("switch", "-qc", "four"); commit(0, "append another stage");
const extended = await reviewChain({ ...options, definition: { ...definition, steps: [...definition.steps, { name: "PR 4", head: "four" }] }, runner });
assert.equal(extended.chain.revision, 4, "un cambio de cadena crea otro snapshot");
assert.equal(extended.chain.stages.length, 5);
assert.equal(extended.findings.length, 1);
assert.equal(extended.findings[0]?.thread, thread);
assert.equal(extended.findings[0]?.rating?.reason, "decisión conservada entre tramos");

// La integración puede aportar un hallazgo que no existía en los informes incrementales.
const integration = await reviewChain({ ...options, definition: { ...definition, name: "Integración propia" }, runner: async req => {
  const isFinal = req.prompt.includes("final integration review");
  return { text: JSON.stringify({ summary: "fixture", findings: isFinal ? [{ kind: "question", severity: "low", title: "Contrato del conjunto",
    plain: "Decisión del fixture", condition: "conjunto", consequence: "necesita una decisión", citations: [`value.cjs@${three}:L1`], verification: "" }] : [] }),
    error: null, usage: { input: 0, output: 0, cacheRead: 0, usd: 0 } };
} });
assert.equal(integration.findings.length, 1);
assert.equal(integration.chain.history[integration.findings[0]!.thread]?.[0]?.kind, "integration");
assert.equal(integration.chain.history[integration.findings[0]!.thread]?.[0]?.stage, "Integración");
const controller = new AbortController();
let callsAfterCancel = 0;
const cancelled = await reviewChain({ ...options, definition: { ...definition, name: "Cancelada" }, signal: controller.signal,
  runner: async () => { callsAfterCancel++; controller.abort(); return { text: "", error: "cancelada", usage: { input: 0, output: 0, cacheRead: 0, usd: 0 } }; } });
assert.equal(callsAfterCancel, 1);
assert.equal(cancelled.chain.complete, false);
assert.equal(cancelled.chain.busy, false);
assert.deepEqual(cancelled.chain.stages.map(s => s.status), ["cancelled", "pending", "pending", "pending"]);
assert.equal(new ChainStore(store).view(cancelled.session.id)?.busy, false, "cancelar libera únicamente la cadena propia");
assert.equal(git("status", "--porcelain"), "");
assert.equal(readFileSync(join(repo, "value.cjs"), "utf8"), "module.exports = 0;\n");
store.close();
console.log("previewer chains: resume, integration, history and decisions OK");
