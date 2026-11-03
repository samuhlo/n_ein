import { strict as assert } from "node:assert";
import { readingFrom, reachedNotice, statusText } from "../pi-package/extensions/usage-core.ts";

const now = Date.UTC(2026, 10, 3, 12, 0, 0);
const seconds = (ms: number) => String(Math.floor(ms / 1000));

// Codex: porcentaje, duración en minutos y reinicio en segundos Unix.
const codex = readingFrom({
  "X-Codex-Primary-Used-Percent": "23.4",
  "x-codex-primary-window-minutes": "300",
  "x-codex-primary-reset-at": seconds(now + 65 * 60_000),
  "x-codex-secondary-used-percent": "40",
  "x-codex-secondary-window-minutes": "10080",
});
assert.deepEqual(codex?.windows.map((w) => [w.label, Math.round(w.percent)]), [["5h", 23], ["sem", 40]]);
assert.equal(codex?.provider, "Codex");
assert.equal(codex?.reached, false);

// Claude Pro/Max (y el puente): fracción 0..1 por ventana.
const claude = readingFrom({
  "anthropic-ratelimit-unified-5h-utilization": "0.82",
  "anthropic-ratelimit-unified-5h-reset": seconds(now + 2 * 3600_000),
  "anthropic-ratelimit-unified-7d-utilization": "0.031",
  "anthropic-ratelimit-unified-status": "allowed",
});
assert.deepEqual(claude?.windows.map((w) => [w.label, Math.round(w.percent)]), [["5h", 82], ["sem", 3]]);
assert.equal(claude?.provider, "Claude");

// Lo que no es una lectura no inventa ventanas.
assert.equal(readingFrom({ "content-type": "text/event-stream" }), undefined);
assert.equal(readingFrom({ "x-codex-primary-used-percent": "12" }), undefined, "sin duración no hay ventana");
assert.equal(readingFrom({ "x-codex-primary-used-percent": "abc", "x-codex-primary-window-minutes": "300" }), undefined);
assert.equal(readingFrom({ "anthropic-ratelimit-unified-5h-utilization": "" }), undefined);

// Una línea con los dos proveedores; la ventana cerca del límite dice cuándo se reinicia.
assert.equal(statusText([codex!, claude!], now), "Codex 5h 23% · sem 40% │ Claude 5h 82% (2h 0m) · sem 3%");
// Una ventana ya reiniciada vale 0 hasta la próxima respuesta.
assert.equal(statusText([claude!], now + 3 * 3600_000), "Claude 5h 0% · sem 3%");
assert.equal(statusText([], now), undefined);

// Ventana agotada: aviso con la salida, sin cambiar de modelo.
const exhausted = readingFrom({
  "anthropic-ratelimit-unified-5h-utilization": "1",
  "anthropic-ratelimit-unified-5h-reset": seconds(now + 30 * 60_000),
  "anthropic-ratelimit-unified-status": "rejected",
})!;
assert.equal(exhausted.reached, true);
assert.match(reachedNotice(exhausted, now), /Claude.*30m.*\[sol high\].*\/nein:models/s);
const codexOut = readingFrom({ "x-codex-primary-used-percent": "100", "x-codex-primary-window-minutes": "300", "x-codex-rate-limit-reached-type": "primary" })!;
assert.equal(codexOut.reached, true);
assert.match(reachedNotice(codexOut, now), /Codex.*\/nein:models/s);

console.log("usage: cabeceras de Codex y Claude a ventanas, línea de estado y aviso de cuota agotada");
