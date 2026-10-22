// =============================================================================
// [UI] NÚCLEO DE LOS MEDIDORES
// Lo que se lee de un vistazo en el pie de Claude Code:
//   · el consumo de la suscripción (ventanas de 5 horas y semanal), abajo a la derecha,
//   · los tokens del último turno y de la sesión, al final de la línea de ayuda.
//
// POR QUÉ -> el coste es turnos × contexto acumulado, y el límite de la
// suscripción corta una sesión sin avisar. Verlos evita las dos sorpresas.
// Sin importaciones, como el resto de núcleos: el plugin corre sin Node.
// =============================================================================

export type Limit = { kind: string; percentUsed: number; resetsAt?: string };
export type Tokens = { input: number; output: number };
export type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number };
export type MeterTone = "accent" | "warning" | "error" | "text" | "dim";
export type MeterSegment = { tone: MeterTone; text: string };

export const NO_TOKENS: Tokens = { input: 0, output: 0 };
// Claude Code solo informa de estas dos ventanas; fuera de suscripción no hay ninguna.
const WINDOWS: Record<string, string> = { five_hour: "5h", seven_day: "sem" };
const CELLS = 8;

/** Las ventanas que se muestran, en orden, de lo que midió el motor. */
export function windowsOf(rateLimits: readonly Limit[]): Limit[] {
  return Object.keys(WINDOWS).flatMap((kind) => {
    const found = rateLimits.find((limit) => limit.kind === kind);
    return found ? [{ kind, percentUsed: found.percentUsed, resetsAt: found.resetsAt }] : [];
  });
}

/** Las ventanas guardadas en el store, solo si siguen teniendo la forma de una lectura. */
export function limitsFrom(value: unknown): Limit[] {
  if (!Array.isArray(value)) return [];
  const valid: Limit[] = value.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null || !("kind" in item) || !("percentUsed" in item)) return [];
    const { kind, percentUsed } = item;
    if (typeof kind !== "string" || typeof percentUsed !== "number") return [];
    const resetsAt = "resetsAt" in item && typeof item.resetsAt === "string" ? item.resetsAt : undefined;
    return [{ kind, percentUsed, resetsAt }];
  });
  return windowsOf(valid);
}

/** «42m», «3h 5m», «2d 4h»: lo que falta para que la ventana se reinicie. */
export function until(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** «950», «1.2k», «3.4M». */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** Amarillo de la marca mientras hay margen; aviso desde el 75 % y error desde el 90 %. */
export function toneFor(percent: number): MeterTone {
  if (percent >= 90) return "error";
  if (percent >= 75) return "warning";
  return "accent";
}

export function widthOf(segments: readonly MeterSegment[]): number {
  return segments.reduce((sum, part) => sum + [...part.text].length, 0);
}

/**
 * El medidor más ancho que cabe en `room` columnas. Donde falta sitio cede, por este orden,
 * las barras, la hora de reinicio y la ventana semanal; si ni la de 5 horas cabe, nada.
 */
export function meterSegments(limits: readonly Limit[], now: number, room: number): MeterSegment[] {
  const windows = limits.map((limit) => {
    const resetsIn = limit.resetsAt === undefined ? undefined : Date.parse(limit.resetsAt) - now;
    // Una ventana ya reiniciada vale 0 hasta que la próxima respuesta la vuelva a medir.
    const expired = resetsIn !== undefined && resetsIn <= 0;
    const percent = expired ? 0 : Math.min(Math.max(limit.percentUsed, 0), 100);
    const reset = resetsIn !== undefined && !expired ? ` ↻ ${until(resetsIn)}` : "";
    return { label: WINDOWS[limit.kind] ?? limit.kind, percent, reset };
  });
  const draw = (shown: typeof windows, bar: boolean, reset: boolean): MeterSegment[] => shown.flatMap((item, index) => {
    const filled = Math.round((item.percent / 100) * CELLS);
    const parts: MeterSegment[] = index > 0 ? [{ tone: "dim", text: " · " }] : [];
    parts.push({ tone: "dim", text: item.label });
    if (bar) parts.push({ tone: toneFor(item.percent), text: ` ${"━".repeat(filled)}` }, { tone: "dim", text: "─".repeat(CELLS - filled) });
    // Sin barra, el color pasa al porcentaje para que el aviso no se pierda.
    parts.push({ tone: bar && item.percent < 75 ? "text" : toneFor(item.percent), text: ` ${Math.round(item.percent)}%` });
    if (reset && item.reset) parts.push({ tone: "dim", text: item.reset });
    return parts;
  });
  const fits = [draw(windows, true, true), draw(windows, false, true), draw(windows, false, false), draw(windows.slice(0, 1), false, false)];
  return fits.find((segments) => segments.length > 0 && widthOf(segments) <= room) ?? [];
}

/** ↑ cuenta todo lo que entró al modelo, caché incluida: es el contexto que arrastra cada turno. */
export function tokensOf(usage: Usage): Tokens {
  return { input: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens, output: usage.output_tokens };
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
  return { input: a.input + b.input, output: a.output + b.output };
}

export function tokenTail(turn: Tokens, session: Tokens): string {
  return `turno ↑${compact(turn.input)} ↓${compact(turn.output)} · sesión ↑${compact(session.input)} ↓${compact(session.output)}`;
}
