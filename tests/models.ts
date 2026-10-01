import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadModels, saveClaudeEffort, saveModelChoice } from "../pi-package/models.ts";
import registerModels from "../pi-package/extensions/models.ts";
import registerWorker from "../pi-package/extensions/worker.ts";

const root = resolve(import.meta.dir, "..");
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

  let modelsCommand: any;
  registerModels({ registerCommand(_name: string, value: any) { modelsCommand = value; } } as any);
  assert.ok(modelsCommand, "/models no se registró");
  const choices = ["Principal", "openai-codex/gpt-6-luna", "medium", "Trabajador", "openai-codex/gpt-6-sol", "high", "Claude", "xhigh", "Claude", "Por defecto de Claude Code"];
  const notices: string[] = [];
  const ctx = {
    hasUI: true,
    modelRegistry: { async getAvailable() { return [
      { provider: "openai-codex", id: "gpt-6-sol" },
      { provider: "openai-codex", id: "gpt-6-luna" },
    ]; } },
    ui: {
      async select(_title: string, options: string[]) {
        const wanted = choices.shift();
        const selected = options.find((value) => value === wanted || value.startsWith(wanted ?? "\u0000"));
        assert.ok(selected, `opción ausente: ${wanted}`);
        return selected;
      },
      notify(message: string) { notices.push(message); },
    },
  } as any;
  await modelsCommand.handler("", ctx);
  await modelsCommand.handler("", ctx);
  await modelsCommand.handler("", ctx);
  assert.equal(loadModels(root).claudeEffort, "xhigh");
  const cli = Bun.spawnSync(["bun", join(root, "pi-package/models.ts"), root, "dev"], { env: process.env }).stdout.toString().trim().split("\t");
  assert.equal(cli[5], "xhigh", "los lanzadores leen el esfuerzo de Claude como sexto campo");
  await modelsCommand.handler("", ctx);
  assert.equal(loadModels(root).claudeEffort, null);
  assert.throws(() => saveClaudeEffort(root, "minimal"), /esfuerzo de Claude inválido/);
  let effective = loadModels(root);
  assert.deepEqual(effective.principal, { model: "openai-codex/gpt-6-luna", thinking: "medium" });
  assert.deepEqual(effective.worker, { model: "openai-codex/gpt-6-sol", thinking: "high" });
  assert.equal(statSync(modelsFile).mode & 0o777, 0o600);
  assert.ok(notices.some((item) => item.includes("Reinicia Pi")));
  assert.ok(notices.some((item) => item.includes("próximo encargo")));

  const fakePi = join(temp, "pi");
  writeFileSync(fakePi, [
    "#!/usr/bin/env bash",
    "if [[ \"${1:-}\" == \"--version\" ]]; then printf '0.87.1\\n'; exit 0; fi",
    "printf '%s\\n' \"$@\" > \"$N_EIN_CAPTURE\"",
    "printf '%s\\n' '{\"type\":\"message_end\",\"message\":{\"role\":\"assistant\",\"provider\":\"openai-codex\",\"model\":\"gpt-6-sol\",\"stopReason\":\"stop\",\"content\":[{\"type\":\"text\",\"text\":\"hecho\"}]}}'",
  ].join("\n") + "\n");
  chmodSync(fakePi, 0o755);
  process.env.N_EIN_PI_BIN = fakePi;
  process.env.N_EIN_AGENT_DIR = join(temp, "agent");
  process.env.N_EIN_CAPTURE = join(temp, "args");
  let worker: any;
  registerWorker({ registerTool(value: any) { worker = value; } } as any);
  const result = await worker.execute("test-model", {
    mode: "explore", task: "Lee", acceptance: "Respuesta",
  }, new AbortController().signal, undefined, { cwd: temp });
  assert.equal(result.details.status, "completo");
  assert.equal(result.details.model, "gpt-6-sol");
  const args = readFileSync(join(temp, "args"), "utf8");
  assert.match(args, /openai-codex\/gpt-6-sol/);
  assert.ok(args.lastIndexOf("openai-codex/gpt-6-sol") > args.indexOf("openai-codex/gpt-6-luna"), "el modelo delegado debe prevalecer");

  saveModelChoice(root, "principal", null);
  effective = loadModels(root);
  assert.equal(effective.principal.model, "openai-codex/gpt-6-sol");
  assert.equal(effective.worker.model, "openai-codex/gpt-6-sol");
  assert.throws(() => saveModelChoice(root, "worker", { model: "bad model", thinking: "high" }));
  writeFileSync(modelsFile, '{"schema":1,"agents":{"worker":{"model":"bad model","thinking":"high"}}}');
  assert.throws(() => loadModels(root), /models.json inválido/);
  console.log("models: selector, persistencia por rol, worker efectivo y esfuerzo de Claude");
} finally {
  for (const [key, env] of [["N_EIN_MODELS_FILE", previous.file], ["N_EIN_CHANNEL", previous.channel],
    ["N_EIN_PI_BIN", previous.pi], ["N_EIN_AGENT_DIR", previous.home], ["N_EIN_CAPTURE", previous.capture]] as const) {
    if (env === undefined) delete process.env[key]; else process.env[key] = env;
  }
  rmSync(temp, { recursive: true, force: true });
}
