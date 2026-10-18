import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COLORS, INTRO_SECONDS, LARGE_HEIGHT, panelLarge, painter } from "../pi-package/extensions/brand.ts";
import { smallRuns } from "../pi-package/claude-plugin/hooks/brand-core.ts";

const root = resolve(import.meta.dir, "..");
const mono = painter(false);
const final = panelLarge(mono, INTRO_SECONDS);
assert.equal(final.length, LARGE_HEIGHT);
// El contrato con go/internal/brand: los dos Panel asentados son idénticos.
assert.equal(final.join("\n") + "\n", readFileSync(resolve(root, "tests/fixtures/panel-final.txt"), "utf8"));
assert.equal(panelLarge(mono, 0).join(""), "", "en t=0 no hay palas");
assert.notEqual(panelLarge(mono, 1).join("\n"), final.join("\n"), "a mitad de apertura las palas aún giran");

const colors = JSON.parse(readFileSync(resolve(root, "brand.json"), "utf8")).colors;
for (const name of ["carbon", "concrete", "yellow"] as const) assert.equal(COLORS[name].toLowerCase(), colors[name].toLowerCase());
assert.match(panelLarge(painter(true), INTRO_SECONDS).join(""), /48;2;26;26;26/, "las palas pintan su fondo");
assert.doesNotMatch(final.join(""), /\x1b\[/, "el monocromo no emite ANSI");

// La marca pequeña de Claude: mismas palas que nein-setup, que giran y se asientan en n_ein.
const smallText = (t: number) => smallRuns(t).map((runs) => runs.map((run) => run.text).join("").trimEnd());
assert.equal(smallText(0).join(""), "", "en t=0 la marca pequeña no tiene palas");
assert.equal(smallText(INTRO_SECONDS)[1], " n   _   e   i   n", "la marca pequeña se asienta en n_ein");
assert.equal(smallRuns(INTRO_SECONDS)[0]!.filter((run) => run.bg).length, 5, "cinco palas con fondo");

console.log("brand: el Panel de Pi coincide con el de Go");
