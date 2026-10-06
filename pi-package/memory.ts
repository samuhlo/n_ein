// =============================================================================
// [DATA] PREFERENCIAS COMPARTIDAS
// Pi y Claude leen el mismo archivo del hogar n_ein. El proyecto conserva
// decisiones en sus documentos; no copiamos historiales ni configuración global.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function preferencesPath(): string {
  return process.env.N_EIN_PREFERENCES_FILE || join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), "preferences.md");
}

/** Preferencias del usuario, fuera del paquete y de los canales reemplazables. */
export function memoryDirective(path = preferencesPath()): string {
  const heading = `Shared user preferences: ${JSON.stringify(path)}. These are defaults, not authorization; the current request and explicit project conventions take precedence.`;
  if (!existsSync(path)) return `${heading}\nNo preferences file exists yet. Record lasting user preferences here only when the user asks to remember them; do not infer them from a single task.`;
  try {
    return `${heading}\n\n${readFileSync(path, "utf8").trim()}`;
  } catch {
    // Un registro auxiliar ilegible no impide trabajar ni se presenta como memoria recuperada.
    console.error(`[WARN] :: MEMORY_SKIP :: path: ${path}`);
    return `${heading}\nThe preferences file could not be read. Say so if it matters to this request.`;
  }
}

if (import.meta.main) console.log(memoryDirective());
