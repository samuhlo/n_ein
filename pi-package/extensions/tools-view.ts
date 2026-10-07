// =============================================================================
// [UI] HERRAMIENTAS CON RECIBO
// Cada llamada se pinta como una línea de receipts.ts; Ctrl+O o un clic abren
// el detalle nativo de Pi (comando completo, salida, diff), sin fondo de caja.
// Vale para cualquier herramienta, también las de MCP o de otros paquetes.
// =============================================================================

import type { ExtensionAPI, Theme, ToolRenderers } from "@earendil-works/pi-coding-agent";
import { Box, Container, Text, type Component } from "@earendil-works/pi-tui";
import { outcomeFor, receiptFor, receiptLine, resultText, type Outcome, type Paint } from "./receipts.ts";

type RowState = { neinOutcome?: Outcome; neinCall?: Component; neinResult?: Component };
type RenderContext = Parameters<NonNullable<ToolRenderers["renderCall"]>>[2];

const empty: Component = { render: () => [], invalidate() {} };

function painter(theme: Theme): Paint {
  return (token, text) => theme.fg(token, text);
}

/** Envuelve el renderer nativo: conserva su componente previo aparte, porque el nuestro es el marco. */
function wrapped(component: Component): Component {
  const box = new Box(1, 0);
  box.addChild(component);
  return box;
}

function compact(tool: string, base: ToolRenderers | undefined): ToolRenderers {
  return {
    renderShell: "self",
    renderCall(args, theme, context: RenderContext) {
      const state = context.state as RowState;
      if (context.expanded) {
        const inner = base?.renderCall
          ? base.renderCall(args, theme, { ...context, lastComponent: state.neinCall })
          : new Text(theme.fg("toolTitle", theme.bold(tool)) + `\n${theme.fg("muted", JSON.stringify(args, null, 2))}`, 0, 0);
        state.neinCall = inner;
        return wrapped(inner);
      }
      // La fila se compone al pintar: para entonces renderResult ya ha dejado su resumen en el estado.
      return {
        render: (width: number) => [receiptLine(receiptFor(tool, args, context.cwd), state.neinOutcome, width, painter(theme))],
        invalidate() {},
      };
    },
    renderResult(result, options, theme, context: RenderContext) {
      const state = context.state as RowState;
      state.neinOutcome = options.isPartial ? undefined : outcomeFor(tool, context.args, { ...result, isError: context.isError });
      if (!options.expanded) return empty;
      if (base?.renderResult) {
        const inner = base.renderResult(result, options, theme, { ...context, lastComponent: state.neinResult });
        state.neinResult = inner;
        return wrapped(inner);
      }
      const text = resultText(result);
      return text ? wrapped(new Text(`\n${theme.fg("toolOutput", text)}`, 0, 0)) : new Container();
    },
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerToolRenderer((tool, next) => compact(tool, next()));
}
