// [CHECK] El recibo se prueba dentro del componente real de Pi, sin inferencia.
import { strict as assert } from "node:assert";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";

const root = process.env.N_EIN_PRODUCT_ROOT || resolve(".");
const version = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi.version;
const modules = join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), "runtimes/pi", version, "global/node_modules/@earendil-works");
const sdk = await import(join(modules, "pi-coding-agent/dist/index.js"));
const { loadExtensions } = await import(join(modules, "pi-coding-agent/dist/core/extensions/loader.js"));
const { visibleWidth } = await import(join(modules, "pi-tui/dist/index.js"));
const loaded = await loadExtensions([join(root, "pi-package/extensions/tools-view.ts")], root);
assert.deepEqual(loaded.errors, []);
const renderer = loaded.extensions[0].toolRenderers[0];
sdk.initTheme("dark", false);
const text = (row: any, width = 80) => row.render(width).map(stripVTControlCharacters).join("\n");
const args = { command: "printf 'COMPLETE OUTPUT'" };
const row = new sdk.ToolExecutionComponent("bash", "one", args, {}, renderer("bash", () => sdk.createBashToolDefinition(root)), { requestRender() {} }, root);
assert.match(text(row), /▸ ejecuta/);
const result = { content: [{ type: "text", text: "COMPLETE OUTPUT\nsecond line" }], isError: false };
const original = JSON.stringify(result);
row.updateResult(result, true);
assert.match(text(row), /▸ ejecuta/);
row.updateResult(result);
assert.match(text(row), /✓ ejecuta.*2 líneas/);
assert.doesNotMatch(text(row), /second line/);
row.setExpanded(true);
assert.match(text(row), /COMPLETE OUTPUT/);
assert.match(text(row), /second line/);
row.setExpanded(false);
assert.doesNotMatch(text(row), /second line/);
assert.equal(JSON.stringify(result), original, "el renderer no modifica la evidencia");
row.updateResult({ content: [{ type: "text", text: "Command exited with code 2" }], isError: true });
assert.match(text(row), /× ejecuta.*código 2/);

// Las rutas son datos: ni controles de terminal ni el ancho Unicode deben romper la fila.
const path = "src/" + "界".repeat(80) + "\n\u001b]0;title\u0007.ts";
const read = new sdk.ToolExecutionComponent("read", "two", { path }, {}, renderer("read", () => sdk.createReadToolDefinition(root)), { requestRender() {} }, root);
read.updateResult({ content: [{ type: "text", text: "unchanged" }], isError: false });
for (const width of [8, 20, 60, 80]) {
  const lines = read.render(width);
  for (const line of lines) {
    assert.ok(!stripVTControlCharacters(line).includes("\n"), "ruta multilínea en recibo");
    assert.ok(visibleWidth(line) <= width, `fila de ${visibleWidth(line)} columnas para ${width}`);
  }
}
read.setExpanded(true);
assert.match(text(read), /unchanged/);
console.log("native tool receipts: compact/expanded, streaming, errors, evidence and terminal width: OK");
