---
name: intent
description: Help define and design an open idea before building. Use when the user asks for intent, to think it through, to design it together, to be grilled with questions, or accepts your offer. A clear implementation request needs no interview.
---

Interview the user relentlessly until you share one understanding of what is worth building. Hold the conversation as a **decision tree**: every decision opens the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: what you can ask _now_ without guessing at answers you have not heard. Start with the decisions that most change the next deliverable, normally at most three concise questions per round, each numbered and carrying your recommended answer. Defer the rest; an exhaustive interview is for when the user asks for one. Then wait for the user. Do not ask them to invoke intent again when their own words already requested help defining or designing the idea.

A round looks like this, written in the conversation language:

```
**Q1 · <question title>** — <the question; several paragraphs and options if it needs them>

▸ I recommend: <your answer and why>

---

**Q2 · <question title>** — <the question>

▸ I recommend: <your answer and why>
```

Every answered round reshapes the tree: settled decisions push the frontier out and unblock what depended on them. Recompute the frontier and open the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round. With no starting idea, the first round is one plain question.

**Facts are your job, never the user's.** When a frontier question needs a fact from the code, the docs or the conversation, find it yourself, with CodeGraph first, before asking the next question. **Decisions are the user's**: put each one to them and wait. Technical, reversible choices that fit the project's conventions are yours: take them and say so. A settled decision stays settled; reopen it only for new evidence, and name it.

The session ends when the next stretch of work has a clear goal, scope, material decisions with reasons and observable criteria, and what can wait is named as deferred. Summarize a short guide: what changes for the user, the limits, the chosen approach and how success will be checked. Ask once for confirmation if the agreement has not already been confirmed. "That works, go ahead / vale, hazlo" is confirmation and permission for that scope; do not ask it again. Until confirmation, this is conversation only.

## After confirmation

The agreement says what to do; permission to build it is separate. If the user only asked to think, stop here. If they had already authorized building within this scope, carry on under that permission.

When the work needs tracking or the user asks, record the agreement in `WORK.md` (shape defined in the n_ein workflow), using only the sections that apply. Load `spec` and `tasks` yourself when their guidance is useful; the user does not need to invoke them or approve a technical task split. Small work uses the agreement directly. That document is the single record: whoever builds it, including the next agent after a handoff, starts from it without repeating the interview. A session dropped before confirmation leaves the project as it was.
