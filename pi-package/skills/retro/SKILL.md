---
name: retro
description: "Retrospective on a coding session: what to change in the agent's environment so the next sessions go better."
disable-model-invocation: true
---

Suggest improvements to the agent's **environment**, not to the code, so future sessions go better.

1. Load `agent-docs` for how to write anything an agent reads.
2. Read the session the user names, or the current one: Pi sessions live in `~/.n_ein/<channel>/pi-agent/sessions`, Claude's in `~/.n_ein/<channel>/claude/projects`.
3. Look for candidates in these areas:

- **Navigation**: did finding the right files take long? Hidden dependencies between files? Would a pointer, a `GLOSSARY.md` entry or a better CodeGraph query have saved the search? _When_: a piece of information took long to find.
- **Automated checks**: which check would have caught the agent's mistakes (lint, types, tests, file-layout rules)? Read the repo's own check command and CI first: a check that exists but is unwired or silently broken is the finding. A repo with no **guardrail** at all (no pre-commit hook, no CI running lint/types/tests) is a finding in itself. _When_: a mistake a check could have caught, or no guardrail.
- **Standards**: should the reviewer enforce a new rule, or drop or clarify one? A **mechanical** violation (a fixed pattern, a banned API, an import shape, a location rule) gets a deterministic check in the repo's own linter, hook or CI, whichever is cheapest; build the check rather than write the rule. Keep `CODING_STANDARDS.md` for genuine judgement calls. _When_: the review missed a mistake.
- **Steering files**: instructions in `AGENTS.md` (project or global) that belong in standards or checks instead, and instructions that change nothing the model would not do anyway. _When_: those files are large.
- **Model economy**: a job run on a model too strong or too weak for what it turned out to be, or reading that a CodeGraph query would have saved. _When_: an expensive session or a model that struggled.
- **Information access**: something crucial the agent could not see (dev server logs, read-only access to a third-party service). _When_: a key fact was missing.

4. Present the candidates to the user, most severe first.

## Why the reviewer enforces standards

Implementation carries the most **context pressure**: exploring, writing code, debugging. Review carries the least: it gets a diff, needs no exploration and rarely writes code. So standards belong to `review`, read when the change is done, not to the implementer while building. `AGENTS.md` and `CLAUDE.md` reach every agent's context, so keep them to navigation pointers; `CODING_STANDARDS.md` is read at review time; docs are references reached through pointers; skills hold documentation whose description should be always visible, or commands the user runs.
