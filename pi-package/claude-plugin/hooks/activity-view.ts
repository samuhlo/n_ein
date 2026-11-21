// =============================================================================
// [UI] MODO DE ACTIVIDAD EN CLAUDE CODE
// El spinner dice qué hace el turno (thinking, writing) y, mientras corre una
// herramienta, su modo (coding, testing…); la franja del TODO lleva la fase
// junto al avance. La tabla vive en activity-core.ts, compartida con Pi.
// =============================================================================

import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import { activityOf, type Activity } from "./activity-core.ts";
import { record } from "./receipt-core.ts";

const NO_ACTIVITY: Activity | null = null;
const activity = atom({ plugin: "n-ein", key: "activity" } as const, NO_ACTIVITY);

// El nombre de la herramienta solo llega al ejecutarla: mientras el modelo escribe la llamada, `preparing`.
const SPINNER_WORD: Record<string, string> = {
  requesting: "thinking",
  thinking: "thinking",
  responding: "writing",
  "tool-input": "preparing",
};

/** Antes de cada herramienta del bucle principal; las de un subagente cuentan como su `Agent`. */
export async function noteTool($: EngineInterface, tool: string, input: unknown, agentId?: string): Promise<void> {
  if (agentId !== undefined) return;
  const next = activityOf(tool, record(input));
  await update($, activity, (current) => (current === next ? current : next));
}

export async function clearActivity($: EngineInterface): Promise<void> {
  await update($, activity, () => null);
}

/** La fase que enseña la franja: la de la última herramienta, solo mientras hay turno. */
export async function phase($: EngineInterface, isWorking: boolean): Promise<string | undefined> {
  return isWorking ? (await read($, activity)) ?? undefined : undefined;
}

export async function spinnerWord($: EngineInterface, mode: string): Promise<string | undefined> {
  if (mode === "tool-use") return (await read($, activity)) ?? "working";
  return SPINNER_WORD[mode];
}
