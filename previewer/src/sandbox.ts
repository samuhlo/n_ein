// =============================================================================
// [AUTH] AISLAMIENTO DEL SISTEMA
// La guardia de texto no ve un `cd ../..`: el sistema operativo sí. Cada comando
// del revisor y cada sonda solo pueden escribir en la copia, los temporales y
// las cachés de herramientas (instalar dependencias, compilar): el resto del
// disco, incluido el repositorio del usuario, queda en solo lectura. `sandbox-exec`
// en macOS, `bwrap` en Linux si está instalado. Sin ninguno, o dentro de otro
// aislamiento que no deja anidar, queda la guardia de texto y la revisión lo dice.
// =============================================================================

import { spawn, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { BashOperations } from "@earendil-works/pi-coding-agent";

export type Sandbox = { kind: "sandbox-exec" | "bwrap" | "injected" | "none"; wrap: (command: string) => { file: string; args: string[] } };

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const KILL_GRACE_MS = 5_000;

function findBwrap(): string | null {
  const found = spawnSync("/bin/sh", ["-c", "command -v bwrap"], { encoding: "utf8" });
  return found.status === 0 && found.stdout.trim() ? found.stdout.trim() : null;
}

/** Dónde puede escribir el revisor además de su copia. Solo las rutas que existen, ya resueltas. */
function writablePaths(copy: string): string[] {
  const home = homedir();
  const candidates = [
    copy, tmpdir(), "/tmp", "/private/tmp", "/private/var/folders", "/dev",
    join(home, ".bun"), join(home, ".cache"), join(home, ".npm"), join(home, "Library/Caches"),
    join(home, "go"), join(process.env.N_EIN_HOME || join(home, ".n_ein"), "cache"),
    // Cachés de Go que fija scripts/check.sh de n_ein.
    join(process.env.N_EIN_HOME || join(home, ".n_ein"), "dev/go-cache"),
  ];
  return [...new Set(candidates.filter((path) => existsSync(path)).map((path) => realpathSync(path)))];
}

const usable = (file: string, args: string[]): boolean => spawnSync(file, [...args, "/usr/bin/true"], { stdio: "ignore" }).status === 0;

export function sandboxFor(copy: string, origin: string): Sandbox {
  const plain = (command: string) => ({ file: "/bin/bash", args: ["-c", command] });
  if (process.env.N_EIN_PREVIEWER_SANDBOX === "none") return { kind: "none", wrap: plain };
  const writable = writablePaths(copy);
  // BLINDAJE -> El original se cierra al final aunque viva bajo una ruta permitida (un temporal, una caché).
  const closed = [...new Set([origin, realpathSync(origin)])];
  if (process.platform === "darwin" && existsSync(SANDBOX_EXEC)) {
    const quote = (path: string): string => `"${path.replace(/["\\]/g, "\\$&")}"`;
    // En SBPL gana la última regla que coincide: primero se niega toda escritura, después se abre lo permitido.
    const subpaths = (paths: string[]): string => paths.map((path) => `(subpath ${quote(path)})`).join(" ");
    const profile = `(version 1)(allow default)(deny file-write*)(allow file-write* ${subpaths(writable)})(deny file-write* ${subpaths(closed)})`;
    const args = ["-p", profile];
    if (usable(SANDBOX_EXEC, args)) return { kind: "sandbox-exec", wrap: (command) => ({ file: SANDBOX_EXEC, args: [...args, "/bin/bash", "-c", command] }) };
  }
  const bwrap = process.platform === "linux" ? findBwrap() : null;
  if (bwrap) {
    const args = ["--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", ...writable.filter((path) => path !== "/dev").flatMap((path) => ["--bind", path, path]), ...closed.flatMap((path) => ["--ro-bind", path, path])];
    if (usable(bwrap, args)) return { kind: "bwrap", wrap: (command) => ({ file: bwrap, args: [...args, "/bin/bash", "-c", command] }) };
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
