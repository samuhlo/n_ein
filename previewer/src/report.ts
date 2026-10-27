// =============================================================================
// [DATA] INFORME DEL REVISOR
// El agente termina con un bloque JSON. Aquí se lee sin fiarse de él: cada
// propuesta mal formada se aparta con su motivo en vez de tumbar la revisión.
// =============================================================================

import { KINDS, SEVERITIES, type Kind, type Severity, type TourStep, type ProbeSpec } from "./finding.ts";
import { PROBE_PROTOCOL } from "./probe-result.ts";

export type ProposedFinding = {
  kind: Kind;
  severity: Severity;
  title: string;
  plain: string;
  condition: string;
  consequence: string;
  citations: string[];
  probe: ProbeSpec | null;
  verification: string;
  /** Clave (`P1`…) del hallazgo de la revisión anterior que sigue presente. */
  previous: string | null;
};

/** Un hallazgo anterior que el revisor da por corregido en este head. */
export type Resolution = { previous: string; note: string; citations: string[]; probe: ProbeSpec | null };

export type Report = { summary: string; tour: TourStep[]; findings: ProposedFinding[]; resolved: Resolution[]; gaps: string[]; rejected: string[] };

/** Más avisos que esto suelen ser ruido; el resto se aparta, no se muestra. */
export const MAX_FINDINGS = 10;
/** Un recorrido más largo deja de ser una guía. */
export const MAX_TOUR_STEPS = 12;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const isKind = (value: unknown): value is Kind => KINDS.some((kind) => kind === value);
const isSeverity = (value: unknown): value is Severity => SEVERITIES.some((severity) => severity === value);

function probeSpec(value: unknown): ProbeSpec | null {
  if (!isFields(value) || !text(value.command)) return null;
  const explicit = value.protocol === PROBE_PROTOCOL && /^[a-zA-Z][\w.-]{0,79}$/.test(text(value.check));
  return { command: text(value.command), file: text(value.file) || null,
    ...(explicit ? { protocol: PROBE_PROTOCOL, check: text(value.check), compareBase: value.compareBase === true } : {}) };
}

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
  const probe = probeSpec(value.probe);
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
    isFields(item) && text(item.previous) ? [{ previous: text(item.previous), note: text(item.note), citations: texts(item.citations), probe: probeSpec(item.probe) }] : []);
  const tour = (Array.isArray(value.tour) ? value.tour : []).flatMap((item): TourStep[] =>
    isFields(item) && text(item.title) && text(item.plain) ? [{ title: text(item.title), plain: text(item.plain), why: text(item.why), files: texts(item.files) }] : []);
  return { summary: text(value.summary), tour: tour.slice(0, MAX_TOUR_STEPS), findings, resolved, gaps: texts(value.gaps), rejected };
}
