// =============================================================================
// [UI] n_ein DENTRO DE CLAUDE CODE
// Claude Code dibuja; este módulo solo cambia cómo se ve:
//   · cada herramienta, un recibo de una línea (la gramática de Pi),
//   · el grupo plegado, una línea con sus verbos,
//   · el spinner y el cierre de turno, en castellano y sin adornos,
//   · la marca 004 Panel sobre el prompt hasta la primera petición,
//   · el consumo de la suscripción y los tokens, en el pie.
//
// POR QUÉ -> el modelo sigue leyendo cada resultado completo; aquí solo se
// decide lo que ve la persona. /detalle devuelve las filas nativas
// para cuando haga falta el comando completo, la salida o el diff.
// =============================================================================

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register, RenderInput } from "claude-code";

import { INTRO_SECONDS, smallRuns, type BrandTone, type TileTone } from "./brand-core.ts";
import { groupSummary, NATIVE_TOOLS, outcomeFor, receiptFor, type Place } from "./claude-receipts.ts";
import { addTokens, limitsFrom, meterSegments, NO_TOKENS, tokenTail, tokensOf, windowsOf, type Limit, type MeterTone, type Tokens } from "./meter-core.ts";
import { GLYPH, receiptSegments, type Segment, type Tone } from "./receipt-core.ts";

const detail = atom({ plugin: "n-ein", key: "detail" } as const, false);
const intro = atom({ plugin: "n-ein", key: "intro" } as const, null);
const NO_LIMITS: Limit[] = [];
const limits = atom({ plugin: "n-ein", key: "limits" } as const, NO_LIMITS);
const tick = atom({ plugin: "n-ein", key: "tick" } as const, 0);
const NO_TURN: Tokens | null = null;
const turn = atom({ plugin: "n-ein", key: "turn" } as const, NO_TURN);
const session = atom({ plugin: "n-ein", key: "session" } as const, NO_TOKENS);

// Hex de brand.json donde manda la marca; claves del tema donde manda la legibilidad (temas claros incluidos).
const YELLOW = "#FFCA40";
const TONE: Record<Tone, string> = { accent: YELLOW, success: "success", error: "error", text: "text", muted: "inactive", dim: "subtle" };
const BRAND: Record<BrandTone, string> = { concrete: "#FAF3F0", yellow: YELLOW, muted: "#9A9A9A", tileHigh: "#1A1A1A", tileLow: "#141414" };
const TILE: Record<TileTone, string> = { tileHigh: "#1A1A1A", tileCard: "#161616", tileLow: "#141414" };
const METER: Record<MeterTone, string> = { accent: YELLOW, warning: "warning", error: "error", text: "text", dim: "subtle" };

// El verbo del spinner sale de lo que hace el turno, no de una lista de ocurrencias.
const SPINNER_WORD: Record<string, string> = {
  requesting: "pensando",
  thinking: "pensando",
  responding: "escribiendo",
  "tool-input": "preparando",
  "tool-use": "trabajando",
};

const FRAME_MS = 80;
const FALLBACK_COLUMNS = 100;
// Cada 30 s se repinta la cuenta atrás y se adopta la lectura que haya dejado otra sesión.
const METER_TICK_MS = 30_000;
// El medidor comparte fila con la línea de estado de n_ein (bin/n-ein-todo): marca, modelo y la
// tarea recortada a 60 caracteres, unas 90 columnas como mucho. El plugin no la ve, así que se
// reservan enteras, más dos de margen a cada lado: el medidor cede antes que partir el pie en dos.
const FOOTER_RESERVED = 90 + 4;

export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function row($: EngineInterface, e: RenderInput, segments: Segment[]) {
  const { Box, Text } = $.ui.resolve(e);
  return (
    <Box flexDirection="row">
      {segments.filter((part) => part.text).map((part) => <Text color={TONE[part.tone]}>{part.text}</Text>)}
    </Box>
  );
}

// Cuándo se tomó la lectura que se ve; el store guarda la más reciente de cualquier sesión.
let seenAt = 0;

async function remember($: EngineInterface, found: Limit[]): Promise<void> {
  if (found.length === 0) return;
  seenAt = await $.clock.now();
  await update($, limits, () => found);
  await $.store.set("limits", found);
  // Después de las ventanas: quien vea la hora nueva encuentra ya las ventanas nuevas.
  await $.store.set("at", seenAt);
}

/** Adopta la lectura que otra sesión dejó en el store, si es más reciente que la nuestra. */
async function adopt($: EngineInterface): Promise<void> {
  const at = Number(await $.store.get("at")) || 0;
  if (at <= seenAt) return;
  const saved = limitsFrom(await $.store.get("limits"));
  if (saved.length === 0) return;
  seenAt = at;
  await update($, limits, () => saved);
}

export const register: Register = (on) => {
  let place: Place = { cwd: "", home: "" };
  let opening: { cancel: () => void } | undefined;
  let metering: { cancel: () => void } | undefined;

  on("session.start", async ($, e, next) => {
    place = { cwd: await $.session.cwd(), home: (await $.env.get("HOME")) ?? "" };
    await $.command.register({ name: "detalle", description: "Alterna entre los recibos de n_ein y las filas nativas de Claude Code." });
    // La única animación del contrato visual: las palas giran una vez y se quedan quietas.
    await update($, intro, () => 0);
    seenAt = 0;
    await update($, turn, () => null);
    await update($, session, () => NO_TOKENS);
    await adopt($);
    await remember($, windowsOf((await $.session.usage()).rateLimits));
    metering?.cancel();
    metering = $.clock.every(METER_TICK_MS, () => {
      // Una lectura fallida deja en pantalla la que había.
      void adopt($).catch(() => {});
      void update($, tick, (n) => n + 1);
    });
    opening?.cancel();
    opening = $.clock.every(FRAME_MS, () => {
      void update($, intro, (t) => {
        if (t === null) return null;
        const nextT = Math.min(INTRO_SECONDS, t + FRAME_MS / 1000);
        if (nextT >= INTRO_SECONDS) opening?.cancel();
        return nextT;
      });
    });
    return next(e);
  });

  on("prompt.submit", async ($, e, next) => {
    opening?.cancel();
    await update($, intro, () => null);
    return next(e);
  });

  on("session.measure", async ($, e, next) => {
    await remember($, windowsOf(e.rateLimits));
    return next(e);
  });

  // Solo el bucle principal: los subagentes cuentan dentro del turno que los lanzó, o no cuentan.
  on("turn.complete", async ($, e, next) => {
    if (e.usage && e.agentId === undefined) {
      const last = tokensOf(e.usage);
      await update($, turn, () => last);
      await update($, session, (total) => addTokens(total, last));
    }
    return next(e);
  });

  on("command.run", { command: "detalle" }, async ($) => {
    const now = await update($, detail, (value) => !value);
    return { text: now ? "Filas nativas de Claude Code: comando, salida y diff completos." : "Recibos de n_ein: una línea por herramienta." };
  });

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (NATIVE_TOOLS.has(e.props.tool) || (await read($, detail))) return next(e);
    const receipt = receiptFor(e.props.tool, e.props.input, place);
    const outcome = outcomeFor(e.props.tool, e.props.input, e.props);
    return row($, e, receiptSegments(receipt, outcome, (e.viewport?.columns ?? FALLBACK_COLUMNS) - 1));
  });

  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (NATIVE_TOOLS.has(e.props.tool) || (await read($, detail))) return next(e);
    // El recibo de ToolUse ya dice lo que salió; el resultado completo es para el modelo.
    const { Box } = $.ui.resolve(e);
    return <Box display="none" />;
  });

  on("ui.render", { component: "ToolGroup" }, async ($, e, next) => {
    if (e.props.isExpanded || (await read($, detail))) return next(e);
    const calls = e.props.calls;
    const width = (e.viewport?.columns ?? FALLBACK_COLUMNS) - 1;
    // Una sola llamada no es un grupo: se lee mejor con su objeto, como un recibo suelto.
    const [only] = calls;
    if (only && calls.length === 1) return row($, e, receiptSegments(receiptFor(only.tool, only.input, place), outcomeFor(only.tool, only.input, only), width));
    const failed = calls.some((call) => call.isErrored || call.isInterrupted);
    const running = calls.some((call) => call.isRunning);
    const glyph: Segment = running
      ? { tone: "accent", text: GLYPH.running }
      : failed ? { tone: "error", text: GLYPH.failed } : { tone: "dim", text: GLYPH.done };
    return row($, e, [{ tone: "text", text: " " }, glyph, { tone: "muted", text: ` ${groupSummary(calls, place)}` }]);
  });

  on("ui.render", { component: "Spinner" }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: SPINNER_WORD[e.props.mode] ?? e.props.word } }));

  on("ui.render", { component: "TurnDuration" }, ($, e) =>
    row($, e, [{ tone: "dim", text: `${GLYPH.done} ${duration(e.props.durationMs)}` }]));

  // La marca pequeña del instalador abre la sesión encima del prompt: sus palas giran y se asientan,
  // y se retira con el primer mensaje.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const t = await read($, intro);
    if (t === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box flexDirection="column" paddingLeft={1}>
        {smallRuns(t).map((runs) => (
          <Box flexDirection="row">
            {runs.map((run) => (
              <Text color={run.fg ? BRAND[run.fg] : undefined} backgroundColor={run.bg ? TILE[run.bg] : undefined}>{run.text}</Text>
            ))}
          </Box>
        ))}
      </Box>
    );
  });

  // Abajo a la derecha: el consumo y, tras él, las etiquetas de modo del motor.
  on("ui.render", { component: "SessionMode" }, async ($, e, next) => {
    const all = await read($, limits);
    if (all.length === 0) return next(e);
    // Suscribe el dibujo a la cuenta atrás.
    await read($, tick);
    const modes = e.props.modes.join(" & ");
    const beneath = await next(e);
    const room = e.surface === "terminal" && e.viewport
      ? e.viewport.columns - FOOTER_RESERVED - (modes ? [...modes].length + 3 : 0)
      : Infinity;
    const segments = meterSegments(all, await $.clock.now(), room);
    if (segments.length === 0) return beneath;
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box flexDirection="row">
        {segments.map((part) => <Text color={METER[part.tone]}>{part.text}</Text>)}
        {modes ? <Text color={METER.dim}> · </Text> : null}
        {beneath}
      </Box>
    );
  });

  // La línea de ayuda sigue siendo del motor (sus pastillas siguen vivas); los tokens van en su cola.
  on("ui.render", { component: "PromptHint" }, async ($, e, next) => {
    const last = await read($, turn);
    const own = last ? tokenTail(last, await read($, session)) : "";
    if (!own) return next(e);
    // El motor ya separa la cola de la línea con « · »; se recorta donde acaba la fila.
    return next({ ...e, props: { ...e.props, tail: [e.props.tail, own].filter(Boolean).join(" · ") } });
  });
};
