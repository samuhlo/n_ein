import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { classify, DEFAULT_ROUTING, loadRouting, parseOverride, type JobClass } from "../pi-package/router.ts";
import registerRouter, { nextState, type RouterState } from "../pi-package/extensions/router.ts";

const root = resolve(import.meta.dir, "..");
type Labeled = { id: string | number; peticion: string; clase: JobClass };
const load = (name: string): Labeled[] => JSON.parse(readFileSync(join(root, "evals/reserved/router", name), "utf8")).peticiones;
const cheap = (c: JobClass) => c === "mecanico" || c === "ordinario";
const costly = (c: JobClass) => c === "riesgo" || c === "abierto";

// Peticiones reales etiquetadas: nunca un encargo de riesgo o abierto a un modelo barato.
for (const [name, minimum] of [["peticiones.json", 1], ["peticiones-control.json", 0.8]] as const) {
  const set = load(name);
  let hits = 0;
  for (const p of set) {
    const got = classify(p.peticion).clase;
    if (got === p.clase) hits++;
    assert.ok(!(costly(p.clase) && cheap(got)), `${name} #${p.id}: un encargo de ${p.clase} no puede ir a ${got}: ${p.peticion}`);
  }
  assert.ok(hits / set.length >= minimum, `${name}: acierto ${hits}/${set.length} por debajo de ${minimum}`);
}

// Anulación al principio del mensaje.
assert.deepEqual(parseOverride("[luna] cambia el título"), { clase: "mecanico", rest: "cambia el título" });
assert.deepEqual(parseOverride("[sol high] migra la tabla").clase, "riesgo");
assert.deepEqual(parseOverride("sin prefijo"), { rest: "sin prefijo" });

// La tabla de runtime.json manda por clase.
assert.deepEqual(loadRouting(root).riesgo, { model: "openai-codex/gpt-6-sol", thinking: "high" });
assert.deepEqual(loadRouting(join(root, "no-existe")), DEFAULT_ROUTING);

// Pegajoso dentro del encargo, solo sube de clase, y el escalado y /nein:modo mandan sobre las reglas.
const user = (text: string) => [{ role: "user", content: text }] as never;
const mech: RouterState = { clase: "mecanico", motivo: "x", fuente: "regla" };
assert.equal(nextState({ reason: "user", state: undefined, messages: user("Documenta el README") }, {}).clase, "mecanico");
assert.equal(nextState({ reason: "continuation", state: mech, messages: user("migra la base de datos") }, {}), mech, "las continuaciones no reclasifican");
assert.equal(nextState({ reason: "user", state: mech, messages: user("ahora migra la base de datos") }, {}).clase, "riesgo", "una petición nueva sube de clase");
const risk: RouterState = { clase: "riesgo", motivo: "x", fuente: "regla" };
assert.equal(nextState({ reason: "user", state: risk, messages: user("corrige una errata del README") }, {}), risk, "nunca baja sola");
assert.equal(nextState({ reason: "continuation", state: mech, messages: user("x") }, { escalate: "toca permisos" }).clase, "riesgo");
assert.equal(nextState({ reason: "continuation", state: risk, messages: user("x") }, { force: "mecanico" }).clase, "mecanico");

// La extensión registra nein/auto, la herramienta de escalado y /nein:modo, y enruta al modelo físico de la clase.
let virtual: any, tool: any, command: any;
registerRouter({
  registerVirtualModel(v: unknown) { virtual = v; },
  registerTool(t: unknown) { tool = t; },
  registerCommand(name: string, c: unknown) { if (name === "nein:modo") command = c; },
} as never);
assert.equal(`${virtual.provider}/${virtual.id}`, "nein/auto");
const ctx = { modelRegistry: { find: (provider: string, id: string) => ({ provider, id }) } } as never;
const first = await virtual.route({ reason: "user", state: undefined, messages: user("Documenta los scripts en el README. Es solo documentación."), thinkingLevel: "medium" }, ctx);
assert.deepEqual([first.model.id, first.thinkingLevel, first.state.clase], ["gpt-6-luna", "medium", "mecanico"]);
const again = await virtual.route({ reason: "continuation", state: first.state, messages: user("x"), thinkingLevel: "medium" }, ctx);
assert.equal(again.state, undefined, "sin cambio de clase no se reescribe el estado");
assert.equal(again.model.id, "gpt-6-luna");
await tool.execute("t", { reason: "toca permisos de usuarios" });
const escalated = await virtual.route({ reason: "continuation", state: first.state, messages: user("x"), thinkingLevel: "medium" }, ctx);
assert.deepEqual([escalated.model.id, escalated.thinkingLevel, escalated.state.clase], ["gpt-6-sol", "high", "riesgo"]);
const compaction = await virtual.route({ reason: "direct", messages: [], thinkingLevel: "medium" }, ctx);
assert.equal(compaction.model.id, "gpt-6-luna", "la compactación va al modelo barato");
const notes: string[] = [];
await command.handler("luna", { ui: { notify: (m: string) => notes.push(m) } });
const forced = await virtual.route({ reason: "continuation", state: escalated.state, messages: user("x"), thinkingLevel: "medium" }, ctx);
assert.equal(forced.model.id, "gpt-6-luna", "/nein:modo manda sobre la clase");
assert.match(notes[0]!, /mecanico/);

console.log("router: clasificación sin riesgo a modelos baratos, encargo pegajoso, escalado y /nein:modo");
