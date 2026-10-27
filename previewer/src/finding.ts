// =============================================================================
// [DATA] HALLAZGO
// Forma común entre el motor, el almacén y la web. Un hallazgo solo existe si
// cita líneas reales del SHA revisado; la sonda, si la hay, la ejecutó el motor.
// =============================================================================

export const KINDS = ["bug", "risk", "smell", "question"] as const;
export type Kind = (typeof KINDS)[number];

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Una cita validada: `ruta@SHA:L12` o `ruta@SHA:L12-L18`, con el texto que había en ese SHA. */
export type Citation = {
  ref: string;
  path: string;
  sha: string;
  start: number;
  end: number;
  text: string;
};

export type ProbeOutcome = "reproduced" | "passed" | "not_applicable" | "error" | "inconclusive" | "not_run";
export type ProbeSpec = {
  command: string;
  file: string | null;
  protocol?: "nein-probe-v1";
  check?: string;
  compareBase?: boolean;
};
export type ProbeAssessment = { outcome: ProbeOutcome; reason: string };
export type ProbeBaseline = ProbeAssessment & { sha: string; exitCode: number | null; output: string };

/** Resultado de la comprobación, distinto del estado del proceso que la ejecutó. */
export type Probe = ProbeSpec & {
  /** Contenido de la sonda: la copia se borra, esto queda para que el usuario la lea. */
  source: string | null;
  exitCode: number | null;
  output: string;
  reproduced: boolean;
  /** Opcionales para poder leer sin migrar las sondas históricas. */
  outcome?: ProbeOutcome;
  reason?: string;
  baseline?: ProbeBaseline;
};

/** Un paso del recorrido: una parte del cambio, en el orden en que conviene leerla. */
export type TourStep = {
  title: string;
  /** Qué hace esta parte, en lenguaje llano. */
  plain: string;
  /** Por qué importa a quien usa el programa. */
  why: string;
  /** Archivos cambiados que forman esta parte, tal como los nombra el diff. */
  files: string[];
};

export type Finding = {
  kind: Kind;
  severity: Severity;
  title: string;
  /** Explicación en lenguaje llano, visible sin desplegar. */
  plain: string;
  condition: string;
  consequence: string;
  citations: Citation[];
  probe: Probe | null;
  /** Lo que falta comprobar; vacío si la sonda lo demuestra. */
  verification: string;
};
