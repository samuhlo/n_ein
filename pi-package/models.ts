// =============================================================================
// [DATA] MODELOS EFECTIVOS
// runtime.json fija los valores del paquete; models.json conserva las elecciones
// del canal fuera del árbol gestionado por el instalador.
// =============================================================================

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type Role = "principal" | "worker";
export type ModelChoice = { model: string; thinking: string };
type Settings = { schema: 1; agents: Record<string, ModelChoice> };
export type EffectiveModels = {
  version: string;
  principal: ModelChoice;
  worker: ModelChoice;
  path: string;
  overridden: Role[];
};

const THINKING = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const MODEL_ID = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._:/+-]+$/;

function validChoice(value: unknown): value is ModelChoice {
  if (!value || typeof value !== "object") return false;
  const choice = value as ModelChoice;
  return typeof choice.model === "string" && MODEL_ID.test(choice.model)
    && typeof choice.thinking === "string" && THINKING.has(choice.thinking);
}

function channelOf(packageRoot: string, requested?: string): string {
  const marker = join(packageRoot, ".n-ein-channel");
  const channel = requested ?? process.env.N_EIN_CHANNEL
    ?? (existsSync(marker) ? readFileSync(marker, "utf8").trim() : "dev");
  if (channel !== "dev" && channel !== "preview" && channel !== "stable") {
    throw new Error(`canal inválido: ${channel}`);
  }
  return channel;
}

export function modelsPath(packageRoot: string, requestedChannel?: string): string {
  return process.env.N_EIN_MODELS_FILE || join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), channelOf(packageRoot, requestedChannel), "models.json");
}

function readSettings(path: string): Settings {
  if (!existsSync(path)) return { schema: 1, agents: {} };
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`models.json inválido: ${path}`);
  const settings = value as Settings;
  if (settings.schema !== 1 || !settings.agents || typeof settings.agents !== "object" || Array.isArray(settings.agents)) {
    throw new Error(`models.json inválido: ${path}`);
  }
  for (const [role, choice] of Object.entries(settings.agents)) {
    if (!validChoice(choice)) throw new Error(`models.json inválido: ${path} (${role})`);
  }
  return settings;
}

export function loadModels(packageRoot: string, requestedChannel?: string): EffectiveModels {
  const defaults = JSON.parse(readFileSync(join(packageRoot, "runtime.json"), "utf8"));
  if (defaults.schema !== 1 || !/^\d+\.\d+\.\d+$/.test(defaults.pi?.version)
    || !validChoice(defaults.pi) || !validChoice(defaults.worker)) throw new Error("runtime.json inválido");
  const path = modelsPath(packageRoot, requestedChannel);
  const settings = readSettings(path);
  return {
    version: defaults.pi.version,
    principal: settings.agents.principal ?? { model: defaults.pi.model, thinking: defaults.pi.thinking },
    worker: settings.agents.worker ?? { model: defaults.worker.model, thinking: defaults.worker.thinking },
    path,
    overridden: (["principal", "worker"] as const).filter((role) => role in settings.agents),
  };
}

export function saveModelChoice(packageRoot: string, role: Role, choice: ModelChoice | null, requestedChannel?: string): string {
  if (choice !== null && !validChoice(choice)) throw new Error(`modelo o esfuerzo inválido: ${role}`);
  const path = modelsPath(packageRoot, requestedChannel);
  const settings = readSettings(path);
  if (choice === null) delete settings.agents[role];
  else settings.agents[role] = choice;
  if (!existsSync(path) && choice === null) return path;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return path;
}

if (import.meta.main) {
  try {
    const effective = loadModels(process.argv[2], process.argv[3]);
    console.log([effective.version, effective.principal.model, effective.principal.thinking,
      effective.worker.model, effective.worker.thinking].join("\t"));
  } catch (error) {
    console.error(`[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 64;
  }
}
