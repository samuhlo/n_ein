// =============================================================================
// [BENCH] CONTEXTO INICIAL Y QUÉ LO LLENA DESPUÉS
// uso: bun context-load.ts <sesión .jsonl o carpeta>...
// Lee sesiones grabadas de Pi o de Claude Code, sin llamar a ningún modelo.
// Prefijo: entrada del primer turno (incluida caché), con el primer mensaje del
// usuario dentro. Arrastre: caracteres de cada resultado × turnos que quedan
// tras él, que es lo que se vuelve a leer de la caché. En Pi el archivo guarda el
// resultado original: lo que `context.ts` retiró después no se descuenta.
// =============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const KINDS = ["codegraph", "read-whole", "read-range", "search", "check", "git", "write", "other"] as const;
type Kind = (typeof KINDS)[number];
type Tally = Record<Kind, number>;
type Session = { file: string; runtime: "pi" | "claude"; prefix: number; turns: number; chars: Tally; carry: Tally };
type Json = Record<string, unknown>;

const READ_ONLY = /^\s*(rg|grep|find|ls|cat|head|tail|sed -n|wc|tree|pwd|nl|awk)\b/;
const CHECK = /\b(test|vitest|jest|tsc|typecheck|lint|build|check\.sh|go (test|vet|build))\b/;

const record = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const list = (value: unknown): Json[] => (Array.isArray(value) ? value.map(record) : []);
const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const empty = (): Tally => Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Tally;

function classify(name: string, input: Json): Kind {
  const tool = name.toLowerCase();
  if (tool.includes("codegraph")) return "codegraph";
  if (tool === "read") return input.offset || input.limit ? "read-range" : "read-whole";
  if (["grep", "glob", "find", "ls"].includes(tool)) return "search";
  if (["edit", "write", "multiedit", "notebookedit"].includes(tool)) return "write";
  if (tool !== "bash") return "other";
  const command = String(input.command ?? "");
  if (/^\s*git\b/.test(command)) return "git";
  if (READ_ONLY.test(command)) return "search";
  return CHECK.test(command) ? "check" : "other";
}

const size = (content: unknown): number =>
  typeof content === "string" ? content.length : list(content).reduce((n, block) => n + String(block.text ?? block.content ?? "").length, 0);

function parse(file: string): Session | null {
  const entries = readFileSync(file, "utf8").split("\n").flatMap((line) => {
    try { return line ? [record(JSON.parse(line))] : []; } catch { return []; }
  });
  const calls = new Map<string, { kind: Kind; turn: number }>();
  const results: { kind: Kind; turn: number; size: number }[] = [];
  let runtime: Session["runtime"] | null = null;
  let prefix = 0, turn = 0, lastClaudeMessage = "";
  for (const entry of entries) {
    const message = record(entry.message);
    if (entry.type === "message" && message.role) {
      runtime = "pi";
      if (message.role === "assistant") {
        turn++;
        const usage = record(message.usage);
        if (!prefix) prefix = num(usage.input) + num(usage.cacheRead) + num(usage.cacheWrite);
        for (const block of list(message.content)) if (block.type === "toolCall") calls.set(String(block.id), { kind: classify(String(block.name), record(block.arguments)), turn });
      } else if (message.role === "toolResult") {
        const call = calls.get(String(message.toolCallId));
        results.push({ kind: call?.kind ?? classify(String(message.toolName ?? ""), {}), turn: call?.turn ?? turn, size: size(message.content) });
      }
    } else if (entry.type === "assistant") {
      runtime = "claude";
      // Claude Code parte una respuesta en varias entradas con el mismo id de mensaje.
      if (message.id !== lastClaudeMessage) { turn++; lastClaudeMessage = String(message.id); }
      const usage = record(message.usage);
      if (!prefix) prefix = num(usage.input_tokens) + num(usage.cache_creation_input_tokens) + num(usage.cache_read_input_tokens);
      for (const block of list(message.content)) if (block.type === "tool_use") calls.set(String(block.id), { kind: classify(String(block.name), record(block.input)), turn });
    } else if (entry.type === "user") {
      for (const block of list(message.content)) {
        const call = block.type === "tool_result" ? calls.get(String(block.tool_use_id)) : undefined;
        if (call) results.push({ kind: call.kind, turn: call.turn, size: size(block.content) });
      }
    }
  }
  if (!runtime || !prefix) return null;
  const chars = empty(), carry = empty();
  for (const result of results) {
    chars[result.kind] += result.size;
    carry[result.kind] += result.size * Math.max(0, turn - result.turn);
  }
  return { file, runtime, prefix, turns: turn, chars, carry };
}

function files(path: string): string[] {
  if (statSync(path).isFile()) return path.endsWith(".jsonl") ? [path] : [];
  // Los subagentes de Claude Code tienen su propio prefijo: no son la sesión principal.
  return readdirSync(path).flatMap((name) => (name === "subagents" ? [] : files(join(path, name))));
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
};
const shares = (sessions: Session[], key: "chars" | "carry"): string => {
  const totals = KINDS.map((kind) => sessions.reduce((n, session) => n + session[key][kind], 0));
  const all = totals.reduce((a, b) => a + b, 0) || 1;
  return KINDS.map((kind, i) => `${kind} ${Math.round((100 * totals[i]!) / all)} %`).join(" · ");
};

const sessions = process.argv.slice(2).flatMap(files).map(parse).filter((session): session is Session => session !== null);
for (const runtime of ["pi", "claude"] as const) {
  const group = sessions.filter((session) => session.runtime === runtime);
  if (!group.length) continue;
  console.log(`${runtime}: ${group.length} sesiones · prefijo mediano ${median(group.map((s) => s.prefix))} tokens · turnos medianos ${median(group.map((s) => s.turns))}`);
  console.log(`  prefijos: ${group.map((s) => s.prefix).sort((a, b) => a - b).join(", ")}`);
  console.log(`  salida de herramientas: ${shares(group, "chars")}`);
  console.log(`  arrastre:               ${shares(group, "carry")}`);
}
