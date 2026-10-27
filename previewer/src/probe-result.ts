// [CHECK] Un fallo al arrancar la prueba no demuestra el defecto que quería medir.
// Esto reconoce errores habituales de Node/Python; no interpreta la lógica de
// una aserción. La validez del hallazgo sigue requiriendo revisar su evidencia.
import type { Probe, ProbeAssessment, ProbeSpec } from "./finding.ts";

export const PROBE_PROTOCOL = "nein-probe-v1" as const;
export const PROBE_PREFIX = "NEIN_PROBE_RESULT ";

/** Los registros históricos no especificaban qué condición había fallado. */
export function probeState(probe: Pick<Probe, "outcome">): ProbeAssessment["outcome"] {
  return probe.outcome ?? "inconclusive";
}

/** Un único resultado de la condición declarada, coherente con la salida del proceso. */
export function assessProbe(spec: Pick<ProbeSpec, "protocol" | "check">,
  execution: { exitCode: number | null; output: string; records: string[] }): ProbeAssessment {
  const { exitCode, output, records } = execution;
  const uncertain = (reason: string): ProbeAssessment => ({ outcome: "inconclusive", reason });
  if (exitCode === null) return { outcome: "error", reason: "La sonda se interrumpió o no pudo arrancar." };
  if (exitCode === 126 || exitCode === 127) return { outcome: "error", reason: "No se pudo ejecutar el comando de la sonda." };
  if (spec.protocol !== PROBE_PROTOCOL || !spec.check) {
    const failure = probeExecutionFailure(exitCode, output);
    return failure ? { outcome: "error", reason: failure }
      : uncertain("Sonda sin resultado explícito de la condición: el código de salida no demuestra el fallo ni su arreglo.");
  }
  if (records.length !== 1) {
    const failure = probeExecutionFailure(exitCode, output);
    return failure ? { outcome: "error", reason: failure } : uncertain("Falta un resultado único de la comprobación declarada.");
  }
  if (!records[0]!.startsWith(PROBE_PREFIX)) return uncertain("El resultado no usa el protocolo declarado.");
  try {
    const value = JSON.parse(records[0]!.slice(PROBE_PREFIX.length));
    if (!value || value.check !== spec.check || typeof value.reason !== "string" || !value.reason.trim())
      return uncertain("El resultado no identifica la condición declarada o no explica lo observado.");
    const expected: Record<string, number> = { reproduced: 1, passed: 0, not_applicable: 0, error: 2 };
    if (!Object.hasOwn(expected, value.outcome) || expected[value.outcome] !== exitCode)
      return uncertain("El resultado de la comprobación y la salida del proceso no coinciden.");
    return { outcome: value.outcome, reason: value.reason.trim().slice(0, 2000) };
  } catch {
    return uncertain("El resultado de la comprobación no se puede leer.");
  }
}

/** Textos comunes para CLI, web y traspaso: nunca deducir «pasa» solo de exit 0. */
export function probeLabel(probe: Pick<Probe, "outcome">, lang: "es" | "en" = "es"): string {
  const labels = {
    es: { reproduced: "fallo reproducido", passed: "comprobación superada", not_applicable: "el escenario ya no aplica",
      error: "error al ejecutar la sonda", inconclusive: "resultado inconcluso", not_run: "no ejecutada" },
    en: { reproduced: "defect reproduced", passed: "check passed", not_applicable: "scenario no longer applies",
      error: "probe execution error", inconclusive: "inconclusive result", not_run: "not run" },
  };
  return labels[lang][probeState(probe)];
}

export function probeExecutionFailure(exitCode: number | null, output: string): string | null {
  if (exitCode === 126 || exitCode === 127) return "no se pudo ejecutar el comando";
  if (exitCode === null || exitCode === 0) return null;
  if (/^\s*(?:E\s+)?(?:Error(?: \[ERR_MODULE_NOT_FOUND\])?: Cannot find (?:module|package)|ModuleNotFoundError:|ImportError:)/m.test(output))
    return "faltan módulos para ejecutar la sonda";
  if (/^(?:ERROR: file or directory not found:|Could not find ['"].*\.previewer-probes\/)|^.*(?:ENOENT: no such file or directory|can't open file).*\.previewer-probes\//m.test(output))
    return "falta un archivo de la sonda";
  if (/^(?:={3,} .*errors? during collection|no tests ran in )/m.test(output))
    return "la prueba no llegó a ejecutarse";
  if (/^\s*(?:E\s+)?subprocess\.CalledProcessError:.*\.previewer-probes\//m.test(output))
    return "falló un auxiliar de la sonda sin mostrar su aserción";
  return null;
}
