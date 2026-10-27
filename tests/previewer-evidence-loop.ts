// [CHECK] Una segunda revisión conserva la condición comprobada, las decisiones
// del usuario y el código fijado: ni un exit 0 ni un escenario obsoleto cierran el hilo.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { review } from "../previewer/src/engine.ts";
import { copiesRoot } from "../previewer/src/copy.ts";
import { ReviewStore } from "../previewer/src/store.ts";
import { PROBE_PROTOCOL } from "../previewer/src/probe-result.ts";
import { handoffBrief } from "../previewer/src/handoff.ts";
import type { AgentRequest } from "../previewer/src/runner.ts";

const root = resolve(import.meta.dir, "..");
const area = realpathSync(mkdtempSync(join(tmpdir(), "nein-evidence-loop-")));
const repo = join(area, "repo");
mkdirSync(repo);
process.env.N_EIN_HOME = join(area, "home");
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "-q", "-b", "main");
git("config", "user.email", "test@local"); git("config", "user.name", "Test");
function state(ready: boolean, preserved: boolean) {
  writeFileSync(join(repo, "backup.cjs"), `module.exports = () => (${JSON.stringify({ ready, preserved })});\n`);
  git("add", "."); git("commit", "-qm", `${ready} ${preserved}`);
  return git("rev-parse", "HEAD");
}
const base = state(true, true);
git("switch", "-qc", "change");
const broken = state(true, false);
const store = new ReviewStore(join(area, "review.db"));
const file = ".previewer-probes/backup.cjs";
const source = `const check = 'backup-content';
function result(outcome, reason) {
  console.log('NEIN_PROBE_RESULT ' + JSON.stringify({ check, outcome, reason }));
  process.exit(outcome === 'reproduced' ? 1 : outcome === 'error' ? 2 : 0);
}
try {
  const actual = require('../backup.cjs')();
  if (!actual.ready) result('not_applicable', 'La operación antigua ya no está disponible.');
  if (!actual.preserved) result('reproduced', 'Falta el contenido recuperado.');
  result('passed', 'El contenido se recupera.');
} catch (error) { result('error', String(error)); }
`;
const spec = { command: "node .previewer-probes/backup.cjs", file, protocol: PROBE_PROTOCOL, check: "backup-content", compareBase: true };
const issue = (sha: string, probe: unknown = spec) => ({ kind: "bug", severity: "high", title: "Contenido perdido", plain: "La copia pierde datos.",
  condition: "al recuperar", consequence: "falta el contenido", citations: [`backup.cjs@${sha}:L1`], probe, verification: "" });
const keyFor = (req: AgentRequest) => req.prompt.match(/^(P\d+)\. Contenido perdido/m)![1];
async function run(answer: (req: AgentRequest) => object) {
  return review({ packageRoot: root, cwd: repo, store, model: "test/reviewer", log: () => {},
    sandbox: { kind: "injected", wrap: command => ({ file: "/bin/bash", args: ["-c", command] }) },
    runner: async req => ({ text: JSON.stringify({ summary: "Comprobado", ...answer(req) }), usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: null }) });
}
const first = await run(req => {
  mkdirSync(join(req.cwd, ".previewer-probes")); writeFileSync(join(req.cwd, file), source);
  return { findings: [issue(broken)] };
});
assert.equal(first.run.status, "done", first.run.error ?? "");
const finding = first.findings[0]!;
assert.equal(finding.probe?.outcome, "reproduced");
assert.equal(finding.probe?.baseline?.outcome, "passed");
assert.equal(finding.probe?.baseline?.sha, base);
store.rate(finding.id, "vale", "Comprobado"); store.select(finding.id, true);

const still = await run(req => {
  // El motor debe recuperar los bytes originales, no aceptar una sonda manipulada para pasar.
  writeFileSync(join(req.cwd, file), "process.exit(0)");
  return { resolved: [{ previous: keyFor(req), note: "Está corregido", citations: [`backup.cjs@${broken}:L1`] }] };
});
assert.equal(still.findings[0]?.status, "persists");
assert.equal(still.findings[0]?.check?.probe?.outcome, "reproduced");
assert.equal(still.findings[0]?.check?.probe?.baseline, undefined, "una repetición no presenta la comparación anterior como si acabara de hacerla");

const changed = state(false, false);
const obsolete = await run(req => ({ resolved: [{ previous: keyFor(req), note: "Ya no falla" }] }));
assert.equal(obsolete.findings[0]?.status, "unchecked");
assert.equal(obsolete.findings[0]?.check?.probe?.outcome, "not_applicable");
assert.equal(obsolete.findings[0]?.selected, true);
assert.equal(obsolete.findings[0]?.rating?.reason, "Comprobado");
assert.match(handoffBrief(obsolete.session, store.selection(obsolete.session.id), changed), /scenario no longer applies/);

const unrelated = await run(req => {
  const replacement = ".previewer-probes/replacement.cjs";
  writeFileSync(join(req.cwd, replacement), `console.log('NEIN_PROBE_RESULT {"check":"different","outcome":"passed","reason":"another test passed"}');`);
  return { resolved: [{ previous: keyFor(req), note: "Otra prueba pasa", probe: { command: `node ${replacement}`, file: replacement, protocol: PROBE_PROTOCOL, check: "different" } }] };
});
assert.equal(unrelated.findings[0]?.status, "unchecked", "cambiar de prueba no acredita por sí solo el arreglo");

const staleCitation = await run(req => ({ resolved: [{ previous: keyFor(req), note: "Cita antigua", citations: [`backup.cjs@${base}:L1`] }] }));
assert.equal(staleCitation.findings[0]?.status, "unchecked");
assert.match(staleCitation.run.rejected.join("\n"), /resolución rechazada/);

state(true, true);
const fixed = await run(() => ({}));
assert.equal(fixed.findings[0]?.status, "resolved");
assert.equal(fixed.findings[0]?.check?.probe?.outcome, "passed");
assert.equal(fixed.findings[0]?.selected, true, "no se borra la decisión al resolver");
assert.equal(store.selection(first.session.id).length, 0, "lo resuelto no vuelve como tarea pendiente");

// Un resultado explícito válido tampoco vale si la sonda ha modificado el código.
const head = git("rev-parse", "HEAD");
const modified = await run(req => {
  mkdirSync(join(req.cwd, ".previewer-probes"));
  writeFileSync(join(req.cwd, file), `require('fs').appendFileSync('backup.cjs', '\\n');\nconsole.log('NEIN_PROBE_RESULT {"check":"backup-content","outcome":"reproduced","reason":"changed code"}');process.exit(1);`);
  return { findings: [issue(head, { ...spec, compareBase: false })] };
});
assert.equal(modified.findings[0]?.probe?.outcome, "inconclusive");
assert.equal(modified.findings[0]?.probe?.reproduced, false);

// Compatibilidad: un informe antiguo conserva su hallazgo, pero no se inventa evidencia al repetirlo.
const legacy = await run(() => ({ findings: [issue(head, { command: "exit 0", file: null })] }));
const old = legacy.findings.find(f => f.runId === legacy.run.id)!;
store.select(old.id, true);
const unproved = await run(() => ({}));
assert.equal(unproved.findings.find(f => f.thread === old.thread)?.status, "unchecked");
assert.equal(unproved.findings.find(f => f.thread === old.thread)?.check?.probe?.outcome, "inconclusive");
assert.ok(store.selection(first.session.id).some(f => f.thread === old.thread));
const byCode = await run(req => ({ resolved: [{ previous: keyFor(req), note: "La implementación conserva el contenido.", citations: [`backup.cjs@${head}:L1`] }] }));
assert.equal(byCode.findings.find(f => f.thread === old.thread)?.status, "resolved");
assert.match(byCode.findings.find(f => f.thread === old.thread)?.check?.note ?? "", /inspección.*sin confirmación por sonda/);

// Un resultado anterior no desaparece del control aunque el log mostrado se recorte.
const duplicate = await run(req => {
  mkdirSync(join(req.cwd, ".previewer-probes"), { recursive: true });
  writeFileSync(join(req.cwd, file), `console.log('NEIN_PROBE_RESULT {"check":"backup-content","outcome":"reproduced","reason":"first"}'); console.log('x'.repeat(20000)); console.log('NEIN_PROBE_RESULT {"check":"backup-content","outcome":"passed","reason":"second"}');`);
  return { findings: [issue(head, { ...spec, compareBase: false })] };
});
assert.equal(duplicate.findings.find(f => f.runId === duplicate.run.id)?.probe?.outcome, "inconclusive");
const absolute = await run(req => {
  mkdirSync(join(req.cwd, ".previewer-probes"), { recursive: true });
  writeFileSync(join(req.cwd, file), source);
  return { findings: [issue(head, { ...spec, command: `node '${join(req.cwd, file)}'` })] };
});
assert.equal(absolute.findings.find(f => f.runId === absolute.run.id)?.probe?.baseline?.outcome, "not_run", "la supuesta base no puede ejecutar por accidente la copia del head");
assert.equal(git("status", "--porcelain"), "");
assert.ok(!existsSync(copiesRoot(repo)));
assert.match(readFileSync(join(repo, "backup.cjs"), "utf8"), /"preserved":true/);
store.close();
console.log("previewer evidence and second review: OK");
