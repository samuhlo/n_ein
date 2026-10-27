import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Finding } from "../previewer/src/finding.ts";
import { ReviewStore } from "../previewer/src/store.ts";

const root = resolve(import.meta.dir, "..");
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "nein-previewer-handoff-")));
const repo = join(scratch, "project");
mkdirSync(repo);
const git = (...args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "-q", "-b", "main");
git("config", "user.email", "test@local");
git("config", "user.name", "Test");
writeFileSync(join(repo, "a.ts"), "export const a = 1;\n");
git("add", ".");
git("commit", "-qm", "base");
git("switch", "-qc", "feat/x");
writeFileSync(join(repo, "a.ts"), "export const a = 2;\n");
git("commit", "-qam", "feat: change a");
const head = git("rev-parse", "HEAD");

const db = join(scratch, "previewer.db");
const env = { ...process.env, N_EIN_HOME: join(scratch, "home"), N_EIN_PREVIEWER_DB: db };
const handoff = (): string => {
  const result = spawnSync(join(root, "bin/n-ein-previewer"), ["handoff"], { cwd: repo, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

// `status` es lo que lee el Panel: un resumen de la rama, sin crear el almacén.
const status = (cwd = repo): Record<string, unknown> => {
  const result = spawnSync(join(root, "bin/n-ein-previewer"), ["status"], { cwd, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
assert.deepEqual(status(), { branch: "feat/x", head, reviewable: true, reason: "", session: null, reviewed: null, current: 0, unchecked: 0, selected: 0 });
assert.equal(existsSync(db), false, "leer el estado no crea el almacén");

const sample = (title: string, probe: Finding["probe"] = null): Finding => ({
  kind: "bug", severity: "high", title, plain: `Explicación llana de ${title}.`, condition: "si a vale 2", consequence: "se rompe",
  citations: [{ ref: `a.ts@${head.slice(0, 7)}:L1`, path: "a.ts", sha: head, start: 1, end: 1, text: "export const a = 2;" }],
  probe, verification: "",
});

// Sin sesión para la rama: no hay nada que aplicar.
assert.match(handoff(), /No p_reviewer session exists for feat\/x/);

const store = new ReviewStore(db);
const session = store.openSession({ repo, branch: "feat/x" });
const first = store.startRun({ sessionId: session.id, baseSha: "base", headSha: head, model: "m/x", thinking: "high" });
const probe = { command: "bash .previewer-probes/a.sh", file: ".previewer-probes/a.sh", source: "grep -q 'a = 2' a.ts && exit 1", exitCode: 1, output: "", reproduced: true, outcome: "reproduced" as const, protocol: "nein-probe-v1" as const, check: "a" };
const [kept, skipped, quiet, fixed] = store.finishRun(first.id, { status: "done", findings: [sample("Sigue", probe), sample("No elegido"), sample("Callado"), sample("Arreglado")] });
assert.ok(kept && skipped && quiet && fixed);

// Elegido nada todavía: lo dice y no elige por su cuenta.
assert.match(handoff(), /Nothing is selected in p_reviewer for feat\/x[\s\S]*do not pick any yourself/);

store.select(kept.id, true);
store.select(quiet.id, true);
store.select(fixed.id, true);
store.rate(quiet.id, "investigar", "no sé si pasa en Linux");
const second = store.startRun({ sessionId: session.id, baseSha: "base", headSha: head, model: "m/x", thinking: "high" });
store.finishRun(second.id, {
  status: "done",
  findings: [{ ...sample("Sigue, dicho de otra forma", probe), thread: kept.thread }],
  checks: [{ thread: fixed.thread, outcome: "resolved", note: "ya no pasa", probe: null }],
});
store.close();

assert.deepEqual(status(), { branch: "feat/x", head, reviewable: true, reason: "", session: session.id, reviewed: head, current: 1, unchecked: 2, selected: 2 });

const brief = handoff();
assert.match(brief, /The user selected 2 findings/);
assert.deepEqual([...brief.matchAll(/^## \d+\. (.+)$/gm)].map((match) => match[1]), ["Sigue, dicho de otra forma", "Callado"], "solo lo seleccionado y sin resolver, en orden");
assert.doesNotMatch(brief, /No elegido|Arreglado/);
assert.match(brief, /Add no other tasks/);
assert.match(brief, /## 2\. Callado\n\nStatus: NOT checked by the latest review: reproduce it before changing any code/, "lo no comprobado se avisa");
assert.match(brief, /User's rating: investigar \(no sé si pasa en Linux\)/);
assert.match(brief, /Probe: `bash \.previewer-probes\/a\.sh` defect reproduced \(exit 1\)/);
assert.match(brief, /grep -q 'a = 2' a\.ts && exit 1/, "la sonda viaja entera para usarla como test en rojo");
assert.match(brief, /export const a = 2;/, "y el código citado");
assert.doesNotMatch(brief, /branch is now at/);

// Si la rama avanzó desde la revisión, se avisa de comprobar contra el código actual.
writeFileSync(join(repo, "a.ts"), "export const a = 3;\n");
git("commit", "-qam", "fix: a");
assert.match(handoff(), /The branch is now at [0-9a-f]{12}: check each finding against the current code/);

assert.notEqual(status().head, head);
assert.equal(status().reviewed, head, "lo revisado es el head anterior: el Panel propone volver a revisar");
git("switch", "-q", "main");
assert.equal(status().reviewable, false, "en la base no hay nada que revisar");

console.log("previewer handoff: OK");
