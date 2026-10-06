import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryDirective, preferencesPath } from "../pi-package/memory.ts";

const dir = mkdtempSync(join(tmpdir(), "n-ein-memory-"));
const previousHome = process.env.N_EIN_HOME;
const previousFile = process.env.N_EIN_PREFERENCES_FILE;
try {
  process.env.N_EIN_HOME = dir;
  delete process.env.N_EIN_PREFERENCES_FILE;
  const path = preferencesPath();
  assert.equal(path, join(dir, "preferences.md"));
  assert.match(memoryDirective(), /No preferences file exists yet/);
  assert.ok(!existsSync(path), "leer memoria no inventa preferencias ni crea archivos");
  writeFileSync(path, "Use Bun when the project lockfile selects it.\n");
  const before = readFileSync(path, "utf8");
  assert.match(memoryDirective(), /Use Bun when the project lockfile selects it/);
  assert.match(memoryDirective(), /not authorization/);
  assert.equal(readFileSync(path, "utf8"), before);
  writeFileSync(path, "Keep the current project's conventions.\n");
  assert.match(memoryDirective(), /Keep the current project's conventions/);
  assert.doesNotMatch(memoryDirective(), /Use Bun/, "otra sesión no recibe preferencias obsoletas de una caché propia");
  process.env.N_EIN_PREFERENCES_FILE = join(dir, "custom.md");
  assert.equal(preferencesPath(), process.env.N_EIN_PREFERENCES_FILE);
  assert.match(memoryDirective(), /No preferences file exists yet/);
  console.log("memory: preferencias comunes recuperadas sin copiar configuración, mutar archivos ni conservar una caché obsoleta");
} finally {
  if (previousHome === undefined) delete process.env.N_EIN_HOME; else process.env.N_EIN_HOME = previousHome;
  if (previousFile === undefined) delete process.env.N_EIN_PREFERENCES_FILE; else process.env.N_EIN_PREFERENCES_FILE = previousFile;
  rmSync(dir, { recursive: true, force: true });
}
