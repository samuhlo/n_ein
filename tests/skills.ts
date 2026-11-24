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

// vision solo la arranca el usuario: el modelo no ve su descripción, así que el flujo es lo único que le permite sugerirla.
const visionDir = join(skillsDir, "vision");
const vision = readFileSync(join(visionDir, "SKILL.md"), "utf8");
assert.equal(Bun.YAML.parse(vision.split("---")[1])["disable-model-invocation"], true, "vision: debe ser de invocación manual");
assert.match(readFileSync(join(root, "pi-package/flow.md"), "utf8"), /`vision`/, "flow.md debe sugerir vision");
// commit tampoco la lanza el modelo, para que nunca sustituya al commit por tarea; el flujo la sugiere ante cambios sueltos.
const commit = readFileSync(join(skillsDir, "commit", "SKILL.md"), "utf8");
assert.equal(Bun.YAML.parse(commit.split("---")[1])["disable-model-invocation"], true, "commit: debe ser de invocación manual");
assert.match(readFileSync(join(root, "pi-package/flow.md"), "utf8"), /suggest the `commit` skill/, "flow.md debe sugerir commit ante cambios sueltos");
// Los defectos que nadie pidió salen del código compartido que se tocó: el flujo y tdd piden probar que sigue igual.
const sharedCode = /shares the code you change \(options, parsers, helpers, validation\)/;
assert.match(readFileSync(join(root, "pi-package/flow.md"), "utf8"), sharedCode, "flow.md debe pedir sonda para lo que comparte el código tocado");
assert.match(readFileSync(join(skillsDir, "tdd", "SKILL.md"), "utf8"), sharedCode, "tdd debe pedir test para lo que comparte el código tocado");
// Las regresiones de redacción en prompts escapan a tests y lectores: la revisión compara frase a frase.
const review = readFileSync(join(skillsDir, "review", "SKILL.md"), "utf8");
for (const [rule, why] of [
  [/Set each removed or reworded sentence beside its base version/, "comparar cada frase quitada o reescrita"],
  [/a dropped condition or exception, a quantifier/, "señalar el matiz perdido"],
  [/a rule that became unconditional/, "señalar la regla que se vuelve absoluta"],
  [/apply each new sentence word for word, as a model would/, "leer la regla nueva como un modelo literal"],
] as const) assert.match(review, rule, `review: ${why}`);
// Un documento por encargo, solo cuando el trabajo no se retoma desde el diff, con el registro al final y un cierre que lo resume.
const flow = readFileSync(join(root, "pi-package/flow.md"), "utf8");
for (const [rule, why] of [
  [/cannot be resumed from the original request and `git diff` alone/, "la prueba de reanudación decide si hay documento"],
  [/`docs\/work\/<YYYY-MM-DD>-<short-name>\.md`/, "uno por encargo en docs/work"],
  [/Stable content first and the growing log last/, "el registro va al final"],
  [/`— espera: <who or what>`/, "las tareas en espera se marcan"],
  [/`— descartada: <reason>`/, "las descartadas se marcan y no cuentan"],
  [/move the file to `docs\/work\/closed\/`/, "el cierre lo resume y lo archiva"],
  [/read the active work document up to its log/, "al retomar se lee hasta el registro"],
] as const) assert.match(flow, rule, `flow.md: ${why}`);
assert.doesNotMatch(flow, /read `WORK\.md` in full/, "flow.md ya no pide leer el documento entero");
const sketch = readFileSync(join(visionDir, "SKETCH.md"), "utf8");
for (const [file, text] of [["SKILL.md", vision], ["SKETCH.md", sketch]]) {
  for (const [, link] of text.matchAll(/\]\(([^)#]+)\)/g)) {
    assert.ok(statSync(join(visionDir, link), { throwIfNoEntry: false })?.isFile(), `vision/${file} enlaza ${link}, que no existe`);
  }
}
// Los bocetos se abren desde disco y se guardan en el repositorio: el esqueleto no puede depender de la red.
const skeleton = readFileSync(join(visionDir, "skeleton.html"), "utf8");
assert.doesNotMatch(skeleton, /(?:src|href)\s*=\s*["']?(?:https?:)?\/\/|url\(\s*["']?(?:https?:)?\/\/|@import/i, "vision/skeleton.html carga recursos externos");
assert.match(skeleton, /<section class="sheet" id="[^"]+" data-tab="[^"]+">/, "vision/skeleton.html debe traer hojas de ejemplo");

// n_ein es un producto para cualquiera: lo que se instala habla del usuario, no de una persona concreta.
const shipped = ["pi-package", "bin", "previewer"].flatMap(function walk(dir: string): string[] {
  const full = join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const path = join(full, entry);
    return statSync(path).isDirectory() ? walk(relative(root, path)) : [path];
  });
});
// Las skills son de n_ein: la procedencia y las licencias de terceros viven solo en NOTICE.md.
const RETIRED = /\b(comment-style|logging-style|handoff-pi|diagnosing-bugs|code-review|codebase-design|domain-modeling|writing-for-agents|to-spec|to-tickets|wait-what|n_ein_worker)\b/;
for (const path of shipped) {
  const text = readFileSync(path, "utf8");
  const name = relative(root, path);
  assert.doesNotMatch(text, /\bSamu\b/, `${name} nombra a una persona concreta`);
  if (name !== "pi-package/NOTICE.md") {
    assert.doesNotMatch(text, /Gentle|Pocock|\bMatt\b|Horthy|show-me/, `${name} cita a terceros fuera de NOTICE.md`);
    assert.doesNotMatch(text, RETIRED, `${name} usa un nombre de skill o herramienta retirado`);
  }
}

// Desde el 5 de octubre el recorrido no delega: nada de lo que lee el modelo nombra los roles.
for (const path of shipped.filter((p) => p.endsWith(".md") && !p.endsWith("NOTICE.md"))) {
  assert.doesNotMatch(readFileSync(path, "utf8"), /\bnein[-_](scout|worker|reviewer)\b/, `${relative(root, path)} nombra un rol retirado del recorrido`);
}
console.log("skills: frontmatter válido, sin nombres propios ni de terceros y sin nombres retirados");
