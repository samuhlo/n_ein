import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reviewGuard } from "../previewer/src/guard-rules.ts";
import { copiesRoot, createCopy, sweepCopies } from "../previewer/src/copy.ts";
import { review } from "../previewer/src/engine.ts";
import { sandboxFor, type Sandbox } from "../previewer/src/sandbox.ts";
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
writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text.slice(0, 3);\n}\n\n");
writeFileSync(join(repo, "empty.txt"), "");
git("add", "empty.txt");
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
  const sandbox = sandboxFor(copy.path, repo);
  // Dentro de otro sandbox-exec (una revisión de esta rama) no se puede anidar: lo dice y sigue.
  if (sandbox.kind === "none") console.log("[PEND] :: SANDBOX_TEST :: reason: no usable OS sandbox here");
  else {
    const escape = "cd ../../project && echo hacked > hacked.txt";
    assert.equal(decide("bash", { command: escape }, copy.path), undefined, "la guardia de texto no lo ve");
    const { file, args } = sandbox.wrap(escape);
    assert.notEqual(spawnSync(file, args, { cwd: copy.path }).status, 0);
    assert.ok(!existsSync(join(repo, "hacked.txt")), "el repositorio de Samu es de solo lectura");
    const inside = sandbox.wrap("echo ok > probe.txt");
    assert.equal(spawnSync(inside.file, inside.args, { cwd: copy.path }).status, 0, "la copia sí se escribe");
    const elsewhere = join(homedir(), `.nein-previewer-escape-${process.pid}`);
    const away = sandbox.wrap(`echo hacked > ${elsewhere}`);
    assert.notEqual(spawnSync(away.file, away.args, { cwd: copy.path }).status, 0);
    assert.ok(!existsSync(elsewhere), "fuera de copia, temporales y cachés no se escribe");
  }
  // Un enlace roto hacia el original no cuela una escritura «dentro» de la copia.
  symlinkSync(join(repo, "planted.txt"), join(copy.path, "planted.txt"));
  assert.ok(decide("write", { path: "planted.txt" }, copy.path), "write sigue el enlace roto");
  mkdirSync(join(copy.path, "nested"));
  symlinkSync(join(repo, "ghost-dir"), join(copy.path, "nested/link"));
  assert.ok(decide("write", { path: "nested/link/new.ts" }, copy.path), "también a través de un directorio enlazado roto");
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
const report = (findings: unknown[], tour: unknown[] = []): string => `He revisado.\n\n\`\`\`json\n${JSON.stringify({ summary: "Recorta el texto a tres letras.", tour, findings, gaps: ["no hay tests"] })}\n\`\`\``;
const finding = (title: string, citations: string[], probe?: unknown) => ({
  kind: "bug", severity: "high", title, plain: "Si escribes una palabra con tilde, se puede romper.", condition: "texto con caracteres de dos unidades",
  consequence: "devuelve medio carácter", citations, probe, verification: "",
});

// --- Revisión completa con un agente falso -------------------------------------------
const store = new ReviewStore(join(scratch, "previewer.db"));
// El aislamiento real se prueba arriba; aquí se inyecta para que el test valga también dentro de otro sandbox.
const injected: Sandbox = { kind: "injected", wrap: (command) => ({ file: "/bin/bash", args: ["-c", command] }) };
const late = join(scratch, "late-after-timeout"), orphan = join(scratch, "late-after-exit");
let seen: AgentRequest | undefined;
const outcome = await review({
  packageRoot, cwd: repo, store, model: "test/reviewer", thinking: "high", log: () => {}, sandbox: injected, probeTimeoutMs: 1_000,
  runner: async (request): Promise<AgentResult> => {
    seen = request;
    assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: request.cwd, encoding: "utf8" }).trim(), headSha, "la copia está en el head");
    assert.ok(!existsSync(join(request.cwd, "scratch.txt")), "la copia no arrastra cambios locales");
    assert.ok(request.prompt.includes("text.slice(0, 3)"), "el prompt lleva el diff");
    assert.equal(request.execute, true);
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
        finding("Línea vacía final", [`text.ts@${short}:L4`, `text.ts@${short}:L5`]),
        finding("Sonda sin comando", [`text.ts@${short}:L1`], { command: "no-such-probe-binary --check", file: null }),
        finding("Cita a un archivo vacío", [`empty.txt@${short}:L1`]),
        finding("Sonda que se agota", [`text.ts@${short}:L1`], { command: `(sleep 2; touch ${late}) & sleep 10`, file: null }),
        finding("Sonda que deja un hijo", [`text.ts@${short}:L1`], { command: `(sleep 2; touch ${orphan}) & exit 1`, file: null }),
        finding("Sonda que no falla", [`text.ts@${baseSha.slice(0, 8)}:L2`], { command: "bash .previewer-probes/pass.sh", file: ".previewer-probes/pass.sh" }),
      ], [
        { title: "El recorte", plain: "Ahora el texto se queda en tres letras.", why: "Los nombres largos se ven cortados.", files: ["text.ts", "ghost.ts"] },
        { title: "Otra vez lo mismo", plain: "Repite el archivo.", files: ["text.ts"] },
        { title: "Sin explicar", files: ["empty.txt"] },
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
assert.deepEqual(outcome.findings.map((f) => f.title), ["Corta letras a la mitad", "Sonda que sale de la copia", "Línea vacía final", "Sonda sin comando", "Sonda que se agota", "Sonda que deja un hijo", "Sonda que no falla"]);
const [clip, outside, blank, missing, timedOut, parent, pass] = outcome.findings;
assert.ok(clip && outside && blank && missing && timedOut && parent && pass);
assert.equal(timedOut.probe?.exitCode, null, "agotada no es un fallo demostrado");
assert.equal(timedOut.probe?.reproduced, false);
assert.equal(parent.probe?.reproduced, true);
await Bun.sleep(2_500);
assert.ok(!existsSync(late), "lo que lanzó una sonda agotada no sigue vivo");
assert.ok(!existsSync(orphan), "ni lo que dejó en segundo plano una sonda terminada");
assert.deepEqual(blank.citations.map((c) => c.ref), [`text.ts@${short}:L4`], "la línea vacía final existe; la siguiente no");
assert.equal(missing.probe?.exitCode, 127);
assert.equal(missing.probe?.reproduced, false, "un comando inexistente no demuestra el fallo");
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
assert.match(rejected, /Cita a un archivo vacío: cita .* rechazada \(el archivo tiene 0 líneas\)/);
assert.deepEqual(outcome.run.gaps, ["no hay tests"]);
assert.deepEqual(outcome.run.tour.map((step) => [step.title, step.files]), [["El recorte", ["text.ts"]], ["Archivos sin explicar", ["empty.txt"]]], "el recorrido solo nombra lo cambiado, una vez, y nada queda fuera");
assert.equal(outcome.run.tour[0]?.why, "Los nombres largos se ven cortados.");
assert.match(rejected, /recorrido: «Otra vez lo mismo»/);
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
  assert.equal(store.findings(failed.session.id).length, 7, "un fallo no borra ni añade hallazgos");
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

// --- Sin aislamiento del sistema: solo lectura ---------------------------------------------
{
  let request: AgentRequest | undefined;
  const marker = join(scratch, "ran-without-sandbox");
  const readOnly = await review({
    packageRoot, cwd: repo, store, model: "test/reviewer", log: () => {}, sandbox: { kind: "none", wrap: injected.wrap },
    runner: async (seenRequest) => {
      request = seenRequest;
      return { text: report([finding("Con sonda", [`text.ts@${short}:L2`], { command: `touch ${marker}; exit 1`, file: null })]), usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: null };
    },
  });
  assert.equal(request?.execute, false, "sin aislamiento el agente no recibe bash ni escritura");
  assert.match(request?.prompt ?? "", /read-only/);
  assert.equal(readOnly.findings[0]?.probe?.reproduced, false);
  assert.ok(!existsSync(marker), "el motor tampoco ejecuta la sonda");
  assert.ok(readOnly.run.gaps.some((gap) => gap.includes("solo de lectura")));
}

// --- Segunda revisión sobre un head nuevo -------------------------------------------------------
{
  store.rate(pass.id, "descartar", "pasa, no es un fallo");
  writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text;\n}\n\n");
  git("commit", "-qam", "fix: stop clipping");
  const fixedSha = git("rev-parse", "HEAD");
  const fixedShort = fixedSha.slice(0, 10);
  let prompt = "";
  const second = await review({
    packageRoot, cwd: repo, store, model: "test/reviewer", log: () => {}, sandbox: injected, probeTimeoutMs: 1_000,
    runner: async (request) => {
      prompt = request.prompt;
      const probe = join(request.cwd, ".previewer-probes/clip.sh");
      assert.equal(readFileSync(probe, "utf8"), clip.probe?.source, "la sonda anterior vuelve a la copia");
      // Aunque el agente la estropee, el motor repite la original.
      writeFileSync(probe, "exit 1\n");
      const keys = new Map([...request.prompt.matchAll(/^(P\d+)\. (.+?)(?: \[|$)/gm)].map((match) => [match[2], match[1]]));
      return {
        text: `\`\`\`json\n${JSON.stringify({
          summary: "Ya no recorta.",
          findings: [{ ...finding("La línea vacía sigue", [`text.ts@${fixedShort}:L4`]), previous: keys.get("Línea vacía final") }, { ...finding("Repite clave", [`text.ts@${fixedShort}:L1`]), previous: keys.get("Línea vacía final") }],
          resolved: [{ previous: keys.get("Corta letras a la mitad"), note: "Devuelve el texto entero." }, { previous: keys.get("Sonda que deja un hijo"), note: "Creo que ya no pasa." }],
          gaps: [],
        })}\n\`\`\``,
        usage: { input: 0, output: 0, cacheRead: 0, usd: 0 }, error: null,
      };
    },
  });
  assert.equal(second.run.status, "done", second.run.error ?? "");
  assert.match(prompt, /Corta letras a la mitad \[Samu|Corta letras a la mitad\n/, "el hallazgo abierto va en el prompt");
  assert.match(prompt, /restored at \.previewer-probes\/clip\.sh/);
  assert.match(prompt, /Samu dismissed[\s\S]*Sonda que no falla \[Samu: descartar, pasa, no es un fallo\]/, "lo descartado se menciona para no repetirlo");
  assert.doesNotMatch(prompt, /^P\d+\. Sonda que no falla/m);
  const byTitle = new Map(second.findings.map((item) => [item.title, item]));
  const resolvedClip = byTitle.get("Corta letras a la mitad");
  assert.deepEqual([resolvedClip?.status, resolvedClip?.check?.probe?.exitCode, resolvedClip?.check?.note], ["resolved", 0, "Devuelve el texto entero."], "la sonda original ya no falla");
  const stillParent = byTitle.get("Sonda que deja un hijo");
  assert.deepEqual([stillParent?.status, stillParent?.current], ["persists", true], "una sonda que sigue fallando pesa más que el agente");
  assert.match(stillParent?.check?.note ?? "", /sigue fallando/);
  const blankAgain = byTitle.get("La línea vacía sigue");
  assert.deepEqual([blankAgain?.status, blankAgain?.thread], ["persists", blank.thread]);
  assert.equal(byTitle.get("Repite clave")?.status, "new", "una clave usada dos veces no continúa dos hilos");
  assert.match(second.run.rejected.join("\n"), /Repite clave: referencia P\d+ desconocida o repetida/);
  assert.equal(byTitle.get("Sonda que no falla")?.status, "unchecked");
  assert.ok(second.run.gaps.some((gap) => gap.includes("«Sonda sin comando», de una revisión anterior, no se comprobó")));
  assert.ok(!existsSync(copiesRoot(repo)));
}

// --- Nada que revisar --------------------------------------------------------------------------
await assert.rejects(review({ packageRoot, cwd: repo, head: "main", store, model: "test/reviewer", log: () => {} }), /nada que revisar/);

store.close();
console.log("previewer engine: OK");
