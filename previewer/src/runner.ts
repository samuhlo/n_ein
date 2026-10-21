// =============================================================================
// [FLOW] AGENTE REVISOR SIN INTERFAZ
// El mismo Pi fijado de n_ein, en modo `-p --mode json`, con las herramientas
// justas para leer, ejecutar tests y escribir sondas dentro de la copia. La
// guardia y la copia sin remotos impiden que toque el repositorio del usuario.
// Los modelos de Claude van por Claude Code (`claude-code/<modelo>`): la
// suscripción de Claude solo se usa desde Claude Code, y allí el proceso
// entero corre dentro del aislamiento del sistema.
// =============================================================================

import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { langDirective, loadLang } from "../../pi-package/lang.ts";
import { channelDir, loadModels } from "../../pi-package/models.ts";
import { sandboxFor } from "./sandbox.ts";
import type { Usage } from "./store.ts";

export type AgentRequest = {
  /** Copia de revisión: el agente trabaja aquí y en ningún otro sitio. */
  cwd: string;
  /** Repositorio del usuario; la guardia bloquea cualquier comando que lo nombre. */
  origin: string;
  prompt: string;
  runDir: string;
  model: string;
  thinking: string;
  signal: AbortSignal;
  timeoutMs: number;
  /** Con aislamiento del sistema puede ejecutar tests y sondas; sin él, solo lee. */
  execute: boolean;
};

export type AgentResult = { text: string; usage: Usage; error: string | null };
export type AgentRunner = (request: AgentRequest) => Promise<AgentResult>;

export const CLAUDE_CODE = "claude-code/";
const READ_TOOLS = "read,grep,find,ls";
const PROBE_TOOLS = "bash,write,edit";
const KILL_GRACE_MS = 5_000;
const INDEX_TIMEOUT_MS = 5 * 60_000;

type Event = Record<string, unknown>;
const isRecord = (value: unknown): value is Event => typeof value === "object" && value !== null && !Array.isArray(value);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Texto final del agente, coste acumulado y error de parada, a partir de los eventos JSON de Pi. */
export function summarizeEvents(lines: readonly string[]): AgentResult {
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, usd: 0 };
  let text = "";
  let error: string | null = null;
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event) || event.type !== "message_end" || !isRecord(event.message) || event.message.role !== "assistant") continue;
    const message = event.message;
    if (isRecord(message.usage)) {
      usage.input += num(message.usage.input);
      usage.output += num(message.usage.output);
      usage.cacheRead += num(message.usage.cacheRead);
      if (isRecord(message.usage.cost)) usage.usd += num(message.usage.cost.total);
    }
    const parts = Array.isArray(message.content) ? message.content : [];
    const said = parts.flatMap((part) => (isRecord(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : [])).join("\n");
    if (said.trim()) text = said;
    error = message.stopReason === "error" ? String(message.errorMessage ?? "error del modelo") : null;
  }
  return { text, usage, error };
}

/** Lo mismo desde el `stream-json` de Claude Code: el evento `result` trae el texto final y el coste. */
export function summarizeClaudeEvents(lines: readonly string[]): AgentResult {
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, usd: 0 };
  let text = "";
  let error: string | null = "Claude Code terminó sin resultado";
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event) || event.type !== "result") continue;
    if (isRecord(event.usage)) {
      usage.input = num(event.usage.input_tokens);
      usage.output = num(event.usage.output_tokens);
      usage.cacheRead = num(event.usage.cache_read_input_tokens);
    }
    usage.usd = num(event.total_cost_usd);
    text = typeof event.result === "string" ? event.result : "";
    error = event.is_error === true || event.subtype !== "success" ? String(event.result || event.subtype || "error de Claude Code") : null;
  }
  return { text, usage, error };
}

type Spawned = { lines: string[]; code: number | null; stopped: string | null };

/** Arranca el agente en su propio grupo, guarda sus eventos y lo para entero al cancelar o agotar el tiempo. */
async function runAgent(file: string, args: string[], request: AgentRequest, env: NodeJS.ProcessEnv, input?: string): Promise<Spawned> {
  const events = createWriteStream(join(request.runDir, "events.jsonl"));
  const stderr = createWriteStream(join(request.runDir, "stderr.log"));
  const lines: string[] = [];
  let pending = "";
  const child = spawn(file, args, { cwd: request.cwd, env, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], detached: true });
  if (input !== undefined) child.stdin?.end(input);
  if (!child.stdout || !child.stderr) throw new Error(`${file} arrancó sin salida`);
  child.stdout.on("data", (chunk: Buffer) => {
    events.write(chunk);
    pending += chunk.toString("utf8");
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    lines.push(...parts);
  });
  child.stderr.on("data", (chunk: Buffer) => stderr.write(chunk));

  let stopped: string | null = null;
  // BLINDAJE -> El agente lanza procesos (tests, sondas): se para el grupo entero, no solo el agente.
  const stop = (reason: string): void => {
    if (stopped || child.pid === undefined) return;
    stopped = reason;
    const group = -child.pid;
    try {
      process.kill(group, "SIGTERM");
    } catch {
      return;
    }
    setTimeout(() => {
      try {
        process.kill(group, "SIGKILL");
      } catch {
        // Ya terminó.
      }
    }, KILL_GRACE_MS).unref();
  };
  const timer = setTimeout(() => stop(`tiempo agotado (${Math.round(request.timeoutMs / 60_000)} min)`), request.timeoutMs);
  const onAbort = (): void => stop("cancelada");
  if (request.signal.aborted) onAbort();
  request.signal.addEventListener("abort", onAbort, { once: true });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  }).finally(() => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
  });
  if (pending) lines.push(pending);
  await Promise.all([new Promise((done) => events.end(done)), new Promise((done) => stderr.end(done))]);
  return { lines, code, stopped };
}

/** La copia necesita su propio índice: el del original describe otros bytes. Devuelve el binario o "". */
function indexCopy(packageRoot: string, cwd: string): string {
  const indexer = join(packageRoot, "bin/n-ein-codegraph");
  spawnSync(indexer, [], { cwd, stdio: ["ignore", "ignore", "inherit"], timeout: INDEX_TIMEOUT_MS });
  return spawnSync(indexer, ["--bin"], { cwd, encoding: "utf8" }).stdout?.trim() ?? "";
}

function finish(name: string, spawned: Spawned, result: AgentResult, runDir: string): AgentResult {
  if (spawned.stopped) return { ...result, error: spawned.stopped };
  if (spawned.code !== 0 && !result.error) return { ...result, error: `${name} terminó con código ${spawned.code}; detalle en ${join(runDir, "stderr.log")}` };
  return result;
}

export function piRunner(packageRoot: string): AgentRunner {
  return async (request) => {
    if (!request.model.includes("/") || request.model.startsWith("nein/"))
      throw new Error(`el revisor necesita un modelo físico proveedor/modelo, no ${request.model}`);
    const home = process.env.N_EIN_HOME || join(homedir(), ".n_ein");
    const pi = process.env.N_EIN_PI_BIN || join(home, "runtimes/pi", loadModels(packageRoot).version, "bin/pi");
    mkdirSync(request.runDir, { recursive: true, mode: 0o700 });

    const codegraph = indexCopy(packageRoot, request.cwd);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PI_CODING_AGENT_DIR: process.env.N_EIN_AGENT_DIR || join(channelDir(packageRoot), "pi-agent"),
      PI_SKIP_VERSION_CHECK: "1",
      PI_OFFLINE: "1",
      DO_NOT_TRACK: "1",
      N_EIN_PREVIEWER_COPY: request.cwd,
      N_EIN_PREVIEWER_ORIGIN: request.origin,
    };
    if (codegraph) env.N_EIN_CODEGRAPH_BIN = codegraph;
    else delete env.N_EIN_CODEGRAPH_BIN;
    // BLINDAJE -> AGENTS.md, CLAUDE.md y la configuración local los escribe la rama revisada: son datos, no instrucciones.
    const args = [
      "-p", "--mode", "json",
      "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates", "--no-context-files", "--no-approve",
      "--tools", [READ_TOOLS, request.execute ? PROBE_TOOLS : "", codegraph ? "codegraph_explore" : ""].filter(Boolean).join(","),
      "-e", join(packageRoot, "previewer/agent/guard.ts"),
      "-e", join(packageRoot, "pi-package/extensions/codegraph.ts"),
      "--model", request.model, "--thinking", request.thinking,
      "--session", join(request.runDir, "session.jsonl"),
      "--append-system-prompt", join(packageRoot, "pi-package/persona.md"),
      "--append-system-prompt", join(packageRoot, "previewer/agent/reviewer.md"),
      "--append-system-prompt", langDirective(loadLang(packageRoot)),
      request.prompt,
    ];

    const spawned = await runAgent(pi, args, request, env);
    return finish("pi", spawned, summarizeEvents(spawned.lines), request.runDir);
  };
}

const EFFORT: Record<string, string> = { off: "low", minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh" };

/** Claude de n_ein: override, la copia fijada en runtimes/claude o el del sistema, como el lanzador. */
function claudeBinary(packageRoot: string): string {
  if (process.env.N_EIN_CLAUDE_BIN) return process.env.N_EIN_CLAUDE_BIN;
  const config: { claude?: { version?: string } } = JSON.parse(readFileSync(join(packageRoot, "runtime.json"), "utf8"));
  const managed = join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), "runtimes/claude", config.claude?.version ?? "", "bin/claude");
  return config.claude?.version && existsSync(managed) ? managed : "claude";
}

export function claudeRunner(packageRoot: string): AgentRunner {
  return async (request) => {
    const model = request.model.slice(CLAUDE_CODE.length);
    if (!request.model.startsWith(CLAUDE_CODE) || !model) throw new Error(`Claude Code necesita claude-code/<modelo>, no ${request.model}`);
    mkdirSync(request.runDir, { recursive: true, mode: 0o700 });
    const configDir = process.env.N_EIN_CLAUDE_DIR || join(channelDir(packageRoot), "claude");
    mkdirSync(configDir, { recursive: true });
    const codegraph = indexCopy(packageRoot, request.cwd);
    // BLINDAJE -> El proceso entero va aislado: solo escribe en la copia, temporales, cachés y su propia configuración.
    const sandbox = sandboxFor(request.cwd, request.origin, [configDir]);
    const execute = request.execute && sandbox.kind !== "none";
    const tools = ["Read", "Grep", "Glob", ...(execute ? ["Bash", "Write", "Edit"] : []), ...(codegraph ? ["mcp__codegraph__codegraph_explore"] : [])];
    const system = [readFileSync(join(packageRoot, "pi-package/persona.md"), "utf8"), readFileSync(join(packageRoot, "previewer/agent/reviewer.md"), "utf8"), langDirective(loadLang(packageRoot))].join("\n\n");
    // BLINDAJE -> Sin fuentes de ajustes no entran CLAUDE.md, hooks ni plugins de la rama revisada ni del usuario.
    const args = [
      "-p", "--output-format", "stream-json", "--verbose", "--setting-sources", "", "--strict-mcp-config",
      "--no-session-persistence", "--disable-slash-commands", "--model", model, "--effort", EFFORT[request.thinking] ?? "high",
      `--tools=${tools.join(",")}`, `--allowedTools=${tools.join(",")}`, "--append-system-prompt", system,
      ...(codegraph ? ["--mcp-config", JSON.stringify({ mcpServers: { codegraph: { type: "stdio", command: codegraph, args: ["serve", "--mcp"], env: { DO_NOT_TRACK: "1" } } } })] : []),
    ];
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: configDir, DISABLE_AUTOUPDATER: "1", DO_NOT_TRACK: "1" };
    const { file, args: wrapped } = execute ? sandbox.run(claudeBinary(packageRoot), args) : { file: claudeBinary(packageRoot), args };
    // El prompt va por stdin: los flags variádicos de Claude Code se comerían un argumento final.
    const spawned = await runAgent(file, wrapped, request, env, request.prompt);
    return finish("claude", spawned, summarizeClaudeEvents(spawned.lines), request.runDir);
  };
}
