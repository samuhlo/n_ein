import { strict as assert } from "node:assert";
import { activityOf, ACTIVITY_EVENT } from "../pi-package/claude-plugin/hooks/activity-core.ts";
import registerActivity from "../pi-package/extensions/activity.ts";

// [CORE] Qué hace el agente, por la herramienta que usa: los nombres de Claude y los de Pi.
const cases: Array<[string, Record<string, unknown>, string]> = [
  ["Edit", { file_path: "/repo/src/server/engine.ts" }, "coding"],
  ["edit", { path: "src/app.vue" }, "coding"],
  ["Write", { file_path: "/repo/README.md" }, "documenting"],
  ["write", { path: "docs/guia.txt" }, "documenting"],
  ["Edit", { file_path: "/repo/WORK.md" }, "planning"],
  ["Edit", { file_path: "/repo/tests/todo-core.ts" }, "testing"],
  ["Write", { file_path: "/repo/src/parser.test.ts" }, "testing"],
  ["NotebookEdit", { notebook_path: "/repo/a.ipynb" }, "coding"],
  ["Bash", { command: "bun test --bail" }, "testing"],
  ["bash", { command: "cd go && go test ./..." }, "testing"],
  ["Bash", { command: "bun run tests/work-doc.ts && bun run tests/banner.ts" }, "testing"],
  ["Bash", { command: "./scripts/check.sh" }, "testing"],
  ["Bash", { command: "pnpm typecheck" }, "testing"],
  ["Bash", { command: "npx vitest run server" }, "testing"],
  ["Bash", { command: "claude plugin test pi-package/claude-plugin" }, "testing"],
  ["Bash", { command: "git add -A && git commit -m 'feat: x'" }, "committing"],
  ["Bash", { command: "gh pr create --fill" }, "committing"],
  ["Bash", { command: "git switch -c feat/x" }, "committing"],
  ["Bash", { command: "bun install --frozen-lockfile" }, "building"],
  ["Bash", { command: "go build -o ../dist/n-ein ./cmd/n-ein" }, "building"],
  ["Bash", { command: "rg -n todo pi-package | head" }, "exploring"],
  ["Bash", { command: "git status --short; git log --oneline -5" }, "exploring"],
  ["Bash", { command: "bun install && bun test" }, "testing"],
  ["Bash", { command: "sed -i '' s/a/b/ file.ts" }, "running"],
  ["Bash", { command: "cat tests/todo-core.ts" }, "exploring"],
  ["Bash", { command: "sed -n 1,40p scripts/check.sh" }, "exploring"],
  ["Bash", { command: "git diff tests/activity.ts" }, "exploring"],
  ["Bash", { command: "bash tests/handoff-launcher.sh" }, "testing"],
  ["Bash", { command: "cd /repo && tests/launcher.sh" }, "testing"],
  ["nein_job", { action: "start", command: "bun run test:e2e" }, "testing"],
  ["Read", { file_path: "/repo/a.ts" }, "exploring"],
  ["grep", { pattern: "x" }, "exploring"],
  ["Glob", { pattern: "**/*.ts" }, "exploring"],
  ["codegraph_explore", { query: "todo" }, "exploring"],
  ["mcp__codegraph__codegraph_explore", { query: "todo" }, "exploring"],
  ["Agent", { prompt: "busca" }, "orchestrating"],
  ["nein_team", { action: "start" }, "orchestrating"],
  ["TodoWrite", { todos: [] }, "planning"],
  ["nein_set_task", { class: "ordinario" }, "planning"],
  ["WebSearch", { query: "pi tui" }, "researching"],
  ["WebFetch", { url: "https://example.com" }, "researching"],
  ["mcp__claude_ai_Context7__query-docs", { query: "x" }, "researching"],
  ["AskUserQuestion", { questions: [] }, "asking"],
  ["Skill", { skill: "review" }, "reviewing"],
  ["Skill", { skill: "intent" }, "planning"],
  ["Skill", { skill: "comments" }, "working"],
  ["mcp__claude_ai_Gmail__search_threads", { query: "x" }, "working"],
  ["Bash", { command: "" }, "running"],
];
for (const [tool, input, expected] of cases) assert.equal(activityOf(tool, input), expected, `${tool} ${JSON.stringify(input)}`);

// [FLOW] En Pi: el mensaje de trabajo dice el modo al instante y el TODO recibe la fase de cada herramienta.
const handlers = new Map<string, (event: any, ctx: any) => void>();
const emitted: unknown[] = [];
registerActivity({
  on(name: string, handler: (event: any, ctx: any) => void) { handlers.set(name, handler); },
  events: { emit(channel: string, data: unknown) { if (channel === ACTIVITY_EVENT) emitted.push(data); }, on: () => () => {} },
} as any);
const messages: Array<string | undefined> = [];
const ctx = { hasUI: true, ui: { setWorkingMessage(message?: string) { messages.push(message); } } };
const fire = (name: string, event: unknown = {}) => handlers.get(name)?.(event, ctx);

fire("agent_start");
assert.equal(messages.at(-1), "thinking…");
fire("message_update", { assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: { content: [] } } });
assert.equal(messages.at(-1), "writing…");
fire("message_update", { assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, partial: { content: [{ type: "text" }, { type: "toolCall", name: "write", arguments: {} }] } } });
assert.equal(messages.at(-1), "coding…", "mientras escribe la llamada ya se sabe qué herramienta es");
fire("tool_execution_start", { toolCallId: "1", toolName: "bash", args: { command: "bun test" } });
assert.equal(messages.at(-1), "testing…");
assert.deepEqual(emitted, ["testing"]);
fire("turn_start");
assert.equal(messages.at(-1), "thinking…");
fire("agent_end");
assert.equal(messages.at(-1), undefined, "al acabar vuelve el mensaje de Pi");
assert.deepEqual(emitted, ["testing", null], "y el TODO pierde la fase");

console.log("activity: cada herramienta dice qué hace el agente, en Pi y en Claude");
