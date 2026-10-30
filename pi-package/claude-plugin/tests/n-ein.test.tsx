import { expect, mock, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";
import type { On, SessionRateLimit } from "claude-code";

const BASH = {
  tool_use_id: "t1",
  tool: "Bash",
  input: { command: "bun test\n  --bail", description: "Run tests" },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: { stdout: "a\nb\n", stderr: "", interrupted: false },
};
const viewport = { columns: 80, rows: 24 };

test("una herramienta terminada es una línea de recibo", async ($) => {
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolUse", props: BASH, requestId: "t1", viewport });
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain("ejecuta");
  expect(drawn).toContain("bun test --bail");
  expect(drawn).toContain("· 2 líneas");
  expect(drawn).toContain("✓");
});

test("mientras corre lleva el foco y sin resultado", async ($) => {
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolUse", props: { ...BASH, isRunning: true, output: undefined }, requestId: "t1", viewport });
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain("▸");
  expect(drawn).not.toContain("líneas");
});

test("el resultado completo no se pinta", async ($) => {
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolResult", props: { tool_use_id: "t1", tool: "Bash", output: BASH.output, isErrored: false }, requestId: "t1", viewport });
  expect(await ui.find({ text: /a/ })).toBeUndefined();
});

test("/detalle devuelve la fila nativa", async ($, on) => {
  on("ui.render", { component: "ToolUse" }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>nativa</Text>;
  });
  const answer = await $.command.run({ command: "detalle", args: "", origin: { kind: "composer" }, presentation: { isFullscreen: false, columns: 80 } });
  expect(answer.text).toContain("nativas");
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolUse", props: BASH, requestId: "t1", viewport });
  expect(await ui.find({ text: "nativa" })).toBeDefined();
});

test("el spinner dice lo que hace el turno", async ($, on) => {
  on("ui.render", { component: "Spinner" }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>{e.props.word}</Text>;
  });
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "Spinner", props: { word: "Sauteing", message: null, suffix: "…", mode: "thinking" } });
  expect(await ui.find({ text: "pensando" })).toBeDefined();
});

test("el cierre de turno es la duración con ✓", async ($) => {
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "TurnDuration", props: { word: "Baked", durationMs: 64_000 } });
  expect(JSON.stringify(await ui.drawn())).toContain("✓ 1m 4s");
});

test("un grupo de una llamada se dibuja como recibo con objeto", async ($) => {
  const call = { tool: "Bash", input: { command: "ls /no/existe" }, isRunning: false, isErrored: true, isInterrupted: false, output: "Exit code 1\nls: /no/existe: No such file" };
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolGroup", props: { calls: [call], isActive: false, isExpanded: false }, viewport });
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain("ls /no/existe");
  expect(drawn).toContain("salió con código 1");
});

test("un grupo de varias llamadas cuenta sus verbos", async ($) => {
  const read = { tool: "Read", input: { file_path: "/x/a.ts" }, isRunning: false, isErrored: false, isInterrupted: false };
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "ToolGroup", props: { calls: [read, read], isActive: false, isExpanded: false }, viewport });
  expect(JSON.stringify(await ui.drawn())).toContain("lee 2");
});

// --- Medidores del pie -------------------------------------------------------------------------
const NOW = Date.parse("2026-10-22T10:00:00Z");
const HOUR = 3_600_000;
const LIMITS: SessionRateLimit[] = [
  { kind: "five_hour", percentUsed: 58, resetsAt: new Date(NOW + 2 * HOUR + 10 * 60_000).toISOString() },
  { kind: "seven_day", percentUsed: 23.5, resetsAt: new Date(NOW + 76 * HOUR).toISOString() },
];
const USAGE = { input_tokens: 200, output_tokens: 340, cache_read_input_tokens: 41_000, cache_creation_input_tokens: 3800, model: "claude-opus-5-5" };

/** Lo que hay debajo del plugin: reloj, store, consumo de la sesión y lo que dibuja el motor. */
function world(on: On, rateLimits: SessionRateLimit[] = LIMITS) {
  const clock = mock.clock(on, { now: NOW });
  const store: Record<string, unknown> = {};
  on("store.get", ($, e) => ({ value: store[e.key] }));
  on("store.set", ($, e) => {
    store[e.key] = JSON.parse(JSON.stringify(e.value));
    return { value: undefined };
  });
  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("session.cwd", () => ({ value: "/repo" }));
  on("env.get", () => ({ value: "/home/samu" }));
  on("command.register", ($, e) => ({ value: { command: e.name } }));
  on("session.usage", () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits } as never }));
  on("session.measure", ($, e) => ({ changed: e.changed }));
  on("turn.complete", ($, e) => ({ text: e.answer }));
  on("ui.render", ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    // Como el motor: la cola va tras la línea, separada con « · ».
    if ("hint" in e.props) return <Text>{e.props.hint + ("tail" in e.props && e.props.tail ? ` · ${e.props.tail}` : "")}</Text>;
    return <Box key="engine" />;
  });
  return { clock, store };
}

const start = ($: Engine) => $.session.start({ cwd: "/repo", surface: "terminal", isInteractive: true });
const footer = ($: Engine, columns = 160) =>
  $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "SessionMode", props: { modes: [] }, viewport: { columns, rows: 30 } });
const hint = ($: Engine) =>
  $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "PromptHint", props: { isDraft: false, isWorking: false, hint: "? for shortcuts" } });
const turnEnd = ($: Engine, usage?: typeof USAGE, agentId?: string) =>
  $.turn.complete({ answer: "", durationMs: 1, isAborted: false, turnId: "t1", reason: "answer", usage, agentId });

test("el pie enseña las dos ventanas de la suscripción con su reinicio", async ($, on) => {
  world(on);
  await start($);
  const drawn = JSON.stringify(await (await footer($)).drawn());
  expect(drawn).toContain("5h");
  expect(drawn).toContain(" 58%");
  expect(drawn).toContain(" ↻ 2h 10m");
  expect(drawn).toContain("sem");
});

test("en un terminal estrecho el medidor cede antes que desbordar", async ($, on) => {
  world(on);
  await start($);
  const drawn = JSON.stringify(await (await footer($, 120)).drawn());
  expect(drawn).toContain(" 58%");
  expect(drawn).not.toContain("━");
  expect(JSON.stringify(await (await footer($, 90)).drawn())).not.toContain("5h");
});

test("fuera de suscripción el pie se queda como está", async ($, on) => {
  world(on, []);
  await start($);
  expect(JSON.stringify(await (await footer($)).drawn())).not.toContain("5h");
});

test("una medición nueva mueve el medidor y queda para la próxima sesión", async ($, on) => {
  const w = world(on, []);
  await start($);
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [{ ...LIMITS[0], percentUsed: 91 }], changed: ["rateLimits"] } as never);
  expect(JSON.stringify(await (await footer($)).drawn())).toContain(" 91%");
  expect(Array.isArray(w.store.limits)).toBe(true);
});

test("tras un turno, la línea de ayuda lleva sus tokens y los de la sesión", async ($, on) => {
  world(on);
  await start($);
  await turnEnd($, USAGE);
  await turnEnd($, { ...USAGE, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1000, output_tokens: 60 });
  await turnEnd($, USAGE, "subagente");
  const ui = await hint($);
  expect(await ui.find({ text: "? for shortcuts · turno ↑1.0k ↓60 · sesión ↑46.0k ↓400" })).toBeDefined();
});

test("antes del primer turno la línea de ayuda no cambia", async ($, on) => {
  world(on);
  await start($);
  expect(await (await hint($)).find({ text: "? for shortcuts" })).toBeDefined();
});

test("la paleta busca sin iniciar un turno y prepara la acción elegida", async ($, on) => {
  on("command.list", () => ({ value: [] }));
  on("ui.open", () => ({ value: undefined }));
  on("ui.close", () => ({ value: undefined }));
  on("prompt.read", () => ({ value: { text: "borrador previo", cursor: 0 } }));
  const fills: string[] = [];
  on("prompt.fill", ($, e) => { fills.push(e.text); return { isFilled: true }; });
  const answer = await $.command.run({ command: "nein-comandos", args: "", origin: { kind: "composer" }, presentation: { isFullscreen: false, columns: 100 } });
  expect(answer.text).toBeUndefined();
  const ui = await $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "Pane", requestId: "nein-actions",
    props: { title: "Comandos", isFocused: true, bodyColumns: 80, bodyRows: 20 }, viewport });
  expect(JSON.stringify(await ui.drawn())).toContain("Nuevo encargo");
  await ui.input({ key: "action-search", text: "nuevo" });
  expect(JSON.stringify(await ui.drawn())).not.toContain("Modelos y esfuerzo");
  await ui.press({ key: "action-new" });
  expect(fills[0]).toContain("Otro encargo:");
  expect(fills[0]).toContain("borrador previo");
});
