// Proveedor determinista: cada petición del usuario llama a nein_ask con N_EIN_TEST_ASK y, con su
// resultado, cierra el turno.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  let calls = 0;
  pi.registerProvider("ask-test", {
    api: "ask-test",
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
    streamSimple(model, context) {
      const stream = createAssistantMessageEventStream();
      const asking = context.messages.at(-1)?.role === "user";
      if (asking) calls += 1;
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content: asking
          ? [{ type: "toolCall", id: `ask-${calls}`, name: "nein_ask", arguments: JSON.parse(process.env.N_EIN_TEST_ASK ?? "{}") }]
          : [{ type: "text", text: "ASK_DONE" }],
        stopReason: asking ? "toolUse" : "stop",
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
