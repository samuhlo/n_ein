import { strict as assert } from "node:assert";
import { limitsFrom, meterSegments, tokensOf, tokenTail, until, widthOf, windowsOf, type MeterSegment } from "../pi-package/claude-plugin/hooks/meter-core.ts";

const NOW = Date.parse("2026-10-22T10:00:00Z");
const HOUR = 3_600_000;
const at = (ms: number): string => new Date(NOW + ms).toISOString();
const LIMITS = [
  { kind: "seven_day", percentUsed: 23.5, resetsAt: at(76 * HOUR) },
  { kind: "five_hour", percentUsed: 58, resetsAt: at(2 * HOUR + 10 * 60_000) },
  { kind: "spend_limit", percentUsed: 10 },
];
const text = (segments: MeterSegment[]): string => segments.map((part) => part.text).join("");

// Solo las ventanas de la suscripción, primero la de 5 horas.
assert.deepEqual(windowsOf(LIMITS).map((limit) => limit.kind), ["five_hour", "seven_day"]);
assert.equal(until(42 * 60_000), "42m");
assert.equal(until(3 * HOUR + 5 * 60_000), "3h 5m");
assert.equal(until(52 * HOUR), "2d 4h");

// Con sitio, barras y reinicio de las dos ventanas.
const wide = meterSegments(windowsOf(LIMITS), NOW, 200);
assert.equal(text(wide), "5h ━━━━━─── 58% ↻ 2h 10m · sem ━━────── 24% ↻ 3d 4h");
assert.equal(wide.find((part) => part.text.startsWith(" ━"))?.tone, "accent");

// Donde falta sitio cede las barras, luego el reinicio y luego la semana; sin sitio, nada.
assert.equal(text(meterSegments(windowsOf(LIMITS), NOW, 40)), "5h 58% ↻ 2h 10m · sem 24% ↻ 3d 4h");
assert.equal(text(meterSegments(windowsOf(LIMITS), NOW, 20)), "5h 58% · sem 24%");
assert.equal(text(meterSegments(windowsOf(LIMITS), NOW, 8)), "5h 58%");
assert.deepEqual(meterSegments(windowsOf(LIMITS), NOW, 3), []);
assert.ok(widthOf(meterSegments(windowsOf(LIMITS), NOW, 40)) <= 40);

// El aviso se ve también sin barra; una ventana ya reiniciada vale 0 hasta la próxima lectura.
const hot = meterSegments([{ kind: "five_hour", percentUsed: 92, resetsAt: at(HOUR) }], NOW, 12);
assert.equal(text(hot), "5h 92%");
assert.equal(hot.at(-1)?.tone, "error");
assert.equal(meterSegments([{ kind: "five_hour", percentUsed: 80 }], NOW, 200).find((part) => part.text === " 80%")?.tone, "warning");
assert.equal(text(meterSegments([{ kind: "five_hour", percentUsed: 70, resetsAt: at(-1) }], NOW, 200)), "5h ──────── 0%");

// Lo que vuelve del store se valida: una lectura corrupta no llega al pie.
assert.deepEqual(limitsFrom("x"), []);
assert.deepEqual(limitsFrom([{ kind: "five_hour" }, null, { kind: "seven_day", percentUsed: 5, resetsAt: 3 }]), [{ kind: "seven_day", percentUsed: 5, resetsAt: undefined }]);

// ↑ cuenta todo lo que entró, caché incluida.
const turn = tokensOf({ input_tokens: 200, output_tokens: 340, cache_read_input_tokens: 41_000, cache_creation_input_tokens: 3800 });
assert.deepEqual(turn, { input: 45_000, output: 340 });
assert.equal(tokenTail(turn, { input: 1_250_000, output: 8100 }), "turno ↑45.0k ↓340 · sesión ↑1.3M ↓8.1k");

console.log("claude meters: OK");
