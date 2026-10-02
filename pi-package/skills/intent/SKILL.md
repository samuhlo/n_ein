---
name: intent
description: Relentless interview to pin down an open idea, plan or decision before building. Use when the user asks for intent or to be grilled with questions, or accepts your offer to run it.
---

Interview the user relentlessly until you share one understanding of what is worth building. Hold the conversation as a **decision tree**: every decision opens the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: what you can ask _now_ without guessing at answers you have not heard. Ask the whole frontier in one round, each question numbered and carrying your recommended answer. Then wait for the user.

A round looks like this, written in the conversation language:

```
**Q1 · <question title>** — <the question; several paragraphs and options if it needs them>

▸ I recommend: <your answer and why>

---

**Q2 · <question title>** — <the question>

▸ I recommend: <your answer and why>
```

Every answered round reshapes the tree: settled decisions push the frontier out and unblock what depended on them. Recompute the frontier and open the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round. With no starting idea, the first round is one plain question.

**Facts are your job, never the user's.** When a frontier question needs a fact from the code, the docs or the conversation, find it: directly if it is quick, through `nein_scout` if it takes a batch of reading. Keep going while it reads: a running scout is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now. **Decisions are the user's**: put each one to them and wait. Technical, reversible choices that fit the project's conventions are yours: take them and say so. A settled decision stays settled; reopen it only for new evidence, and name it.

The session ends when the frontier for the next stretch of work is empty: goal, scope, decisions with their reasons and observable criteria settled, and whatever can wait named as deferred, with nothing silently assumed. Then present the agreement and ask once for confirmation that you both read it the same way. Until that confirmation, this is conversation only.

## After confirmation

The agreement says what to do; permission to build it is separate. If the user only asked to think, stop here. If they had already authorized building within this scope, carry on under that permission.

When the work needs tracking or the user asks, record the agreement in `WORK.md` (shape defined in the n_ein workflow), using only the sections that apply. `spec` turns the agreement into a full spec and `tasks` slices it into tasks. That document is the single record: whoever builds it, including a delegated role or the next agent after a handoff, starts from it without repeating the interview. A session dropped before confirmation leaves the project as it was.
