// =============================================================================
// [FLOW] TRANSPORTE RPC DE TRABAJADORES
// El protocolo público de Pi evita depender de campos privados de RpcClient.
// El host Go conserva la propiedad; settled y salida son hechos distintos.
// =============================================================================
import { spawn, execFileSync } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

export type WorkerResult = {
  status: "ready" | "stopped" | "failed";
  text: string;
  error?: string;
  tokens: number;
  cost: number;
  usageKnown: boolean;
};
export type WorkerOptions = {
  host: string;
  cwd: string;
  leaseCwd?: string;
  binary: string;
  args: string[];
  prompt: string;
  env: NodeJS.ProcessEnv;
  onEvent(event: any): void;
  idleMs?: number;
  toolMs?: number;
};
export function startWorker(options: WorkerOptions) {
  const env = { ...options.env };
  delete env.N_EIN_LEASE_FD;
  const child = spawn(
    options.host,
    [
      "--worker-host",
      "--project",
      options.leaseCwd || options.cwd,
      "--worker-cwd",
      options.cwd,
      "--",
      options.binary,
      ...options.args,
    ],
    { cwd: options.cwd, env, stdio: ["pipe", "pipe", "pipe"] },
  );
  const decoder = new StringDecoder("utf8");
  let buffer = "",
    stderr = "",
    text = "",
    settled = false,
    cancelled = false,
    closed = false,
    stopping = false,
    error: string | undefined;
  let fatalError: string | undefined;
  let tokens = 0,
    cost = 0,
    usageKnown = false,
    sequence = 0;
  const inFlight = new Set<string>();
  const pending = new Map<
    string,
    {
      resolve(value: any): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let timer: ReturnType<typeof setTimeout>;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stopProcess = () => {
    if (stopping || closed) return;
    stopping = true;
    clearTimeout(timer);
    child.stdin.end();
    killTimer = setTimeout(() => child.kill("SIGTERM"), 2000);
  };
  const fail = (reason: string) => {
    fatalError ??= reason;
    error ??= reason;
    stopProcess();
  };
  const arm = () => {
    clearTimeout(timer);
    if (!stopping)
      timer = setTimeout(
        () => fail(inFlight.size ? "tool timed out" : "worker stalled"),
        inFlight.size
          ? (options.toolMs ?? 1_800_000)
          : (options.idleMs ?? 240_000),
      );
  };
  const request = (type: string, data: Record<string, unknown> = {}) =>
    new Promise<any>((resolve, reject) => {
      if (stopping || closed) {
        reject(new Error("worker stopped"));
        return;
      }
      const id = String(++sequence);
      const timeout = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error(`RPC ${type} timed out`));
        },
        type === "get_state" ? 90_000 : 15_000,
      );
      pending.set(id, { resolve, reject, timer: timeout });
      child.stdin.write(JSON.stringify({ id, type, ...data }) + "\n", (e) => {
        if (e) {
          const p = pending.get(id);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(id);
            p.reject(e);
          }
        }
      });
    });
  const onRecord = (event: any) => {
    if (event.type === "response") {
      const p = pending.get(event.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(event.id);
        event.success
          ? p.resolve(event.data)
          : p.reject(new Error(event.error || "RPC failure"));
      }
      return;
    }
    if (event.type === "tool_execution_start") inFlight.add(event.toolCallId);
    if (event.type === "tool_execution_end") inFlight.delete(event.toolCallId);
    if (event.type === "message_end" && event.message?.role === "assistant") {
      const m = event.message;
      const value = (m.content ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      if (value) text = value;
      if (m.stopReason === "error" || m.stopReason === "aborted")
        error = m.errorMessage || m.stopReason;
      else if (m.stopReason === "stop" && !fatalError) error = undefined;
      if (m.usage) {
        usageKnown = true;
        tokens +=
          (m.usage.input ?? 0) +
          (m.usage.output ?? 0) +
          (m.usage.cacheRead ?? 0) +
          (m.usage.cacheWrite ?? 0);
        cost += m.usage.cost?.total ?? 0;
      }
    }
    arm();
    try {
      options.onEvent(event);
    } catch (e) {
      fail(`recording worker event: ${e}`);
    }
    if (event.type === "agent_settled") {
      settled = true;
      if (!text && !error)
        text =
          "Worker settled without a text report. Inspect the saved assignment, session evidence and any preserved changes before accepting its result.";
      stopProcess();
    }
    if (
      event.type === "extension_ui_request" &&
      event.id &&
      ["input", "select", "confirm", "editor"].includes(event.method)
    ) {
      child.stdin.write(
        JSON.stringify({
          type: "extension_ui_response",
          id: event.id,
          cancelled: true,
        }) + "\n",
      );
    }
  };
  child.stdout.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    if (buffer.length > 8 * 1024 * 1024) {
      fail("RPC frame exceeded 8 MiB");
      return;
    }
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try {
        onRecord(JSON.parse(line));
      } catch {
        fail("invalid RPC record");
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
  });
  child.stdin.on("error", () => {});
  arm();
  const done = new Promise<WorkerResult>((resolve) => {
    child.on("error", (e) => fail(e.message));
    child.on("close", async () => {
      closed = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("worker exited"));
      }
      pending.clear();
      // El descriptor heredado mantiene busy si todavía vive un comando del hijo.
      let free = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        try {
          execFileSync(
            options.host,
            [
              "--worker-probe",
              "--project",
              options.leaseCwd || options.cwd,
              "--worker-cwd",
              options.cwd,
            ],
            { env, cwd: options.cwd, stdio: "pipe", timeout: 500 },
          );
          free = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      if (!free)
        error = "worker exit unconfirmed: tree still owned; preserve worktree";
      if (!settled && !stopping && !error)
        error = stderr || "worker exited before agent_settled";
      resolve({
        status:
          !free || fatalError
            ? "failed"
            : cancelled
              ? "stopped"
              : error
                ? "failed"
                : settled
                  ? "ready"
                  : "stopped",
        text,
        error,
        tokens,
        cost,
        usageKnown,
      });
    });
  });
  void (async () => {
    try {
      await request("get_state");
      const response = await request("prompt", { message: options.prompt });
      if (response?.disposition === "handled")
        fail("prompt handled without starting work");
    } catch (e) {
      if (!stopping) fail(String(e));
    }
  })();
  return {
    pid: child.pid,
    done,
    async steer(message: string) {
      await request("steer", { message });
    },
    async stop() {
      cancelled = true;
      stopProcess();
      return done;
    },
  };
}
