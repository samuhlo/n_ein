// =============================================================================
// [CORE] ENRUTADO POR ENCARGO
// Un modelo para todo el encargo, elegido con la primera petición: delegar
// partes en un modelo barato salió más caro y peor que hacerlo entero en el
// modelo adecuado (evals/results/2026-10-05-modelos-de-trabajo.md). Las reglas
// van de lo más caro de equivocar a lo más barato: riesgo antes que mecánico.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CLASSES = ["mecanico", "ordinario", "riesgo", "abierto"] as const;
export type JobClass = (typeof CLASSES)[number];
export type Route = { model: string; thinking: string };
export type RoutingTable = Record<JobClass, Route>;
export type Classification = { clase: JobClass; motivo: string; fuente: "usuario" | "regla" | "defecto" };

// Tabla de partida; runtime.json puede sobrescribirla por clase. Sol high donde equivocarse cuesta caro.
export const DEFAULT_ROUTING: RoutingTable = {
  mecanico: { model: "openai-codex/gpt-6-luna", thinking: "high" },
  ordinario: { model: "openai-codex/gpt-6-sol", thinking: "medium" },
  riesgo: { model: "openai-codex/gpt-6-sol", thinking: "high" },
  abierto: { model: "openai-codex/gpt-6-sol", thinking: "high" },
};

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Una propuesta o una pregunta de diseño: se conversa antes de construir.
const OPEN = /\b(como lo (enfocamos|planteamos|hacemos|harias)|que te parece|que opinas|propon(me)?|deberiamos|how (should|would) we|what do you think)\b|^\s*(quiero|me gustaria)\b[^.?!]*\?/;
// Solo texto: lo dice la propia petición o su verbo principal es documentar.
const DOCS_ONLY = /\b(solo (es )?documentacion|no cambies (el )?codigo|only docs?|docs? only)\b|^\s*(documenta|redacta|reescribe el readme|actualiza (el readme|la documentacion|los docs))\b|^\s*(deja|compacta)\b[^.]*\b(documento|documentacion|diseno y (las )?tareas)\b/;
// Lo que la checklist de riesgo del flujo considera difícil de ver o de deshacer.
const RISK = /\b(migraci\w*|base de datos|\bbd\b|esquema|tablas?|sql|drizzle|neon|produccion|deploy\w*|despliegue|release|publica[rd]?|\bci\b|e2e de release|instalador|actualizador|actualizacion|sube[^.]*version|ultima version|dependencia\w*|usuarios?|cuentas?|permisos?|da(r)? de alta|alta (de|manual)\w*|rechac\w*|lo que manda el cliente|cuerpo que manda|deje de mandar\w*|guardad[ao] del|en el servidor|roles? de|autentica\w*|\bauth\b|authentication|authorization|login|sesion(es)?|contrasena|token|credencial\w*|secretos?|seguridad|origen aceptado|cors|websocket|cifra\w*|pagos?|borra\w* (los |de )?datos|guarda[^.]*base de datos|persist\w*|contrato|api publica|formato de (la )?configuracion|de la configuracion|concurren\w*|verificada|solo se pueden?|no puede ser|database|migration|permission|users?|accounts?|security|deploy|production)\b/;
// Cambios sin lógica ni diseño: texto, estilo, rutas de import, configuración de una línea.
const MECHANICAL = /\b(readme|documentacion|docs?\b|textos?|errata|typo|renombra\w*|traduc\w*|comentarios?|estilo|formato|color(es)?|iconos?|titulos?|etiquetas?|label|gitignore|git ignore|importacion|import\b|alinea el test|el mismo formato|mismo boton|se vean|que se vea|mensaje nuevo)\b/;

/** Clasifica la primera petición de un encargo. Sin señal clara, ordinario: ni el más caro ni el más arriesgado. */
export function classify(text: string): Classification {
  const t = fold(text);
  if (OPEN.test(t)) return { clase: "abierto", motivo: "propuesta o decisión abierta", fuente: "regla" };
  if (DOCS_ONLY.test(t)) return { clase: "mecanico", motivo: "solo documentación", fuente: "regla" };
  const risk = RISK.exec(t);
  if (risk) return { clase: "riesgo", motivo: `toca ${risk[0]}`, fuente: "regla" };
  const mech = MECHANICAL.exec(t);
  if (mech) return { clase: "mecanico", motivo: `cambio de ${mech[0]}`, fuente: "regla" };
  return { clase: "ordinario", motivo: "sin señales de riesgo ni de cambio mecánico", fuente: "defecto" };
}

// [luna] [sol] [sol high] o el nombre de la clase entre corchetes al principio de la petición.
const OVERRIDE = /^\s*\[(luna|sol high|sol|mecanico|mecánico|ordinario|riesgo|abierto)\]\s*/i;

/** Anulación explícita del usuario al principio del mensaje; devuelve también el texto sin el prefijo. */
export function parseOverride(text: string): { clase?: JobClass; rest: string } {
  const match = OVERRIDE.exec(text);
  if (!match) return { rest: text };
  const key = fold(match[1]!);
  const clase: JobClass = key === "luna" ? "mecanico" : key === "sol" ? "ordinario" : key === "sol high" ? "riesgo" : key as JobClass;
  return { clase, rest: text.slice(match[0].length) };
}

/** Tabla efectiva: la de runtime.json por clase sobre la de partida. */
export function loadRouting(packageRoot: string): RoutingTable {
  const path = join(packageRoot, "runtime.json");
  const table: RoutingTable = { ...DEFAULT_ROUTING };
  if (!existsSync(path)) return table;
  const routing = JSON.parse(readFileSync(path, "utf8"))?.routing ?? {};
  for (const clase of CLASSES) {
    const entry = routing[clase];
    if (entry && typeof entry.model === "string" && typeof entry.thinking === "string") table[clase] = { model: entry.model, thinking: entry.thinking };
  }
  return table;
}
