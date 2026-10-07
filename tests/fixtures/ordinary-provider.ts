// Atraviesa el enrutador y herramientas reales sin inferencia externa.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  let calls = 0;
  pi.registerProvider("nein-test", {
    api: "nein-ordinary",
    apiKey: "test",
    baseUrl: "http://127.0.0.1",
    models: ["cheap", "capable", "risk"].map((id) => ({
      id,
      name: id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 272000,
      maxTokens: 1000,
    })),
    streamSimple(model) {
      const first = calls++ === 0;
      const stream = createAssistantMessageEventStream();
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
                id: "discovered-risk",
                name: "nein_escalate",
                arguments: {
                  reason: "Discovery: this change affects permissions",
                },
              },
            ]
          : [
              {
                type: "text",
                text: JSON.stringify({
                  model: model.id,
                  tools: pi.getActiveTools(),
                }),
              },
            ],
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
