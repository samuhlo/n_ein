// =============================================================================
// [BENCH] REVISIÓN A CIEGAS
// uso: bun judge.ts <escenario> <run>... [--control <nombre>=<patch>]...
// Junta el diff de cada ejecución (commits y cambios sin commitear sobre la
// base), los baraja con etiquetas neutras y pide a Claude una puntuación por
// rúbrica. Los controles (una referencia limpia y otra con un defecto sembrado)
// miden si el juez distingue. La tabla de etiquetas solo se guarda en disco.
// =============================================================================
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const bench = process.env.N_EIN_BENCH ?? "/Users/samu/Documents/01_Proyectos/n_ein-bench";
const [scenario, ...rest] = process.argv.slice(2);
const runs: string[] = [], controls: [string, string][] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--control") { const [n, p] = rest[++i]!.split("="); controls.push([n!, p!]); } else runs.push(rest[i]!);
}

// Sin el encargo literal el juez no puede puntuar alcance ni documentación: falta = error, no «undefined».
const PROMPTS: Record<string, string> = {
  s1: "Los certificados sin enlace normativo válido, o cuyo enlace no pasa la allowlist del BOE, se rechazan con 422 antes de importar, pero su estado se queda en `not_imported` y el poblador los reintenta en cada pasada. Arréglalo: deben quedar en `failed`, sin tocar la red ni pasar por `importing`. Un certificado inexistente sigue dando 404 sin mutar nada.",
  s2: "Haz que el Anexo III lea la planificación guardada del curso en el servidor en vez del cuerpo que manda el cliente, y que el cliente deje de mandarla cuando hay curso.",
  s5: "Documenta en el README todos los scripts de base de datos y de semillas de `package.json` (los `db:*` y `seed:*`): qué hace cada uno y sobre qué entorno actúa. Es solo documentación: no cambies código.",
  s6: "En el panel del centro, que el título «Los cursos del centro» muestre cuántos cursos hay, por ejemplo «Los cursos del centro (3)». Si no hay ninguno, el título se queda como está.",
  s3b: "Cierra las tres deudas que quedan en `docs/alpha-v1/estado-actual.md`.",
  s3: "Cierra las deudas de `docs/alpha-v1/estado-actual.md`: que al dar de alta un centro se rechace a quien ya tiene cursos propios o módulos asignados; que `tests/pages/anexo-iv-codigo.test.ts` monte el componente en vez de leerlo como texto; y corrige el documento, que todavía da en gris el botón «Crear un curso» del centro.",
};

if (!(scenario! in PROMPTS)) { console.error(`[ERR] :: JUDGE_SCENARIO :: sin encargo para ${scenario}`); process.exit(64); }

// Los documentos de trabajo de cada variante delatarían su origen: se excluyen del diff.
const EXCLUDE = [":(exclude)WORK.md", ":(exclude)work", ":(exclude)odd", ":(exclude).scratch", ":(exclude)AGENTS.md", ":(exclude)docs/agents"];
function diffOf(run: string): string {
  const copy = join(bench, "copies", run);
  const meta = JSON.parse(readFileSync(join(bench, "logs", run, "meta.json"), "utf8"));
  // Rama con más commits sobre la base, o la base si no hubo commits; más lo no commiteado.
  execFileSync("git", ["-C", copy, "add", "-A", "-N"]);
  return execFileSync("git", ["-C", copy, "diff", meta.base_rev, "--", ".", ...EXCLUDE], { encoding: "utf8", maxBuffer: 64 << 20 });
}

// Lo que el usuario recibe para revisar: los mensajes de commit y el mensaje de cierre del agente.
function reviewKit(run: string): string {
  const copy = join(bench, "copies", run), log = join(bench, "logs", run);
  const meta = JSON.parse(readFileSync(join(log, "meta.json"), "utf8"));
  const commits = execFileSync("git", ["-C", copy, "log", "--all", "--reverse", "--format=* %s%n%b", `^${meta.base_rev}`], { encoding: "utf8" }).trim();
  let closing = "";
  for (const f of readdirSync(log).filter((n) => n.startsWith("events-")).sort()) {
    for (const line of readFileSync(join(log, f), "utf8").split("\n").filter(Boolean)) {
      let e: any; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "message_end" && e.message?.role === "assistant") {
        const text = (e.message.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
        if (text) closing = text;
      }
      if (e.type === "item.completed" && e.item?.type === "agent_message" && e.item.text) closing = e.item.text;
    }
  }
  // El nombre de la herramienta o del flujo delataría la variante.
  const scrub = (t: string) => t.replace(/WORK\.md|work\/[\w-]+\/\w+\.md|odd\/tasks\/[\w-]+\.md|\.scratch\/[\w\/-]+\.md/g, "<documento de trabajo>");
  return `--- commits ---\n${scrub(commits) || "(sin commits)"}\n--- mensaje final al usuario ---\n${scrub(closing).slice(0, 4000) || "(sin mensaje)"}`;
}

const items = [
  ...runs.map((r) => ({ source: r, diff: `${reviewKit(r)}\n--- diff ---\n${diffOf(r)}` })),
  ...controls.map(([n, p]) => ({ source: `control:${n}`, diff: readFileSync(p, "utf8") })),
];
for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
const labeled = items.map((it, i) => ({ ...it, label: `P${String(i + 1).padStart(2, "0")}` }));

const prompt = `Eres revisor de código senior en un proyecto Nuxt 4 + Vitest + Drizzle. Recibes varias propuestas independientes para el mismo encargo, cada una como diff completo sobre la misma base. No sabes quién las hizo.

Encargo literal del usuario:
> ${PROMPTS[scenario]}

Puntúa cada propuesta de 1 (malo) a 5 (excelente) en:
- correccion: hace lo pedido sin romper lo que funcionaba (lee el código, no te fíes de los comentarios).
- tests: los tests prueban el comportamiento pedido por la interfaz pública, incluidos casos límite, y caerían si se rompe.
- alcance: no añade cambios no pedidos ni deja partes del encargo sin hacer.
- legibilidad: el código y los comentarios se entienden y siguen las convenciones del repo.
- documentacion: actualiza la documentación afectada cuando hace falta.
- revisabilidad: el usuario puede revisar y verificar el cambio en pocos minutos: commits acotados con mensajes claros, un mensaje final que dice qué se hizo, dónde mirar y cómo comprobarlo sin exagerar, y errores o logs que dirían dónde falla. Los controles sin commits ni mensaje se puntúan solo por el diff.

Lista los defectos reales con archivo:línea y severidad (bloqueante | importante | menor). No inventes defectos: si una propuesta está bien, dilo.

Responde SOLO con JSON válido, sin texto alrededor:
{"propuestas":[{"etiqueta":"P01","correccion":n,"tests":n,"alcance":n,"legibilidad":n,"documentacion":n,"revisabilidad":n,"defectos":[{"severidad":"...","lugar":"...","descripcion":"..."}],"resumen":"una frase"}]}

${labeled.map((it) => `===== PROPUESTA ${it.label} =====\n${it.diff.slice(0, 60000)}`).join("\n\n")}`;

const out = join(bench, "judge", `${scenario}-${Date.now()}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "labels.json"), JSON.stringify(labeled.map(({ label, source }) => ({ label, source })), null, 2));
writeFileSync(join(out, "prompt.md"), prompt);
const res = spawnSync("claude", ["-p", "--model", "opus", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--setting-sources", "project"], {
  input: prompt, encoding: "utf8", maxBuffer: 64 << 20, cwd: out, timeout: 30 * 60 * 1000,
});
writeFileSync(join(out, "raw.json"), res.stdout ?? "");
let verdict: any;
try {
  const text = JSON.parse(res.stdout).result as string;
  verdict = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
} catch (error) {
  console.error("[ERR] :: JUDGE_PARSE ::", String(error), res.stderr?.slice(0, 500));
  process.exit(1);
}
const bySource = Object.fromEntries(labeled.map((it) => [it.label, it.source]));
const scored = verdict.propuestas.map((p: any) => ({ source: bySource[p.etiqueta], ...p }));
writeFileSync(join(out, "verdict.json"), JSON.stringify(scored, null, 2));
for (const p of scored) {
  const sum = p.correccion + p.tests + p.alcance + p.legibilidad + p.documentacion + (p.revisabilidad ?? 0);
  const block = p.defectos.filter((d: any) => d.severidad === "bloqueante").length;
  console.log(`${p.source.padEnd(16)} total ${sum}/30 · c${p.correccion} t${p.tests} a${p.alcance} l${p.legibilidad} d${p.documentacion} r${p.revisabilidad} · bloqueantes ${block} · ${p.resumen}`);
}
console.log(`\n${out}`);
