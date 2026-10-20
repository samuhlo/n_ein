// =============================================================================
// [DATA] INFORME DEL REVISOR
// El agente termina con un bloque JSON. Aquí se lee sin fiarse de él: cada
// propuesta mal formada se aparta con su motivo en vez de tumbar la revisión.
// =============================================================================

import { KINDS, SEVERITIES, type Kind, type Severity } from "./finding.ts";

export type ProposedFinding = {
  kind: Kind;
  severity: Severity;
  title: string;
  plain: string;
  condition: string;
  consequence: string;
  citations: string[];
  probe: { command: string; file: string | null } | null;
  verification: string;
  /** Clave (`P1`…) del hallazgo de la revisión anterior que sigue presente. */
  previous: string | null;
};

/** Un hallazgo anterior que el revisor da por corregido en este head. */
export type Resolution = { previous: string; note: string };

export type Report = { summary: string; findings: ProposedFinding[]; resolved: Resolution[]; gaps: string[]; rejected: string[] };

/** Más avisos que esto suelen ser ruido; el resto se aparta, no se muestra. */
export const MAX_FINDINGS = 10;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const isKind = (value: unknown): value is Kind => KINDS.some((kind) => kind === value);
const isSeverity = (value: unknown): value is Severity => SEVERITIES.some((severity) => severity === value);

/** El último bloque ```json del mensaje; si no hay, el último objeto entre llaves. */
export function extractJson(message: string): unknown {
  const blocks = [...message.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map((match) => match[1] ?? "");
  const candidate = blocks.at(-1) ?? message.slice(message.indexOf("{"), message.lastIndexOf("}") + 1);
  if (!candidate) throw new Error("el revisor no devolvió un bloque JSON");
  return JSON.parse(candidate);
}

function proposed(value: unknown, index: number): ProposedFinding | string {
  if (!isFields(value)) return `#${index + 1}: no es un objeto`;
  const title = text(value.title) || `#${index + 1}`;
  if (!isKind(value.kind)) return `${title}: tipo desconocido (${String(value.kind)})`;
  if (!isSeverity(value.severity)) return `${title}: gravedad desconocida (${String(value.severity)})`;
  const plain = text(value.plain), condition = text(value.condition), consequence = text(value.consequence);
  if (!plain || !condition || !consequence) return `${title}: falta explicación, condición o consecuencia`;
  const citations = texts(value.citations);
  if (!citations.length) return `${title}: sin citas`;
  let probe: ProposedFinding["probe"] = null;
  if (isFields(value.probe) && text(value.probe.command))
    probe = { command: text(value.probe.command), file: text(value.probe.file) || null };
  return {
    kind: value.kind, severity: value.severity, title, plain, condition, consequence, citations, probe,
    verification: text(value.verification), previous: text(value.previous) || null,
  };
}

export function parseReport(message: string): Report {
  const value = extractJson(message);
  if (!isFields(value)) throw new Error("el informe del revisor no es un objeto JSON");
  const findings: ProposedFinding[] = [];
  const rejected: string[] = [];
  const items = Array.isArray(value.findings) ? value.findings : [];
  items.forEach((item, index) => {
    const result = proposed(item, index);
    if (typeof result === "string") rejected.push(result);
    else if (findings.length >= MAX_FINDINGS) rejected.push(`${result.title}: supera el máximo de ${MAX_FINDINGS} avisos`);
    else findings.push(result);
  });
  const resolved = (Array.isArray(value.resolved) ? value.resolved : []).flatMap((item): Resolution[] =>
    isFields(item) && text(item.previous) ? [{ previous: text(item.previous), note: text(item.note) }] : []);
  return { summary: text(value.summary), findings, resolved, gaps: texts(value.gaps), rejected };
}
