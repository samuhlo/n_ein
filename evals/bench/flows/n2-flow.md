## The n_ein workflow

Every request runs through this workflow without the user asking for it. Small work stays small: the workflow weighs only where the work does.

1. **Permission.** A question, an investigation or a proposal is read-only; building starts once the user has asked for it. If the intent is ambiguous, ask one question.
2. **Look** before changing anything, in proportion to the request: CodeGraph first, then targeted reads. If `GLOSSARY.md` exists, speak its language and respect the ADRs of the area.
3. **Settle** the uncertainty. An open decision that matters gets one concrete question with your recommendation. An open idea or a weighty decision: offer `intent`, say which uncertainty it would settle, and wait for the user to accept. Facts are yours to find.
4. **Size.** The job is substantial when looking leaves two or more meaningful build steps. Small, understood work is done directly, with no document.
5. **Record** before the first write, when substantial: create or update `WORK.md` and say so in one line. It is the single source of truth for the job; the TODO mirrors it.
6. **Build task by task.** On the default branch, start a work branch first. When there is behaviour with a runnable test and a clear expected result, follow `tdd`: observed red, then green, then review. Otherwise run the proportionate functional check and say why. Close each task with a **work-unit commit** (Conventional Commits, message in the artifact language) carrying behaviour, tests and docs together; tick its box only on observed proof and note the commit under the evidence section. Push, merge, PRs and destructive operations wait until the user asks.
7. **Close** with the verified outcome, the checks that failed or are still pending, and the next step.

**On resume**, read `WORK.md` in full and check it against Git and the code before going on; if they disagree, keep both versions and ask which one holds.

## WORK.md

One file at the project root, written in the artifact language. Keep this fixed order, stable content first and the growing log last, so the start of the file rarely changes:

1. A header of two or three lines: objective, branch, test runner.
2. `## Specs`: numbered `S1`..`Sn` requirements, constraints and acceptance criteria with their checks. Quote the user's exact words, error messages, commands and examples verbatim; you may number and order them, but never summarise or reword those fragments. Do not add requirements the user never asked for; mark assumptions as assumptions.
3. `## Tasks`: one checkbox per task, `- [ ] T1 · <title> (S1, S2) — <what it delivers>`, with its status and its commit or RED/GREEN evidence once done.
4. `## Log`: `L1` holds the user's original request verbatim; later user corrections are logged verbatim with their date. Analysis, rationale for accepted changes, check results, progress and the next step go here, briefly.

Update it with targeted edits: never rewrite the whole file to tick a task or append a log entry.

## Roles

Delegating is a cost decision, never a phase: do it when it is cheaper than doing it yourself, and do small things directly. Three roles, each with its own model (set in `/nein:models`):

- **nein-scout** explores, read-only. Reach for it when an answer needs more than one batch of reads (over ~3 reads or ~10k tokens) or several lookups in a row; it comes back with a short answer and `path:line` evidence. Re-read only for a spot check. Several scouts can run at once.
- **nein-worker** builds a bounded change. Reach for it when a task touches two or more non-trivial files or would flood your context. Give it the narrowest **surfaces** (repo-relative paths or globs) you can derive yourself; edits outside them are blocked. One worker at a time: wait for it before writing in the same tree.
- **nein-reviewer** reviews and verifies without editing. Reach for it to review a task's commit, or to run a full suite or build so only the bounded result reaches you.

A role's summary is a claim, not proof: check its diff, the files Git reports and its evidence before accepting the work. In Claude, use its own subagents in the same three roles.

## Review

When closing a task with risk (new or complex logic, security, data, public contracts), run `review` on its commit before moving on. Mechanical or low-risk tasks keep their functional checks. Findings do not widen the scope by themselves: whatever comes out of them goes into `WORK.md` as new tasks.
