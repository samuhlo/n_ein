// =============================================================================
// [UI] PÁGINA DEL REVISOR
// Entender → revisar → decidir: qué cambia y en qué orden mirarlo, los
// hallazgos con su explicación llana a la vista y lo técnico plegado, y el
// diff con una marca donde cae cada cita. Funciones puras: datos → HTML.
// =============================================================================

import type { Probe } from "../src/finding.ts";
import type { Run, Session, Status, StoredFinding, Verdict } from "../src/store.ts";
import { marksFor, rowMarks, splitDiff, type FileDiff, type Mark, type Row } from "./diff.ts";
import { html, type Html } from "./html.ts";

export type Lang = "es" | "en";

/** Lo que el servidor entrega para pintar una sesión. */
export type SessionView = {
  session: Session;
  /** La revisión vigente: la última terminada. */
  run: Run | null;
  /** La última en empezar, si es otra: en curso o fallida. */
  latest: Run | null;
  runs: { count: number; usd: number };
  findings: StoredFinding[];
  patch: string;
  lang: Lang;
};

const WORDS = {
  es: {
    title: "REVISIÓN", tour: "QUÉ CAMBIA", findings: "HALLAZGOS", changes: "CAMBIOS",
    reviews: (n: number) => `${n} ${n === 1 ? "revisión" : "revisiones"}`,
    running: "hay una revisión en curso; esta página se actualiza sola al terminar",
    failed: (error: string) => `la última revisión no terminó: ${error}`,
    none: "esta rama todavía no tiene una revisión terminada",
    current: "vigentes", unchecked: "sin comprobar en la última revisión", resolved: "resueltos",
    noFindings: "esta revisión no encontró fallos.",
    status: { new: "nuevo", persists: "sigue", resolved: "resuelto", unchecked: "sin comprobar" } satisfies Record<Status, string>,
    kind: { bug: "fallo", risk: "riesgo", smell: "olor", question: "pregunta" },
    severity: { high: "alto", medium: "medio", low: "bajo" },
    verdict: { vale: "vale", descartar: "descartar", investigar: "investigar" } satisfies Record<Verdict, string>,
    valid: "¿es válido?", reason: "motivo (opcional)", pick: "enviar a n_ein",
    detail: "detalle técnico", condition: "condición", consequence: "consecuencia", cited: "citas",
    probe: "sonda", check: "última comprobación", unproven: "falta comprobar", seenAt: "visto en",
    demonstrated: "demostrado", passes: "pasa", notReproduced: "no reproduce", notRun: "no ejecutada",
    output: "salida", gap: "pendiente", rejected: (n: number) => `apartados: ${n} (sin citas válidas o mal formados)`,
    noLines: "sin líneas de texto que mostrar",
    picked: (n: number) => n === 0
      ? "marca «enviar a n_ein» en lo que quieras corregir"
      : `${n} para corregir · di «aplica la revisión» en n_ein`,
  },
  en: {
    title: "REVIEW", tour: "WHAT CHANGES", findings: "FINDINGS", changes: "CHANGES",
    reviews: (n: number) => `${n} ${n === 1 ? "review" : "reviews"}`,
    running: "a review is running; this page updates itself when it ends",
    failed: (error: string) => `the latest review did not finish: ${error}`,
    none: "this branch has no finished review yet",
    current: "current", unchecked: "not checked by the latest review", resolved: "resolved",
    noFindings: "this review found no defects.",
    status: { new: "new", persists: "still there", resolved: "resolved", unchecked: "not checked" } satisfies Record<Status, string>,
    kind: { bug: "bug", risk: "risk", smell: "smell", question: "question" },
    severity: { high: "high", medium: "medium", low: "low" },
    verdict: { vale: "valid", descartar: "dismiss", investigar: "investigate" } satisfies Record<Verdict, string>,
    valid: "is it valid?", reason: "reason (optional)", pick: "send to n_ein",
    detail: "technical detail", condition: "condition", consequence: "consequence", cited: "citations",
    probe: "probe", check: "latest check", unproven: "still unproven", seenAt: "seen at",
    demonstrated: "demonstrated", passes: "passes", notReproduced: "does not reproduce", notRun: "not run",
    output: "output", gap: "pending", rejected: (n: number) => `set aside: ${n} (no valid citations or malformed)`,
    noLines: "no text lines to show",
    picked: (n: number) => n === 0
      ? "mark «send to n_ein» on what you want fixed"
      : `${n} to fix · say «apply the review» in n_ein`,
  },
} as const;

type Words = (typeof WORDS)[Lang];

const short = (sha: string | null | undefined): string => (sha ?? "").slice(0, 7);
const number = (index: number): string => String(index + 1).padStart(2, "0");
const VERDICTS: Verdict[] = ["vale", "descartar", "investigar"];
/** Un archivo largo sin hallazgos empieza plegado: el recorrido y las marcas lo abren. */
const OPEN_ROWS = 60;

function heading(index: number, title: string): Html {
  return html`<h2 class="section"><span class="slashes">//</span> <span class="num">${String(index).padStart(3, "0")}</span>  ${title}</h2>`;
}

function probeState(probe: Probe, words: Words): string {
  if (probe.reproduced) return words.demonstrated;
  if (probe.exitCode === 0) return words.passes;
  if (probe.output.startsWith("no ejecutada")) return words.notRun;
  return words.notReproduced;
}

/** Ancla de la línea que una cita marca en el diff, si cae en él. */
const anchor = (file: number, side: Mark["side"], line: number): string => `l-${file}-${side === "after" ? "a" : "b"}-${line}`;

function probeBlock(probe: Probe, words: Words): Html {
  return html`<div class="probe">
    <p><span class="key">${words.probe}</span> <code>${probe.command}</code> · ${probeState(probe, words)}${probe.exitCode !== null ? ` · exit ${probe.exitCode}` : ""}</p>
    ${probe.file && probe.source ? html`<p class="path">${probe.file}</p><pre><code>${probe.source}</code></pre>` : null}
    ${probe.output ? html`<p class="key">${words.output}</p><pre><code>${probe.output}</code></pre>` : null}
  </div>`;
}

function findingBlock(item: StoredFinding, index: number, words: Words, places: Map<string, string>): Html {
  const probe = item.check?.probe ?? item.probe;
  const verdict = item.rating?.verdict ?? null;
  const canPick = item.status !== "resolved" && verdict !== "descartar";
  const refs = item.citations.map((citation) => {
    const place = places.get(`${item.id}:${citation.ref}`);
    return place ? html`<a href="#${place}">${citation.ref}</a>` : html`<span>${citation.ref}</span>`;
  });
  return html`<article class="finding status-${item.status}${item.selected ? " picked" : ""}" id="f-${item.id}" data-id="${item.id}" tabindex="-1">
    <p class="tags"><span class="num">${number(index)}</span> · ${words.severity[item.severity]} · ${words.kind[item.kind]} · <span class="status">${words.status[item.status]}</span>${probe ? ` · ${words.probe}: ${probeState(probe, words)}` : ""}</p>
    <h3>${item.title}</h3>
    <p class="plain">${item.plain}</p>
    ${item.check ? html`<p class="note">${item.check.note}</p>` : null}
    <p class="where">${refs.map((ref, i) => (i ? html` · ${ref}` : ref))}</p>
    <div class="decide" role="group" aria-label="${words.valid}">
      <span class="key">${words.valid}</span>
      ${VERDICTS.map((option) => html`<button type="button" class="verdict" data-action="rate" data-verdict="${option}" aria-pressed="${verdict === option ? "true" : "false"}">${words.verdict[option]}</button>`)}
      <input class="reason" data-action="reason" type="text" maxlength="500" placeholder="${words.reason}" value="${item.rating?.reason ?? ""}" aria-label="${words.reason}">
      <label class="pick"><input type="checkbox" data-action="select"${item.selected && canPick ? " checked" : ""}${canPick ? "" : " disabled"}> ${words.pick}</label>
    </div>
    <details>
      <summary>${words.detail}</summary>
      <dl>
        <dt>${words.condition}</dt><dd>${item.condition}</dd>
        <dt>${words.consequence}</dt><dd>${item.consequence}</dd>
        ${item.verification ? html`<dt>${words.unproven}</dt><dd>${item.verification}</dd>` : null}
        <dt>${words.seenAt}</dt><dd><code>${short(item.headSha)}</code></dd>
      </dl>
      <p class="key">${words.cited}</p>
      ${item.citations.map((citation) => html`<p class="path">${citation.ref}</p><pre><code>${citation.text}</code></pre>`)}
      ${probe ? probeBlock(probe, words) : null}
    </details>
  </article>`;
}

function rowBlock(row: Row, file: number, marks: Mark[], numbers: Map<string, number>, words: Words): Html {
  if (row.kind === "hunk") return html`<div class="row hunk"><span class="n"></span><span class="n"></span><span class="sign"></span><code>${row.text}</code></div>`;
  const here = rowMarks(row, marks);
  const starts = here.filter((mark) => (mark.side === "after" ? row.after : row.before) === mark.start);
  const id = row.after !== null ? anchor(file, "after", row.after) : row.before !== null ? anchor(file, "before", row.before) : "";
  const sign = row.kind === "added" ? "+" : row.kind === "removed" ? "−" : "";
  // Una línea retirada también se ancla por su número en la base, para las citas a la base.
  const alias = row.kind === "same" && row.before !== null ? html`<span class="alias" id="${anchor(file, "before", row.before)}"></span>` : null;
  return html`<div class="row ${row.kind}${here.length ? " cited" : ""}" id="${id}">${alias}<span class="n">${row.before ?? ""}</span><span class="n">${row.after ?? ""}</span><span class="sign" aria-label="${row.kind}">${sign}</span><code>${row.text || " "}</code>${[...new Set(starts.map((mark) => mark.finding))].map((finding) => html`<a class="mark" href="#f-${finding}" aria-label="${words.findings} ${number(numbers.get(finding) ?? 0)}">▸ ${number(numbers.get(finding) ?? 0)}</a>`)}</div>`;
}

/** Orden de los archivos: el del recorrido; lo que no esté en él, al final en el orden del diff. */
function ordered(files: FileDiff[], run: Run | null): FileDiff[] {
  const order = new Map<string, number>();
  for (const step of run?.tour ?? []) for (const path of step.files) if (!order.has(path)) order.set(path, order.size);
  return [...files].sort((a, b) => (order.get(a.path) ?? order.size + files.indexOf(a)) - (order.get(b.path) ?? order.size + files.indexOf(b)));
}

export function renderPage(view: SessionView): Html {
  const words = WORDS[view.lang];
  const { session, run, latest } = view;
  const files = run ? ordered(splitDiff(view.patch), run) : [];
  const fileIndex = new Map(files.map((file, index) => [file.path, index]));
  const listed = [
    ...view.findings.filter((item) => item.current),
    ...view.findings.filter((item) => item.status === "unchecked"),
    ...view.findings.filter((item) => item.status === "resolved"),
  ];
  const numbers = new Map(listed.map((item, index) => [item.id, index]));
  // Lo resuelto y lo descartado ya no piden atención en el diff.
  const marks = run ? marksFor(listed.filter((item) => item.status !== "resolved" && item.rating?.verdict !== "descartar"), run) : [];
  // Dónde cae cada cita en el diff, para enlazarla desde su hallazgo.
  const places = new Map<string, string>();
  for (const item of listed)
    for (const citation of item.citations) {
      const file = fileIndex.get(citation.path);
      const side = run && citation.sha === run.headSha ? "after" : run && citation.sha === run.baseSha ? "before" : null;
      if (file !== undefined && side) places.set(`${item.id}:${citation.ref}`, anchor(file, side, citation.start));
    }
  const picked = view.findings.filter((item) => item.selected && item.status !== "resolved").length;
  const group = (label: string, items: StoredFinding[], folded = false): Html | null => {
    if (!items.length) return null;
    const body = items.map((item) => findingBlock(item, numbers.get(item.id) ?? 0, words, places));
    return folded
      ? html`<details class="group"><summary class="group-label">${label} · ${items.length}</summary>${body}</details>`
      : html`<div class="group"><p class="group-label">${label} · ${items.length}</p>${body}</div>`;
  };
  const repo = session.repo.split("/").at(-1) ?? session.repo;
  return html`<header class="top">
    <p class="eyebrow">p_reviewer · ${repo} · ${session.branch}</p>
    ${heading(0, words.title)}
    <p class="meta">${run ? html`head <code>${short(run.headSha)}</code> · base <code>${short(run.baseSha)}</code> · ` : null}${words.reviews(view.runs.count)} · ${view.runs.usd.toLocaleString(view.lang === "es" ? "es-ES" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $${session.prUrl ? html` · <a href="${session.prUrl}" rel="noreferrer">PR</a>` : null}</p>
    ${latest?.status === "running" ? html`<p class="live">▸ ${words.running}</p>` : null}
    ${latest && latest.status !== "running" && latest.status !== "done" ? html`<p class="warn">${words.failed(latest.error ?? latest.status)}</p>` : null}
    ${run ? null : html`<p class="warn">${words.none}</p>`}
  </header>
  ${run ? html`<main>
  <section id="tour">
    ${heading(1, words.tour)}
    ${run.summary ? html`<p class="summary">${run.summary}</p>` : null}
    <ol class="tour">${run.tour.map((step, index) => html`<li>
      <h3><span class="num">${index + 1}.</span> ${step.title}</h3>
      <p>${step.plain}</p>
      ${step.why ? html`<p class="why">${step.why}</p>` : null}
      <p class="files">${step.files.map((path, i) => html`${i ? " · " : ""}<a href="#file-${fileIndex.get(path) ?? ""}">${path}</a>`)}</p>
    </li>`)}</ol>
  </section>
  <section id="findings">
    ${heading(2, words.findings)}
    ${listed.length ? null : html`<p class="plain">${words.noFindings}</p>`}
    ${group(words.current, listed.filter((item) => item.current))}
    ${group(words.unchecked, listed.filter((item) => item.status === "unchecked"))}
    ${group(words.resolved, listed.filter((item) => item.status === "resolved"), true)}
    ${run.gaps.length ? html`<ul class="gaps">${run.gaps.map((gap) => html`<li>· ${words.gap}: ${gap}</li>`)}</ul>` : null}
    ${run.rejected.length ? html`<details class="rejected"><summary>· ${words.rejected(run.rejected.length)}</summary><ul>${run.rejected.map((item) => html`<li>${item}</li>`)}</ul></details>` : null}
  </section>
  <section id="changes">
    ${heading(3, words.changes)}
    ${files.map((file, index) => {
      const own = marks.filter((mark) => mark.path === file.path);
      const added = file.rows.filter((row) => row.kind === "added").length;
      const removed = file.rows.filter((row) => row.kind === "removed").length;
      return html`<section class="file" id="file-${index}"><details${own.length || file.rows.length <= OPEN_ROWS ? " open" : ""}>
      <summary class="path">${file.path} <span class="count">+${added} −${removed}${own.length ? ` · ${own.length} ▸` : ""}</span></summary>
      <div class="diff">${file.rows.length ? file.rows.map((row) => rowBlock(row, index, own, numbers, words)) : html`<p class="note">${words.noLines}</p>`}</div>
    </details></section>`;
    })}
  </section>
  </main>` : null}
  <footer class="bar${picked ? " active" : ""}" aria-live="polite">${words.picked(picked)}</footer>`;
}
