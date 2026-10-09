import { expect, test } from "claude-code/testing";

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
