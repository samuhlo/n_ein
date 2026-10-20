// =============================================================================
// [AUTH] GUARDIA DEL REVISOR
// El revisor puede ejecutar tests y escribir sondas, pero solo en su copia.
// Es la capa que explica el motivo al agente; debajo, el bash corre con el
// repositorio de Samu en solo lectura (sandbox.ts) y la copia no tiene remotos.
// =============================================================================

import { createBashToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { reviewGuard } from "../src/guard-rules.ts";
import { sandboxedOperations, sandboxFor } from "../src/sandbox.ts";

export default function (pi: ExtensionAPI): void {
  const copy = process.env.N_EIN_PREVIEWER_COPY;
  const origin = process.env.N_EIN_PREVIEWER_ORIGIN;
  if (!copy || !origin) throw new Error("the reviewer guard requires its review copy");
  const decide = reviewGuard(copy, origin);
  pi.registerTool(createBashToolDefinition(copy, { operations: sandboxedOperations(sandboxFor(origin)) }));
  pi.on("tool_call", (event, ctx) => decide(event.toolName, event.input, ctx.cwd));
}
