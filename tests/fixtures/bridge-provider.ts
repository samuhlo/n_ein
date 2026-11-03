// Proveedores deterministas: un «claude-bridge» que pide nein_set_task y un ejecutor. Cada llamada queda en el log.
import { appendFileSync } from "node:fs";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const model = (id: string) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text" as const],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 272000,
  maxTokens: 1000,
});

function reply(m: any, content: unknown[], stopReason: "stop" | "toolUse") {
  const stream = createAssistantMessageEventStream();
  const message: any = {
    role: "assistant",
    api: m.api,
    provider: m.provider,
    model: m.id,
    timestamp: Date.now(),
    content,
    stopReason,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  };
  queueMicrotask(() => {
    stream.push({ type: "done", reason: stopReason, message });
    stream.end();
  });
  return stream;
}

export default function (pi: ExtensionAPI) {
  const log = (provider: string, context: any) => {
    const last = context.messages.at(-1);
    appendFileSync(process.env.N_EIN_TEST_LOG!, JSON.stringify({ provider, last: last?.role }) + "\n");
  };
  pi.registerProvider("claude-bridge", {
    api: "bridge-test",
    apiKey: "fixture",
    baseUrl: "http://127.0.0.1",
    models: [model("claude-opus-5-5")],
    streamSimple(m, context) {
      log("claude-bridge", context);
      return context.messages.at(-1)?.role === "toolResult"
        ? reply(m, [{ type: "text", text: "OPUS_CLOSED" }], "stop")
        : reply(m, [{ type: "toolCall", id: "task", name: "nein_set_task", arguments: { clase: "ordinario", transition: "start_implementation", request: "Hazlo", reason: "diseño acordado" } }], "toolUse");
    },
  });
  pi.registerProvider("exec-test", {
    api: "exec-test",
    apiKey: "fixture",
    baseUrl: "http://127.0.0.1",
    models: [model("model")],
    streamSimple(m, context) {
      log("exec-test", context);
      return reply(m, [{ type: "text", text: "BUILD_ON_EXECUTOR" }], "stop");
    },
  });
}
