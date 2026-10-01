import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const skillsDir = join(root, "pi-package/skills");

// Pi descarta en silencio una skill con frontmatter roto: se valida aquí para que falle en voz alta.
for (const name of readdirSync(skillsDir)) {
  const path = join(skillsDir, name, "SKILL.md");
  if (!statSync(join(skillsDir, name)).isDirectory()) continue;
  const text = readFileSync(path, "utf8");
  const frontmatter = text.split("---")[1];
  const meta = Bun.YAML.parse(frontmatter) as Record<string, unknown>;
  assert.equal(meta.name, name, `${name}: el nombre debe coincidir con la carpeta`);
  assert.ok(typeof meta.description === "string" && meta.description.length > 0 && meta.description.length <= 1024, `${name}: descripción ausente o larga`);
}

// n_ein es un producto para cualquiera: lo que se instala habla del usuario, no de una persona concreta.
const shipped = ["pi-package", "bin"].flatMap(function walk(dir: string): string[] {
  const full = join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const path = join(full, entry);
    return statSync(path).isDirectory() ? walk(relative(root, path)) : [path];
  });
});
for (const path of shipped) {
  assert.doesNotMatch(readFileSync(path, "utf8"), /\bSamu\b/, `${relative(root, path)} nombra a una persona concreta`);
}

console.log("skills: frontmatter válido y sin nombres propios en lo instalable");
