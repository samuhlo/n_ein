import { strict as assert } from "node:assert";
import { painter } from "../pi-package/extensions/brand.ts";
import { bannerSeconds, renderBanner, type BannerData } from "../pi-package/extensions/banner-view.ts";

const p = painter(false);
const data: BannerData = {
  channel: "preview", version: "0.1.0-preview.1+hotfix.abc", piVersion: "0.87.1", cwd: "~/proyecto",
  index: "codegraph · al día",
  todo: { current: "Corregir el puerto", done: 1, total: 3 },
  models: { principal: "gpt-6-sol · high", scout: "gpt-6-luna · low", worker: "gpt-6-luna · high", reviewer: "gpt-6-sol · medium", claude: "modelo de Claude Code · xhigh" },
};

const opening = renderBanner(p, data, 0, 100).join("\n");
assert.doesNotMatch(opening, /PROYECTO|no hace falta tanto/, "en t=0 aún no entra el estado ni el lema");

const waiting = renderBanner(p, data, 5, 100).join("\n");
assert.match(waiting, /consultando Git…/, "sin respuesta de Git la fila espera en vez de inventar");

data.git = { branch: "main", changes: "2 sin confirmar" };
const settled = renderBanner(p, data, bannerSeconds(data, p), 100).join("\n");
for (const expected of ["▀▀▀▀▀", "no hace falta tanto", "preview · 0.1.0-preview.1+hotfix.abc · pi 0.87.1", "// 001  PROYECTO",
  "main · 2 sin confirmar", "codegraph · al día", "// 002  TRABAJO", "▸ Corregir el puerto  1/3", "// 003  MODELOS",
  "gpt-6-luna · high", "nein-scout     gpt-6-luna · low", "nein-reviewer  gpt-6-sol · medium", "modelo de Claude Code · xhigh", "/nein:models"]) {
  assert.ok(settled.includes(expected), `falta «${expected}» en el banner asentado`);
}
assert.doesNotMatch(settled, /\x1b\[/, "sin color no hay ANSI");

delete data.todo;
const noWork = renderBanner(p, data, 10, 100).join("\n");
assert.doesNotMatch(noWork, /TRABAJO/, "sin WORK.md no hay sección de trabajo");
assert.match(noWork, /\/\/ 002  MODELOS/);

const short = renderBanner(p, data, 10, 100, 24);
assert.ok(short.some((line) => line.trim() === "n_ein") && !short.join("\n").includes("▀▀▀▀▀"), "en una terminal baja el Panel cede al wordmark");
assert.ok(short.length < renderBanner(p, data, 10, 100, 50).length - 8, "en compacto el estado pierde los respiros");

const narrow = renderBanner(p, data, 10, 30);
assert.ok(narrow.some((line) => line.trim() === "n_ein"), "en estrecho el Panel cede al wordmark");

console.log("banner: Panel, lema, versiones y estado en cascada");
