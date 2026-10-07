// Proveedor determinista: intenta herramientas ajenas al encargo de lectura.
import {
  createAssistantMessageEventStream,
  collapseSystemMessages,
} from "@earendil-works/pi-ai";
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
      let content: any[] =
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
      if (process.env.N_EIN_CHILD !== "1") {
        content =
          n === 0
            ? [
                {
                  type: "toolCall",
                  id: "start-research",
                  name: "nein_team",
                  arguments: {
                    action: "start",
                    tasks: [
                      {
                        mode: "read",
                        taskId: "R3",
                        label: "Current evidence",
                        class: "ordinario",
                        prompt:
                          "Read source.txt and report its current contents with evidence. Do not change anything.",
                      },
                    ],
                  },
                },
              ]
            : [
                {
                  type: "text",
                  text:
                    n === 1
                      ? "Waiting for the research result."
                      : "RESEARCH DELIVERED " +
                        JSON.stringify(
                          collapseSystemMessages(context).messages,
                        ),
                },
              ];
      }
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content,
        stopReason: content.some((c) => c.type === "toolCall")
          ? "toolUse"
          : "stop",
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
