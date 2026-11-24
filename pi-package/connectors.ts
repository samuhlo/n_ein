// =============================================================================
// [DATA] CONECTORES DE CLAUDE.AI EN n_ein
// Claude Code trae a cada sesión los conectores de la cuenta de claude.ai, y
// cada uno declara sus herramientas en todos los turnos: Vercel y Neon suman
// cientos. n_ein deja Context7 para consultar documentación y apaga el resto;
// un proyecto enciende los suyos con un nombre por línea en `.n_ein/connectors`.
// El bloqueo viaja en `--settings` de bin/n-ein-claude-dev: ~/.claude no se toca
// y ningún otro ajuste lo anula. El puente de Pi ya arranca Claude sin ellos.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ConnectorPolicy = { denied: string[]; kept: string[] };

const PREFIX = "claude.ai ";
// Documentación al día en cualquier proyecto, por dos herramientas.
const DEFAULT_KEEP = ["Context7"];
export const PROJECT_FILE = ".n_ein/connectors";

const key = (name: string): string => (name.toLowerCase().startsWith(PREFIX) ? name.slice(PREFIX.length) : name).trim().toLowerCase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Un archivo ausente es lo normal en un hogar nuevo; uno ilegible se avisa y no apaga nada por error.
function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`[WARN] :: CONN_SKIP :: path: ${path} | reason: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Los conectores que conoce el hogar de Claude: los que conectó alguna vez y los que esperan login.
 * Claude no publica esta lista; si cambia su registro, no se conoce ninguno y la sesión arranca como antes.
 */
export function knownConnectors(claudeDir: string): string[] {
  const names = new Set<string>();
  const state = readJson(join(claudeDir, ".claude.json"));
  const connected = isRecord(state) ? state.claudeAiMcpEverConnected : undefined;
  if (Array.isArray(connected)) for (const name of connected) if (typeof name === "string") names.add(name);
  const pending = readJson(join(claudeDir, "mcp-needs-auth-cache.json"));
  if (isRecord(pending)) for (const name of Object.keys(pending)) names.add(name);
  return [...names].filter((name) => name.startsWith(PREFIX)).sort();
}

/** Los que el proyecto enciende: un nombre por línea, `#` para comentarios. */
export function projectConnectors(root: string): string[] {
  const path = join(root, PROJECT_FILE);
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
  } catch (error) {
    console.error(`[WARN] :: CONN_SKIP :: path: ${path} | reason: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function connectorPolicy(claudeDir: string, root: string): ConnectorPolicy {
  const keep = new Set([...DEFAULT_KEEP, ...projectConnectors(root)].map(key));
  const known = knownConnectors(claudeDir);
  return { denied: known.filter((name) => !keep.has(key(name))), kept: known.filter((name) => keep.has(key(name))) };
}

/** Lo que recibe el agente: qué está apagado y cómo encenderlo, para responder sin adivinar. */
export function connectorNote(policy: ConnectorPolicy): string {
  if (!policy.denied.length) return "";
  return `claude.ai connectors turned off in this n_ein session: ${policy.denied.join(", ")}. A project turns one on by listing its name on its own line in \`${PROJECT_FILE}\` at the repository root; the change applies from the next session.`;
}
