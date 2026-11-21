// =============================================================================
// [UI] MODO DE ACTIVIDAD EN PI
// El mensaje de trabajo dice qué hace el agente en cada momento (thinking,
// writing, coding, testing…) y la fase de cada herramienta llega al TODO por
// el bus de eventos. La tabla vive en claude-plugin/hooks/activity-core.ts.
// =============================================================================

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { activityOf, ACTIVITY_EVENT } from "../claude-plugin/hooks/activity-core.ts";
import { record } from "../claude-plugin/hooks/receipt-core.ts";

export default function (pi: ExtensionAPI) {
  const say = (ctx: ExtensionContext, word?: string): void => {
    if (ctx.hasUI) ctx.ui.setWorkingMessage(word && `${word}…`);
  };

  pi.on("agent_start", (_event, ctx) => say(ctx, "thinking"));
  pi.on("turn_start", (_event, ctx) => say(ctx, "thinking"));
  pi.on("message_update", (event, ctx) => {
    const update = event.assistantMessageEvent;
    if (update.type === "thinking_start") say(ctx, "thinking");
    else if (update.type === "text_start") say(ctx, "writing");
    else if (update.type === "toolcall_start") {
      // Mientras el modelo escribe la llamada ya se sabe la herramienta; los argumentos llegan después.
      const call = update.partial.content[update.contentIndex];
      if (call?.type === "toolCall") say(ctx, activityOf(call.name, record(call.arguments)));
    }
  });
  pi.on("tool_execution_start", (event, ctx) => {
    const activity = activityOf(event.toolName, record(event.args));
    say(ctx, activity);
    pi.events.emit(ACTIVITY_EVENT, activity);
  });
  pi.on("agent_end", (_event, ctx) => {
    say(ctx);
    pi.events.emit(ACTIVITY_EVENT, null);
  });
}
