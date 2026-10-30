import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readDesign,
  readComments,
  changeDesign,
  designPath,
  previewURL,
  artboardHTML,
} from "../pi-package/workspace/design.ts";
const cwd = mkdtempSync(join(tmpdir(), "nein-design-")),
  dir = join(cwd, "docs/design/example");
mkdirSync(dir, { recursive: true });
execFileSync("git", ["init", "-q"], { cwd });
writeFileSync(
  join(dir, "design.json"),
  JSON.stringify({
    schema: 1,
    title: "Ejemplo",
    brief: "Flujo",
    artboards: [
      { file: "one.html", title: "Una", tradeoff: "Simple" },
      { file: "two.html", title: "Dos", tradeoff: "Densa" },
    ],
  }),
);
writeFileSync(join(dir, "one.html"), "<button>Guardar</button>");
writeFileSync(join(dir, "two.html"), "<h1>Otra</h1>");
await assert.rejects(
  changeDesign(cwd, "example", {
    action: "accept",
    file: "one.html",
    note: "Visto",
  }),
);
await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    changeDesign(cwd, "example", {
      action: "comment",
      file: "one.html",
      text: `Nota ${i}`,
    }),
  ),
);
assert.equal(readComments(cwd, "example").length, 10);
await changeDesign(cwd, "example", { action: "choose", file: "one.html" });
await changeDesign(cwd, "example", {
  action: "implement",
  file: "one.html",
  status: "implemented",
  preview: "http://localhost:3000",
  note: "Funcionando",
});
await changeDesign(cwd, "example", {
  action: "accept",
  file: "one.html",
  note: "Probados vacío y error",
});
assert.ok(readDesign(cwd, "example").acceptanceCurrent);
writeFileSync(join(cwd, "app.ts"), "changed source");
assert.equal(readDesign(cwd, "example").acceptanceCurrent, false);
await changeDesign(cwd, "example", { action: "choose", file: "two.html" });
assert.equal(readDesign(cwd, "example").acceptance, undefined);
assert.throws(() => designPath(cwd, "../escape"));
assert.throws(() => previewURL("https://evil.test"));
symlinkSync("/etc/passwd", join(dir, "bad.html"));
assert.throws(() => designPath(cwd, "example", "bad.html"));
assert.match(artboardHTML(cwd, "example", "one.html"), /nein-design-pick/);
writeFileSync(join(dir, "comments.json"), "broken");
await assert.rejects(
  changeDesign(cwd, "example", {
    action: "comment",
    file: "one.html",
    text: "No sobrescribir",
  }),
);
console.log(
  "design: variants, concurrent comments, handoff states, local preview and confined paths",
);
