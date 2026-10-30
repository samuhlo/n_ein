// [AUTH] PROCESOS POR EL CANAL NATIVO DE HERRAMIENTAS
// executeTool conserva validación, hooks y permisos de bash. Usar solo su
// backend de procesos saltaría los controles que un proyecto haya instalado.
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { openSync, closeSync, readSync } from "node:fs";
export function jobExecutor(ctx: Pick<ExtensionToolContext, "executeTool">) {
  return async (
    command: string,
    cwd: string,
    options: {
      signal: AbortSignal;
      timeout: number;
      onData(data: Buffer): void;
    },
  ) => {
    let emitted = 0;
    let captureError: unknown;
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) abort();
    const capture = (value: any) => {
      const path =
        value.details?.fullOutputPath ??
        value.structuredContent?.full_output_path;
      if (typeof path === "string") {
        const fd = openSync(path, "r");
        try {
          const buffer = Buffer.alloc(64 * 1024);
          while (!options.signal.aborted) {
            const n = readSync(fd, buffer, 0, buffer.length, emitted);
            if (!n) break;
            emitted += n;
            options.onData(Buffer.from(buffer.subarray(0, n)));
          }
        } finally {
          closeSync(fd);
        }
      } else {
        const text =
          value.structuredContent?.output ??
          (value.content ?? [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("\n");
        const bytes = Buffer.from(text);
        if (bytes.length > emitted) {
          const addition = bytes.subarray(emitted);
          emitted = bytes.length;
          options.onData(addition);
        }
      }
    };
    // El cwd de la sesión puede cambiar mientras un comando espera permiso.
    const quoted = "'" + cwd.replace(/'/g, "'\\''") + "'";
    const safelyCapture = (value: any) => {
      try {
        capture(value);
      } catch (error) {
        captureError = error;
        controller.abort();
      }
    };
    let result;
    try {
      result = await ctx.executeTool(
        "bash",
        { command: `cd -- ${quoted}\n${command}`, timeout: options.timeout },
        { signal: controller.signal, onUpdate: safelyCapture },
      );
    } finally {
      options.signal.removeEventListener("abort", abort);
    }
    safelyCapture(result.result);
    if (captureError)
      throw new Error(
        `No se pudo conservar la salida: ${String(captureError)}`,
      );
    const code = (
      result.result.structuredContent as { exit_code?: unknown } | undefined
    )?.exit_code;
    if (typeof code !== "number")
      throw new Error(
        result.result.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n") || "bash no entregó código de salida",
      );
    return { exitCode: code };
  };
}
