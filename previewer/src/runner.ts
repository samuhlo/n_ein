// =============================================================================
// [FLOW] AGENTE REVISOR SIN INTERFAZ
// El mismo Pi fijado de n_ein, en modo `-p --mode json`, con las herramientas
// justas para leer, ejecutar tests y escribir sondas dentro de la copia. La
// guardia y la copia sin remotos impiden que toque el repositorio de Samu.
// =============================================================================

import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { langDirective, loadLang } from "../../pi-package/lang.ts";
import { channelDir, loadModels } from "../../pi-package/models.ts";
import type { Usage } from "./store.ts";

export type AgentRequest = {
  /** Copia de revisión: el agente trabaja aquí y en ningún otro sitio. */
  cwd: string;
  /** Repositorio de Samu; la guardia bloquea cualquier comando que lo nombre. */
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

export function piRunner(packageRoot: string): AgentRunner {
  return async (request) => {
    if (!request.model.includes("/") || request.model.startsWith("nein/"))
      throw new Error(`el revisor necesita un modelo físico proveedor/modelo, no ${request.model}`);
    const home = process.env.N_EIN_HOME || join(homedir(), ".n_ein");
    const pi = process.env.N_EIN_PI_BIN || join(home, "runtimes/pi", loadModels(packageRoot).version, "bin/pi");
    mkdirSync(request.runDir, { recursive: true, mode: 0o700 });

    // BLINDAJE -> La copia necesita su propio índice: el del original describe otros bytes.
    const indexer = join(packageRoot, "bin/n-ein-codegraph");
    spawnSync(indexer, [], { cwd: request.cwd, stdio: ["ignore", "ignore", "inherit"], timeout: INDEX_TIMEOUT_MS });
    const codegraph = spawnSync(indexer, ["--bin"], { cwd: request.cwd, encoding: "utf8" }).stdout?.trim() ?? "";

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
    const args = [
      "-p", "--mode", "json",
      "--no-extensions", "--no-skills", "--no-themes", "--no-prompt-templates",
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

    const events = createWriteStream(join(request.runDir, "events.jsonl"));
    const stderr = createWriteStream(join(request.runDir, "stderr.log"));
    const lines: string[] = [];
    let pending = "";
    const child = spawn(pi, args, { cwd: request.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    child.stdout.on("data", (chunk: Buffer) => {
      events.write(chunk);
      pending += chunk.toString("utf8");
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      lines.push(...parts);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.write(chunk));

    let stopped: string | null = null;
    // BLINDAJE -> Pi lanza procesos (tests, sondas): se para el grupo entero, no solo Pi.
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

    const result = summarizeEvents(lines);
    if (stopped) return { ...result, error: stopped };
    if (code !== 0 && !result.error) return { ...result, error: `pi terminó con código ${code}; detalle en ${join(request.runDir, "stderr.log")}` };
    return result;
  };
}
