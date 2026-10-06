// Proveedor determinista para atravesar Pi y sus herramientas sin llamadas externas.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_TEST_PID)
    writeFileSync(process.env.N_EIN_TEST_PID, String(process.pid));
  let calls = 0;
  pi.registerProvider("nein-test", {
    api: "nein-scripted",
    apiKey: "local-test",
    baseUrl: "http://127.0.0.1",
    models: [
      {
        id: "scripted",
        name: "Scripted",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 100000,
        maxTokens: 1000,
      },
    ],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream();
      const first = calls++ === 0;
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content: first
          ? [
              {
                type: "toolCall",
                id: "owned-command",
                name: "bash",
                arguments: {
                  command: process.env.N_EIN_TEST_COMMAND || "printf checked",
                },
              },
            ]
          : [{ type: "text", text: "checked" }],
        stopReason: first ? "toolUse" : "stop",
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
