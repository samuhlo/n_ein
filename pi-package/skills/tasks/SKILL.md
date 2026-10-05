---
name: tasks
description: Slice a plan, a spec or the conversation into tracer-bullet tasks, each naming what blocks it, in the tasks section of WORK.md.
disable-model-invocation: true
---

# Tasks

Slice the work into **tracer-bullet** tasks: vertical slices, each naming the tasks that **block** it.

## 1. Gather

Start from the conversation and `WORK.md`; read in full any spec or reference the user passes. Look at the code if you have not (CodeGraph first), and use the glossary's language. Look for prefactoring that makes the rest easier: make the change easy, then make the easy change.

## 2. Draft vertical slices

- Each slice cuts a narrow but **complete** path through every layer it needs (schema, API, UI, tests), never one horizontal layer.
- A finished slice can be shown or verified on its own.
- Each slice fits in one session and one work-unit commit.
- Prefactoring goes first.

Give each task its **blockers**: the tasks that must finish before it starts. No blockers means it can start now.

**Wide refactors are the exception.** A mechanical change whose blast radius fans across the whole codebase (renaming a column, retyping a shared symbol) breaks everything in one edit, so no vertical slice can land green. Sequence it as **expand–contract**: expand (add the new form beside the old, nothing breaks); migrate the call sites in batches sized by blast radius (per package, per folder), each batch a task blocked by the expand and green on its own because the old form still exists; contract (delete the old form) in a task blocked by every batch. If even the batches cannot stay green alone, keep the sequence on a shared integration branch and promise green only in a final integrate-and-verify task.

## 3. Quiz the user

Show the breakdown as a numbered list: title, blocked by, and the end-to-end behaviour each task delivers. Ask whether the granularity is right (too coarse, too fine), whether every blocker truly gates its task, and whether any task should be merged or split. Iterate until they approve.

## 4. Write them into WORK.md

Add the approved tasks under the tasks section in dependency order, blockers first, with stable IDs, in the artifact language:

```markdown
## Tasks

- [ ] T1 · <title> — <what it delivers, end to end, from the user's point of view>. Blocked by: none.
  - Criterion: <observable behaviour>
- [ ] T2 · <title> — <what it delivers>. Blocked by: T1.
  - Criterion: <observable behaviour>
```

Criteria are plain sub-bullets so the TODO counts only tasks. No file paths or snippets in tasks (they go stale), except a prototype snippet that pins a decision, trimmed and marked. The work then follows the **frontier**: any task whose blockers are done.
