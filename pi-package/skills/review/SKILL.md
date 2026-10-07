---
name: review
description: "Review the changes since a fixed point against what was asked (Spec) and the repo's standards (Standards), probing the behaviour instead of trusting the diff. Use to review a branch, a PR, work in progress or a task's commit, when the user asks to review since X, and before closing a high-risk change."
---

Review the diff between `HEAD` and a fixed point yourself, in two passes kept apart: **Spec** first (does it do what was asked?), then **Standards** (is it written the way this repo writes code?). A clean diff that builds the wrong thing fails Spec; the right thing written against the conventions fails Standards. Report them separately.

## 1. Pin the fixed point

Use what the user says (a SHA, a branch, a tag, `main`, `HEAD~5`). Without one, use the start of the current task according to `WORK.md`; failing that, ask. Fix the diff once: `git diff <point>...HEAD` plus `git log <point>..HEAD --oneline`, and check the diff is not empty.

## 2. Spec: probe what was asked

Find the asks: the user's request, quoted; `WORK.md` (goal, decisions, limits, criteria, the task under review); a path the user gave; a spec under `docs/` or `specs/` matching the branch. Without any, say "no spec" and review Standards only.

For **each ask**, derive one probe a careless change would fail, and run it here without editing source files: a focused test, a CLI call, a request against a test double, or a test you write in a scratch file and delete afterwards. Read the code paths the probe exercises; do not trust names, comments or the commit message. Cover:

- the asked behaviour on its normal path and on its edge cases (empty input, missing record, the second entry path to the same rule);
- what must **not** change: existing output, data and callers outside the ask;
- failure paths: the error the user sees, and that nothing is half written.

For an expected business refusal, trace the actual server response through the consumer's error mapper and recovery action. Exercise that path even when the implementation reuses an existing error code: an HTTP rejection can pass while the UI wrongly reports a network failure or tells the user to retry unchanged input.

Report per ask: done, partial, wrong or missing, with the probe and its result. Add anything the diff does that nobody asked for.

Compare each recorded check with the revision, dependencies and environment it exercised; repeat only what changed or lacked coverage.

## 3. Standards

Whatever the repo documents about writing code: `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `AGENTS.md`, linter config. If the project documents no style of its own, the `comments` and `logs` skills are its standard. Skip anything tooling already enforces.

On top of that, check this **smell baseline** (Fowler, _Refactoring_, ch. 3), under two rules: **the repo wins** (a documented standard that endorses something suppresses the smell) and **every smell is a judgement call**, never a hard violation.

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
- **Middle man**: something that mostly forwards → call the real target.
- **Refused bequest**: a subclass ignoring most of what it inherits → composition.

Also check that a reader can follow it: comments say why, logs and errors name where and what failed, and tests read as the behaviour they protect.

## 4. Severity

- **Blocker**: an ask missing or wrong; existing behaviour or data broken; an explicit option or input silently ignored; a failure that reports success; a security hole. Any input the program accepts counts as realistic.
- **Important**: an edge case of an ask unhandled; a test that would still pass if the behaviour broke; stale documentation of the changed behaviour.
- **Minor**: everything else, including every smell.

## 5. Report and fix once

Show `## Spec` and `## Standards` separately, each with its findings in severity order, `path:line` and the probe or quote behind it. Close with one line per axis: the count and the worst finding.

When you are the one building: fix every blocker in one batch, re-run only the probes that failed, and stop. A probe that still fails after that round, or a new finding, goes to the user as "needs your decision"; never start a second full sweep. Important and minor findings go to `WORK.md` as tasks, or into the close report when there is no document.
