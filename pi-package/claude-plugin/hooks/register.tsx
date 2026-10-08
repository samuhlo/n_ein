// =============================================================================
// [UI] n_ein DENTRO DE CLAUDE CODE
// Claude Code dibuja; este módulo solo cambia cómo se ve:
//   · cada herramienta, un recibo de una línea (la gramática de Pi),
//   · el grupo plegado, una línea con sus verbos,
//   · el spinner y el cierre de turno, en castellano y sin adornos,
//   · la marca 004 Panel sobre el prompt hasta la primera petición.
//
// POR QUÉ -> el modelo sigue leyendo cada resultado completo; aquí solo se
// decide lo que ve la persona. /detalle devuelve las filas nativas
// para cuando haga falta el comando completo, la salida o el diff.
// =============================================================================

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register, RenderInput } from "claude-code";

import { INTRO_SECONDS, LARGE_WIDTH, panelCells, panelRuns, type BrandTone } from "./brand-core.ts";
import { groupSummary, NATIVE_TOOLS, outcomeFor, receiptFor, type Place } from "./claude-receipts.ts";
import { GLYPH, receiptSegments, type Segment, type Tone } from "./receipt-core.ts";

const detail = atom({ plugin: "n-ein", key: "detail" } as const, false);
const intro = atom({ plugin: "n-ein", key: "intro" } as const, null);

// Hex de brand.json donde manda la marca; claves del tema donde manda la legibilidad (temas claros incluidos).
const YELLOW = "#FFCA40";
const TONE: Record<Tone, string> = { accent: YELLOW, success: "success", error: "error", text: "text", muted: "inactive", dim: "subtle" };
const BRAND: Record<BrandTone, string> = { concrete: "#FAF3F0", yellow: YELLOW, muted: "#9A9A9A", tileHigh: "#1A1A1A", tileLow: "#141414" };

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

export const register: Register = (on) => {
  let place: Place = { cwd: "", home: "" };
  let opening: { cancel: () => void } | undefined;

  on("session.start", async ($, e, next) => {
    place = { cwd: await $.session.cwd(), home: (await $.env.get("HOME")) ?? "" };
    await $.command.register({ name: "detalle", description: "Alterna entre los recibos de n_ein y las filas nativas de Claude Code." });
    // La única animación del contrato visual: las palas giran una vez y se quedan quietas.
    await update($, intro, () => 0);
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

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const t = await read($, intro);
    if (t === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    // Sin sitio para las palas, la marca queda en su forma corta.
    if ((e.props.bodyColumns ?? FALLBACK_COLUMNS) < LARGE_WIDTH + 2) {
      return (
        <Box>
          <Text color={BRAND.concrete}>n</Text>
          <Text color={YELLOW}>_</Text>
          <Text color={BRAND.concrete}>ein</Text>
        </Box>
      );
    }
    return (
      <Box flexDirection="column" paddingLeft={1}>
        {panelCells(t).map((cells) => (
          <Box flexDirection="row">
            {panelRuns(cells).map((run) => (
              <Text color={run.fg ? BRAND[run.fg] : undefined} backgroundColor={run.bg ? BRAND[run.bg] : undefined}>{run.text}</Text>
            ))}
          </Box>
        ))}
      </Box>
    );
  });
};
