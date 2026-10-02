---
name: review
description: "Two-axis review of the changes since a fixed point: Standards (does the code follow the repo's documented standards?) and Spec (does it do what WORK.md agreed?). Use to review a branch, a PR, work in progress or a task's commit, when the user asks to review since X, and when closing a risky task."
---

Review the diff between `HEAD` and a fixed point along two axes:

- **Standards**: does the code follow the repo's documented standards?
- **Spec**: does it faithfully implement what was agreed?

Each axis goes to its own **nein-reviewer**, with a fresh context so one axis cannot colour the other. Launch both at once; in Claude, two subagents. Then put their findings side by side.

## 1. Pin the fixed point

Use what the user says (a SHA, a branch, a tag, `main`, `HEAD~5`). Without one, use the start of the current task according to `WORK.md`; failing that, ask.

Fix the diff command once: `git diff <point>...HEAD` (three dots: against the merge-base), plus `git log <point>..HEAD --oneline`. Check that the point resolves (`git rev-parse <point>`) and the diff is not empty here, before any reviewer starts.

## 2. Find the spec

In this order: the agreement in `WORK.md` (goal, decisions, limits, criteria and the task under review); a path the user gave; issue references in commit messages, if the project uses a tracker you can reach; a spec under `docs/` or `specs/` matching the branch. If none exists, the Spec reviewer is skipped and the report says "no spec".

## 3. Gather the standards

Whatever the repo documents about writing code: `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `AGENTS.md`, linter config. If the project documents no style of its own, the `comments` and `logs` skills are its standard.

On top of that, the Standards axis always carries this **smell baseline** (Fowler, _Refactoring_, ch. 3), under two rules: **the repo wins** (a documented standard that endorses something suppresses the smell) and **every smell is a judgement call**, never a hard violation. Skip anything tooling already enforces.

- **Mysterious name**: a name that does not reveal what it does or holds → rename; if no honest name comes, the design is murky.
- **Duplicated code**: the same logic shape in more than one hunk or file → extract it, call it from both.
- **Feature envy**: a method reaching into another object's data more than its own → move it next to that data.
- **Data clumps**: the same few fields or params always travelling together → one type.
- **Primitive obsession**: a primitive standing in for a domain concept → give it a small type.
- **Repeated switches**: the same `switch`/`if` cascade on one type in several places → polymorphism or one shared map.
- **Shotgun surgery**: one logical change scattered across many files → gather what changes together.
- **Divergent change**: one module edited for unrelated reasons → split it.
- **Speculative generality**: abstractions, params or hooks the spec does not need → delete them.
- **Message chains**: long `a.b().c().d()` walks → hide the walk behind one method.
- **Middle man**: something that mostly delegates → call the real target.
- **Refused bequest**: a subclass ignoring most of what it inherits → composition.

## 4. Launch the two reviewers

**Standards** (`nein_reviewer`): target = the diff command and commit list; criteria = the standards files from step 3 **plus the smell baseline pasted in full** (the reviewer has no other access to it), with this brief: "Report per file/hunk (a) every breach of a documented standard, citing the file and rule, and (b) any baseline smell, naming it and quoting the hunk. Documented breaches can be blocking; smells are always judgement calls; the repo overrides the baseline. Skip what tooling enforces. Under 400 words."

**Spec** (`nein_reviewer`): target = the same diff; criteria = the spec, with this brief: "Report (a) requirements missing or partial, (b) behaviour nobody asked for, (c) requirements that look implemented but wrongly. Quote the spec line for each. Under 400 words."

Add the project's checks (`checks`) to one of them when the review should also prove the tests pass.

## 5. Report

Show both reports under `## Standards` and `## Spec`, verbatim or lightly cleaned. Each axis keeps its own findings and order: they are separate on purpose. Close with one line: findings per axis and the worst one _within each axis_. Picking a single winner across axes is exactly the reranking the separation prevents: clean code that builds the wrong thing passes Standards and fails Spec; the right thing built against the conventions does the opposite.

Fixes that come out of the review go to `WORK.md` as tasks; the review itself changes nothing.
