// [DATA] CONSUMO OBSERVADO
// Los importes antiguos se conservan; sin cobertura no demuestran un total completo.
import type { Usage } from "./store.ts";

export type UsageSummary = {
  usd: number;
  coverage: "complete" | "partial" | "unknown";
};
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;

export function usageSummary(
  items: readonly (Usage | null | undefined)[],
): UsageSummary {
  let usd = 0,
    observed = false,
    complete = items.length > 0;
  for (const item of items) {
    const c = item?.coverage;
    const known =
      Boolean(c && c.priced > 0) ||
      Boolean(!c && item && finite(item.usd) && item.usd > 0);
    if (known && finite(item?.usd)) {
      usd += item.usd;
      observed = true;
    }
    if (!c || c.messages < 1 || c.priced !== c.messages) complete = false;
  }
  return {
    usd,
    coverage: complete ? "complete" : observed ? "partial" : "unknown",
  };
}

export function usageLabel(
  value: { usd: number; coverage?: UsageSummary["coverage"] },
  lang: "es" | "en",
): string {
  if (!value.coverage && value.usd > 0)
    return usageLabel({ ...value, coverage: "partial" }, lang);
  if (!value.coverage || value.coverage === "unknown")
    return lang === "es" ? "consumo desconocido" : "usage unknown";
  const amount = value.usd.toLocaleString(lang === "es" ? "es-ES" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} $ · ${lang === "es" ? "estimado" : "estimated"}${value.coverage === "partial" ? (lang === "es" ? " parcial" : " partial") : ""}`;
}
