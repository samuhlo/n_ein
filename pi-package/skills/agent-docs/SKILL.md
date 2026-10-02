---
name: agent-docs
description: How to write anything an agent reads. Use when creating or editing skills, the persona or workflow, AGENTS.md or CLAUDE.md.
---

Reference for writing any document an agent consumes: a skill, the n_ein persona or workflow, an `AGENTS.md` / `CLAUDE.md`, a doc reached through a pointer. The packaging differs; the writing does not. The aim is predictability: the agent takes the same _process_ on every run, not the same output. Write agent-facing text in English; the user-facing language comes from the language instruction. For skills, also read [SKILL-MECHANICS.md](SKILL-MECHANICS.md).

## Pointers

A **pointer** is a reference held in the agent's context that names material outside it and encodes when to reach for it. A skill's description is one; a line in `AGENTS.md` naming a doc is another. The pointer's **wording**, not its target, decides how reliably the agent gets there: a must-have target behind a weak pointer is a variance bug. Sharpen the wording first; inline the material only if sharpening fails.

A pointer says what the material is and lists the **branches** (distinct cases) that should trigger it. Every word of an always-loaded pointer is paid on every turn, so prune it hardest: put the **leading word** first; one trigger per branch (synonyms of one branch collapse into one); drop identity the body already carries.

## Two loads

- **Context load**: what always-loaded text costs the agent on every turn, firing or not.
- **Cognitive load**: what the human must remember about which documents exist and when to use them. Not a cost to minimise blindly: spend it where human judgement matters.

Material behind a pointer escapes context load for the price of the pointer's line; material with no pointer rides entirely on the human.

## Information ladder

A document mixes **steps** (ordered actions) and **reference** (rules and facts consulted on demand). Place each piece on a ladder by how soon the agent needs it:

1. **Steps in the file**: what the agent does, in order.
2. **Reference in the file**: consulted on demand; a flat set of peers is fine.
3. **Disclosed reference**: moved to a separate file behind a pointer, loaded only when the pointer fires.

**Disclose progressively**: inline what every branch needs, push behind a pointer what only some branches reach. This protects the top of the document; reference that should be disclosed buries the steps and makes following them a coin flip. **Co-locate**: keep a concept's definition, rules and caveats under one heading. **Sprawl** (a document simply too long) thins attention even when every line is live; the cure is the ladder.

## Done criteria

Every step ends on a **done criterion**. It needs **clarity** (can the agent tell done from not done? a vague bound invites **premature completion**, attention slipping to the steps ahead) and **demand** (how much it asks: "every modified model accounted for" drives legwork that "list the changes" does not). Sharpen the bound first; hide later steps behind a real context boundary (a handoff or a role delegation) only if it stays fuzzy and you see the rush. The strongest criteria are checkable and exhaustive.

## When to split

Splitting spends one of the two loads, so split only when the cut pays: **by sequence**, when later steps tempt the agent to rush the current one; **by invocation**, for skills (see the mechanics).

## Leading words

A **leading word** is a compact concept the model already knows from pretraining (_tracer bullet_, _seam_, _red_, _frontier_). Repeated as a token, never as a sentence, it anchors a whole region of behaviour in a few tokens, both in the body (the agent reaches for the same behaviour every time) and in a pointer (shared language with your prompts and code triggers it reliably). Prefer an existing word to a coined one: a coined word recruits nothing and must be paid for in definition. Hunt for restatements a leading word can retire ("fast, deterministic, low-overhead" → _tight_).

**Negation** is its failure mode: naming the forbidden behaviour activates it. State the target behaviour instead ("write one-line comments"). Keep a prohibition only as a hard guardrail you cannot phrase positively, and pair it with the positive target.

## Pruning

- **One source of truth** per meaning; duplication costs upkeep and inflates a meaning's weight.
- **The environment is a source of truth** (scripts, config, layout, `--help`); restating it is a **cache** that only earns its place when the lookup is expensive. Cache the unwritten convention, the reason behind a choice, the trap no config confesses.
- **Relevance**: delete lines that never bear on the task or went stale. Without pruning, documents silt up with **sediment**.
- **No-ops**: an instruction the model already follows by default says nothing. Test it by running the document, and delete the whole sentence when it fails; a leading word too weak to beat the default (_thorough_) needs a stronger one (_relentless_).
