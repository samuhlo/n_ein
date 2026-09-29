import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createEngramTransport } from "../ein-pi/agent/lib/engram-cli.ts";
import { MemoryLifecycle } from "../ein-pi/agent/lib/memory-lifecycle.ts";
import { renderMemoryAdvisory } from "../ein-pi/agent/lib/sdd-session-memory.ts";

// A disposable notebook: never reads or writes the user's Engram data.
const store = mkdtempSync(join(tmpdir(), "ein-engram-probe-"));
process.env.ENGRAM_DATA_DIR = store;
process.env.ENGRAM_NO_UPDATE_CHECK = "1";
delete process.env.ENGRAM_CLOUD_AUTOSYNC;
const cli = (args: string[]) => execFileSync("engram", args, { encoding: "utf8", env: process.env, timeout: 5000 });
const transport = createEngramTransport();
const projectId = "ein-memory-eval";
const cases = [
  ["Compactación", "compactacion", "El checkpoint canónico vive en disco. Releer archivos y Git antes de continuar."],
  ["Barato", "barato", "Usar razonamiento bajo sobre un plan cerrado y verificable; corregir el plan si exige interpretación."],
  ["Verificación", "verificacion", "La evidencia debe corresponder al árbol actual y a comandos ejecutados en esta sesión."],
  ["Cuaderno", "cuaderno", "Pi y Claude comparten el mismo almacén aislado y el mismo nombre de proyecto."],
  ["Burocracia", "burocracia", "Un fallo de memoria no bloquea una tarea; OpenSpec conserva el estado canónico."],
  ["Exploración", "exploracion", "Acotar la investigación y entregar al padre rutas y hechos con procedencia."],
];
const saves = [];
for (const [title, keyword, body] of cases) {
  saves.push(await transport.save({ title, content: `${keyword}: ${body}`, type: "learning", projectId, topic: `learning/${keyword}` }));
}
const empty = await transport.search({ query: "zzznomatchzzz", projectId });
const genericRaw = cli(["search", "SDD session context", "--project", projectId]);
const generic = await new MemoryLifecycle({ transport, project: { kind: "remote", id: projectId } }).prepare({ lifecycleKey: "session", query: "SDD session context" });
const rows = [];
for (const [title, keyword, body] of cases) {
  const start = performance.now();
  const raw = cli(["search", keyword, "--project", projectId]);
  const prepared = await new MemoryLifecycle({ transport, project: { kind: "remote", id: projectId } }).prepare({ lifecycleKey: keyword, query: keyword });
  rows.push({ title, keyword, rawContainsLesson: raw.includes(body), advisoryContainsLesson: renderMemoryAdvisory(prepared).includes(body), prepared, elapsedMs: Math.round(performance.now() - start), raw });
}
const repeated = await transport.save({ title: "Cuaderno revisado", content: "cuaderno: NUEVA regla comprobada del almacén compartido.", type: "learning", projectId, topic: "learning/cuaderno" });
const updated = cli(["search", "cuaderno", "--project", projectId]);
const isolation = cli(["search", "cuaderno", "--project", "different-project"]);
const result = {
  version: cli(["version"]).trim(), store, saves, empty, genericRaw, generic,
  targetedRawHits: rows.filter(r => r.rawContainsLesson).length,
  targetedAdvisoryHits: rows.filter(r => r.advisoryContainsLesson).length,
  rows, repeated, updated, isolation,
};
const output = process.argv[2] ?? join(store, "results.json");
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ output, store, version: result.version, saves: saves.map(s => s.status), empty, generic: generic.receipt, targetedRawHits: result.targetedRawHits, targetedAdvisoryHits: result.targetedAdvisoryHits, example: rows[0]?.prepared, updated, isolation }, null, 2));
