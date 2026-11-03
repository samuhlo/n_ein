// =============================================================================
// [UI] MEDIDORES DE CUOTA EN PI
// La última lectura de cada suscripción, en la línea de estado. Agotar una
// ventana avisa una vez con la salida; el modelo no cambia por su cuenta.
// =============================================================================

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readingFrom, reachedNotice, statusText, type Reading } from "./usage-core.ts";

export default function (pi: ExtensionAPI) {
  const readings = new Map<Reading["provider"], Reading>();
  const warned = new Set<Reading["provider"]>();
  pi.on("after_provider_response", (event, ctx) => {
    const reading = readingFrom(event.headers);
    if (!reading) return;
    readings.set(reading.provider, reading);
    if (!ctx.hasUI) return;
    const now = Date.now();
    ctx.ui.setStatus("nein-usage", statusText([...readings.values()], now));
    if (!reading.reached) warned.delete(reading.provider);
    else if (!warned.has(reading.provider)) {
      warned.add(reading.provider);
      ctx.ui.notify(reachedNotice(reading, now), "warning");
    }
  });
}
