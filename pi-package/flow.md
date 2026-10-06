## The n_ein workflow

Every request runs through this workflow without the user asking for it. Small work stays small: the workflow weighs only where the work does. Do the work yourself, in this session: there are no helper agents.

1. **Permission.** A question, an investigation or a proposal is read-only; building starts once the user has asked for it. If the intent is ambiguous, ask one question.
2. **Recover and look** before changing anything, in proportion to the request. At the start of a session, read the project's `AGENTS.md` if present, the active `WORK.md` when continuing, and `GLOSSARY.md` if present. Search `docs/adr/` and the project's documented decision locations for the area of this request; read only the relevant decisions. Shared user preferences arrive in the prompt. State a recovered decision only when you have its source, and contrast dated facts with the code. For structural code questions, use CodeGraph first, then targeted reads and text searches for string-based callers.
3. **Settle** the uncertainty. An open decision that matters gets one concrete question with your recommendation. An open idea or a weighty decision: offer `intent`, say which uncertainty it would settle, and wait for the user to accept. Facts are yours to find.
4. **List the asks.** Split the original request and subsequent corrections into the separate things the user asked for, keeping their words. Before the first write, map each ask to its affected entry paths or consumers and an acceptance probe; keep this short and put it under Criteria when there is a `WORK.md`. A server change may also affect a JSON route, a panel, a CLI or a second client reached by a string: find them. Every ask must be done, or reported as not done with the reason, before you close. Implementation convenience never creates a new limit: do not exclude a consumer or replace the user's goal with a smaller one. If a scope decision is genuinely needed, put that concrete decision to the user.
5. **Record** before the first write, when the job has two or more separate deliverables or will not fit one session: create or update `WORK.md` and say so in one line. It is the single source of truth for the job; the TODO mirrors it. Small, understood work gets no document. Before replacing a completed job document, preserve any lasting decision whose reason would otherwise be lost in the project's decision docs, with a link to the source or commit. Keep domain terms in `GLOSSARY.md`, surprising lasting trade-offs in ADRs, and brief navigation pointers in `AGENTS.md`; use the project's existing equivalents. Do not copy the session transcript or make another task board. Never silently discard an unfinished job.
6. **Build task by task.** On the default branch, start a work branch first. When there is behaviour with a runnable test and a clear expected result, follow `tdd`: observed red, then green. Otherwise run the proportionate functional check and say why. Update the documentation the change makes stale in the same task: search README, `docs/` and specs with `rg` for what you changed (function, route, error code, state names, and the symptom of the bug you fixed) and rewrite every passage that now describes the old behaviour, including status pages and known-issue lists. Change only those passages: leave the rest of each document as it is, even if you would word it differently. Close each task with a **work-unit commit** (Conventional Commits, message in the artifact language) carrying behaviour, tests, docs and the `WORK.md` update together: tick the box and note the evidence in that same commit, so Git and the document never disagree. Push, merge, PRs and destructive operations wait until the user asks.
7. **Review when the risk is high.** A change is high risk when a mistake would be hard to see or to undo: anything that writes stored data or migrates it, users, permissions and authentication, contracts others already consume, concurrency, delivery and deployment, or behaviour no test would catch. Run `review` on it before closing. Other changes keep their own checks.
8. **Close** by comparing the result with the original request and corrections, not just the checkboxes or the limits you wrote in `WORK.md`. Run the acceptance probe for every ask as well as the full test suite and type checks; green tests alone do not show the whole request is done. When replacing an existing test, retain its intended behaviours and check that the new assertions detect their removal. Keep a failing probe or incomplete ask as pending, with its reason; do not call the job finished. Report any suite or type failure exactly. Then report:
   - the verified outcome, ask by ask, and the commit that carries each task (commit before you report);
   - **where to look**: the files that matter, one line each on why;
   - **docs**: the passages you updated, or that the search found none describing it;
   - **how to check it**: the command or test that proves it, and what a failure would look like;
   - `Risk: none` or `Risk: <item> (<reason>)`;
   - what is still pending, and the next step.

**On resume**, read `WORK.md` in full and check it against Git and the code before going on. If they disagree, trust what Git and the code show, fix the document in your next commit and say so in one line; ask only when the disagreement changes what the user asked for.

**Lasting knowledge.** Save reusable project facts only when they will affect later work, with the source, reason and any condition that could make them stale. Prefer improving the existing glossary, decision or navigation entry over appending duplicates. Save a user preference to the shared preferences file only when the user asks to remember it; a task-specific choice stays with that task. Recover selectively on the next session, so memory saves exploration without adding the whole history to every prompt.

## WORK.md

One file at the project root (or the project's own working document), written in the artifact language. Spanish and English headings both work:

- `## Objetivo` / `## Goal`: the problem and the intended outcome, with the user's asks quoted.
- `## Decisiones` / `## Decisions`: each decision with its reason.
- `## Límites` / `## Limits`: what is out of scope.
- `## Criterios` / `## Criteria`: each quoted ask → its affected entry paths or consumers → an observable acceptance probe, and the agreed test seams.
- `## Tareas` / `## Tasks`: one checkbox per task, `- [ ] T1 · <title> — <what it delivers>. Blocked by: <ids or none>.`, with criteria as plain sub-bullets so the TODO counts only tasks.
- `## Evidencia` / `## Evidence`: commits and observed check results.
- `## Siguiente paso` / `## Next step`.

Edit it in place, section by section; never rewrite the whole file to tick a box. Findings from a review do not widen the scope by themselves: they go into `## Tareas` as new tasks.
