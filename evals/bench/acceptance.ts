// =============================================================================
// [BENCH] ACEPTACIÓN COMPLETA
// La suite del agente puede pasar aunque omita consumidores o escriba tests
// débiles. La aceptación independiente y los mutantes cuentan también.
// =============================================================================

type Grade = {
  hiddenPass?: number; hiddenTotal?: number;
  suiteFailed?: number; suiteBadFiles?: number; typecheck?: boolean;
  extra?: { mount?: { readsText?: boolean; mounts?: boolean; mutantsKilled?: number }; docFixed?: boolean; codeFilesTouched?: number };
};

export function acceptanceStatus(scenario: string, grade: Grade): { complete: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!["s1", "s2", "s3", "s3b", "s5", "s6"].includes(scenario)) reasons.push("unknown scenario");
  if (!(Number.isInteger(grade.hiddenTotal) && grade.hiddenTotal! > 0 && grade.hiddenPass === grade.hiddenTotal)) reasons.push("hidden acceptance incomplete");
  if (grade.suiteFailed !== 0 || grade.suiteBadFiles !== 0) reasons.push("suite failed or unknown");
  if (grade.typecheck !== true) reasons.push("typecheck failed or unknown");
  if (scenario === "s3" || scenario === "s3b") {
    if (grade.extra?.mount?.mounts !== true || grade.extra.mount.readsText !== false) reasons.push("behaviour test not mounted");
    if (grade.extra?.mount?.mutantsKilled !== 2) reasons.push("mutant survived or unknown");
    if (grade.extra?.docFixed !== true) reasons.push("documentation stale or unknown");
  }
  if (scenario === "s5" && grade.extra?.codeFilesTouched !== 0) reasons.push("code changed or unknown in docs-only job");
  return { complete: reasons.length === 0, reasons };
}
