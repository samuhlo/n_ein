import { strict as assert } from "node:assert";
import { groupSummary, outcomeFor, outputText, receiptFor } from "../pi-package/claude-plugin/hooks/claude-receipts.ts";
import { receiptLine, type Paint } from "../pi-package/claude-plugin/hooks/receipt-core.ts";

const plain: Paint = (_token, text) => text;
const place = { cwd: "/repo", home: "/Users/samu" };
const done = { isRunning: false, isErrored: false, isInterrupted: false };

// Las herramientas de Claude se leen con los verbos de Pi y rutas relativas al proyecto.
assert.deepEqual(receiptFor("Read", { file_path: "/repo/src/a.ts", offset: 10, limit: 5 }, place), { label: "lee", target: "src/a.ts:10-14" });
assert.deepEqual(receiptFor("Read", { file_path: "/Users/samu/.n_ein/skills/tdd/SKILL.md" }, place), { label: "skill", target: "tdd" });
assert.deepEqual(receiptFor("Edit", { file_path: "/Users/samu/notas.md" }, place), { label: "edita", target: "~/notas.md" });
assert.deepEqual(receiptFor("Bash", { command: "git status\n  --short" }, place), { label: "ejecuta", target: "git status --short" });
assert.deepEqual(receiptFor("mcp__codegraph__codegraph_explore", { query: "brand panel" }, place), { label: "explora", target: "brand panel" });
assert.deepEqual(receiptFor("TodoWrite", { todos: [{ content: "a", status: "in_progress", activeForm: "Probando" }] }, place), { label: "tareas", target: "Probando" });
assert.equal(receiptFor("mcp__docs__search_pages", { query: "x" }, place).label.length <= 8, true);

// Lo que salió, desde el registro estructurado de cada herramienta.
assert.equal(outcomeFor("Bash", {}, { ...done, output: { stdout: "a\nb\n", stderr: "", interrupted: false } })?.meta, "2 líneas");
assert.equal(outcomeFor("Bash", {}, { ...done, output: { stdout: "", stderr: "", interrupted: false } })?.meta, "sin salida");
assert.equal(outcomeFor("Bash", {}, { ...done, output: { stdout: "", stderr: "", interrupted: false, gitOperation: { commit: { sha: "abcdef1234", kind: "committed" } } } })?.meta, "commit abcdef1");
assert.deepEqual(outcomeFor("Bash", {}, { ...done, isErrored: true, output: "Exit code 2\nboom" }), { meta: "salió con código 2", bad: true });
assert.deepEqual(outcomeFor("Edit", {}, { ...done, isErrored: true, output: "The user doesn't want to proceed with this tool use." }), { meta: "rechazado", bad: true });
assert.equal(outcomeFor("Read", { file_path: "/repo/a.ts" }, { ...done, output: { type: "text", file: { numLines: 40, truncatedByTokenCap: true } } })?.meta, "40 líneas · recortado");
assert.equal(outcomeFor("Edit", {}, { ...done, output: { structuredPatch: [{ lines: [" a", "-b", "+c", "+d"] }] } })?.meta, "+2 −1");
assert.equal(outcomeFor("Write", { content: "a\nb\nc\n" }, { ...done, output: { type: "create" } })?.meta, "nuevo · 3 líneas");
assert.equal(outcomeFor("TodoWrite", {}, { ...done, output: { newTodos: [{ status: "completed" }, { status: "pending" }] } })?.meta, "1/2");
assert.equal(outcomeFor("mcp__codegraph__codegraph_explore", {}, { ...done, output: [{ type: "text", text: "Found 53 symbols across 4 files." }] })?.meta, "53 símbolos · 4 archivos");
assert.equal(outcomeFor("Bash", {}, { ...done, isRunning: true }), undefined, "mientras corre no hay resultado");
assert.deepEqual(outcomeFor("Bash", {}, { ...done, isInterrupted: true }), { meta: "interrumpido", bad: true });
assert.equal(outputText({ content: [{ type: "text", text: "uno" }, "dos"] }), "uno\ndos");

// El grupo plegado cuenta por verbo, en el orden de llegada.
const calls = [
  { tool: "Read", input: { file_path: "/repo/a" } },
  { tool: "Grep", input: { pattern: "x" } },
  { tool: "Read", input: { file_path: "/repo/b" } },
];
assert.equal(groupSummary(calls, place), "lee 2 · busca 1");

// La fila completa cabe en el ancho y conserva verbo y resultado.
const line = receiptLine(receiptFor("Bash", { command: "x".repeat(300) }, place), { meta: "12 líneas", bad: false }, 60, plain);
assert.ok([...line].length <= 60, line);
assert.ok(line.startsWith(" ✓ ejecuta") && line.endsWith("· 12 líneas"), line);

console.log("claude receipts: OK");
