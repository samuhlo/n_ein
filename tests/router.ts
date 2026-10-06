import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { classify, DEFAULT_ROUTING, loadRouting, parseOverride, type JobClass } from "../pi-package/router.ts";
import registerRouter, { nextState, type RouterState } from "../pi-package/extensions/router.ts";

const root = resolve(import.meta.dir, "..");
// La tabla del test es la del paquete: sin los ajustes del canal de quien lo ejecuta.
process.env.N_EIN_MODELS_FILE = join(root, "no-existe", "models.json");
type Labeled = { id: string | number; peticion: string; clase: JobClass };
const load = (name: string): Labeled[] => JSON.parse(readFileSync(join(root, "evals/reserved/router", name), "utf8")).peticiones;
const cheap = (c: JobClass) => c === "mecanico" || c === "ordinario";
const costly = (c: JobClass) => c === "riesgo" || c === "abierto";

assert.equal(classify("Documenta el cambio y arregla los permisos").clase, "riesgo", "documentar no oculta una modificación de permisos");
assert.equal(classify("Actualiza el README; migra las cuentas existentes").clase, "riesgo");
assert.equal(classify("Document the change and fix authentication").clase, "riesgo");
assert.equal(classify("Documenta los permisos existentes. Es solo documentación: no cambies código.").clase, "mecanico", "explicar un riesgo no lo modifica");
assert.equal(classify("Cambia el color y añade validación al formulario").clase, "ordinario", "presentación y lógica no es un encargo mecánico");
assert.equal(classify("Implementa el parser y escribe su documentación").clase, "ordinario", "documentar una implementación no la convierte en mecánica");
assert.equal(classify("Change permissions and update the README").clase, "riesgo", "el idioma inglés conserva el riesgo de los permisos");
assert.equal(classify("Change the public contract and update the README").clase, "riesgo");
assert.equal(classify("Document the permissions and update authentication").clase, "riesgo");
assert.equal(classify("Document the database migrations. Do not change code.").clase, "mecanico", "documentación inglesa sin cambios de código sigue siendo mecánica");

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
assert.equal(nextState({ reason: "user", state: risk, messages: user("Cambia el color del botón") }, { newJob: true }).clase, "mecanico", "un nuevo encargo no arrastra el riesgo anterior");
assert.equal(nextState({ reason: "continuation", state: risk, messages: user("Cambia el color del botón") }, { newJob: true }), risk, "la frontera espera a una petición del usuario");
assert.equal(nextState({ reason: "user", state: risk, messages: user("Otra cosa: corrige una errata del README") }, {}).clase, "mecanico", "otro encargo en lenguaje normal puede elegir un modelo más barato");
assert.equal(nextState({ reason: "user", state: risk, messages: user("Otra cosa del mismo encargo: corrige el texto") }, {}), risk, "una corrección del encargo conserva la clase");
assert.equal(nextState({ reason: "user", state: risk, messages: user("New task: fix a typo in README") }, {}).clase, "mecanico");
assert.equal(classify("Ayúdame a diseñar esta idea").clase, "abierto");
const open: RouterState = { clase: "abierto", motivo: "diseño", fuente: "regla" };
const choice = { clase: "ordinario" as const, transition: "start_implementation" as const, reason: "el alcance está acordado" };
assert.equal(nextState({ reason: "continuation", state: open, messages: user("Vale, hazlo") }, { choice }).clase, "ordinario", "diseño acordado permite elegir la capacidad para construir");
assert.equal(nextState({ reason: "continuation", state: risk, messages: user("Continúa") }, { choice }), risk, "aclarar no rebaja un trabajo de riesgo que ya se ejecuta");

// La extensión registra nein/auto, la herramienta de escalado y /nein:modo, y enruta al modelo físico de la clase.
let virtual: any, tool: any, taskTool: any, command: any, newJob: any, sessionStart: any;
const sent: string[] = [];
registerRouter({
  on(name: string, handler: unknown) { if (name === "session_start") sessionStart = handler; },
  sendUserMessage(message: string) { sent.push(message); },
  registerVirtualModel(v: unknown) { virtual = v; },
  registerTool(t: any) { if (t.name === "nein_escalate") tool = t; else if (t.name === "nein_set_task") taskTool = t; },
  registerCommand(name: string, c: unknown) { if (name === "nein:modo") command = c; if (name === "nein:nuevo") newJob = c; },
} as never);
assert.equal(`${virtual.provider}/${virtual.id}`, "nein/auto");
const ctx = { modelRegistry: { find: (provider: string, id: string) => ({ provider, id }) } } as never;
const first = await virtual.route({ reason: "user", state: undefined, messages: user("Documenta los scripts en el README. Es solo documentación."), thinkingLevel: "medium" }, ctx);
assert.deepEqual([first.model.id, first.thinkingLevel, first.state.clase], ["gpt-6-luna", "high", "mecanico"]);
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

let idle = false;
await newJob.handler("Cambia el color del botón", { waitForIdle: async () => { idle = true; }, ui: { notify: (m: string) => notes.push(m) } });
assert.ok(idle);
assert.deepEqual(sent, ["Cambia el color del botón"]);
await virtual.route({ reason: "direct", messages: [], thinkingLevel: "medium" }, ctx);
const fresh = await virtual.route({ reason: "user", state: escalated.state, messages: user(sent[0]!), thinkingLevel: "medium" }, ctx);
assert.equal(fresh.model.id, "gpt-6-luna", "compactar no consume el comienzo del nuevo encargo");
await command.handler("luna", { ui: { notify() {} } });
sessionStart();
const resumed = await virtual.route({ reason: "continuation", state: escalated.state, messages: user("x"), thinkingLevel: "medium" }, ctx);
assert.equal(resumed.model.id, "gpt-6-sol", "una orden pendiente de otra sesión no altera el estado restaurado");

const taskContext = { model: { provider: "nein", id: "auto" }, sessionManager: { getBranch: () => [{ type: "message", message: { role: "user", content: "Vale, hazlo" } }] } };
assert.equal((await taskTool.execute("t", { ...choice, request: "otra cosa" }, undefined, undefined, taskContext)).isError, true);
assert.notEqual((await taskTool.execute("t", { ...choice, request: "Vale, hazlo" }, undefined, undefined, taskContext)).isError, true);
const built = await virtual.route({ reason: "continuation", state: open, messages: user("Vale, hazlo") }, ctx);
assert.deepEqual([built.model.id, built.thinkingLevel, built.state.clase], ["gpt-6-sol", "medium", "ordinario"]);
assert.equal((await taskTool.execute("t", { ...choice, request: "Vale, hazlo" }, undefined, undefined, { ...taskContext, model: { provider: "openai", id: "gpt-6-sol" } })).isError, true, "no promete cambiar un modelo manual con un estado virtual inactivo");
assert.equal((await tool.execute("t", { reason: "risk" }, undefined, undefined, { model: { provider: "openai", id: "gpt-6-sol" } })).isError, true);

// El selector promete aplicar sus cambios al siguiente encargo, conservando el modelo del actual.
const dir = mkdtempSync(join(tmpdir(), "nein-routing-settings-"));
try {
  process.env.N_EIN_MODELS_FILE = join(dir, "models.json");
  writeFileSync(process.env.N_EIN_MODELS_FILE, JSON.stringify({ schema: 1, agents: {} }));
  let live: any;
  registerRouter({ on() {}, registerTool() {}, registerCommand() {}, registerVirtualModel(value: any) { live = value; } } as never);
  const initial = await live.route({ reason: "user", messages: user("Documenta el README") }, ctx);
  writeFileSync(process.env.N_EIN_MODELS_FILE, JSON.stringify({ schema: 1, agents: { mecanico: { model: "openai/gpt-6-sol", thinking: "medium" } } }));
  const continuing = await live.route({ reason: "continuation", state: initial.state, messages: user("Continúa") }, ctx);
  assert.equal(continuing.model.id, "gpt-6-luna");
  const another = await live.route({ reason: "user", state: initial.state, messages: user("Otra cosa: documenta el README") }, ctx);
  assert.equal(another.model.provider, "openai", "un encargo nuevo carga la tabla guardada sin reiniciar Pi");
  assert.equal(another.model.id, "gpt-6-sol");
  assert.equal((await live.route({ reason: "continuation", state: another.state, messages: user("Continúa") }, ctx)).model.id, "gpt-6-sol");
  writeFileSync(process.env.N_EIN_MODELS_FILE, "{}");
  assert.throws(() => live.route({ reason: "user", state: another.state, messages: user("Otra cosa: documenta el README") }, ctx), /models.json inválido/);
} finally {
  process.env.N_EIN_MODELS_FILE = join(root, "no-existe", "models.json");
  rmSync(dir, { recursive: true, force: true });
}

console.log("router: clasificación sin riesgo a modelos baratos, encargo pegajoso, escalado y /nein:modo");
