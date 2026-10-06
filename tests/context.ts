import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerContext, { RETIRED_MARK, retirements, type Entry, type Retirement } from "../pi-package/extensions/context";

// Una sesión mínima con la forma de la proyección de Pi: un mensaje por entrada.
let seq = 0;
const entries: Entry[] = [];
const big = (label: string, size = 4000) => `${label}\n${"x".repeat(size)}`;
function turn(calls: { name: string; arguments: Record<string, unknown>; result: string; isError?: boolean; nested?: { name: string; arguments?: Record<string, unknown>; status: string }[] }[]): string[] {
  const ids = calls.map(() => `c${++seq}`);
  entries.push({ sourceEntry: { id: `a${seq}`, type: "message" }, messages: [{ role: "assistant", content: calls.map((c, i) => ({ type: "toolCall", id: ids[i], name: c.name, arguments: c.arguments })) }] });
  return calls.map((c, i) => {
    const id = `r${ids[i]}`;
    entries.push({ sourceEntry: { id, type: "message" }, messages: [{ role: "toolResult", toolCallId: ids[i], content: [{ type: "text", text: c.result }], isError: Boolean(c.isError), nestedCalls: c.nested ? { calls: c.nested } : undefined }] });
    return id;
  });
}
// Lo que haría Pi con los context_edit: sustituir el contenido y conservar el resto.
function apply(list: Retirement[]) {
  for (const r of list) {
    const entry = entries.find((e) => e.sourceEntry.id === r.targetId)!;
    entry.messages = [{ ...entry.messages[0]!, content: [{ type: "text", text: r.text }] }];
  }
}
const ids = (list: Retirement[]) => list.map((r) => r.targetId).sort();
// El HEAD nuevo que la extensión pasa cuando el turno commiteó y quedan tareas.
const HEAD = "3f9a2c1d5e6b7a8c9d0e1f2a3b4c5d6e7f8a9b0c";

// Las instrucciones llegan también por shell y por referencias del catálogo.
turn([
  { name: "bash", arguments: { command: "cat pi-package/skills/tdd/SKILL.md" }, result: big("# TDD") },
  { name: "read", arguments: { path: "/pkg/skills/tdd/tests.md" }, result: big("Test guidance") },
  { name: "bash", arguments: { command: "cat AGENTS.md" }, result: big("Project instructions") },
]);
const [instructionBoundary] = turn([{ name: "write", arguments: { path: "WORK.md" }, result: "ok" }]);
assert.deepEqual(retirements(entries, new Set([instructionBoundary!])), [], "la primera escritura conserva instrucciones leídas por shell");
const [instructionCommit] = turn([{ name: "bash", arguments: { command: "git commit -m 'docs: plan'" }, result: "[main abc1234] docs: plan" }]);
assert.deepEqual(retirements(entries, new Set([instructionCommit!]), HEAD), [], "un commit conserva también las referencias de las skills");
entries.length = 0; seq = 0;

entries.push({ sourceEntry: { id: "u0", type: "message" }, messages: [{ role: "user", content: "Arregla el estado de los certificados" }] });
const [graph] = turn([{ name: "codegraph_explore", arguments: { query: "importCertificate" }, result: big("Exploration") }]);
const [search, file, skill, tiny] = turn([
  { name: "bash", arguments: { command: "cd /repo && rg -n importCertificate server" }, result: big("server/a.ts:1") },
  { name: "read", arguments: { path: "server/a.ts" }, result: big("export function importCertificate") },
  { name: "read", arguments: { path: "/pkg/skills/tdd/SKILL.md" }, result: big("# TDD") },
  { name: "bash", arguments: { command: "ls server" }, result: "a.ts" },
]);
assert.deepEqual(retirements(entries, new Set()), [], "sin escribir todavía no hay frontera");

// En el turno de la primera escritura se retira lo explorado, no lo leído para editar ni la skill.
const [lateSearch, firstEdit] = turn([
  { name: "grep", arguments: { pattern: "notImported" }, result: big("hit") },
  { name: "edit", arguments: { path: "server/a.ts" }, result: "Successfully replaced 1 block" },
]);
const atWrite = retirements(entries, new Set([lateSearch!, firstEdit!]));
assert.deepEqual(ids(atWrite), [graph!, search!].sort(), "el turno en curso y lo pequeño se quedan; CodeGraph y rg se van");
assert.match(atWrite[0]!.text, new RegExp(`^${RETIRED_MARK.replace(/[[\]]/g, "\\$&")} at the first edit: `));
assert.match(atWrite.find((r) => r.targetId === search)!.text, /bash cd \/repo && rg -n importCertificate server returned \d+ chars/);
apply(atWrite);
assert.deepEqual(retirements(entries, new Set()), [], "sin frontera nueva no se vuelve a romper la caché");

// El commit retira lecturas recuperables, conservando evidencia y fallos.
const [suite] = turn([{ name: "bash", arguments: { command: "bunx vitest run > /tmp/t.log; tail -5 /tmp/t.log" }, result: big("Tests 12 passed") }]);
const [failedTest] = turn([{ name: "bash", arguments: { command: "bun test" }, result: big("FAIL: unresolved permission check"), isError: true }]);
const [commit] = turn([{ name: "bash", arguments: { command: "git add -A && git commit -m 'fix: estado failed'" }, result: "[fix/estado 3f9a2c1d] fix: estado failed\n 2 files changed" }]);
assert.deepEqual(retirements(entries, new Set([commit!])), [], "sin commit entre tareas no hay frontera nueva");
const atCommit = retirements(entries, new Set([commit!]), HEAD);
assert.deepEqual(ids(atCommit), [file!, lateSearch!].sort(), "solo lecturas: ni instrucciones, ni comprobaciones, ni errores");
assert.ok(!ids(atCommit).includes(suite!) && !ids(atCommit).includes(failedTest!));
assert.ok(atCommit.every((r) => r.text.includes("at commit 3f9a2c1:")));
assert.ok(![...atWrite, ...atCommit].some((r) => r.targetId === skill || r.targetId === tiny), "la skill y lo pequeño no se retiran nunca");
apply(atCommit);
assert.deepEqual(retirements(entries, new Set(), HEAD), [], "lo ya retirado no se vuelve a retirar");

// codemode: lo leído en un script es recuperable; si cargó una skill, se queda.
const [script] = turn([{ name: "codemode", arguments: { code: "await tools.read({path:'b.ts'})" }, result: big("Script completed"), nested: [{ name: "read", arguments: { path: "b.ts" }, status: "ok" }] }]);
const [skillScript] = turn([{ name: "codemode", arguments: { code: "..." }, result: big("# TDD"), nested: [{ name: "read", arguments: { path: "/pkg/skills/tdd/SKILL.md" }, status: "ok" }] }]);
const [scriptCommit] = turn([{
  name: "codemode", arguments: { code: "..." }, result: "Script completed in 3s\nok",
  nested: [{ name: "edit", arguments: { path: "b.ts" }, status: "ok" }, { name: "bash", arguments: { command: "git commit -qm 'feat: b'" }, status: "ok" }],
}]);
const atScriptCommit = ids(retirements(entries, new Set([scriptCommit!]), HEAD));
assert.deepEqual(atScriptCommit, [script!], "un script que solo leyó se retira en el commit");
assert.ok(!atScriptCommit.includes(skillScript!), "el script que cargó una skill se queda");

entries.length = 0; seq = 0;
const protectedOutputs = turn([
  { name: "bash", arguments: { command: "rg x src && bun test" }, result: big("Tests 12 passed") },
  { name: "bash", arguments: { command: "cat $skill" }, result: big("Instructions from a dynamic path") },
  { name: "read", arguments: { path: "/tmp/check.log" }, result: big("Test evidence") },
  { name: "write", arguments: { path: "a.ts" }, result: big("Mutation receipt") },
  { name: "codemode", arguments: { code: "..." }, result: big("FAIL"), nested: [{ name: "bash", arguments: { command: "bun test" }, status: "error" }] },
]);
const [safeRead] = turn([{ name: "read", arguments: { path: "a.ts" }, result: big("Code") }]);
const [lastCommit] = turn([{ name: "bash", arguments: { command: "git commit -qm 'T1'" }, result: "" }]);
const kept = ids(retirements(entries, new Set([lastCommit!]), HEAD));
assert.deepEqual(kept, [safeRead!], "resultados mixtos, dinámicos, checks y mutaciones se conservan");
assert.ok(protectedOutputs.every((id) => !kept.includes(id)));

// La extensión mira HEAD antes del primer comando y al acabar el turno, lee las tareas de WORK.md y devuelve context_edit.
type Proposal = { entries: { type: string; targetId: string; replacement: { content: { type: string; text: string }[] } }[] } | undefined;
const handlers = new Map<string, (event: unknown, ctx: unknown) => Proposal>();
registerContext({ on(name: string, fn: (event: unknown, ctx: unknown) => Proposal) { handlers.set(name, fn); } } as never);
const project = mkdtempSync(join(tmpdir(), "n-ein-context-"));
const git = (...args: string[]) => execFileSync("git", args, { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
let version = 0;
const edited = (name: string) => writeFileSync(join(project, name), `export const v = ${++version}\n`);
// Un turno como lo vive Pi: turn_start, el modelo genera, tool_call antes de ejecutar cada llamada,
// lo que esas llamadas hacen de verdad y turn_end.
function live(calls: Parameters<typeof turn>[0], effect = () => {}, whileGenerating = () => {}): Proposal {
  const ctx = { cwd: project };
  handlers.get("turn_start")?.({ type: "turn_start" }, ctx);
  whileGenerating();
  for (const call of calls) handlers.get("tool_call")?.({ type: "tool_call", toolName: call.name, input: call.arguments }, ctx);
  effect();
  return handlers.get("turn_end")!({ context: { contextEntries: entries }, toolResultEntryIds: turn(calls) }, ctx);
}
const texts = (proposal: Proposal) => (proposal?.entries ?? []).map((e) => ({ targetId: e.targetId, text: e.replacement.content[0]!.text }));
const previous = process.env.N_EIN_WORK_DOC;
delete process.env.N_EIN_WORK_DOC;
try {
  git("init", "-b", "main");
  git("config", "user.name", "n_ein test");
  git("config", "user.email", "test@n-ein.invalid");
  edited("a.ts");
  git("add", "a.ts");
  git("commit", "-m", "test: base");
  entries.length = 0; seq = 0;
  const [explored] = turn([{ name: "codegraph_explore", arguments: { query: "x" }, result: big("Exploration") }]);
  const atEdit = live([{ name: "write", arguments: { path: "a.ts" }, result: "Wrote a.ts" }], () => edited("a.ts"));
  assert.deepEqual(atEdit?.entries.map((e) => [e.type, e.targetId]), [["context_edit", explored]]);
  assert.match(atEdit!.entries[0]!.replacement.content[0]!.text, /codegraph_explore x returned/);
  apply(texts(atEdit));

  // `type(scope): …`, heredoc y redirecciones son la forma habitual de commitear: HEAD los reconoce sin leer el comando.
  const [read] = turn([{ name: "read", arguments: { path: "a.ts" }, result: big("code") }]);
  const scoped = { name: "bash", arguments: { command: 'git add -A && git commit -m "fix(router): T1" 2>&1 | tail -3' }, result: "[main 1a2b3c4] fix(router): T1" };
  assert.equal(live([scoped], () => git("commit", "-am", "fix(router): T1")), undefined, "sin WORK.md el commit cierra el encargo");
  writeFileSync(join(project, "WORK.md"), "# Trabajo\n\n## Tareas\n- [x] T1 · Servidor\n- [ ] T2 · Cliente\n- [ ] T3 · Docs\n");
  const [other] = turn([{ name: "read", arguments: { path: "b.ts" }, result: big("code") }]);
  const sameTurn = { name: "read", arguments: { path: "c.ts" }, result: big("code") };
  const heredoc = { name: "bash", arguments: { command: "git commit -aF - <<'EOF'\nfix(context): T2\n\nDetalle.\nEOF" }, result: "[main 5d6e7f8] fix(context): T2" };
  const between = live([sameTurn, heredoc], () => { edited("a.ts"); git("commit", "-am", "fix(context): T2"); });
  assert.deepEqual(between?.entries.map((e) => e.targetId).sort(), [read!, other!].sort(), "con tareas pendientes, HEAD movido es frontera; lo del turno en curso se queda");
  assert.ok(texts(between).every((r) => r.text.includes(`at commit ${git("rev-parse", "HEAD").slice(0, 7)}:`)));
  apply(texts(between));

  // Sin que HEAD se mueva por los comandos del turno no hay frontera: un commit fallido, o uno ajeno.
  turn([{ name: "read", arguments: { path: "d.ts" }, result: big("code") }]);
  const failed = { name: "bash", arguments: { command: 'git commit -m "fix(router): T3"' }, result: "nothing to commit, working tree clean", isError: true };
  assert.equal(live([failed]), undefined, "un commit fallido no mueve HEAD");
  const otherSession = () => { edited("a.ts"); git("commit", "-am", "chore: otra sesión"); };
  assert.equal(live([{ name: "bash", arguments: { command: "bun test" }, result: "ok" }], undefined, otherSession), undefined, "un commit ajeno mientras el modelo genera no es frontera");
  assert.equal(handlers.get("turn_end")!({ context: { contextEntries: entries }, toolResultEntryIds: [] }, { cwd: project }), undefined, "un turno sin herramientas no propone entradas");
} finally {
  if (previous === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previous;
  rmSync(project, { recursive: true, force: true });
}

console.log("context: retira lo explorado en la primera escritura y lo leído en cada commit entre tareas, sin tocar el turno en curso ni las instrucciones");
