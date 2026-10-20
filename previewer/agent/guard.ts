// =============================================================================
// [AUTH] GUARDIA DEL REVISOR
// El revisor puede ejecutar tests y escribir sondas, pero solo en su copia.
// Es la capa que explica el motivo al agente; debajo, el bash corre con el
// repositorio del usuario en solo lectura (sandbox.ts) y la copia no tiene remotos.
// =============================================================================

import { createBashToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { reviewGuard } from "../src/guard-rules.ts";
import { sandboxedOperations, sandboxFor } from "../src/sandbox.ts";

export default function (pi: ExtensionAPI): void {
  const copy = process.env.N_EIN_PREVIEWER_COPY;
  const origin = process.env.N_EIN_PREVIEWER_ORIGIN;
  if (!copy || !origin) throw new Error("the reviewer guard requires its review copy");
  const decide = reviewGuard(copy, origin);
  const sandbox = sandboxFor(copy, origin);
  // BLINDAJE -> El motor ya quita bash sin aislamiento; si aun así llega aquí, no se ejecuta sin él.
  if (sandbox.kind !== "none") pi.registerTool(createBashToolDefinition(copy, { operations: sandboxedOperations(sandbox) }));
  else pi.on("tool_call", (event) => (event.toolName === "bash" ? { block: true, reason: "No OS sandbox: this review is read-only." } : undefined));
  pi.on("tool_call", (event, ctx) => decide(event.toolName, event.input, ctx.cwd));
}
