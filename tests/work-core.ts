import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { branchFromHead, chooseWorkDoc, focusOf, parseWork, taskLabel, taskParts } from "../pi-package/claude-plugin/hooks/work-core.ts";
import { resolveWorkDoc } from "../pi-package/extensions/work-doc.ts";

const DOC = [
  "# Un documento por encargo",
  "",
  "Estado: activo · Rama: feat/doc · Tests: `bun test`",
  "Autorización: «hazlo» en esta rama · sin publicar.",
  "Objetivo: que el documento no crezca sin fin.",
  "Siguiente: T2.",
  "",
  "## Pedidos",
  "",
  "- P1. «uno por encargo» → docs/work → el TODO de cada rama enseña el suyo.",
  "",
  "## Decisiones",
  "",
  "- Uno por encargo.",
  "",
  "## Tareas",
  "",
  "- [x] T1 · Núcleo — `abc1234` · rojo → verde",
  "- [ ] T2 · Claude — el plugin. Blocked by: T1.",
  "- [ ] T3 · Puesta en servicio — pasos del dueño — espera: el propietario",
  "- [ ] T4 · Panel viejo — descartada: lo sustituye T2",
  "- [ ] T5 · Launcher — Go.",
  "",
  "## Registro",
  "",
  "- R1 (23 nov) Petición: «vamos con B».",
  "- R2 (23 nov) T1 cerrada con `abc1234`; LARGO_DEL_REGISTRO.",
  "",
].join("\n");

// [CORE] Cabecera, secciones y registro del formato nuevo.
const work = parseWork(DOC);
assert.equal(work.title, "Un documento por encargo");
assert.equal(work.status, "active");
assert.equal(work.branch, "feat/doc");
assert.equal(work.authorization, "«hazlo» en esta rama · sin publicar.", "una línea de texto libre no se parte por « · »");
assert.equal(work.objective, "que el documento no crezca sin fin.");
assert.equal(work.next, "T2.");
assert.match(work.asks, /^- P1\. «uno por encargo»/);
assert.equal(work.decisions, "- Uno por encargo.");
assert.match(work.log, /LARGO_DEL_REGISTRO/);
assert.doesNotMatch(work.live, /LARGO_DEL_REGISTRO|## Registro/, "lo vivo acaba donde empieza el registro");
assert.match(work.live, /## Tareas/);

// [CORE] Estados: en espera y descartada salen de la línea de la tarea, sin romper la casilla.
assert.deepEqual(work.tasks.map((task) => task.state), ["done", "open", "waiting", "dropped", "open"]);
assert.deepEqual(taskParts(work.tasks[2]!.text), { key: "T3", title: "Puesta en servicio" });
const focus = focusOf(work.tasks);
assert.equal(focus.current && taskParts(focus.current.text).key, "T2");
assert.deepEqual(focus.waiting.map((task) => taskParts(task.text).key), ["T3"]);
assert.deepEqual(focus.behind, [], "una tarea en espera no es una abierta que quedó atrás");
assert.equal(focus.done, 1);
assert.equal(focus.total, 4, "una descartada no cuenta");
const owner = focusOf(parseWork("# E\n\n## Tareas\n- [x] T1 · Uno\n- [ ] T2 · Del dueño — espera: el dueño\n").tasks);
assert.equal(owner.current, undefined, "solo queda trabajo en espera: no hay tarea actual");
assert.equal(owner.waiting.length, 1);
const dropped = parseWork("# E\n\n## Tareas\n- [x] T1 · Uno — descartada: ya no hace falta\n- [ ] T2 · Dos — dropped: superseded\n").tasks;
assert.deepEqual(dropped.map((task) => task.state), ["dropped", "dropped"], "descartada manda sobre la casilla; también en inglés");
assert.equal(parseWork("# E\n\n## Tareas\n- [ ] T1 · Uno — algo. Blocked by: T0.\n").tasks[0]?.state, "open", "Blocked by es orden, no espera");

// [CORE] El formato anterior sigue leyéndose: objetivo, siguiente paso, criterios y evidencia por sección.
const legacy = parseWork([
  "# Encargo", "", "## Objetivo", "", "Corregir el puerto.", "", "## Autorización", "", "Hazlo.", "",
  "## Decisiones", "", "- Sin cambiar la API.", "", "## Límites", "", "- Sin publicar.", "", "## Criterios", "", "- «arréglalo» → puerto", "",
  "## Tareas", "", "- [x] T1 · Arreglo", "", "## Evidencia", "", "- EVIDENCIA_LARGA", "", "## Siguiente paso", "", "Cerrar.", "",
].join("\n"));
assert.equal(legacy.objective, "Corregir el puerto.");
assert.equal(legacy.authorization, "Hazlo.");
assert.equal(legacy.next, "Cerrar.");
assert.equal(legacy.limits, "- Sin publicar.");
assert.match(legacy.asks, /arréglalo/);
assert.match(legacy.log, /EVIDENCIA_LARGA/);
assert.doesNotMatch(legacy.live, /EVIDENCIA_LARGA/, "en el formato anterior lo vivo deja fuera la evidencia");
assert.match(legacy.live, /## Siguiente paso/);
assert.equal(legacy.status, "", "sin cabecera no hay estado declarado");
const english = parseWork("# Job\n\nStatus: waiting · Branch: fix/x\nGoal: Ship.\nNext: wait.\n\n## Asks\n- A1\n\n## Tasks\n- [ ] T1 · Do — waiting: the owner\n\n## Log\n- L1\n");
assert.deepEqual([english.status, english.branch, english.objective, english.next, english.asks, english.log], ["waiting", "fix/x", "Ship.", "wait.", "- A1", "- L1"]);
assert.equal(english.tasks[0]?.state, "waiting");

// [CORE] La rama, de .git/HEAD; con HEAD suelto no hay rama.
assert.equal(branchFromHead("ref: refs/heads/feat/doc\n"), "feat/doc");
assert.equal(branchFromHead("4f3c2a1b0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b\n"), null);

// [CORE] El activo: la rama de su cabecera; si no, el WORK.md de la raíz; si no, el único abierto que no espera.
const docs = [
  { path: "docs/work/2026-11-20-a.md", status: "active" as const, branch: "feat/a" },
  { path: "docs/work/2026-11-21-b.md", status: "active" as const, branch: "feat/b" },
  { path: "docs/work/2026-11-22-c.md", status: "waiting" as const, branch: "feat/c" },
];
assert.equal(chooseWorkDoc(docs, "feat/b", null), "docs/work/2026-11-21-b.md");
assert.equal(chooseWorkDoc(docs, "feat/c", null), "docs/work/2026-11-22-c.md", "en su rama, uno en espera sigue siendo el suyo");
assert.equal(chooseWorkDoc(docs, "main", "WORK.md"), "WORK.md", "sin coincidencia, el documento de siempre");
assert.equal(chooseWorkDoc(docs, "main", null), null, "dos abiertos sin rama que los distinga: ninguno");
assert.equal(chooseWorkDoc(docs.slice(1), "main", null), "docs/work/2026-11-21-b.md", "el único abierto que no espera");
assert.equal(chooseWorkDoc([...docs, { path: "docs/work/2026-11-23-b2.md", status: "active", branch: "feat/b" }], "feat/b", null), "docs/work/2026-11-23-b2.md", "con dos de la misma rama, el más reciente");
assert.equal(chooseWorkDoc([{ path: "docs/work/x.md", status: "closed", branch: "feat/x" }], "feat/x", null), null, "un cerrado no vuelve solo");
assert.equal(chooseWorkDoc([], null, null), null);

// [FLOW] En un repositorio real, cada rama ve su documento; los cerrados no cuentan.
const repo = mkdtempSync(join(tmpdir(), "n-ein-work-core-"));
const previous = process.env.N_EIN_WORK_DOC;
delete process.env.N_EIN_WORK_DOC;
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
try {
  git("init", "-q", "-b", "feat/a");
  mkdirSync(join(repo, "docs/work/closed"), { recursive: true });
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "docs/work/2026-11-20-a.md"), "# A\n\nEstado: activo · Rama: feat/a\n\n## Tareas\n- [ ] T1 · A\n");
  writeFileSync(join(repo, "docs/work/2026-11-21-b.md"), "# B\n\nEstado: activo · Rama: feat/b\n\n## Tareas\n- [ ] T1 · B\n");
  writeFileSync(join(repo, "docs/work/closed/2026-11-01-viejo.md"), "# Viejo\n\nEstado: cerrado · Rama: main\n\n## Tareas\n- [x] T1 · V\n");
  assert.equal(resolveWorkDoc(join(repo, "src")), join(repo, "docs/work/2026-11-20-a.md"));
  writeFileSync(join(repo, ".git/HEAD"), "ref: refs/heads/feat/b\n");
  assert.equal(resolveWorkDoc(repo), join(repo, "docs/work/2026-11-21-b.md"));
  writeFileSync(join(repo, ".git/HEAD"), "ref: refs/heads/main\n");
  assert.equal(resolveWorkDoc(repo), null, "en main, con dos abiertos y ninguno suyo, no se adivina");
  writeFileSync(join(repo, "WORK.md"), "# Viejo formato\n\n## Tareas\n- [ ] T1 · X\n");
  assert.equal(resolveWorkDoc(repo), join(repo, "WORK.md"), "el WORK.md de la raíz sigue funcionando");
  // Un worktree tiene un archivo .git que apunta a su HEAD propio.
  const tree = join(repo, "arbol");
  mkdirSync(join(tree, "docs/work"), { recursive: true });
  mkdirSync(join(repo, ".git/worktrees/arbol"), { recursive: true });
  writeFileSync(join(repo, ".git/worktrees/arbol/HEAD"), "ref: refs/heads/feat/t\n");
  writeFileSync(join(tree, ".git"), `gitdir: ${join(repo, ".git/worktrees/arbol")}\n`);
  writeFileSync(join(tree, "docs/work/2026-11-22-t.md"), "# T\n\nEstado: activo · Rama: feat/t\n\n## Tareas\n- [ ] T1 · T\n");
  writeFileSync(join(tree, "docs/work/2026-11-22-u.md"), "# U\n\nEstado: activo · Rama: feat/u\n\n## Tareas\n- [ ] T1 · U\n");
  assert.equal(resolveWorkDoc(tree), join(tree, "docs/work/2026-11-22-t.md"), "en un worktree vale su rama");
  process.env.N_EIN_WORK_DOC = "docs/work/2026-11-21-b.md";
  assert.equal(resolveWorkDoc(repo), join(repo, "docs/work/2026-11-21-b.md"), "N_EIN_WORK_DOC manda");
} finally {
  if (previous === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previous;
  rmSync(repo, { recursive: true, force: true });
}

// [FLOW] El repositorio de ejemplo común: el launcher en Go comprueba lo mismo contra expected.json.
type Expected = Record<string, { doc: string | null; current?: string; done?: number; total?: number; waiting?: string[] }>;
const sample = mkdtempSync(join(tmpdir(), "n-ein-work-repo-"));
try {
  cpSync(join(import.meta.dir, "fixtures/work-repo"), sample, { recursive: true });
  mkdirSync(join(sample, ".git"));
  const expected = JSON.parse(readFileSync(join(sample, "expected.json"), "utf8")) as Expected;
  for (const [branch, want] of Object.entries(expected)) {
    writeFileSync(join(sample, ".git/HEAD"), `ref: refs/heads/${branch}\n`);
    const path = resolveWorkDoc(sample);
    assert.equal(path && relative(sample, path), want.doc, `documento de ${branch}`);
    if (!path) continue;
    const seen = focusOf(parseWork(readFileSync(path, "utf8")).tasks);
    assert.deepEqual(
      { current: seen.current ? taskLabel(seen.current.text) : "", done: seen.done, total: seen.total, waiting: seen.waiting.map((task) => taskParts(task.text).key) },
      { current: want.current, done: want.done, total: want.total, waiting: want.waiting },
      `foco de ${branch}`,
    );
  }
} finally {
  rmSync(sample, { recursive: true, force: true });
}

console.log("work core: un documento por encargo, con cabecera, estados, registro al final y el activo por rama");
