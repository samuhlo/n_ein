// =============================================================================
// [FLOW] TRASPASO A N_EIN
// Lo que el usuario seleccionó en el revisor vuelve a la conversación como un
// encargo: una tarea por hallazgo, con sus pruebas, y nada más. El agente lo
// lee con `n-ein-previewer handoff`; la web nunca escribe en el repositorio.
// =============================================================================

import type { Session, StoredFinding } from "./store.ts";
import { probeLabel } from "./probe-result.ts";

const short = (sha: string): string => sha.slice(0, 12);
const fence = (text: string, lang = ""): string => {
  const ticks = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
  return `${ticks}${lang}\n${text}\n${ticks}`;
};

const STATUS: Record<StoredFinding["status"], string> = {
  new: "found in the latest review",
  persists: "still present in the latest review",
  unchecked: "NOT checked by the latest review: reproduce it before changing any code",
  resolved: "resolved",
};

function item(finding: StoredFinding, index: number): string {
  const lines = [`## ${index + 1}. ${finding.title}`, "", `Status: ${STATUS[finding.status]} · ${finding.kind} · ${finding.severity} · reviewed at ${short(finding.headSha)}`];
  if (finding.rating) lines.push(`User's rating: ${finding.rating.verdict}${finding.rating.reason ? ` (${finding.rating.reason})` : ""}`);
  lines.push("", finding.plain, "", `- Condition: ${finding.condition}`, `- Consequence: ${finding.consequence}`, "- Cited:");
  for (const citation of finding.citations) lines.push(`  - ${citation.ref}`, fence(citation.text).replace(/^/gm, "    "));
  const probe = finding.check?.probe ?? finding.probe;
  if (probe) {
    const result = `${probeLabel(probe, "en")} (exit ${probe.exitCode ?? "none"})`;
    lines.push(`- Probe: \`${probe.command}\` ${result}`);
    if (probe.reason) lines.push(`  Assessment: ${probe.reason}`);
    if (probe.protocol) lines.push(`  Protocol: ${probe.protocol}; check: ${probe.check}`);
    if (probe.file && probe.source) lines.push(`  ${probe.file}:`, fence(probe.source).replace(/^/gm, "    "));
    if (probe.output) lines.push("  Output:", fence(probe.output).replace(/^/gm, "    "));
    if (probe.baseline) lines.push(`  Base ${probe.baseline.sha}: ${probeLabel({ ...probe, ...probe.baseline }, "en")}. ${probe.baseline.reason}`);
  }
  if (finding.check) lines.push(`- Latest check: ${finding.check.note}`);
  if (finding.verification) lines.push(`- Still unproven: ${finding.verification}`);
  return lines.join("\n");
}

/** Texto para el agente: instrucciones en inglés, contenido en el idioma de la conversación. */
export function handoffBrief(session: Session, selection: StoredFinding[], headNow: string | null): string {
  if (!selection.length)
    return `Nothing is selected in p_reviewer for ${session.branch}. Ask the user to choose the findings to fix in the reviewer first; do not pick any yourself.\n`;
  const moved = headNow && session.headSha && headNow !== session.headSha ? ` The branch is now at ${short(headNow)}: check each finding against the current code.` : "";
  return [
    `# p_reviewer selection · ${session.branch}`,
    "",
    `The user selected ${selection.length} finding${selection.length === 1 ? "" : "s"} in p_reviewer and asked you to apply the review. Latest reviewed head: ${short(session.headSha ?? "?")}.${moved}`,
    "",
    "Work them as one ordinary job:",
    "1. Add one task per finding below to `WORK.md`, in this order and with these titles. Add no other tasks: findings that are not listed here are not part of this job.",
    "2. For each task, reproduce the defect first. Check that the probe exercises the claimed condition; an execution error or an inapplicable scenario is not a red test. Preserve its explicit result protocol and make it a project regression test when it fits. Then fix it, run the checks and commit the task.",
    "3. If a finding does not reproduce or turns out to be wrong, change no code for it. Report it back with your evidence; that is a valid outcome.",
    "4. When the job is closed, offer in one line to open the reviewer again for a second review.",
    "",
    selection.map(item).join("\n\n"),
    "",
  ].join("\n");
}
