---
name: vision
description: "Shape a vague idea for a new project or feature into a clear brief, with HTML wireframes and schemas, before any development starts."
disable-model-invocation: true
---

The user has an idea and not yet a clear picture of how they want it or how far it should go. Turn it into a **brief** that development can start from without guessing: what it is, for whom, where it stops, and what it looks like. This session designs; it builds nothing.

## Rounds

Hold the conversation as a **decision tree** and work it in **rounds**, like an interview: each round asks only the decisions whose prerequisites are settled (the **frontier**), at most three, each numbered with your recommendation underneath, written in the conversation language:

```
**Q1 · <question title>** — <the question, with concrete options when they help>

▸ I recommend: <your answer and why>
```

Then wait. Every answer reshapes the tree; recompute the frontier and open the next round. Start by restating the idea in two or three lines so the user can correct the premise before anything hangs off it.

**Facts are your job; decisions are the user's.** Technical, reversible choices that fit the user's known preferences are yours: take them and say so. A settled decision stays settled; reopen it only for new evidence, and name it.

## What to settle

Not a form to fill in order; these are the branches the tree usually needs. Skip what the idea makes obvious.

- **Kind.** A new project or a feature of an existing one. For a feature, look at the code first (CodeGraph first): where it fits, what it touches, which consumers and conventions it must respect. For a new project there is no code: facts come from the user's shared preferences, their similar projects when they name them, and research.
- **Problem and people.** Who uses it, what they are trying to get done, and what is true for them once it exists.
- **Horizon.** Three rings, agreed explicitly: **v1** (what gets built first and is useful on its own), **later** (wanted, named and deferred), **never** (out, with the reason). Push back when v1 grows past something one stretch of work can finish; the rings exist so ambition is recorded without inflating v1.
- **Shape.** Main flows, screens or surfaces, the data and its relations, states that matter. For a new project, also stack, hosting and data storage, defaulting to the user's preferences.
- **Success.** How the user will tell v1 works: observable criteria, not tasks.

## Sketches

When a frontier decision is visual or structural (a layout, a flow, what an entity holds), show it instead of describing it. Follow [SKETCH.md](SKETCH.md): one self-contained HTML file in grey, opened in the browser and iterated with small edits. Ask about what is on screen ("Q1 · Is sheet 2 the right flow?"). Do not sketch what words already settle.

## Closing

The session is ready to close when v1 has a goal, a horizon, its material decisions with reasons, its shape and success criteria, with open questions named as deferred. Write the brief in the artifact language to `docs/design/<topic>.md`, or the project's existing design-docs location, next to the sketch file:

- **Goal**: the problem and the outcome, from the user's point of view.
- **Horizon**: v1, later, never.
- **Decisions**: each with its reason; link the sketch sheets that pin them.
- **Shape**: flows, surfaces, data, and the stack for a new project.
- **Success**: observable criteria for v1.
- **Deferred**: open questions that do not block v1.

Remove sheets the user rejected so the sketch file shows only what was agreed. Summarize the brief in a few lines and ask once for confirmation.

Confirming the brief is not permission to build. When the user asks to build ("go ahead / hazlo"), the ordinary workflow takes over: `WORK.md` links the brief and the sketches instead of copying them, and `spec` and `tasks` start from the brief without repeating the interview. If the user drops the session before confirming, say which draft files exist and leave them for the user to keep or delete.
