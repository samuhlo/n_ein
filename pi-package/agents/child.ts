import {
  createBashToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { existsSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { ownedShell } from "./shell.ts";

export default function (pi: ExtensionAPI) {
  const host = process.env.N_EIN_WORKER_HOST;
  if (!host || process.env.N_EIN_LEASE_FD !== "3")
    throw new Error("worker requires its owning launcher");
  const shell = ownedShell(host);
  pi.on("session_start", async (_event, ctx) => {
    if (!process.env.N_EIN_CODEGRAPH_BIN) return;
    const script = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../bin/n-ein-codegraph",
    );
    const quote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";
    try {
      await shell.exec(quote(script), ctx.cwd, {
        onData: (data) => {
          process.stderr.write(data);
        },
        timeout: 60,
      });
    } catch {
      process.stderr.write(
        "[WARN] :: INDEX_SKIP :: worker index unavailable\n",
      );
    }
  });
  pi.registerTool(
    createBashToolDefinition(process.cwd(), { operations: shell }),
  );
  // Los permisos del encargo no incluyen escribir en el árbol del coordinador.
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const path = resolve(ctx.cwd, String((event.input as any).path ?? ""));
    let ancestor = path;
    while (!existsSync(ancestor) && dirname(ancestor) !== ancestor)
      ancestor = dirname(ancestor);
    const canonical = resolve(realpathSync(ancestor), relative(ancestor, path));
    const rel = relative(realpathSync(ctx.cwd), canonical);
    if (rel === ".." || rel.startsWith("../") || basename(path) === "WORK.md")
      return {
        block: true,
        reason:
          "Return the proposed shared change to the coordinator; write only inside your worktree and do not edit WORK.md.",
      };
  });
}
