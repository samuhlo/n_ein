// =============================================================================
// [FLOW] CODEGRAPH EN PI
// Pi no habla MCP, así que el índice entra como herramienta. Sincroniza antes
// de cada consulta (≈0,2 s sin cambios): tras una edición, lo que responde es
// el código actual. El trabajador hereda la herramienta por el mismo paquete.
// =============================================================================

import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const OUTPUT_LIMIT = 60_000;
const TIMEOUT_MS = 60_000;

function run(
  binary: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      binary,
      args,
      {
        cwd,
        signal,
        timeout: TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, DO_NOT_TRACK: "1" },
      },
      (error, stdout, stderr) => {
        const code = error
          ? typeof error.code === "number"
            ? error.code
            : 1
          : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

export default function (pi: ExtensionAPI) {
  const binary = process.env.N_EIN_CODEGRAPH_BIN;
  if (!binary) return;

  pi.registerTool({
    name: "codegraph_explore",
    label: "CodeGraph",
    description:
      "Explore project structure with CodeGraph before grep/find/read: relevant literal source, callers and dependencies. Name concrete symbols or paths and one question. Returned source is already read; retrieve only missing or changed evidence. Source is limited to 3 files by default; raise maxFiles for a specific cross-cutting question. Use the omitted-symbol references to focus follow-ups instead of repeating a broad map.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "The structural question, naming concrete symbols or files when known",
      }),
      maxFiles: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 12,
          description:
            "Files whose literal source is included; default 3. Expand only for the needed scope.",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      // Un sync fallido no invalida la consulta: el índice anterior sigue sirviendo.
      // Los lectores comparten el árbol: no regeneran el índice del escritor.
      const sync =
        process.env.N_EIN_ASSIGNMENT_MODE === "read"
          ? undefined
          : await run(binary, ["sync", "--quiet"], ctx.cwd, signal);
      const result = await run(
        binary,
        [
          "explore",
          String(params.query),
          "--max-files",
          String(params.maxFiles ?? 3),
        ],
        ctx.cwd,
        signal,
      );
      if (result.code !== 0) {
        const reason =
          (result.stderr || result.stdout).trim().slice(0, 2000) ||
          `exit ${result.code}`;
        return {
          content: [
            {
              type: "text",
              text: `[ERR] :: CODEGRAPH_FAIL :: reason: ${reason}\nUsa grep/read como alternativa e indícalo.`,
            },
          ],
          details: undefined,
        };
      }
      const warning =
        sync && sync.code !== 0
          ? `[WARN] :: INDEX_STALE :: ${String(
              sync.stderr || sync.stdout || `exit ${sync.code}`,
            )
              .trim()
              .slice(
                0,
                500,
              )}\nLa sincronización falló: confirma las relaciones relevantes en los archivos actuales.\n\n`
          : "";
      let text = result.stdout;
      let fullOutputPath: string | undefined;
      if (text.length > OUTPUT_LIMIT) {
        // Conservar la fuente completa permite ampliar sin repetir la exploración.
        try {
          fullOutputPath = join(
            mkdtempSync(join(tmpdir(), "nein-codegraph-")),
            "output.txt",
          );
          writeFileSync(fullOutputPath, warning + text, {
            mode: 0o600,
            flag: "wx",
          });
        } catch {
          fullOutputPath = undefined;
        }
        text =
          text.slice(0, OUTPUT_LIMIT) +
          `\n\n[recortado a ${OUTPUT_LIMIT} caracteres. ${fullOutputPath ? `Salida completa: ${JSON.stringify(fullOutputPath)}; usa read con offset/limit para el tramo que falta.` : "No se pudo conservar la salida completa; afina la consulta con los símbolos que falten."}]`;
      }
      return {
        content: [{ type: "text", text: warning + text }],
        details: { fullOutputPath, maxFiles: params.maxFiles ?? 3 },
      };
    },
  });
}
