// =============================================================================
// [DATA] DIFF CON MARCAS
// El diff de la revisión, partido por archivo, con cada línea numerada en la
// base y en el head. Una cita al head marca la línea nueva; una a la base, la
// retirada: así la marca cae justo donde el hallazgo dice.
// =============================================================================

export type Row =
  | { kind: "hunk"; text: string }
  | { kind: "added" | "removed" | "same"; text: string; before: number | null; after: number | null };

export type FileDiff = { path: string; rows: Row[] };

/** Parte `git diff` en archivos; el nombre es el del head, o el de la base si se borró. */
export function splitDiff(patch: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let before = 0;
  let after = 0;
  let inHunk = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
      current = { path: match?.[2] ?? line.slice(11), rows: [] };
      files.push(current);
      inHunk = false;
      continue;
    }
    if (!current) continue;
    if (!inHunk && line.startsWith("+++ ")) {
      if (line !== "+++ /dev/null") current.path = line.replace(/^\+\+\+ b\//, "");
      continue;
    }
    if (!inHunk && line.startsWith("--- ")) {
      if (line !== "--- /dev/null") current.path = current.path || line.replace(/^--- a\//, "");
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/.exec(line);
    if (hunk) {
      before = Number(hunk[1]);
      after = Number(hunk[2]);
      inHunk = true;
      current.rows.push({ kind: "hunk", text: hunk[3] ?? "" });
    } else if (inHunk && line.startsWith("+")) current.rows.push({ kind: "added", text: line.slice(1), before: null, after: after++ });
    else if (inHunk && line.startsWith("-")) current.rows.push({ kind: "removed", text: line.slice(1), before: before++, after: null });
    else if (inHunk && line.startsWith(" ")) current.rows.push({ kind: "same", text: line.slice(1), before: before++, after: after++ });
  }
  return files;
}

export type Mark = { finding: string; path: string; side: "after" | "before"; start: number; end: number };

/** Qué filas de un archivo cita cada hallazgo. Una cita a otro SHA (un head anterior) no cae en este diff. */
export function marksFor(
  findings: { id: string; citations: { path: string; sha: string; start: number; end: number }[] }[],
  range: { baseSha: string; headSha: string },
): Mark[] {
  const marks: Mark[] = [];
  for (const finding of findings)
    for (const citation of finding.citations) {
      const side = citation.sha === range.headSha ? "after" : citation.sha === range.baseSha ? "before" : null;
      if (side) marks.push({ finding: finding.id, path: citation.path, side, start: citation.start, end: citation.end });
    }
  return marks;
}

export function rowMarks(row: Row, marks: Mark[]): Mark[] {
  if (row.kind === "hunk") return [];
  return marks.filter((mark) => {
    const line = mark.side === "after" ? row.after : row.before;
    return line !== null && line >= mark.start && line <= mark.end;
  });
}
