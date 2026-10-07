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
      const resuming = process.env.N_EIN_TEST_RESUME === "1";
      const handoff = process.env.N_EIN_TEST_ACTIVE_HANDOFF === "1";
      let content: any[],
        reason = "toolUse";
      const tool = (name: string, args: unknown, id = String(n)) => ({
        type: "toolCall",
        id,
        name,
        arguments: args,
      });
      if (process.env.N_EIN_CHILD === "1") {
        const continuity = process.env.N_EIN_TEST_CONTINUITY === "1";
        const partial =
          continuity &&
          JSON.stringify(collapseSystemMessages(context).messages).includes(
            "assignment T2:",
          );
        const file = continuity
          ? partial
            ? "partial.txt"
            : "first.txt"
          : `child-${basename(process.cwd())}.txt`;
        if (n === 1)
          content = [
            tool("bash", {
              command:
                resuming &&
                JSON.stringify(
                  collapseSystemMessages(context).messages,
                ).includes("Continuation:")
                  ? `test -f '${file}'; printf resumed > resumed.txt; git add resumed.txt; git commit -qm resumed`
                  : handoff
                    ? "printf live > live.txt; sleep 30"
                    : continuity
                      ? partial
                        ? `printf 'partial-${process.env.N_EIN_TEST_MARKER}' > partial.txt; sleep 30`
                        : `printf 'first-${process.env.N_EIN_TEST_MARKER}' > first.txt; git add first.txt; git commit -qm worker`
                      : `sleep ${JSON.stringify(collapseSystemMessages(context).messages).includes("assignment T1:") ? 3 : 0.3}; printf done > '${file}'; git add '${file}'; git commit -qm worker`,
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
      } else if (handoff && n === 2) {
        const dir = join(process.cwd(), ".git/n_ein/team");
        const tasks = readdirSync(dir)
          .filter((x) => x.endsWith(".json"))
          .map((x) => JSON.parse(readFileSync(join(dir, x), "utf8")))
          .filter((t) => t.status === "running");
        content = [
          tool("bash", {
            command: tasks
              .map(
                (t) =>
                  `while [ ! -f '${t.cwd}/live.txt' ]; do sleep 0.02; done`,
              )
              .join("; "),
            timeout: 10,
          }),
        ];
      } else if (handoff && n === 3) {
        content = [
          tool("nein_handoff", {
            destination: "claude",
            request: "continue with Claude",
          }),
        ];
      } else if (handoff) {
        content = [
          { type: "text", text: "Transferring after stopping the workers." },
        ];
        reason = "stop";
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
      } else {
        const messages = JSON.stringify(
          collapseSystemMessages(context).messages,
        );
        const tasks = readdirSync(join(process.cwd(), ".git/n_ein/team"))
          .filter((x) => x.endsWith(".json"))
          .map((x) =>
            JSON.parse(
              readFileSync(join(process.cwd(), ".git/n_ein/team", x), "utf8"),
            ),
          );
        const second = tasks.find((t) => t.taskId === "T2");
        if (!messages.includes("Ready for integration."))
          throw new Error("Parent continued without receiving worker results");
        if (resuming && second?.status === "ready" && second.attempt === 1) {
          content = [
            tool("nein_team", {
              action: "resume",
              id: second.id,
              message:
                "Continue by adding resumed.txt while keeping the previous marker.",
            }),
          ];
        } else {
          const ready = tasks.filter((t) => t.status === "ready");
          if (ready.length)
            content = ready.map((t, i) =>
              tool(
                "nein_team",
                { action: "integrate", id: t.id },
                `merge-${n}-${i}`,
              ),
            );
          else {
            content = [
              {
                type: "text",
                text: tasks.every((t) => t.status === "integrated")
                  ? "INTEGRATED"
                  : "Waiting for pending worker results.",
              },
            ];
            reason = "stop";
          }
        }
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
