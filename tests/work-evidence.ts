import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWork, inspectWork, workBrief } from "../pi-package/workspace/evidence.ts";
const area = mkdtempSync(join(tmpdir(), "nein-evidence-"));
process.env.N_EIN_HOME = join(area, "home");
process.env.N_EIN_CHANNEL = "dev";
execFileSync("git", ["init", "-q"], { cwd: area });
writeFileSync(join(area, ".gitignore"), "home/\n");
writeFileSync(
  join(area, "WORK.md"),
  "## Objetivo\nValidar comportamiento\n## Criterios\n- acepta Unicode\n## Tareas\n- [x] T1 · Codificar\n",
);
writeFileSync(join(area, "code.ts"), "export const n = 1;\n");
const record = await checkWork(area, area, "acepta Unicode", [
  process.execPath,
  "-e",
  "console.log('á')",
]);
assert.equal(record.exit, 0);
assert.equal(inspectWork(area, area).evidence[0].state, "verified");
writeFileSync(join(area, "new.ts"), "new file");
assert.equal(
  inspectWork(area, area).evidence[0].state,
  "stale",
  "new untracked files invalidate checks",
);
const bad = await checkWork(area, area, "acepta Unicode", [
  process.execPath,
  "-e",
  "process.exit(3)",
]);
assert.equal(bad.exit, 3);
assert.equal(inspectWork(area, area).evidence[0].state, "failed");
await assert.rejects(
  checkWork(area, area, "invented criterion", [
    process.execPath,
    "-e",
    "process.exit(0)",
  ]),
);
const changed = await checkWork(area, area, "T1", [
  process.execPath,
  "-e",
  "await Bun.write('code.ts','changed')",
]);
assert.equal(changed.exit, 0);
assert.equal(
  inspectWork(area, area).evidence[0].state,
  "stale",
  "a check modifying its code does not verify the final tree",
);
// El resumen para el agente: lo vivo del documento, lo hecho por su nombre, sin el registro.
writeFileSync(
  join(area, "WORK.md"),
  [
    "# Encargo",
    "",
    "Estado: activo · Rama: main",
    "Objetivo: validar comportamiento.",
    "Siguiente: T2.",
    "",
    "## Pedidos",
    "",
    "- P1. acepta Unicode",
    "",
    "## Tareas",
    "",
    "- [x] T1 · Codificar — DETALLE_DE_LO_HECHO · `abc1234`",
    "- [ ] T2 · Probar — DETALLE_PENDIENTE",
    "",
    "## Registro",
    "",
    "- R1 REGISTRO_LARGO",
    "",
  ].join("\n"),
);
const brief = workBrief(area, area);
assert.match(brief, /WORK\.md · \d+ (?:B|KB) · registro de \d+ (?:B|KB) fuera/);
for (const text of ["Objetivo: validar comportamiento.", "Siguiente: T2.", "- P1. acepta Unicode", "- [x] T1 · Codificar", "- [ ] T2 · Probar — DETALLE_PENDIENTE"])
  assert.ok(brief.includes(text), `el resumen lleva ${text}`);
for (const text of ["REGISTRO_LARGO", "DETALLE_DE_LO_HECHO"])
  assert.ok(!brief.includes(text), `el resumen deja fuera ${text}`);
assert.match(brief, /comprobaciones: \d+ verificadas · \d+ obsoletas · \d+ fallidas/);
assert.ok(brief.length < 1200, "un resumen, no el documento");
console.log(
  "work evidence: executed command, exit, criterion, changed and new files",
);
