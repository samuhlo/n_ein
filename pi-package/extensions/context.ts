// =============================================================================
// [FLOW] CONTEXTO CON PRESUPUESTO
// Cada turno vuelve a leer de la caché todo lo anterior: lo explorado al
// principio se paga de nuevo en cada paso del método (TDD, commits, WORK.md).
// En dos fronteras, esos resultados se sustituyen por una nota de una línea con
// `context_edit` de Pi; el historial, la interfaz y la contabilidad no cambian.
//   · primera escritura   -> CodeGraph y búsquedas: ya sirvieron para decidir.
//   · commit entre tareas -> todo lo leído antes: Git, WORK.md y los archivos
//                            guardan el estado vigente. Tras el último commit
//                            queda poco por hacer y romper la caché no compensa.
// Las instrucciones (skills, AGENTS.md, glosario) no se retiran nunca.
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

const KEEP_PATH = /(^|\/)(SKILL\.md|AGENTS\.md|CLAUDE\.md|GLOSSARY\.md)$/;
const READ_ONLY_BASH = /^(rg|grep|find|ls|cat|head|tail|sed -n|wc|tree|pwd|git (status|log|show|diff|grep|ls-files|blame))\b/;
const COMMIT = /\bgit\b[^\n]*\bcommit\b/;
const SHA = /\[[^\]\n]*?([0-9a-f]{7,40})\]/;

const command = (call?: Call) => String(call?.arguments?.command ?? "");
// `cd x && rg ...` sigue siendo una búsqueda: se mira el primer programa tras los cd.
const firstProgram = (cmd: string) => cmd.replace(/^\s*(cd\s+[^;&|]+\s*(&&|;)\s*)+/, "").trim();
const isWrite = (call?: Call) => call?.name === "edit" || call?.name === "write";
const isCommit = (call?: Call) => call?.name === "bash" && COMMIT.test(command(call)) && !/--dry-run/.test(command(call));

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
  return [item.call, ...item.nested].some((call) => call?.name === "read" && KEEP_PATH.test(String(call.arguments?.path ?? "")));
}

function isExploration(item: Item): boolean {
  const name = item.call?.name;
  if (name === "codegraph_explore" || name === "grep" || name === "find" || name === "ls") return true;
  if (name === "bash") return READ_ONLY_BASH.test(firstProgram(command(item.call)));
  // Antes de la primera escritura, un script solo pudo mirar.
  return name === "codemode";
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
    if (currentTurn.has(item.id) || item.text.length < MIN_CHARS || item.text.startsWith(RETIRED_MARK) || isInstruction(item)) continue;
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
