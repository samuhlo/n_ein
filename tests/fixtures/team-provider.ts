import {
  createAssistantMessageEventStream,
  collapseSystemMessages,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { basename, join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

export default function (pi: ExtensionAPI) {
  let calls = 0;
  pi.registerProvider("nein-test", {
    api: "nein-scripted-team",
    apiKey: "local-test",
    baseUrl: "http://127.0.0.1",
    models: [
      {
        id: "team",
        name: "Scripted team",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 100000,
        maxTokens: 1000,
      },
    ],
    streamSimple(model, context) {
      const stream = createAssistantMessageEventStream();
      const n = ++calls;
      let content: any[],
        reason = "toolUse";
      const tool = (name: string, args: unknown, id = String(n)) => ({
        type: "toolCall",
        id,
        name,
        arguments: args,
      });
      if (process.env.N_EIN_CHILD === "1") {
        const file = `child-${basename(process.cwd())}.txt`;
        if (n === 1)
          content = [
            tool("bash", {
              command: `sleep 0.8; printf done > '${file}'; git add '${file}'; git commit -qm worker`,
            }),
          ];
        else {
          content = [{ type: "text", text: "Ready for integration." }];
          reason = "stop";
        }
      } else if (n === 1) {
        content = [
          tool("nein_team", {
            action: "start",
            tasks: ["T1", "T2"].map((taskId) => ({
              taskId,
              label: taskId,
              prompt: "Write and commit your own marker file.",
              class: "ordinario",
            })),
          }),
        ];
      } else if (n === 2) {
        content = [
          tool("bash", {
            command:
              "printf parent > parent.txt; git add parent.txt; git commit -qm parent",
          }),
        ];
      } else if (n === 3) {
        content = [{ type: "text", text: "Waiting for worker results." }];
        reason = "stop";
      } else if (n === 4) {
        const messages = JSON.stringify(
          collapseSystemMessages(context).messages,
        );
        const dir = join(process.cwd(), ".git/n_ein/team");
        const tasks = readdirSync(dir)
          .filter((x) => x.endsWith(".json"))
          .map((x) => JSON.parse(readFileSync(join(dir, x), "utf8")));
        if (!messages.includes("Ready for integration."))
          throw new Error("Parent continued without receiving worker results");
        content = tasks.map((t, i) =>
          tool("nein_team", { action: "integrate", id: t.id }, `merge-${i}`),
        );
      } else {
        content = [{ type: "text", text: "INTEGRATED" }];
        reason = "stop";
      }
      const message: any = {
        role: "assistant",
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content,
        stopReason: reason,
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      queueMicrotask(() => {
        stream.push({ type: "done", reason: reason as any, message });
        stream.end();
      });
      return stream;
    },
  });
}
