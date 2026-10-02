---
name: spec
description: "Turn the current conversation into a spec inside WORK.md: no interview, only synthesis of what is already settled."
disable-model-invocation: true
---

Turn what the conversation and the code already say into a spec. Synthesise; open decisions belong to `intent`, not here.

1. **Look** at the code first if you have not (CodeGraph first). Use the glossary's language throughout and respect the ADRs of the area.
2. **Sketch the test seams.** Prefer existing seams to new ones and the highest one possible; fewer seams across the code are better, one is ideal. Check with the user that they match what they expect.
3. **Write the spec into `WORK.md`** (shape in the n_ein workflow; complete existing sections instead of duplicating them), in the artifact language:

- **Goal**: the problem from the user's point of view, then the solution from the user's point of view.
- **User stories**: a long, numbered list covering every aspect of the feature, each as "As a <actor>, I want <feature>, so that <benefit>", for example "As a mobile banking customer, I want to see my account balances, so that I can decide what to spend."
- **Decisions**: each implementation decision with its reason: modules built or changed, interfaces that change, architecture, schema changes, API contracts, notable interactions. No file paths or code snippets, which go stale fast; the one exception is a snippet from a prototype that pins a decision better than prose (a state machine, a reducer, a schema, a type), trimmed to the decision and marked as coming from the prototype.
- **Criteria**: what makes a good test here (external behaviour only), the agreed seams and the modules under test, and similar tests already in the code to follow.
- **Limits**: what is out of scope.
- Any further notes.

Tasks are not part of this skill: when the user wants the work sliced, `tasks` adds them.
