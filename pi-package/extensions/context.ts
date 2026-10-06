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
// Las instrucciones, los errores y las comprobaciones no se retiran.
// =============================================================================

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
const SHA = /\[[^\]\n]*?([0-9a-f]{7,40})\]/;

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
const isCommit = (call?: Call) => call?.name === "bash" && shellCommands(command(call)).some((words) => {
  if (words[0] !== "git" || words.includes("--dry-run")) return false;
  let i = 1;
  while (i < words.length && words[i]!.startsWith("-")) {
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(words[i]!)) i += 2;
    else if (/^--(?:git-dir|work-tree)=/.test(words[i]!)) i++;
    else return false;
  }
  return words[i] === "commit";
});

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

// Un script de codemode escribe o commitea a través de sus llamadas anidadas.
const wrote = (item: Item) => !item.isError && (isWrite(item.call) || item.nested.some((c) => c.status === "ok" && isWrite(c)));
const committed = (item: Item) => !item.isError && (isCommit(item.call) || item.nested.some((c) => c.status === "ok" && isCommit(c)));

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
 * sola vez por frontera. Un commit solo es frontera si quedan tareas.
 */
export function retirements(entries: readonly Entry[], currentTurn: ReadonlySet<string>, tasksPending = false): Retirement[] {
  const all = items(entries);
  const firstWrite = all.find(wrote)?.turn ?? 0;
  const commit = tasksPending ? all.findLast(committed) : undefined;
  const sha = commit ? SHA.exec(commit.text)?.[1] : undefined;
  const out: Retirement[] = [];
  for (const item of all) {
    if (currentTurn.has(item.id) || item.isError || item.text.length < MIN_CHARS || item.text.startsWith(RETIRED_MARK) || isInstruction(item)) continue;
    // Los checks y las mutaciones no son lecturas: un commit no demuestra que su evidencia se haya guardado.
    const recoverable = item.call?.name === "read" || isExploration(item);
    if (!recoverable || /\.(?:log|jsonl)\b/.test(target(item.call))) continue;
    if (commit && item.turn < commit.turn) out.push({ targetId: item.id, text: note(item, sha ? `commit ${sha.slice(0, 7)}` : "a commit") });
    else if (item.turn < firstWrite && isExploration(item)) out.push({ targetId: item.id, text: note(item, "the first edit") });
  }
  return out;
}

function tasksPending(cwd: string): boolean {
  const path = resolveWorkDoc(cwd);
  try { return path ? readWorkDoc(path).tasks.some((task) => !task.done) : false; } catch { return false; }
}

export default function (pi: ExtensionAPI) {
  pi.on("turn_end", (event, ctx) => {
    // Un turno sin herramientas cierra la ejecución: no hay petición que abaratar.
    if (!event.toolResultEntryIds.length) return;
    const retire = retirements(event.context.contextEntries, new Set(event.toolResultEntryIds), tasksPending(ctx.cwd));
    if (!retire.length) return;
    return {
      entries: retire.map(({ targetId, text }) => ({ type: "context_edit" as const, targetId, replacement: { content: [{ type: "text" as const, text }] } })),
    };
  });
}
