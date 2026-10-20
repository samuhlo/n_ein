import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reviewGuard } from "../previewer/src/guard-rules.ts";
import { copiesRoot, createCopy, sweepCopies } from "../previewer/src/copy.ts";
import { review } from "../previewer/src/engine.ts";
import { sandboxFor } from "../previewer/src/sandbox.ts";
import { parseReport } from "../previewer/src/report.ts";
import { summarizeEvents, type AgentRequest, type AgentResult } from "../previewer/src/runner.ts";
import { ReviewStore } from "../previewer/src/store.ts";

const packageRoot = resolve(import.meta.dir, "..");
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "nein-previewer-engine-")));
process.env.N_EIN_HOME = join(scratch, "home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_MODELS_FILE = join(scratch, "models.json");
const repo = join(scratch, "project");
mkdirSync(repo);
const git = (...args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "-q", "-b", "main");
git("config", "user.email", "test@local");
git("config", "user.name", "Test");
writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text;\n}\n");
git("add", ".");
git("commit", "-qm", "base");
const baseSha = git("rev-parse", "HEAD");
git("switch", "-qc", "feat/clip");
writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text.slice(0, 3);\n}\n");
git("commit", "-qam", "feat: clip to three units");
const headSha = git("rev-parse", "HEAD");
writeFileSync(join(repo, "scratch.txt"), "cambio local de Samu\n");
const statusBefore = git("status", "--porcelain");
const logBefore = git("log", "--all", "--format=%H %D");

// --- Guardia ------------------------------------------------------------------
{
  const copy = createCopy(repo, { baseSha, headSha }, "guard");
  const decide = reviewGuard(copy.path, repo);
  assert.equal(decide("write", { path: ".previewer-probes/a.ts" }, copy.path), undefined);
  assert.ok(decide("write", { path: join(repo, "text.ts") }, copy.path), "no escribe en el original");
  assert.ok(decide("edit", { path: "../project/text.ts" }, copy.path));
  assert.ok(decide("bash", { command: `cat ${repo}/text.ts` }, copy.path), "el original no se nombra");
  assert.equal(decide("bash", { command: `ls ${copy.path}` }, copy.path), undefined, "la copia en <repo>-worktrees sí");
  assert.ok(decide("bash", { command: "git push origin HEAD" }, copy.path));
  assert.ok(decide("bash", { command: "cd x && gh pr comment 1 -b hi" }, copy.path));
  assert.equal(decide("bash", { command: "bun test && git diff refs/previewer/base HEAD" }, copy.path), undefined);
  assert.equal(execFileSync("git", ["remote"], { cwd: copy.path, encoding: "utf8" }).trim(), "", "la copia no tiene remotos");
  // Un `cd` relativo esquiva la guardia de texto; el aislamiento del sistema, no.
  const sandbox = sandboxFor(repo);
  if (process.platform === "darwin") assert.equal(sandbox.kind, "sandbox-exec");
  if (sandbox.kind !== "none") {
    const escape = "cd ../../project && echo hacked > hacked.txt";
    assert.equal(decide("bash", { command: escape }, copy.path), undefined, "la guardia de texto no lo ve");
    const { file, args } = sandbox.wrap(escape);
    assert.notEqual(spawnSync(file, args, { cwd: copy.path }).status, 0);
    assert.ok(!existsSync(join(repo, "hacked.txt")), "el repositorio de Samu es de solo lectura");
    const inside = sandbox.wrap("echo ok > probe.txt");
    assert.equal(spawnSync(inside.file, inside.args, { cwd: copy.path }).status, 0, "la copia sí se escribe");
  }
  const objects = execFileSync("find", [join(copy.path, ".git/objects"), "-type", "f", "-links", "+1"], { encoding: "utf8" }).trim();
  assert.equal(objects, "", "ningún objeto comparte fichero con el original");
  copy.remove();
  assert.ok(!existsSync(copy.path));
}

// --- Copias huérfanas -----------------------------------------------------------
{
  const orphan = createCopy(repo, { baseSha, headSha }, "orphan");
  writeFileSync(join(orphan.path, ".git/previewer-owner"), "999999999\n");
  assert.deepEqual(sweepCopies(repo), ["previewer-orphan"]);
  assert.ok(!existsSync(orphan.path));
}

// --- Lectura de eventos e informe ----------------------------------------------------
{
  const lines = [
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "primero" }], usage: { input: 10, output: 2, cacheRead: 5, cost: { total: 0.25 } } } }),
    "no es json",
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "toolCall" }], usage: { input: 1, output: 1, cacheRead: 0, cost: { total: 0.05 } } } }),
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "final" }] } }),
  ];
  const summary = summarizeEvents(lines);
  assert.equal(summary.text, "final");
  assert.deepEqual(summary.usage, { input: 11, output: 3, cacheRead: 5, usd: 0.3 });
  assert.equal(summary.error, null);
  assert.throws(() => parseReport("sin informe"), /JSON/);
}

const short = headSha.slice(0, 10);
const report = (findings: unknown[]): string => `He revisado.\n\n\`\`\`json\n${JSON.stringify({ summary: "Recorta el texto a tres letras.", findings, gaps: ["no hay tests"] })}\n\`\`\``;
const finding = (title: string, citations: string[], probe?: unknown) => ({
  kind: "bug", severity: "high", title, plain: "Si escribes una palabra con tilde, se puede romper.", condition: "texto con caracteres de dos unidades",
  consequence: "devuelve medio carácter", citations, probe, verification: "",
});

// --- Revisión completa con un agente falso -------------------------------------------
const store = new ReviewStore(join(scratch, "previewer.db"));
let seen: AgentRequest | undefined;
const outcome = await review({
  packageRoot, cwd: repo, store, model: "test/reviewer", thinking: "high", log: () => {},
  runner: async (request): Promise<AgentResult> => {
    seen = request;
    assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: request.cwd, encoding: "utf8" }).trim(), headSha, "la copia está en el head");
    assert.ok(!existsSync(join(request.cwd, "scratch.txt")), "la copia no arrastra cambios locales");
    assert.ok(request.prompt.includes("text.slice(0, 3)"), "el prompt lleva el diff");
    // Aunque el revisor mueva ramas dentro de su copia, el original no se entera.
    execFileSync("git", ["branch", "-f", "main", "HEAD"], { cwd: request.cwd });
    mkdirSync(join(request.cwd, ".previewer-probes"));
    writeFileSync(join(request.cwd, ".previewer-probes/clip.sh"), "grep -q 'slice(0, 3)' text.ts && exit 1 || exit 0\n");
    writeFileSync(join(request.cwd, ".previewer-probes/pass.sh"), "exit 0\n");
    return {
      text: report([
        finding("Corta letras a la mitad", [`text.ts@${short}:L2`, `text.ts@${short}:L99`], { command: "bash .previewer-probes/clip.sh", file: ".previewer-probes/clip.sh" }),
        finding("Cita inventada", [`missing.ts@${short}:L1`]),
        finding("SHA ajeno", ["text.ts@0123456789:L1"]),
        { ...finding("Tipo raro", [`text.ts@${short}:L1`]), kind: "opinion" },
        finding("Sonda que sale de la copia", [`text.ts@${short}:L1`], { command: `cat ${repo}/text.ts; exit 1`, file: null }),
        finding("Sonda que no falla", [`text.ts@${baseSha.slice(0, 8)}:L2`], { command: "bash .previewer-probes/pass.sh", file: ".previewer-probes/pass.sh" }),
      ]),
      usage: { input: 100, output: 20, cacheRead: 0, usd: 0.12 },
      error: null,
    };
  },
});
assert.ok(seen);
assert.equal(outcome.run.status, "done", outcome.run.error ?? "");
assert.equal(outcome.run.headSha, headSha);
assert.equal(outcome.run.baseSha, baseSha, "la base por defecto es el ancestro común con main");
assert.equal(outcome.session.branch, "feat/clip");
assert.deepEqual(outcome.findings.map((f) => f.title), ["Corta letras a la mitad", "Sonda que sale de la copia", "Sonda que no falla"]);
const [clip, outside, pass] = outcome.findings;
assert.ok(clip && outside && pass);
assert.equal(outside.probe?.reproduced, false, "el motor no repite una sonda que la guardia rechaza");
assert.match(outside.probe?.output ?? "", /no ejecutada/);
assert.deepEqual(clip.citations.map((c) => [c.ref, c.text]), [[`text.ts@${short}:L2`, "  return text.slice(0, 3);"]]);
assert.equal(clip.probe?.reproduced, true, "la sonda que falla demuestra el fallo");
assert.equal(clip.probe?.exitCode, 1);
assert.match(clip.probe?.source ?? "", /slice/, "el contenido de la sonda sobrevive a la copia");
assert.equal(pass.probe?.reproduced, false);
assert.equal(pass.citations[0]?.sha, baseSha, "las citas a la base valen para código retirado");
assert.equal(pass.citations[0]?.text, "  return text;");
const rejected = outcome.run.rejected.join("\n");
assert.match(rejected, /L99 rechazada/);
assert.match(rejected, /Cita inventada: ninguna cita/);
assert.match(rejected, /SHA ajeno/);
assert.match(rejected, /Tipo raro: tipo desconocido/);
assert.deepEqual(outcome.run.gaps, ["no hay tests"]);
assert.equal(outcome.run.usage?.usd, 0.12);
assert.ok(!existsSync(seen.cwd), "la copia se borra al terminar");
assert.ok(!existsSync(copiesRoot(repo)), "sin copias, la carpeta hermana tampoco queda");
assert.equal(git("status", "--porcelain"), statusBefore, "el repositorio de Samu no cambia");
assert.equal(git("log", "--all", "--format=%H %D"), logBefore, "ninguna rama se mueve");
assert.equal(git("rev-parse", "main"), baseSha);

// --- El agente falla: la copia se borra igual y no hay hallazgos nuevos ---------------------
{
  let cwd = "";
  const failed = await review({
    packageRoot, cwd: repo, store, model: "test/reviewer", log: () => {},
    runner: async (request) => {
      cwd = request.cwd;
      throw new Error("modelo caído");
    },
  });
  assert.equal(failed.run.status, "failed");
  assert.match(failed.run.error ?? "", /modelo caído/);
  assert.ok(cwd && !existsSync(cwd));
  assert.equal(store.findings(failed.session.id).length, 3, "un fallo no borra ni añade hallazgos");
}

// --- Informe ilegible: falla con su texto guardado --------------------------------------
{
  const unreadable = await review({
    packageRoot, cwd: repo, store, model: "test/reviewer", log: () => {},
    runner: async () => ({ text: "no tengo JSON", usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: null }),
  });
  assert.equal(unreadable.run.status, "failed");
  assert.match(unreadable.run.error ?? "", /informe ilegible/);
  const saved = join(process.env.N_EIN_HOME, "dev/previewer/runs", unreadable.run.id, "final.txt");
  assert.equal(readFileSync(saved, "utf8"), "no tengo JSON");
}

// --- Cancelación ---------------------------------------------------------------------------
{
  const controller = new AbortController();
  let cwd = "";
  const cancelled = await review({
    packageRoot, cwd: repo, store, model: "test/reviewer", signal: controller.signal, log: () => {},
    runner: (request) => new Promise((done) => {
      cwd = request.cwd;
      request.signal.addEventListener("abort", () => done({ text: "", usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: "cancelada" }));
      controller.abort();
    }),
  });
  assert.equal(cancelled.run.status, "cancelled");
  assert.ok(cwd && !existsSync(cwd));
}

// --- Nada que revisar --------------------------------------------------------------------------
await assert.rejects(review({ packageRoot, cwd: repo, head: "main", store, model: "test/reviewer", log: () => {} }), /nada que revisar/);

store.close();
console.log("previewer engine: OK");
