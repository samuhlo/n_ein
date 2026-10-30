// Proveedor determinista: el trabajo real pasa por bash y sus hooks.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  let first = true;
  pi.on("tool_call", (event) => {
    if (event.toolName === "bash" && process.env.N_EIN_TEST_DENY_JOB === "1")
      return { block: true, reason: "native-test-denial" };
  });
  pi.registerProvider("jobs-test", {
    api: "jobs-test",
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
      const stream = createAssistantMessageEventStream(),
        start = first;
      first = false;
      const received = JSON.stringify(context.messages).includes("Estado:");
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content: start
          ? [
              {
                type: "toolCall",
                id: "start-job",
                name: "nein_job",
                arguments: {
                  action: "start",
                  command:
                    "echo start; sleep 0.1; echo end; echo owned > marker",
                  timeout_seconds: 5,
                },
              },
            ]
          : [{ type: "text", text: received ? "JOB_OBSERVED" : "waiting" }],
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
