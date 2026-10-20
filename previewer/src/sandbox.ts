// =============================================================================
// [AUTH] AISLAMIENTO DEL SISTEMA
// La guardia de texto no ve un `cd ../..`: el sistema operativo sí. Cada comando
// del revisor y cada sonda corren con el repositorio de Samu en solo lectura:
// `sandbox-exec` en macOS, `bwrap` en Linux si está instalado. Sin ninguno,
// queda la guardia de texto y la revisión lo dice como pendiente.
// =============================================================================

import { spawn, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import type { BashOperations } from "@earendil-works/pi-coding-agent";

export type Sandbox = { kind: "sandbox-exec" | "bwrap" | "none"; wrap: (command: string) => { file: string; args: string[] } };

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const KILL_GRACE_MS = 5_000;

function findBwrap(): string | null {
  const found = spawnSync("/bin/sh", ["-c", "command -v bwrap"], { encoding: "utf8" });
  return found.status === 0 && found.stdout.trim() ? found.stdout.trim() : null;
}

export function sandboxFor(origin: string): Sandbox {
  const paths = [...new Set([origin, realpathSync(origin)])];
  const plain = (command: string) => ({ file: "/bin/bash", args: ["-c", command] });
  if (process.env.N_EIN_PREVIEWER_SANDBOX === "none") return { kind: "none", wrap: plain };
  if (process.platform === "darwin" && existsSync(SANDBOX_EXEC)) {
    const quote = (path: string): string => `"${path.replace(/["\\]/g, "\\$&")}"`;
    const profile = `(version 1)(allow default)(deny file-write* ${paths.map((path) => `(subpath ${quote(path)})`).join(" ")})`;
    return { kind: "sandbox-exec", wrap: (command) => ({ file: SANDBOX_EXEC, args: ["-p", profile, "/bin/bash", "-c", command] }) };
  }
  const bwrap = process.platform === "linux" ? findBwrap() : null;
  if (bwrap) {
    const readOnly = paths.flatMap((path) => ["--ro-bind", path, path]);
    return { kind: "bwrap", wrap: (command) => ({ file: bwrap, args: ["--dev-bind", "/", "/", ...readOnly, "/bin/bash", "-c", command] }) };
  }
  return { kind: "none", wrap: plain };
}

/** Bash de Pi a través del aislamiento; para el grupo entero al cancelar o agotar el tiempo. */
export function sandboxedOperations(sandbox: Sandbox): BashOperations {
  return {
    exec(command, cwd, options) {
      return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error("aborted"));
          return;
        }
        const { file, args } = sandbox.wrap(command);
        const child = spawn(file, args, { cwd, detached: true, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] });
        let stopped = false;
        const stop = (): void => {
          if (stopped || child.pid === undefined) return;
          stopped = true;
          const group = -child.pid;
          try {
            process.kill(group, "SIGTERM");
          } catch {
            return;
          }
          setTimeout(() => {
            try {
              process.kill(group, "SIGKILL");
            } catch {
              // Ya terminó.
            }
          }, KILL_GRACE_MS).unref();
        };
        const timer = options.timeout ? setTimeout(stop, options.timeout * 1000) : undefined;
        options.signal?.addEventListener("abort", stop, { once: true });
        child.stdout.on("data", options.onData);
        child.stderr.on("data", options.onData);
        child.once("error", reject);
        child.once("close", (code) => {
          if (timer) clearTimeout(timer);
          options.signal?.removeEventListener("abort", stop);
          resolve({ exitCode: stopped ? 130 : code });
        });
      });
    },
  };
}
