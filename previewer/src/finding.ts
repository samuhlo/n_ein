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

/** Sonda: comando que sale con error cuando el fallo existe. El motor la repite antes de borrar la copia. */
export type Probe = {
  command: string;
  file: string | null;
  /** Contenido de la sonda: la copia se borra, esto queda para que Samu la lea. */
  source: string | null;
  exitCode: number | null;
  output: string;
  reproduced: boolean;
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
