import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadModels, saveClaudeEffort, saveModelChoice } from "../pi-package/models.ts";
import registerModels, { openModels } from "../pi-package/extensions/models.ts";
import { visible } from "../pi-package/extensions/brand.ts";
import registerAgents from "../pi-package/extensions/agents.ts";

const root = resolve(import.meta.dir, "..");
const piVersion = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi.version;
const temp = mkdtempSync(join(tmpdir(), "n-ein-models-"));
const modelsFile = join(temp, "models.json");
const previous = {
  file: process.env.N_EIN_MODELS_FILE,
  channel: process.env.N_EIN_CHANNEL,
  pi: process.env.N_EIN_PI_BIN,
  home: process.env.N_EIN_AGENT_DIR,
  capture: process.env.N_EIN_CAPTURE,
};
process.env.N_EIN_MODELS_FILE = modelsFile;
process.env.N_EIN_CHANNEL = "dev";

try {
  const defaults = loadModels(root);
  assert.equal(defaults.principal.model, "openai-codex/gpt-6-sol");
  assert.equal(defaults.worker.model, "openai-codex/gpt-6-luna");
  assert.equal(defaults.overridden.length, 0);
  assert.equal(defaults.claudeEffort, null, "Sin ajuste, el esfuerzo de Claude lo decide Claude Code");

  let registered: string | undefined;
  registerModels({ registerCommand(name: string) { registered = name; } } as any);
  assert.equal(registered, "nein:models", "el selector vive en /nein:models");

  // Teclas crudas como las manda la terminal; el kit falso hace de pi-tui.
  const KEYS: Record<string, string> = { up: "\x1b[A", down: "\x1b[B", enter: "\r", escape: "\x1b", "ctrl+s": "\x13", backspace: "\x7f" };
  const kit = { matchesKey: (data: string, key: string) => KEYS[key] === data, truncateToWidth: (text: string) => text, visibleWidth: visible };
  const notices: string[] = [];
  const renders: string[] = [];
  let sessions: string[][] = [];
  const ctx = {
    hasUI: true,
    modelRegistry: { async getAvailable() { return [
      { provider: "openai-codex", id: "gpt-6-sol" },
      { provider: "openai-codex", id: "gpt-6-luna" },
    ]; } },
    ui: {
      async custom(factory: any) {
        const keys = sessions.shift() ?? [];
        return await new Promise((resolveResult) => {
          const panel = factory({ requestRender() {} }, {}, {}, resolveResult);
          for (const data of keys) { panel.handleInput(data); renders.push(panel.render(100).join("\n").replace(/\x1b\[[0-9;]*m/g, "")); }
        });
      },
      async input() { return "openai-codex/gpt-7-prueba"; },
      notify(message: string) { notices.push(message); },
    },
  } as any;
  const type = (text: string) => [...text];

  // Principal: buscar luna y subir esfuerzo; scout: un paso más; worker: sol; claude: dos pasos (por defecto → low → medium).
  sessions = [[KEYS.enter, ...type("luna"), KEYS.enter, "e", KEYS.down, "e", KEYS.down, KEYS.enter, ...type("sol"), KEYS.enter, KEYS.down, KEYS.down, "e", "e", KEYS["ctrl+s"]]];
  await openModels(ctx, kit);
  let effective = loadModels(root);
  assert.deepEqual(effective.principal, { model: "openai-codex/gpt-6-luna", thinking: "xhigh" });
  assert.deepEqual(effective.scout, { model: "openai-codex/gpt-6-luna", thinking: "medium" });
  assert.deepEqual(effective.worker, { model: "openai-codex/gpt-6-sol", thinking: "high" });
  assert.deepEqual(effective.reviewer, { model: "openai-codex/gpt-6-sol", thinking: "medium" }, "el reviewer intacto conserva el valor del paquete");
  assert.equal(effective.claudeEffort, "medium");
  assert.equal(statSync(modelsFile).mode & 0o777, 0o600);
  assert.ok(notices.some((item) => item.includes("reinicia Pi")) && notices.some((item) => item.includes("próximo encargo")) && notices.some((item) => item.includes("al abrir Claude")) && notices.some((item) => item.includes("nein-scout")));
  assert.ok(renders.some((frame) => frame.includes("// 000  MODELOS") && frame.includes("nein-reviewer") && frame.includes("•")), "la tabla marca lo pendiente");
  assert.ok(renders.some((frame) => frame.includes("// 001  MODELO") && frame.includes("buscar  luna")), "el buscador filtra lo tecleado");
  const cli = Bun.spawnSync(["bun", join(root, "pi-package/models.ts"), root, "dev"], { env: process.env }).stdout.toString().trim().split("\t");
  assert.equal(cli[5], "medium", "los lanzadores leen el esfuerzo de Claude como sexto campo");

  // Cancelar no escribe nada.
  sessions = [["e", KEYS.escape]];
  await openModels(ctx, kit);
  assert.deepEqual(loadModels(root).principal, { model: "openai-codex/gpt-6-luna", thinking: "xhigh" });

  // Id personalizado: el panel cierra, pregunta con el input de Pi y vuelve con el borrador.
  sessions = [[KEYS.down, KEYS.down, KEYS.enter, ...type("personalizado"), KEYS.enter], [KEYS["ctrl+s"]]];
  await openModels(ctx, kit);
  assert.deepEqual(loadModels(root).worker, { model: "openai-codex/gpt-7-prueba", thinking: "high" });

  // r devuelve el principal al paquete y claude a su valor por defecto.
  sessions = [["r", KEYS.down, KEYS.down, KEYS.down, KEYS.down, "r", KEYS["ctrl+s"]]];
  await openModels(ctx, kit);
  effective = loadModels(root);
  assert.deepEqual(effective.principal, { model: "openai-codex/gpt-6-sol", thinking: "high" });
  assert.equal(effective.claudeEffort, null);
  assert.throws(() => saveClaudeEffort(root, "minimal"), /esfuerzo de Claude inválido/);
  saveModelChoice(root, "worker", { model: "openai-codex/gpt-6-sol", thinking: "high" });

  const fakePi = join(temp, "pi");
  writeFileSync(fakePi, [
    "#!/usr/bin/env bash",
    `if [[ "\${1:-}" == "--version" ]]; then printf '${piVersion}\\n'; exit 0; fi`,
    "printf '%s\\n' \"$@\" > \"$N_EIN_CAPTURE\"",
    "printf '%s\\n' '{\"type\":\"message_end\",\"message\":{\"role\":\"assistant\",\"provider\":\"openai-codex\",\"model\":\"gpt-6-sol\",\"stopReason\":\"stop\",\"content\":[{\"type\":\"text\",\"text\":\"hecho\"}]}}'",
  ].join("\n") + "\n");
  chmodSync(fakePi, 0o755);
  process.env.N_EIN_PI_BIN = fakePi;
  process.env.N_EIN_AGENT_DIR = join(temp, "agent");
  process.env.N_EIN_CAPTURE = join(temp, "args");
  const tools: Record<string, any> = {};
  // Los roles solo existen con N_EIN_ROLES=1; aquí se comprueba que heredan el modelo del panel.
  process.env.N_EIN_ROLES = "1";
  registerAgents({ registerTool(value: any) { tools[value.name] = value; }, on() {} } as any);
  const result = await tools.nein_worker.execute("test-model", {
    task: "Lee", surfaces: ["src/**"], acceptance: "Respuesta",
  }, new AbortController().signal, undefined, { cwd: temp });
  assert.equal(result.details.status, "completo");
  assert.equal(result.details.model, "gpt-6-sol");
  const args = readFileSync(join(temp, "args"), "utf8");
  assert.match(args, /openai-codex\/gpt-6-sol/);
  assert.ok(args.lastIndexOf("openai-codex/gpt-6-sol") > args.indexOf("openai-codex/gpt-6-luna"), "el modelo delegado debe prevalecer");

  assert.throws(() => saveModelChoice(root, "worker", { model: "bad model", thinking: "high" }));
  writeFileSync(modelsFile, '{"schema":1,"agents":{"worker":{"model":"bad model","thinking":"high"}}}');
  assert.throws(() => loadModels(root), /models.json inválido/);
  console.log("models: panel /nein:models con los tres roles, persistencia, modelo delegado y esfuerzo de Claude");
} finally {
  for (const [key, env] of [["N_EIN_MODELS_FILE", previous.file], ["N_EIN_CHANNEL", previous.channel],
    ["N_EIN_PI_BIN", previous.pi], ["N_EIN_AGENT_DIR", previous.home], ["N_EIN_CAPTURE", previous.capture]] as const) {
    if (env === undefined) delete process.env[key]; else process.env[key] = env;
  }
  rmSync(temp, { recursive: true, force: true });
}
