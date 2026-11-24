// =============================================================================
// [CORE] MODO DE ACTIVIDAD
// Qué hace el agente, dicho por la herramienta que usa: coding, testing,
// orchestrating… Lo comparten el spinner de Claude, el mensaje de trabajo de
// Pi y la cabecera del TODO en los dos.
//
// POR QUÉ EN INGLÉS -> se pidieron estos nombres tal cual; el resto de la
// interfaz sigue en castellano. Un modo equivocado solo se ve, nunca decide
// nada, así que lo que no se reconoce dice `working` en vez de adivinar.
// =============================================================================

import { record, str } from "./receipt-core.ts";

export type Activity =
  | "exploring" | "coding" | "documenting" | "planning" | "testing" | "building"
  | "committing" | "researching" | "orchestrating" | "reviewing" | "asking" | "running" | "working";

/** Canal del bus de eventos de Pi por el que activity.ts pasa la fase al TODO. */
export const ACTIVITY_EVENT = "n-ein:activity";

// Nombres de Claude y de Pi, en minúscula y sin el prefijo `mcp__servidor__`.
const EXPLORE = new Set(["read", "grep", "glob", "ls", "find", "lsp", "codegraph_explore"]);
const EDIT = new Set(["edit", "write", "multiedit", "notebookedit"]);
const ORCHESTRATE = new Set(["agent", "task", "sendmessage", "nein_team"]);
const PLAN = new Set(["todowrite", "taskcreate", "taskupdate", "enterplanmode", "exitplanmode", "nein_set_task", "nein_escalate"]);
const RESEARCH = new Set(["webfetch", "websearch"]);
const RESEARCH_SERVERS = /context7/;

const TEST_COMMANDS = [
  /\b(bun|npm|pnpm|yarn|npx|bunx)\s+(run\s+)?(test|tests|check|typecheck|lint|e2e|vitest|jest|playwright|tsc)\b/,
  /\b(bun|npm|pnpm|yarn)\s+run\s+(test|e2e|check)[:\w-]*/,
  /\bbun\s+(run\s+)?\S*\btests?\//,
  /\b(vitest|jest|pytest|playwright|mocha|ava|phpunit|rspec)\b/,
  /\bgo\s+(test|vet)\b/,
  /\bcargo\s+(test|clippy|check)\b/,
  /\b(tsc|vue-tsc|eslint|biome|ruff|mypy|golangci-lint|shellcheck|actionlint)\b/,
  /\bnuxi\s+typecheck\b/,
  // Ejecutar un script de pruebas, no leerlo: al principio del comando, tras un separador o tras su intérprete.
  /(^|&&|\|\||;|\b(?:bash|sh|zsh|bun|node|python3?))\s*\S*\bcheck\.sh\b/,
  /(^|&&|\|\||;|\b(?:bash|sh|zsh|bun|node|python3?))\s*\.?\/?tests?\/\S+\.(sh|ts|js|py)\b/,
  /\bclaude\s+plugin\s+(test|validate)\b/,
  /\bmake\s+(test|check|lint)\b/,
];
const COMMIT_COMMANDS = [/\bgit\s+(commit|push|merge|rebase|cherry-pick|tag|switch|checkout|reset|revert|pull|stash|am)\b/, /\bgh\s+(pr|release)\b/];
const BUILD_COMMANDS = [
  /\b(bun|npm|pnpm|yarn)\s+(run\s+)?(build|install|add|i|ci)\b/,
  /\bgo\s+(build|install|mod|generate)\b/,
  /\bcargo\s+build\b/,
  /\bmake\b/,
  /\bdocker\s+(build|compose)\b/,
  /(^|[\s/])build[\w-]*\.sh\b/,
  /\bdrizzle-kit\b/,
];
const READ_ONLY = /^(rg|grep|cat|head|tail|less|ls|find|fd|tree|wc|file|stat|pwd|which|echo|jq|sed -n|git (status|log|diff|show|blame|branch|grep|ls-files|rev-parse))\b/;

function fileActivity(path: string): Activity {
  if (/(^|\/)WORK\.md$/i.test(path)) return "planning";
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)(tests?|__tests__)\//.test(path)) return "testing";
  if (/\.(md|mdx|markdown|txt|rst|adoc)$/i.test(path) || /(^|\/)docs\//.test(path)) return "documenting";
  return "coding";
}

/** Un comando compuesto vale por su parte más significativa: probar pesa más que preparar. */
function commandActivity(command: string): Activity {
  if (TEST_COMMANDS.some((pattern) => pattern.test(command))) return "testing";
  if (COMMIT_COMMANDS.some((pattern) => pattern.test(command))) return "committing";
  if (BUILD_COMMANDS.some((pattern) => pattern.test(command))) return "building";
  const parts = command.split(/&&|\|\||[;|\n]/).map((part) => part.trim().replace(/^(\w+=\S*\s+)+/, "")).filter((part) => part && !/^cd\s/.test(part));
  if (parts.length > 0 && parts.every((part) => READ_ONLY.test(part))) return "exploring";
  return "running";
}

function skillActivity(skill: string): Activity {
  if (/review|previewer|simplify/.test(skill)) return "reviewing";
  if (/research/.test(skill)) return "researching";
  if (/intent|design|spec|tasks|vision|prototype|glossary|plan/.test(skill)) return "planning";
  return "working";
}

export function activityOf(tool: string, input: Record<string, unknown>): Activity {
  const name = tool.toLowerCase();
  const [, server = "", mcpTool = ""] = /^mcp__(.+?)__(.+)$/.exec(name) ?? [];
  const base = mcpTool || name;
  const args = record(input);
  if (EXPLORE.has(base)) return "exploring";
  if (EDIT.has(base)) return fileActivity(str(args.file_path) || str(args.path) || str(args.notebook_path));
  if (base === "bash" || base === "nein_job") return commandActivity(str(args.command));
  if (ORCHESTRATE.has(base)) return "orchestrating";
  if (PLAN.has(base)) return "planning";
  if (RESEARCH.has(base) || RESEARCH_SERVERS.test(server)) return "researching";
  if (base === "askuserquestion" || base === "nein_ask") return "asking";
  if (base === "skill") return skillActivity(str(args.skill) || str(args.name));
  return "working";
}
