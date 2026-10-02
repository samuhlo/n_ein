// =============================================================================
// [FLOW] ROLES DE n_ein
// Tres delegaciones por coste, no por fase: nein-scout busca, nein-worker hace
// y nein-reviewer comprueba. Cada una es un proceso Pi con contexto nuevo y su
// propio modelo (/nein:models). El runtime impone los límites: scout y reviewer
// no escriben; worker solo dentro de sus superficies.
// =============================================================================

import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { loadModels } from "../models.ts";

export type AgentRole = "scout" | "worker" | "reviewer";
type Command = { command: string; exitCode: number | null; output: string };
type Run = {
  provider?: string;
  model?: string;
  stopReason?: string;
  error?: string;
  finalText: string;
  commands: Command[];
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; catalogEstimateUsd: number | null };
};

const OUTPUT_LIMIT = 1200;
const CHILD_GRACE_MS = 5000;
const MAX_READERS = 3;
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const launcher = resolve(packageRoot, "bin/n-ein-dev");

// Herramientas de cada rol: lo que el rol no debe hacer no está a su alcance.
const READ_TOOLS = "read,grep,find,ls,codegraph_explore";
const ROLE_TOOLS: Record<AgentRole, string | undefined> = {
  scout: READ_TOOLS,
  worker: undefined,
  reviewer: `${READ_TOOLS},bash`,
};
const TAG: Record<AgentRole, string> = { scout: "SCOUT", worker: "WORKER", reviewer: "REVIEW" };

/** Glob de superficie a expresión regular: `**` cruza directorios, `*` y `?` no. */
export function surfacePattern(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      source += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  // Un directorio cubre todo lo que cuelga de él.
  return new RegExp(`^${source}(?:/.*)?$`);
}

/** Una superficie es una ruta o glob relativo y concreto: nunca la raíz entera ni algo fuera del repo. */
export function validSurface(surface: string): boolean {
  const value = surface.trim().replace(/\/+$/, "");
  return value.length > 0 && !isAbsolute(value) && !value.split("/").includes("..")
    && !["", ".", "*", "**", "**/*"].includes(value);
}

export function insideSurfaces(file: string, surfaces: string[]): boolean {
  return surfaces.some((surface) => surfacePattern(surface.trim().replace(/\/+$/, "")).test(file));
}

function changedFiles(cwd: string): Set<string> {
  try {
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
    return new Set(status.split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").pop()!.trim()));
  } catch {
    return new Set();
  }
}

function taskPrompt(role: AgentRole, params: Record<string, unknown>): string {
  if (role === "scout") {
    return [
      "You are nein-scout, a read-only explorer. Use codegraph_explore first, then targeted reads with line ranges.",
      `Question: ${params.question}`,
      params.focus ? `Where to look first: ${params.focus}` : "",
      "Answer in at most ~2k tokens: the answer, evidence as path:line, and what you could not establish. Report facts; leave decisions to the main agent.",
    ].filter(Boolean).join("\n\n");
  }
  if (role === "reviewer") {
    return [
      "You are nein-reviewer. Review only: leave every file as it is. You may run checks and tests with bash to gather evidence.",
      `What to review: ${params.target}`,
      `Review against: ${params.criteria}`,
      params.checks ? `Checks to run: ${params.checks}` : "",
      "Report findings per file, each with its severity (blocking / should fix / judgement call) and the quoted line; then the checks you ran and their observed results. Under 400 words.",
    ].filter(Boolean).join("\n\n");
  }
  return [
    "You are nein-worker. Implement the task below; investigate and think within its scope.",
    `Edit only inside these surfaces: ${(params.surfaces as string[]).join(", ")}`,
    `Task: ${params.task}`,
    `Observable acceptance: ${params.acceptance}`,
    params.knownFailures ? `Known baseline failures (not general exemptions): ${params.knownFailures}` : "",
    "Leave your changes uncommitted and WORK.md untouched: the main agent reviews and integrates them.",
    "Return: complete or partial result, files changed, commands run with observed results, discrepancies and what is pending. Keep to the authorized scope.",
  ].filter(Boolean).join("\n\n");
}

function readText(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content;
  return content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

function consumeEvent(line: string, run: Run, commandsById: Map<string, Command>, label: string): string | undefined {
  let event: any;
  try {
    event = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (event.type === "message_end" && event.message?.role === "assistant") {
    const message = event.message;
    run.provider = message.provider ?? run.provider;
    run.model = message.model ?? run.model;
    run.stopReason = message.stopReason ?? run.stopReason;
    run.error = message.errorMessage ?? run.error;
    const text = message.content?.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
    if (text) run.finalText = text;
    for (const part of message.content ?? []) {
      if (part.type !== "toolCall" || part.name !== "bash") continue;
      const command: Command = { command: String(part.arguments?.command ?? ""), exitCode: null, output: "" };
      commandsById.set(part.id, command);
      run.commands.push(command);
    }
    const usage = message.usage;
    if (usage) {
      run.usage.input += usage.input ?? 0;
      run.usage.output += usage.output ?? 0;
      run.usage.cacheRead += usage.cacheRead ?? 0;
      run.usage.cacheWrite += usage.cacheWrite ?? 0;
      if (typeof usage.cost?.total === "number") run.usage.catalogEstimateUsd = (run.usage.catalogEstimateUsd ?? 0) + usage.cost.total;
    }
    return `${label}: turno ${run.stopReason ?? "en curso"}`;
  }
  if (event.type === "tool_execution_end" && event.toolName === "bash") {
    const command = commandsById.get(event.toolCallId);
    if (!command) return undefined;
    const output = readText(event.result);
    const code = output.match(/Command exited with code (\d+)/);
    command.exitCode = event.isError ? (code ? Number(code[1]) : null) : 0;
    command.output = output.slice(0, OUTPUT_LIMIT);
    return `${label}: $ ${command.command.slice(0, 60)} → ${command.exitCode ?? "error"}`;
  }
  if (event.type === "tool_execution_end") return `${label}: ${event.toolName} ${event.isError ? "falló" : "terminó"}`;
  return undefined;
}

// [FLOW] Dentro del proceso hijo: el rol y sus superficies llegan por entorno y se imponen en cada escritura.
function guardChild(pi: ExtensionAPI): void {
  const role = process.env.N_EIN_ROLE as AgentRole | undefined;
  if (!role) return;
  let surfaces: string[] = [];
  try { surfaces = JSON.parse(process.env.N_EIN_SURFACES ?? "[]"); } catch { surfaces = []; }
  pi.on("tool_call", (event: any, ctx: any) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return undefined;
    if (role !== "worker") return { block: true, reason: `nein-${role} es de solo lectura.` };
    const path = String(event.input?.path ?? "");
    const file = relative(ctx?.cwd ?? process.cwd(), resolve(ctx?.cwd ?? process.cwd(), path));
    if (insideSurfaces(file, surfaces)) return undefined;
    return { block: true, reason: `${file} está fuera de las superficies de edición: ${surfaces.join(", ")}` };
  });
}

export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_WORKER_CHILD === "1") {
    guardChild(pi);
    return;
  }
  let writerActive = false;
  let readers = 0;

  async function delegate(role: AgentRole, params: Record<string, unknown>, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
    if (role === "worker" && writerActive) return { content: [{ type: "text", text: "[WARN] :: WORKER_BUSY :: Ya hay un nein-worker escribiendo en este árbol." }] };
    if (role !== "worker" && readers >= MAX_READERS) return { content: [{ type: "text", text: `[WARN] :: AGENTS_BUSY :: Ya hay ${MAX_READERS} delegaciones de solo lectura activas.` }] };
    if (role === "worker") {
      const surfaces = params.surfaces as string[];
      const bad = surfaces.filter((surface) => !validSurface(surface));
      if (surfaces.length === 0 || bad.length) {
        return { content: [{ type: "text", text: `[ERR] :: SURFACES_BAD :: values: ${bad.join(", ") || "vacío"} | fix: rutas o globs relativos y concretos del repo` }] };
      }
    }
    let selected;
    try {
      selected = loadModels(packageRoot)[role];
    } catch (error) {
      return { content: [{ type: "text", text: `[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}` }] };
    }
    const label = `nein-${role}`;
    const separator = selected.model.indexOf("/");
    const provider = selected.model.slice(0, separator);
    const modelName = selected.model.slice(separator + 1);
    if (role === "worker") writerActive = true; else readers++;

    const before = changedFiles(ctx.cwd);
    const run: Run = { finalText: "", commands: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, catalogEstimateUsd: null } };
    const commandsById = new Map<string, Command>();
    const args = ["--mode", "json", "--print", "--no-session", "--model", selected.model, "--thinking", selected.thinking];
    if (ROLE_TOOLS[role]) args.push("--tools", ROLE_TOOLS[role]!);
    args.push(taskPrompt(role, params));

    let stderr = "";
    let aborted = false;
    let closed = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const exitCode = await new Promise<number>((resolveExit) => {
        const child = spawn(launcher, args, {
          cwd: ctx.cwd,
          env: { ...process.env, N_EIN_WORKER_CHILD: "1", N_EIN_ROLE: role, N_EIN_SURFACES: JSON.stringify(params.surfaces ?? []) },
          stdio: ["ignore", "pipe", "pipe"],
          detached: process.platform !== "win32",
        });
        let buffer = "";
        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const progress = consumeEvent(line, run, commandsById, label);
            if (progress) onUpdate?.({ content: [{ type: "text", text: progress }] });
          }
        });
        child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4000); });
        child.on("error", (error) => { stderr = `${stderr}\n${error.message}`.slice(-4000); });
        const killTree = (signalName: "SIGTERM" | "SIGKILL") => {
          // BLINDAJE -> Al cancelar, el hijo y sus herramientas no deben seguir escribiendo.
          if (process.platform !== "win32" && child.pid) {
            try { process.kill(-child.pid, signalName); return; } catch { /* proceso ya terminado */ }
          }
          child.kill(signalName);
        };
        const stopChild = () => {
          if (closed || aborted) return;
          aborted = true;
          killTree("SIGTERM");
          killTimer = setTimeout(() => { if (!closed) killTree("SIGKILL"); }, CHILD_GRACE_MS);
        };
        child.on("close", (code) => {
          closed = true;
          signal?.removeEventListener("abort", stopChild);
          if (buffer.trim()) consumeEvent(buffer, run, commandsById, label);
          resolveExit(code ?? 1);
        });
        if (signal?.aborted) stopChild();
        else signal?.addEventListener("abort", stopChild, { once: true });
      });

      // Lo que dijo el rol se contrasta con Git: un resumen no es una prueba.
      const after = changedFiles(ctx.cwd);
      const touched = [...after].filter((file) => !before.has(file));
      const breaches = role === "worker"
        ? touched.filter((file) => !insideSurfaces(file, params.surfaces as string[]))
        : touched;
      const complete = !aborted && exitCode === 0 && run.provider === provider && run.model === modelName && run.stopReason === "stop" && Boolean(run.finalText.trim());
      const status = complete ? "completo" : aborted ? "cancelado" : "parcial o fallido";
      const action = complete ? "COMPLETE" : aborted ? "CANCELLED" : "PARTIAL";
      const header = `[${TAG[role]}] :: ${action} :: rol: ${label} | modelo: ${run.provider ?? "desconocido"}/${run.model ?? "desconocido"} | cwd: ${ctx.cwd} | exit: ${exitCode}`;
      const cost = run.usage.catalogEstimateUsd === null ? "desconocida" : `$${run.usage.catalogEstimateUsd.toFixed(4)} (estimación de catálogo, no importe facturado)`;
      const breachLine = breaches.length
        ? `[WARN] :: ${role === "worker" ? "SURFACE_BREACH" : "READONLY_BREACH"} :: files: ${breaches.join(", ")}`
        : "";
      const result = [header, breachLine, run.finalText || "Sin respuesta final.", run.error ? `Error del modelo: ${run.error}` : "", stderr ? `Diagnóstico: ${stderr}` : "",
        role === "worker" ? `Archivos cambiados según Git: ${touched.join(", ") || "ninguno"}` : "",
        `Uso: ${run.usage.input} entrada | ${run.usage.output} salida | estimación: ${cost}`, `Comandos observados: ${JSON.stringify(run.commands)}`].filter(Boolean).join("\n\n");
      return { content: [{ type: "text", text: result }], details: { status, role, cwd: ctx.cwd, exitCode, aborted, touched, breaches, ...run, stderr } };
    } finally {
      if (killTimer) clearTimeout(killTimer);
      if (role === "worker") writerActive = false; else readers--;
    }
  }

  pi.registerTool({
    name: "nein_scout",
    label: "nein-scout",
    description: "Delegate read-only exploration to nein-scout (fast, cheap model, fresh context, CodeGraph first). Use when answering needs more than one batch of reads (over ~3 reads or ~10k tokens) or several lookups in a row. Returns a short answer with path:line evidence. Several scouts can run at once.",
    parameters: Type.Object({
      question: Type.String({ description: "What to find out, naming the symbols, files or behaviour involved" }),
      focus: Type.Optional(Type.String({ description: "Where to look first, if known" })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) { return delegate("scout", params as Record<string, unknown>, signal, onUpdate, ctx); },
  });

  pi.registerTool({
    name: "nein_worker",
    label: "nein-worker",
    description: "Delegate a bounded implementation to nein-worker (its own model, fresh context). Use when the change touches two or more non-trivial files, or when doing it yourself would flood your context. Edits are blocked outside the given surfaces. One worker at a time; wait for it before writing in the same tree, then check its diff and evidence.",
    parameters: Type.Object({
      task: Type.String({ description: "Expected result, scope and relevant references" }),
      surfaces: Type.Array(Type.String(), { description: "Repository-relative paths or globs the worker may edit, as narrow as possible (never the repo root)" }),
      acceptance: Type.String({ description: "Behaviour or checks that would prove the result" }),
      knownFailures: Type.Optional(Type.String({ description: "Concrete pre-existing failures and the command that reproduces them" })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) { return delegate("worker", params as Record<string, unknown>, signal, onUpdate, ctx); },
  });

  pi.registerTool({
    name: "nein_reviewer",
    label: "nein-reviewer",
    description: "Delegate a review or verification to nein-reviewer (its own model, fresh context, cannot edit files). Use to review a commit or diff against WORK.md and the repo's standards, or to run a full suite or build with bounded output. Several reviewers can run at once.",
    parameters: Type.Object({
      target: Type.String({ description: "What to review: a diff command such as `git diff <base>...HEAD`, a commit, or files" }),
      criteria: Type.String({ description: "What to review against: WORK.md criteria, standards files, the spec" }),
      checks: Type.Optional(Type.String({ description: "Commands to run as evidence" })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) { return delegate("reviewer", params as Record<string, unknown>, signal, onUpdate, ctx); },
  });
}
