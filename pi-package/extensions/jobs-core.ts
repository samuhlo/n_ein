// =============================================================================
// [FLOW] PROCESOS DE UNA SESIÓN
// Pi ejecuta y cancela el árbol. Aquí solo viven propiedad, logs y avisos;
// esperar un proceso no necesita otra llamada al modelo.
// =============================================================================
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
export type Job = {
  id: string;
  label: string;
  command: string;
  cwd: string;
  log: string;
  started: number;
  ended?: number;
  status: "running" | "passed" | "failed" | "stopped";
  exit: number | null;
  reason?: string;
  tail: string[];
  monitor: boolean;
};
type Execute = (
  command: string,
  cwd: string,
  options: { signal: AbortSignal; timeout: number; onData(data: Buffer): void },
) => Promise<{ exitCode: number | null }>;
export type Notice = { job: Job; kind: "result" | "lines"; lines: string[] };
const MAX_LOG = 16 * 1024 * 1024;
const safe = (s: string) => s.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");

export class Jobs {
  private items = new Map<
    string,
    {
      job: Job;
      controller: AbortController;
      done: Promise<void>;
      suppress: boolean;
    }
  >();
  private closing = false;
  constructor(
    private directory: string,
    private execute: Execute,
    private notice: (notice: Notice) => void,
    private changed = () => {},
  ) {}
  get closed(): boolean {
    return this.closing;
  }
  list(): Job[] {
    return [...this.items.values()].map(({ job }) => ({
      ...job,
      tail: [...job.tail],
    }));
  }
  start(
    command: string,
    cwd: string,
    label: string,
    timeout: number,
    monitor = false,
    execution?: Execute,
  ): Job {
    if (this.closing) throw new Error("La sesión está cerrando sus procesos.");
    if (!command.trim() || command.length > 32_768)
      throw new Error("Comando vacío o demasiado largo.");
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1800)
      throw new Error("Indica timeout_seconds entre 1 y 1800.");
    if (this.list().filter((j) => j.status === "running").length >= 8)
      throw new Error("Ya hay ocho procesos activos; espera o detén uno.");
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const id = randomUUID(),
      log = join(this.directory, `${id}.log`);
    writeFileSync(log, "", { mode: 0o600, flag: "wx" });
    const job: Job = {
      id,
      label: safe(label || command).slice(0, 120),
      command,
      cwd,
      log,
      started: Date.now(),
      status: "running",
      exit: null,
      tail: [],
      monitor,
    };
    const controller = new AbortController();
    const item = { job, controller, done: Promise.resolve(), suppress: false };
    this.items.set(id, item);
    let bytes = 0,
      pending = "",
      batch: string[] = [],
      omitted = 0,
      windowStart = Date.now(),
      windowLines = 0;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    const decoder = new StringDecoder("utf8");
    const deliver = (kind: Notice["kind"], lines: string[]) => {
      if (!this.closing && !item.suppress) {
        try {
          this.notice({ job: { ...job, tail: [...job.tail] }, kind, lines });
        } catch {
          /* La presentación no cambia el resultado. */
        }
      }
    };
    const flush = () => {
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = undefined;
      if (batch.length)
        deliver("lines", [
          ...batch,
          ...(omitted ? [`… ${omitted} líneas más en el log`] : []),
        ]);
      batch = [];
      omitted = 0;
    };
    const line = (text: string) => {
      const clean = safe(text.replace(/\r$/, "")).slice(-2000);
      job.tail.push(clean);
      if (job.tail.length > 20) job.tail.shift();
      if (!monitor || !clean || controller.signal.aborted) return;
      const now = Date.now();
      if (now - windowStart >= 60_000) {
        windowStart = now;
        windowLines = 0;
      }
      if (++windowLines > 120) {
        job.reason = "monitor detenido: más de 120 líneas por minuto";
        controller.abort();
        return;
      }
      if (batch.length < 20) batch.push(clean);
      else omitted++;
      if (!batchTimer) batchTimer = setTimeout(flush, 250);
    };
    const consume = (text: string) => {
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const value of lines) line(value);
      // Una línea sin salto tampoco puede crecer sin límite en memoria.
      if (pending.length > 4000) pending = pending.slice(-4000);
    };
    const timer = setTimeout(() => {
      job.reason = `tiempo agotado (${timeout}s)`;
      controller.abort();
    }, timeout * 1000);
    const run = execution ?? this.execute;
    item.done = Promise.resolve()
      .then(() =>
        run(command, cwd, {
          signal: controller.signal,
          timeout,
          onData: (chunk) => {
            if (controller.signal.aborted) return;
            bytes += chunk.length;
            if (bytes > MAX_LOG) {
              job.reason = "salida supera 16 MiB";
              controller.abort();
              return;
            }
            try {
              appendFileSync(log, chunk);
              consume(decoder.write(chunk));
            } catch (error) {
              job.reason = `No se pudo guardar la salida: ${String(error)}`;
              controller.abort();
            }
          },
        }),
      )
      .then(
        (result) => {
          job.exit = result.exitCode;
          job.status = controller.signal.aborted
            ? "stopped"
            : result.exitCode === 0
              ? "passed"
              : "failed";
        },
        (error) => {
          job.status = controller.signal.aborted ? "stopped" : "failed";
          job.reason ??= String(error);
        },
      )
      .finally(() => {
        clearTimeout(timer);
        consume(decoder.end());
        if (pending) line(pending);
        flush();
        job.ended = Date.now();
        deliver("result", job.tail);
        this.update();
      });
    this.update();
    return { ...job, tail: [] };
  }
  private update(): void {
    try {
      this.changed();
    } catch {
      /* La vista no altera el resultado ni la parada. */
    }
  }
  async stop(id: string, silent = false): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error("Proceso ajeno o desconocido.");
    item.suppress = silent;
    if (item.job.status === "running") {
      item.job.reason = "detenido por petición";
      item.controller.abort();
    }
    await item.done;
  }
  async wait(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error("Proceso desconocido");
    await item.done;
  }
  async close(): Promise<void> {
    this.closing = true;
    await Promise.all([...this.items.keys()].map((id) => this.stop(id, true)));
  }
}

// Pi carga extensiones por separado. Solo compartimos ejecutores locales a este
// proceso; las identidades de sesión evitan parar otras conversaciones.
const key = Symbol.for("n-ein.jobs");
const registry = (): Map<string, Jobs> =>
  ((globalThis as any)[key] ??= new Map<string, Jobs>());
export function ownJobs(session: string, jobs: Jobs): void {
  registry().set(session, jobs);
}
export async function stopSessionJobs(session: string): Promise<void> {
  const jobs = registry().get(session);
  if (!jobs) return;
  await jobs.close();
  registry().delete(session);
}
