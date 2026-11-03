// =============================================================================
// [DATA] CUOTA DE LAS SUSCRIPCIONES
// Codex y Claude informan del consumo en las cabeceras de cada respuesta; el
// puente de Claude reenvía las suyas con los mismos nombres. Solo se muestra
// lo que el proveedor midió: sin duración o sin porcentaje no hay ventana.
// =============================================================================

import { until } from "../claude-plugin/hooks/meter-core.ts";

export type UsageWindow = { label: string; percent: number; resetsAt?: number };
/** `overage`: Claude rechazó por cuota y aun así responde con uso extra, que se cobra aparte. */
export type Reading = { provider: "Codex" | "Claude"; windows: UsageWindow[]; reached: boolean; overage: boolean };

const CODEX = "x-codex-";
const CLAUDE = "anthropic-ratelimit-unified-";
// Desde aquí la línea dice cuándo se reinicia la ventana: es cuando empieza a importar.
const NEAR_LIMIT = 75;

function labelFor(minutes: number): string {
  if (minutes === 300) return "5h";
  if (minutes === 10_080) return "sem";
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

const number = (value: string | undefined) => (value === undefined || value.trim() === "" ? Number.NaN : Number(value));
const resetAt = (value: string | undefined) => {
  const seconds = number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

function codexWindow(headers: Record<string, string>, kind: "primary" | "secondary"): UsageWindow | undefined {
  const percent = number(headers[`${CODEX}${kind}-used-percent`]);
  const minutes = number(headers[`${CODEX}${kind}-window-minutes`]);
  if (!Number.isFinite(percent) || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  return { label: labelFor(minutes), percent, resetsAt: resetAt(headers[`${CODEX}${kind}-reset-at`]) };
}

/** La lectura de una respuesta, o nada si sus cabeceras no traen cuota. */
export function readingFrom(raw: Record<string, string>): Reading | undefined {
  const headers = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
  const codex = [codexWindow(headers, "primary"), codexWindow(headers, "secondary")].filter((w): w is UsageWindow => w !== undefined);
  if (codex.length > 0) {
    const reached = Boolean(headers[`${CODEX}rate-limit-reached-type`]) || codex.some((w) => w.percent >= 100);
    return { provider: "Codex", windows: codex, reached, overage: false };
  }
  const claude = (
    [["5h", "5h"], ["7d", "sem"]] as const
  ).flatMap(([key, label]) => {
    const fraction = number(headers[`${CLAUDE}${key}-utilization`]);
    return Number.isFinite(fraction) ? [{ label, percent: fraction * 100, resetsAt: resetAt(headers[`${CLAUDE}${key}-reset`]) }] : [];
  });
  if (claude.length === 0) return undefined;
  const reached = headers[`${CLAUDE}status`] === "rejected";
  const overage = reached && /^allowed/.test(headers[`${CLAUDE}overage-status`] ?? "");
  return { provider: "Claude", windows: claude, reached, overage };
}

function windowText(window: UsageWindow, now: number): string {
  // Una ventana ya reiniciada vale 0 hasta que la próxima respuesta la vuelva a medir.
  const expired = window.resetsAt !== undefined && window.resetsAt <= now;
  const percent = expired ? 0 : Math.round(Math.min(Math.max(window.percent, 0), 100));
  const reset = !expired && percent >= NEAR_LIMIT && window.resetsAt !== undefined ? ` (${until(window.resetsAt - now)})` : "";
  return `${window.label} ${percent}%${reset}`;
}

/** «Codex 5h 23% · sem 40% │ Claude 5h 82% (2h 0m)», o nada si aún no hay lecturas. */
export function statusText(readings: readonly Reading[], now: number): string | undefined {
  if (readings.length === 0) return undefined;
  return readings
    .map((reading) => `${reading.provider} ${reading.windows.map((w) => windowText(w, now)).join(" · ")}${reading.overage ? " · uso extra" : ""}`)
    .join(" │ ");
}

/** Qué pasa y cómo seguir; el modelo nunca cambia por su cuenta. */
export function reachedNotice(reading: Reading, now: number): string {
  const fullest = [...reading.windows].sort((a, b) => b.percent - a.percent)[0];
  const reset = fullest?.resetsAt !== undefined && fullest.resetsAt > now ? `; se reinicia en ${until(fullest.resetsAt - now)}` : "";
  const paid = reading.overage ? " Las respuestas se están cobrando como uso extra." : "";
  return reading.provider === "Claude"
    ? `Cuota de Claude agotada${reset}.${paid} Para seguir sin Opus, escribe [sol high] al principio del mensaje o cambia «abierto» en /nein:models.`
    : `Cuota de Codex agotada${reset}. Los modelos de OpenAI no responderán hasta entonces; /nein:models permite elegir otro modelo.`;
}
