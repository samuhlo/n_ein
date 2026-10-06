import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// Pruebas y commit entre tareas: se retira todo lo anterior salvo las instrucciones.
const [suite] = turn([{ name: "bash", arguments: { command: "bunx vitest run > /tmp/t.log; tail -5 /tmp/t.log" }, result: big("Tests 12 passed") }]);
const [failedCommit] = turn([{ name: "bash", arguments: { command: "git commit -m 'fix: x'" }, result: "nothing added to commit", isError: true }]);
assert.deepEqual(retirements(entries, new Set([failedCommit!]), true), [], "un commit fallido no es frontera");
const [commit] = turn([{ name: "bash", arguments: { command: "git add -A && git commit -m 'fix: estado failed'" }, result: "[fix/estado 3f9a2c1d] fix: estado failed\n 2 files changed" }]);
assert.deepEqual(retirements(entries, new Set([commit!]), false), [], "tras el último commit no se rompe la caché por un cierre");
const atCommit = retirements(entries, new Set([commit!]), true);
assert.deepEqual(ids(atCommit), [file!, lateSearch!, suite!].sort(), "lo leído antes del commit se retira; la skill y lo ya retirado no");
assert.ok(atCommit.every((r) => r.text.includes("at commit 3f9a2c1:")));
assert.ok(![...atWrite, ...atCommit].some((r) => r.targetId === skill || r.targetId === tiny), "la skill y lo pequeño no se retiran nunca");
apply(atCommit);
assert.deepEqual(retirements(entries, new Set(), true), []);

// codemode: escribe y commitea a través de sus llamadas anidadas.
const [script] = turn([{ name: "codemode", arguments: { code: "await tools.read({path:'b.ts'})" }, result: big("Script completed") }]);
const [scriptCommit] = turn([{
  name: "codemode", arguments: { code: "..." }, result: "Script completed in 3s\nok",
  nested: [{ name: "edit", arguments: { path: "b.ts" }, status: "ok" }, { name: "bash", arguments: { command: "git commit -qm 'feat: b'" }, status: "ok" }],
}]);
assert.deepEqual(ids(retirements(entries, new Set([scriptCommit!]), true)), [script!], "un commit dentro de un script también es frontera");

// La extensión registra turn_end, lee las tareas pendientes de WORK.md y devuelve context_edit.
type Proposal = { entries: { type: string; targetId: string; replacement: { content: { type: string; text: string }[] } }[] } | undefined;
let handler: ((event: unknown, ctx: unknown) => Proposal) | undefined;
registerContext({ on(name: string, fn: (event: unknown, ctx: unknown) => Proposal) { if (name === "turn_end") handler = fn; } } as never);
const project = mkdtempSync(join(tmpdir(), "n-ein-context-"));
const previous = process.env.N_EIN_WORK_DOC;
delete process.env.N_EIN_WORK_DOC;
try {
  mkdirSync(join(project, ".git"));
  entries.length = 0; seq = 0;
  const [explored] = turn([{ name: "codegraph_explore", arguments: { query: "x" }, result: big("Exploration") }]);
  const [edit] = turn([{ name: "write", arguments: { path: "WORK.md" }, result: "Wrote WORK.md" }]);
  const result = handler!({ context: { contextEntries: entries }, toolResultEntryIds: [edit] }, { cwd: project });
  assert.deepEqual(result?.entries.map((e) => [e.type, e.targetId]), [["context_edit", explored]]);
  assert.match(result!.entries[0]!.replacement.content[0]!.text, /codegraph_explore x returned/);
  apply(result!.entries.map((e) => ({ targetId: e.targetId, text: e.replacement.content[0]!.text })));

  const [read] = turn([{ name: "read", arguments: { path: "a.ts" }, result: big("code") }]);
  const [done] = turn([{ name: "bash", arguments: { command: "git commit -qm 'feat: T1'" }, result: "" }]);
  assert.equal(handler!({ context: { contextEntries: entries }, toolResultEntryIds: [done] }, { cwd: project }), undefined, "sin WORK.md el commit cierra el encargo");
  writeFileSync(join(project, "WORK.md"), "# Trabajo\n\n## Tareas\n- [x] T1 · Servidor\n- [ ] T2 · Cliente\n");
  const between = handler!({ context: { contextEntries: entries }, toolResultEntryIds: [done] }, { cwd: project });
  assert.deepEqual(between?.entries.map((e) => e.targetId), [read], "con tareas pendientes el commit es frontera");
  assert.match(between!.entries[0]!.replacement.content[0]!.text, /at a commit:/);
  assert.equal(handler!({ context: { contextEntries: entries }, toolResultEntryIds: [] }, { cwd: project }), undefined, "un turno sin herramientas no propone entradas");
} finally {
  if (previous === undefined) delete process.env.N_EIN_WORK_DOC;
  else process.env.N_EIN_WORK_DOC = previous;
  rmSync(project, { recursive: true, force: true });
}

console.log("context: retira lo explorado en la primera escritura y lo leído en cada commit entre tareas, sin tocar el turno en curso ni las instrucciones");
