// =============================================================================
// [FLOW] TRABAJADOR CONFIGURADO
// Un proceso Pi por encargo: contexto nuevo, mismo proyecto y hogar aislado.
// =============================================================================

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { loadModels } from "../models.ts";

type Mode = "explore" | "work" | "review";
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
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const launcher = resolve(packageRoot, "bin/n-ein-dev");

function taskPrompt(mode: Mode, task: string, acceptance: string, knownFailures?: string): string {
  const boundary = mode === "work"
    ? "Puedes investigar, editar y ejecutar checks dentro del alcance autorizado."
    : "Solo lectura. No edites archivos ni ejecutes comandos que escriban.";
  return [
    `Encargo delegado (${mode}). ${boundary}`,
    `Resultado esperado y alcance: ${task}`,
    `Aceptación observable: ${acceptance}`,
    knownFailures ? `Fallos conocidos de la base, no exenciones generales: ${knownFailures}` : "",
    mode === "work" ? "Deja los cambios sin commitear y sin tocar WORK.md: el agente principal los revisa e integra." : "",
    "Devuelve resultado completo o parcial, archivos cambiados, comandos y resultados observados, discrepancias y pendiente. No publiques ni amplíes el alcance.",
  ].filter(Boolean).join("\n\n");
}

function readText(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content;
  return content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

function consumeEvent(line: string, run: Run, commandsById: Map<string, Command>, modelName: string): string | undefined {
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
      if (typeof usage.cost?.total === "number") {
        run.usage.catalogEstimateUsd = (run.usage.catalogEstimateUsd ?? 0) + usage.cost.total;
      }
    }
    return `${modelName}: turno ${run.stopReason ?? "en curso"}`;
  }

  if (event.type === "tool_execution_end" && event.toolName === "bash") {
    const command = commandsById.get(event.toolCallId);
    if (!command) return undefined;
    const output = readText(event.result);
    const code = output.match(/Command exited with code (\d+)/);
    command.exitCode = event.isError ? (code ? Number(code[1]) : null) : 0;
    command.output = output.slice(0, OUTPUT_LIMIT);
    return `${modelName}: $ ${command.command.slice(0, 60)} → ${command.exitCode ?? "error"}`;
  }
  if (event.type === "tool_execution_end") return `${modelName}: ${event.toolName} ${event.isError ? "falló" : "terminó"}`;
  return undefined;
}

export default function (pi: ExtensionAPI) {
  // BLINDAJE -> El hijo no recibe otra herramienta con la que crear nietos.
  if (process.env.N_EIN_WORKER_CHILD === "1") return;
  let active = false;

  pi.registerTool({
    name: "n_ein_worker",
    label: "Trabajador n_ein",
    description: "Delega un encargo acotado al modelo configurado para este trabajador. Usa work para implementar, explore para investigar y review para revisar. Espera el resultado y contrasta diff y evidencia antes de aceptarlo.",
    parameters: Type.Object({
      mode: Type.Union([Type.Literal("explore"), Type.Literal("work"), Type.Literal("review")]),
      task: Type.String({ description: "Resultado esperado, alcance y referencias pertinentes" }),
      acceptance: Type.String({ description: "Comportamiento o comprobaciones que demostrarían el resultado" }),
      knownFailures: Type.Optional(Type.String({ description: "Fallos concretos ya presentes y comando que los reproduce" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (active) return { content: [{ type: "text", text: "[WARN] :: WORKER_BUSY :: Hay otro trabajador activo en este árbol." }] };
      let selected;
      try {
        selected = loadModels(packageRoot).worker;
      } catch (error) {
        return { content: [{ type: "text", text: `[ERR] :: MODELS_BAD :: reason: ${error instanceof Error ? error.message : String(error)}` }] };
      }
      const separator = selected.model.indexOf("/");
      const provider = selected.model.slice(0, separator);
      const modelName = selected.model.slice(separator + 1);
      active = true;

      const mode = params.mode as Mode;
      const run: Run = {
        finalText: "",
        commands: [],
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, catalogEstimateUsd: null },
      };
      const commandsById = new Map<string, Command>();
      const args = ["--mode", "json", "--print", "--no-session", "--model", selected.model, "--thinking", selected.thinking];
      if (mode !== "work") args.push("--tools", "read,grep,find,ls,codegraph_explore");
      args.push(taskPrompt(mode, params.task, params.acceptance, params.knownFailures));

      let stderr = "";
      let aborted = false;
      let closed = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        const exitCode = await new Promise<number>((resolveExit) => {
          const child = spawn(launcher, args, {
            cwd: ctx.cwd,
            env: { ...process.env, N_EIN_WORKER_CHILD: "1" },
            stdio: ["ignore", "pipe", "pipe"],
            detached: process.platform !== "win32",
          });
          let buffer = "";
          child.stdout.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const progress = consumeEvent(line, run, commandsById, modelName);
              if (progress) {
                onUpdate?.({ content: [{ type: "text", text: progress }] });
              }
            }
          });
          child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4000); });
          child.on("error", (error) => { stderr = `${stderr}\n${error.message}`.slice(-4000); });
          const killTree = (signalName: "SIGTERM" | "SIGKILL") => {
            // BLINDAJE -> Al cancelar, la herramienta hija no debe seguir escribiendo.
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
            if (buffer.trim()) consumeEvent(buffer, run, commandsById, modelName);
            resolveExit(code ?? 1);
          });
          if (signal?.aborted) stopChild();
          else signal?.addEventListener("abort", stopChild, { once: true });
        });

        const complete = !aborted && exitCode === 0 && run.provider === provider && run.model === modelName && run.stopReason === "stop" && Boolean(run.finalText.trim());
        const status = complete ? "completo" : aborted ? "cancelado" : "parcial o fallido";
        const action = complete ? "COMPLETE" : aborted ? "CANCELLED" : "PARTIAL";
        const header = `[WORK] :: ${action} :: modo: ${mode} | modelo: ${run.provider ?? "desconocido"}/${run.model ?? "desconocido"} | cwd: ${ctx.cwd} | exit: ${exitCode}`;
        const cost = run.usage.catalogEstimateUsd === null ? "desconocida" : `$${run.usage.catalogEstimateUsd.toFixed(4)} (estimación de catálogo, no importe facturado)`;
        const result = [header, run.finalText || "Sin respuesta final.", run.error ? `Error del modelo: ${run.error}` : "", stderr ? `Diagnóstico: ${stderr}` : "", `Uso: ${run.usage.input} entrada | ${run.usage.output} salida | estimación: ${cost}`, `Comandos observados: ${JSON.stringify(run.commands)}`].filter(Boolean).join("\n\n");
        return { content: [{ type: "text", text: result }], details: { status, mode, cwd: ctx.cwd, exitCode, aborted, ...run, stderr } };
      } finally {
        if (killTimer) clearTimeout(killTimer);
        active = false;
      }
    },
  });
}
