import { strict as assert } from "node:assert";
import { outcomeFor, receiptFor, receiptLine, type Paint } from "../pi-package/extensions/receipts.ts";

const plain: Paint = (_token, text) => text;
const cwd = "/repo";

// La llamada se lee como verbo y objeto, con rutas relativas al proyecto.
assert.deepEqual(receiptFor("read", { path: "/repo/src/a.ts", offset: 10, limit: 5 }, cwd), { label: "lee", target: "src/a.ts:10-14" });
assert.deepEqual(receiptFor("read", { path: "/pkg/skills/tdd/SKILL.md" }, cwd), { label: "skill", target: "tdd" });
assert.deepEqual(receiptFor("bash", { command: "git status\n  --short" }, cwd), { label: "ejecuta", target: "git status --short" });
assert.equal(receiptFor("nein_team", { action: "start", tasks: [{ label: "API" }, { label: "UI" }] }).target, "arranca API · UI");
assert.equal(receiptFor("mcp__docs__search_pages", { query: "x" }).label.length <= 8, true);

// Lo que salió: recuentos con unidad y fallos en castellano.
assert.equal(outcomeFor("bash", {}, { content: [{ type: "text", text: "a\nb\n" }] }).meta, "2 líneas");
assert.deepEqual(outcomeFor("bash", {}, { content: [{ type: "text", text: "boom\n\nCommand exited with code 2" }], isError: true }), { meta: "salió con código 2", bad: true });
assert.equal(outcomeFor("edit", {}, { details: { diff: " 1 a\n-2 b\n+2 c\n+3 d" } }).meta, "+2 −1");
assert.equal(outcomeFor("read", { path: "/x/SKILL.md" }, { content: [{ type: "text", text: "..." }] }).meta, "cargada");
assert.equal(outcomeFor("grep", {}, { content: [{ type: "text", text: "No matches found" }] }).meta, "sin resultados");
assert.equal(outcomeFor("codegraph_explore", {}, { content: [{ type: "text", text: "Found 53 symbols across 4 files." }] }).meta, "53 símbolos · 4 archivos");
assert.equal(outcomeFor("nein_team", {}, { content: [{ type: "text", text: JSON.stringify([{ label: "API", status: "integrated" }]) }] }).meta, "API · integrado");
// Un modelo elegido a mano no es un fallo para la persona, aunque el modelo reciba un error.
assert.deepEqual(outcomeFor("nein_escalate", {}, { content: [{ type: "text", text: "Automatic task routing is not active; manually selected model." }], isError: true }), { meta: "modelo manual: se mantiene", bad: false });

// La fila cabe en el ancho, sin escapes ni saltos, y recorta el objeto antes que el resultado.
const long = receiptLine({ label: "ejecuta", target: "x".repeat(300) }, { meta: "12 líneas", bad: false }, 60, plain);
assert.ok([...long].length <= 60, long);
assert.ok(long.endsWith("· 12 líneas"));
assert.ok(receiptLine({ label: "lee", target: "a" }, undefined, 60, plain).startsWith(" ▸ lee"));
assert.ok(receiptLine({ label: "lee", target: "a" }, { meta: "x", bad: true }, 60, plain).startsWith(" × lee"));
const dirty = receiptFor("bash", { command: "echo \u001b[31mrojo\u0007" });
assert.ok(!/[\x00-\x1f]/.test(receiptLine(dirty, undefined, 80, plain)));
assert.ok([...receiptLine({ label: "lee", target: "abc" }, { meta: "m".repeat(80), bad: false }, 20, plain)].length <= 20);

console.log("receipts: OK");
