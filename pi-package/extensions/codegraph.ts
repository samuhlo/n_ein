// =============================================================================
// [FLOW] CODEGRAPH EN PI
// Pi no habla MCP, así que el índice entra como herramienta. Sincroniza antes
// de cada consulta (≈0,2 s sin cambios): tras una edición, lo que responde es
// el código actual. El trabajador hereda la herramienta por el mismo paquete.
// =============================================================================

import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const OUTPUT_LIMIT = 60_000;
const TIMEOUT_MS = 60_000;

function run(binary: string, args: string[], cwd: string, signal?: AbortSignal): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(binary, args, {
      cwd,
      signal,
      timeout: TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, DO_NOT_TRACK: "1" },
    }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

export default function (pi: ExtensionAPI) {
  const binary = process.env.N_EIN_CODEGRAPH_BIN;
  if (!binary) return;

  pi.registerTool({
    name: "codegraph_explore",
    label: "CodeGraph",
    description: "Explora el código del proyecto con el índice de CodeGraph: devuelve el código fuente literal de los símbolos relevantes, las rutas de llamada entre ellos y qué depende de ellos. Úsala ANTES de grep/find/read para cualquier pregunta estructural: cómo funciona algo, quién llama a qué, qué rompe un cambio, dónde vive una pieza. Nombra funciones, tipos o archivos concretos en la consulta. El código devuelto equivale a haberlo leído; lee aparte solo lo que falte.",
    parameters: Type.Object({
      query: Type.String({ description: "Qué explorar: símbolos, archivos o la pregunta, con los nombres concretos que conozcas" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      // Un sync fallido no invalida la consulta: el índice anterior sigue sirviendo.
      // Los lectores comparten el árbol: no regeneran el índice del escritor.
      if (process.env.N_EIN_ASSIGNMENT_MODE !== "read")
        await run(binary, ["sync", "--quiet"], ctx.cwd, signal);
      const result = await run(binary, ["explore", String(params.query)], ctx.cwd, signal);
      if (result.code !== 0) {
        const reason = (result.stderr || result.stdout).trim().slice(0, 2000) || `exit ${result.code}`;
        return { content: [{ type: "text", text: `[ERR] :: CODEGRAPH_FAIL :: reason: ${reason}\nUsa grep/read como alternativa e indícalo.` }] };
      }
      const text = result.stdout.length > OUTPUT_LIMIT
        ? `${result.stdout.slice(0, OUTPUT_LIMIT)}\n\n[recortado a ${OUTPUT_LIMIT} caracteres: afina la consulta con nombres concretos]`
        : result.stdout;
      return { content: [{ type: "text", text }] };
    },
  });
}
