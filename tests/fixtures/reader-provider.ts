// Proveedor determinista: intenta herramientas ajenas al encargo de lectura.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  let calls = 0;
  pi.registerProvider("nein-test", {
    api: "nein-reader",
    apiKey: "local-test",
    baseUrl: "http://127.0.0.1",
    models: [
      {
        id: "reader",
        name: "Reader",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 100000,
        maxTokens: 1000,
      },
    ],
    streamSimple(model, context) {
      const stream = createAssistantMessageEventStream();
      const tools = pi.getActiveTools();
      const n = calls++;
      const content: any[] =
        n === 0
          ? [
              {
                type: "toolCall",
                id: "read-source",
                name: "read",
                arguments: { path: "source.txt" },
              },
            ]
          : n === 1
            ? [
                {
                  type: "toolCall",
                  id: "attempt-bash",
                  name: "bash",
                  arguments: { command: "touch forbidden.txt" },
                },
                {
                  type: "toolCall",
                  id: "attempt-write",
                  name: "write",
                  arguments: { path: "forbidden.txt", content: "bad" },
                },
              ]
            : [
                {
                  type: "text",
                  text: JSON.stringify({
                    tools,
                    messages: context.messages
                      .filter((m) => m.role === "toolResult")
                      .map((m) => m.content),
                  }),
                },
              ];
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content,
        stopReason: n < 2 ? "toolUse" : "stop",
        usage: {
          input: 10,
          output: 5,
          cacheRead: 20,
          cacheWrite: 0,
          totalTokens: 35,
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
