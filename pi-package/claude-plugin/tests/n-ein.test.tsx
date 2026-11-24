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
  expect(await ui.find({ text: "thinking" })).toBeDefined();
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
  on("env.get", ($, e) => ({ value: e.name === "HOME" ? "/home/samu" : undefined }));
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

// --- TODO en la franja sobre el prompt ----------------------------------------------------------
const WORK = "# Encargo de prueba\n\n## Tareas\n- [x] T1 · Uno — detalle\n- [ ] T2 · Dos — detalle. Blocked by: T1.\n- [ ] T3 · Tres\n";
const BAND = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} };

/** Un repositorio en /repo con los archivos dados; las ediciones de la prueba los cambian de verdad. */
function workspace(on: On, files: Record<string, string>) {
  // /repo/.git es una carpeta; cualquier prefijo de un archivo, también.
  const isDir = (path: string) => path === "/repo/.git" || Object.keys(files).some((file) => file.startsWith(`${path}/`));
  on("fs.exists", ($, e) => ({ value: e.path in files || isDir(e.path) }));
  on("fs.stat", ($, e) => {
    if (!(e.path in files) && !isDir(e.path)) throw new Error(`ENOENT: ${e.path}`);
    return { value: { kind: e.path in files ? "file" : "dir", size: 0, mtimeMs: 0, isLink: false } };
  });
  on("fs.list", ($, e) => {
    const names = new Set(Object.keys(files).filter((file) => file.startsWith(`${e.path}/`)).map((file) => file.slice(e.path.length + 1).split("/")[0] ?? ""));
    return { value: [...names].map((name) => ({ name, kind: `${e.path}/${name}` in files ? "file" as const : "dir" as const, size: 0, mtimeMs: 0, isLink: false })) };
  });
  on("fs.read", ($, e) => {
    const text = files[e.path];
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`);
    return { value: text };
  });
  on("prompt.submit", ($, e) => ({ text: e.text }));
  on("tool.call", ($, e) => {
    const text = e.tool === "Edit" ? files[e.file_path] : undefined;
    if (e.tool === "Edit" && text !== undefined) files[e.file_path] = text.replace(e.old_string, e.new_string);
    return { result: { ok: true } as never };
  });
}
const band = ($: Engine, props: Partial<typeof BAND> = {}) =>
  $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "AbovePrompt", props: { ...BAND, ...props }, viewport });
const submit = ($: Engine) => $.prompt.submit({ text: "hola", wait: false, origin: { kind: "composer" } });

test("tras la primera petición la franja enseña el bloque del TODO", async ($, on) => {
  world(on);
  workspace(on, { "/repo/WORK.md": WORK });
  await start($);
  expect(JSON.stringify(await (await band($)).drawn())).not.toContain("Encargo de prueba");
  await submit($);
  const drawn = JSON.stringify(await (await band($)).drawn());
  for (const part of ["Encargo de prueba", "1/3", "✓", "Uno", "▸", "T2", "Dos", "Tres"]) expect(drawn).toContain(part);
  expect(drawn).not.toContain("detalle");
});

test("la franja cede ante una encuesta y sin WORK.md no aparece", async ($, on) => {
  world(on);
  workspace(on, { "/repo/WORK.md": WORK });
  await start($);
  await submit($);
  expect(JSON.stringify(await (await band($, { hasSurvey: true })).drawn())).not.toContain("Encargo de prueba");
});

test("sin WORK.md la franja queda para el motor", async ($, on) => {
  world(on);
  workspace(on, {});
  await start($);
  await submit($);
  expect(JSON.stringify(await (await band($)).drawn())).not.toContain("▸");
});

test("una edición de WORK.md mueve la franja", async ($, on) => {
  world(on);
  workspace(on, { "/repo/WORK.md": WORK });
  await start($);
  await submit($);
  await $.tool.call({ tool: "Edit", file_path: "/repo/WORK.md", old_string: "- [ ] T2", new_string: "- [x] T2" });
  const drawn = JSON.stringify(await (await band($)).drawn());
  expect(drawn).toContain("2/3");
  expect(drawn).toContain("Tres");
});

// --- Modo de actividad ---------------------------------------------------------------------------
const spinner = ($: Engine, mode: "requesting" | "responding" | "thinking" | "tool-input" | "tool-use") =>
  $.ui.mount({ plugin: "n-ein", surface: "terminal", component: "Spinner", props: { word: "Sauteing", message: null, suffix: "…", mode } });
const word = (on: On) => on("ui.render", { component: "Spinner" }, ($, e) => {
  const { Text } = $.ui.resolve(e);
  return <Text>{e.props.word}</Text>;
});

test("el spinner dice el modo de la herramienta en curso", async ($, on) => {
  // Antes que world: su hook genérico contesta cualquier dibujo sin pasar al siguiente.
  word(on);
  world(on);
  workspace(on, { "/repo/WORK.md": WORK });
  await start($);
  const says = async (mode: Parameters<typeof spinner>[1]) => JSON.stringify(await (await spinner($, mode)).drawn());
  expect(await says("tool-use")).toContain("working");
  await $.tool.call({ tool: "Bash", command: "bun test --bail" });
  expect(await says("tool-use")).toContain("testing");
  expect(await says("responding")).toContain("writing");
  // Las herramientas de un subagente no cambian lo que hace el bucle principal.
  await $.tool.call({ tool: "Edit", file_path: "/repo/a.ts", old_string: "a", new_string: "b", agentId: "a1" });
  expect(await says("tool-use")).toContain("testing");
  await turnEnd($, USAGE);
  expect(await says("tool-use")).toContain("working");
});

test("mientras trabaja, la franja lleva la fase junto al avance", async ($, on) => {
  world(on);
  workspace(on, { "/repo/WORK.md": WORK });
  await start($);
  await submit($);
  await $.tool.call({ tool: "Edit", file_path: "/repo/src/a.ts", old_string: "a", new_string: "b" });
  expect(JSON.stringify(await (await band($, { isWorking: true })).drawn())).toContain("▸ coding");
  expect(JSON.stringify(await (await band($, { isWorking: false })).drawn())).not.toContain("coding");
});

test("con un documento por encargo, la franja enseña el de la rama", async ($, on) => {
  world(on);
  const doc = (name: string, branch: string) => `# Encargo ${name}\n\nEstado: activo · Rama: ${branch}\n\n## Tareas\n- [ ] T1 · Tarea de ${name}\n\n## Registro\n- R1\n`;
  const files: Record<string, string> = {
    "/repo/.git/HEAD": "ref: refs/heads/feat/b\n",
    "/repo/docs/work/2026-11-20-a.md": doc("A", "feat/a"),
    "/repo/docs/work/2026-11-21-b.md": doc("B", "feat/b"),
    "/repo/docs/work/closed/2026-11-01-viejo.md": doc("viejo", "feat/b").replace("activo", "cerrado"),
  };
  workspace(on, files);
  await start($);
  await submit($);
  const drawn = JSON.stringify(await (await band($)).drawn());
  expect(drawn).toContain("Encargo B");
  expect(drawn).not.toContain("Encargo A");
  // Cambiar de rama cambia de documento en la siguiente lectura.
  files["/repo/.git/HEAD"] = "ref: refs/heads/feat/a\n";
  await turnEnd($, USAGE);
  expect(JSON.stringify(await (await band($)).drawn())).toContain("Encargo A");
});

// [FLOW] El lanzador imprime al salir cómo volver con n_ein: cada cierre le deja su id, y tras /clear
// gana el de la sesión nueva, que cierra después.
function endings(on: On, env: Record<string, string>) {
  const writes: { path: string; text: string }[] = [];
  on("env.get", ($, e) => ({ value: env[e.name] }));
  on("session.end", ($, e) => ({ sessionId: e.sessionId }));
  on("fs.write", ($, e) => {
    writes.push({ path: e.path, text: e.text });
    return { value: undefined };
  });
  return writes;
}

test("cada cierre de sesión deja su id al lanzador", async ($, on) => {
  const writes = endings(on, { N_EIN_RESUME_FILE: "/tmp/n-ein-resume.x" });
  await $.session.end({ reason: "clear", sessionId: "vieja", resume: { id: "vieja" } });
  await $.session.end({ reason: "prompt_input_exit", sessionId: "nueva", resume: { id: "nueva" } });
  expect(writes).toEqual([
    { path: "/tmp/n-ein-resume.x", text: "vieja\n" },
    { path: "/tmp/n-ein-resume.x", text: "nueva\n" },
  ]);
});

test("sin lanzador de n_ein no escribe", async ($, on) => {
  const writes = endings(on, {});
  await $.session.end({ reason: "prompt_input_exit", sessionId: "s", resume: { id: "s" } });
  expect(writes).toEqual([]);
});
