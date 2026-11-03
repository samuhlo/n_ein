// Proveedor determinista: pide un único bash con el comando de la prueba y después cierra.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  let first = true;
  pi.registerProvider("guard-test", {
    api: "guard-test",
    apiKey: "fixture",
    baseUrl: "http://127.0.0.1",
    models: [
      {
        id: "model",
        name: "test",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 272000,
        maxTokens: 1000,
      },
    ],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream(),
        start = first;
      first = false;
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content: start
          ? [{ type: "toolCall", id: "run", name: "bash", arguments: { command: process.env.N_EIN_TEST_COMMAND } }]
          : [{ type: "text", text: "GUARD_DONE" }],
        stopReason: start ? "toolUse" : "stop",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      queueMicrotask(() => {
        stream.push({ type: "done", reason: message.stopReason, message });
        stream.end();
      });
      return stream;
    },
  });
}
