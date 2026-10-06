// =============================================================================
// [FLOW] CONTEXTO CON PRESUPUESTO
// Cada turno vuelve a leer de la caché todo lo anterior: lo explorado al
// principio se paga de nuevo en cada paso del método (TDD, commits, WORK.md).
// En dos fronteras, esos resultados se sustituyen por una nota de una línea con
// `context_edit` de Pi; el historial, la interfaz y la contabilidad no cambian.
//   · primera escritura   -> CodeGraph y búsquedas: ya sirvieron para decidir.
//   · commit entre tareas -> lecturas recuperables: Git, WORK.md y los archivos
//                            guardan el estado vigente. Tras el último commit
//                            queda poco por hacer y romper la caché no compensa.
// El commit se reconoce porque HEAD se mueve durante el turno, no por el texto
// del comando: así valen `type(scope): …`, heredocs, redirecciones y scripts.
// Las instrucciones, los errores y las comprobaciones no se retiran.
// =============================================================================

import { execFileSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readWorkDoc, resolveWorkDoc } from "./work-doc";

// Por debajo de esto la nota ahorra poco y romper la caché no compensa.
const MIN_CHARS = 1200;
export const RETIRED_MARK = "[n_ein: retired from context";

// Solo la forma que se lee de la proyección de Pi: así los tests pueden pasarle sesiones grabadas.
type Call = { name: string; arguments?: Record<string, unknown>; status?: string };
type Block = { type: string; id?: string; name?: string; arguments?: Record<string, unknown>; text?: string };
type Message = { role: string; content?: string | readonly Block[]; toolCallId?: string; nestedCalls?: { calls: readonly Call[] }; isError?: boolean };
export type Entry = { sourceEntry: { id: string; type: string }; messages: readonly Message[] };
export type Retirement = { targetId: string; text: string };

// La documentación puede contener decisiones o instrucciones, también fuera de SKILL.md.
const KEEP_PATH = /\.md\b|(?:^|\/)skills\//i;
const READ_ONLY_BASH = /^(rg|grep|find|ls|cat|head|tail|sed -n|wc|tree|pwd|git (status|log|show|diff|grep|ls-files|blame))\b/;

const command = (call?: Call) => String(call?.arguments?.command ?? "");
// Solo comandos simples y visibles. No evaluamos shell ni adivinamos variables o scripts.
function shellCommands(cmd: string): string[][] {
  if (/[$`\\(){}<>]/.test(cmd)) return [];
  const groups: string[][] = [[]];
  let end = 0;
  for (const match of cmd.matchAll(/"[^"\n]*"|'[^'\n]*'|&&|\|\||[;|\n]|[^\s;&|'"\n]+/g)) {
    if (cmd.slice(end, match.index).trim()) return [];
    end = match.index! + match[0].length;
    if (/^(?:&&|\|\||[;|\n])$/.test(match[0])) groups.push([]);
    else groups.at(-1)!.push(match[0].replace(/^(['"])(.*)\1$/, "$2"));
  }
  return cmd.slice(end).trim() ? [] : groups.filter((group) => group.length);
}
const isWrite = (call?: Call) => call?.name === "edit" || call?.name === "write";

// `turn` es el mensaje del asistente que pidió la llamada: las fronteras se cuentan por turnos.
type Item = { id: string; turn: number; call?: Call; nested: readonly Call[]; text: string; isError: boolean };

function items(entries: readonly Entry[]): Item[] {
  const calls = new Map<string, { call: Call; turn: number }>();
  const out: Item[] = [];
  let turn = 0;
  for (const entry of entries) {
    if (entry.sourceEntry.type !== "message") continue;
    for (const message of entry.messages) {
      const blocks = typeof message.content === "string" ? [] : message.content ?? [];
      if (message.role === "assistant") {
        turn++;
        for (const block of blocks) if (block.type === "toolCall" && block.id && block.name) calls.set(block.id, { call: { name: block.name, arguments: block.arguments }, turn });
      } else if (message.role === "toolResult") {
        const origin = calls.get(message.toolCallId ?? "");
        const text = blocks.map((block) => (block.type === "text" ? block.text ?? "" : "")).join("");
        out.push({ id: entry.sourceEntry.id, turn: origin?.turn ?? turn, call: origin?.call, nested: message.nestedCalls?.calls ?? [], text, isError: Boolean(message.isError) });
      }
    }
  }
  return out;
}

// Un script de codemode escribe a través de sus llamadas anidadas.
const wrote = (item: Item) => !item.isError && (isWrite(item.call) || item.nested.some((c) => c.status === "ok" && isWrite(c)));

// También un script que cargó una skill: retirarlo se llevaría sus instrucciones.
function isInstruction(item: Item): boolean {
  return [item.call, ...item.nested].some((call) => {
    const source = call?.name === "bash" ? command(call) : String(call?.arguments?.path ?? "");
    return KEEP_PATH.test(source);
  });
}

function isExploration(item: Item): boolean {
  return isExplorationCall(item.call) || (item.call?.name === "codemode" && item.nested.length > 0 && item.nested.every((call) => call.status === "ok" && (call.name === "read" || isExplorationCall(call))));
}

function isExplorationCall(call?: Call): boolean {
  const name = call?.name;
  if (name === "codegraph_explore" || name === "grep" || name === "find" || name === "ls") return true;
  if (name !== "bash") return false;
  const commands = shellCommands(command(call));
  return commands.length > 0 && commands.some((words) => words[0] !== "cd") && commands.every((words) => words[0] === "cd" || READ_ONLY_BASH.test(words.join(" ")));
}

function target(call?: Call): string {
  const args = call?.arguments ?? {};
  const raw = String(args.path ?? args.query ?? args.command ?? args.pattern ?? (call?.name === "codemode" ? "script" : ""));
  const line = raw.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}

function note(item: Item, boundary: string): string {
  return `${RETIRED_MARK} at ${boundary}: ${item.call?.name ?? "tool"} ${target(item.call)} returned ${item.text.length} chars. Git, WORK.md and the files hold the current state; run it again if you need it.]`;
}

/**
 * Qué resultados retirar al acabar un turno. Solo los de turnos anteriores a
 * la frontera: lo del turno en curso el modelo aún no lo ha visto, y lo del
 * propio turno de la frontera espera a la siguiente. Así la caché se rompe una
 * sola vez por frontera. `commit` es el HEAD nuevo cuando este turno commiteó
 * y aún quedan tareas.
 */
export function retirements(entries: readonly Entry[], currentTurn: ReadonlySet<string>, commit?: string): Retirement[] {
  const all = items(entries);
  const firstWrite = all.find(wrote)?.turn ?? 0;
  const out: Retirement[] = [];
  for (const item of all) {
    if (currentTurn.has(item.id) || item.isError || item.text.length < MIN_CHARS || item.text.startsWith(RETIRED_MARK) || isInstruction(item)) continue;
    // Los checks y las mutaciones no son lecturas: un commit no demuestra que su evidencia se haya guardado.
    const recoverable = item.call?.name === "read" || isExploration(item);
    if (!recoverable || /\.(?:log|jsonl)\b/.test(target(item.call))) continue;
    if (commit) out.push({ targetId: item.id, text: note(item, `commit ${commit.slice(0, 7)}`) });
    else if (item.turn < firstWrite && isExploration(item)) out.push({ targetId: item.id, text: note(item, "the first edit") });
  }
  return out;
}

function tasksPending(cwd: string): boolean {
  const path = resolveWorkDoc(cwd);
  try { return path ? readWorkDoc(path).tasks.some((task) => !task.done) : false; } catch { return false; }
}

// Fuera de Git no hay HEAD. Nunca lanza: un fallo en `tool_call` bloquearía la herramienta.
function head(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export default function (pi: ExtensionAPI) {
  // Pi espera a `tool_call` antes de ejecutar: el primero del turno ve HEAD antes de
  // cualquier comando: un commit ajeno mientras el modelo genera no se toma por propio.
  // null: el turno aún no ha ejecutado nada.
  let before: string | undefined | null = null;
  pi.on("turn_start", () => { before = null; });
  pi.on("tool_call", (_event, ctx) => { if (before === null) before = head(ctx.cwd); });
  pi.on("turn_end", (event, ctx) => {
    // Un turno sin herramientas cierra la ejecución: no hay petición que abaratar.
    if (!event.toolResultEntryIds.length) return;
    const now = before ? head(ctx.cwd) : undefined;
    const commit = now && now !== before && tasksPending(ctx.cwd) ? now : undefined;
    const retire = retirements(event.context.contextEntries, new Set(event.toolResultEntryIds), commit);
    if (!retire.length) return;
    return {
      entries: retire.map(({ targetId, text }) => ({ type: "context_edit" as const, targetId, replacement: { content: [{ type: "text" as const, text }] } })),
    };
  });
}
