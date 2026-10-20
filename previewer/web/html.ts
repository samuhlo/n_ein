// =============================================================================
// [UI] PLANTILLAS CON ESCAPE
// Todo lo que pinta la web viene del modelo o del repositorio revisado: datos,
// nunca HTML. Cada valor interpolado se escapa salvo que ya sea un fragmento
// construido con esta misma plantilla.
// =============================================================================

const SAFE = Symbol("safe-html");
export type Html = { [SAFE]: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escape = (text: string): string => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

const isHtml = (value: unknown): value is Html => typeof value === "object" && value !== null && SAFE in value;

type Value = Html | string | number | boolean | null | undefined | Value[];

function render(value: Value): string {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (Array.isArray(value)) return value.map(render).join("");
  if (isHtml(value)) return value[SAFE];
  return escape(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): Html {
  return { [SAFE]: strings.reduce((out, part, index) => out + part + (index < values.length ? render(values[index]) : ""), "") };
}

export const text = (fragment: Html): string => fragment[SAFE];
