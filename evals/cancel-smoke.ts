// =============================================================================
// [FLOW] CANCELACIÓN REAL DEL TRABAJADOR
// Usa RPC para abortar mientras una herramienta del hijo sigue ejecutándose.
// =============================================================================

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dir, "..");
const cwd = mkdtempSync(join(tmpdir(), "n-ein-cancel-"));
const marker = join(cwd, "started.marker");
const ticks = join(cwd, "ticks.log");
const finished = join(cwd, "finished.marker");
const answer = join(cwd, "answer.txt");

writeFileSync(answer, "pending\n");
writeFileSync(join(cwd, "long-check.sh"), [
  "#!/bin/sh",
  "printf 'started\\n' > started.marker",
  "i=0",
  "while [ \"$i\" -lt 100 ]; do",
  "  printf '.' >> ticks.log",
  "  sleep 0.2",
  "  i=$((i + 1))",
  "done",
  "printf 'finished\\n' > finished.marker",
].join("\n") + "\n");

const child = spawn(join(root, "bin/n-ein-dev"), ["--mode", "rpc", "--no-session", "--tools", "n_ein_worker"], {
  cwd,
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
let buffer = "";
let abortSent = false;
let abortAck = false;
let settled = false;
let workerStarted = false;
let childModel: string | undefined;
let workerStatus: string | undefined;
let workerAborted = false;
let observedCommands = 0;
const send = (value: object) => child.stdin.write(JSON.stringify(value) + "\n");

const completed = new Promise<void>((resolveDone, rejectDone) => {
  const deadline = setTimeout(() => {
    send({ id: "timeout-abort", type: "abort" });
    rejectDone(new Error("La prueba agotó 90 s esperando la cancelación."));
  }, 90_000);

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      let event: any;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.type === "tool_execution_start" && event.toolName === "n_ein_worker") workerStarted = true;
      if (event.type === "tool_execution_end" && event.toolName === "n_ein_worker") {
        childModel = event.result?.details?.model;
        workerStatus = event.result?.details?.status;
        workerAborted = event.result?.details?.aborted === true;
        observedCommands = event.result?.details?.commands?.length ?? 0;
      }
      if (event.type === "response" && event.command === "abort" && event.id === "abort-1") abortAck = event.success;
      if (event.type === "agent_settled") settled = true;
      if (abortAck && settled) child.stdin.end();
    }
  });
  child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2000); });
  child.on("error", (error) => rejectDone(error));
  child.on("close", () => {
    clearTimeout(deadline);
    if (abortAck && settled) resolveDone();
    else rejectDone(new Error(`Pi terminó sin confirmar abort/settled: ${stderr}`));
  });
});

send({
  id: "prompt-1",
  type: "prompt",
  message: "Usa n_ein_worker en modo work una sola vez. Encargo: primero cambia answer.txt de pending a ready; después ejecuta sh long-check.sh y espera el resultado. Aceptación: answer.txt dice ready y el script termina. Este es un ensayo de cancelación en un directorio temporal; no cambies otros archivos.",
});

const markerWatch = setInterval(() => {
  if (!abortSent && existsSync(marker)) {
    abortSent = true;
    send({ id: "abort-1", type: "abort" });
  }
}, 50);

try {
  await completed;
  assert.ok(workerStarted, "El padre no inició el trabajador.");
  assert.ok(abortSent, "La herramienta larga no llegó a empezar.");
  assert.equal(childModel, "gpt-6-luna", "El trabajador no usó Luna.");
  assert.equal(workerStatus, "cancelado", "El trabajador no devolvió estado cancelado.");
  assert.equal(workerAborted, true, "El trabajador no registró la interrupción.");
  assert.equal(readFileSync(answer, "utf8").trim(), "ready", "Se perdió la edición anterior al abortar.");
  const before = existsSync(ticks) ? readFileSync(ticks).length : 0;
  await Bun.sleep(1000);
  const after = existsSync(ticks) ? readFileSync(ticks).length : 0;
  assert.equal(after, before, "La herramienta hija siguió escribiendo tras abortar.");
  assert.equal(existsSync(finished), false, "La herramienta larga llegó a terminar tras abortar.");
  console.log(JSON.stringify({ result: "cancelled", cwd, childModel, workerStatus, observedCommands, ticks: after }));
} finally {
  clearInterval(markerWatch);
  if (child.exitCode === null) child.kill("SIGTERM");
}
