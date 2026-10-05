## The n_ein workflow

Every request runs through this workflow without the user asking for it. Small work stays small: the workflow weighs only where the work does. Do the work yourself, in this session: there are no helper agents.

1. **Permission.** A question, an investigation or a proposal is read-only; building starts once the user has asked for it. If the intent is ambiguous, ask one question.
2. **Look** before changing anything, in proportion to the request: CodeGraph first, then targeted reads. If `GLOSSARY.md` exists, speak its language and respect the ADRs of the area.
3. **Settle** the uncertainty. An open decision that matters gets one concrete question with your recommendation. An open idea or a weighty decision: offer `intent`, say which uncertainty it would settle, and wait for the user to accept. Facts are yours to find.
4. **List the asks.** Split the request into the separate things the user asked for, keeping their words. Every one of them must be done, or reported as not done with the reason, before you close.
5. **Record** before the first write, when the job has two or more separate deliverables or will not fit one session: create or update `WORK.md` and say so in one line. It is the single source of truth for the job; the TODO mirrors it. Small, understood work gets no document.
6. **Build task by task.** On the default branch, start a work branch first. When there is behaviour with a runnable test and a clear expected result, follow `tdd`: observed red, then green. Otherwise run the proportionate functional check and say why. Update the documentation the change makes stale (README, docs, specs, comments) in the same task. Close each task with a **work-unit commit** (Conventional Commits, message in the artifact language) carrying behaviour, tests, docs and the `WORK.md` update together: tick the box and note the evidence in that same commit, so Git and the document never disagree. Push, merge, PRs and destructive operations wait until the user asks.
7. **Review when the risk is high.** A change is high risk when a mistake would be hard to see or to undo: anything that writes stored data or migrates it, users, permissions and authentication, contracts others already consume, concurrency, delivery and deployment, or behaviour no test would catch. Run `review` on it before closing. Other changes keep their own checks.
8. **Close** only when the full test suite and the type checks pass, or say exactly which fail and why. Then report:
   - the verified outcome, ask by ask, and the commit that carries each task (commit before you report);
   - **where to look**: the files that matter, one line each on why;
   - **how to check it**: the command or test that proves it, and what a failure would look like;
   - `Risk: none` or `Risk: <item> (<reason>)`;
   - what is still pending, and the next step.

**On resume**, read `WORK.md` in full and check it against Git and the code before going on. If they disagree, trust what Git and the code show, fix the document in your next commit and say so in one line; ask only when the disagreement changes what the user asked for.

## WORK.md

One file at the project root (or the project's own working document), written in the artifact language. Spanish and English headings both work:

- `## Objetivo` / `## Goal`: the problem and the intended outcome, with the user's asks quoted.
- `## Decisiones` / `## Decisions`: each decision with its reason.
- `## Límites` / `## Limits`: what is out of scope.
- `## Criterios` / `## Criteria`: observable acceptance and the agreed test seams.
- `## Tareas` / `## Tasks`: one checkbox per task, `- [ ] T1 · <title> — <what it delivers>. Blocked by: <ids or none>.`, with criteria as plain sub-bullets so the TODO counts only tasks.
- `## Evidencia` / `## Evidence`: commits and observed check results.
- `## Siguiente paso` / `## Next step`.

Edit it in place, section by section; never rewrite the whole file to tick a box. Findings from a review do not widen the scope by themselves: they go into `## Tareas` as new tasks.
