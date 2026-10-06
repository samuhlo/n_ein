---
name: spec
description: "Turn an agreed conversation into a concise guide in WORK.md when the user asks to record it or an authorized multi-delivery job needs one. Use the settled scope; no extra interview."
---

Turn what the conversation and the code already say into a spec. Synthesise; open decisions belong to `intent`, not here.

1. **Look** at the code first if you have not (CodeGraph first). Use the glossary's language throughout and respect the ADRs of the area.
2. **Sketch the test seams.** Prefer existing seams to new ones and the highest meaningful one. State your choice and proceed; ask only when it changes the user's scope or observable behaviour.
3. **Write the spec into `WORK.md`** (shape in the n_ein workflow; complete existing sections instead of duplicating them), in the artifact language:

- **Goal**: the problem from the user's point of view, then the solution from the user's point of view.
- **User behaviour**: the user's actual asks and the observable result of each. Use stories only when they clarify different actors or paths; do not expand a small feature into a requirements inventory.
- **Decisions**: each implementation decision with its reason: modules built or changed, interfaces that change, architecture, schema changes, API contracts, notable interactions. No file paths or code snippets, which go stale fast; the one exception is a snippet from a prototype that pins a decision better than prose (a state machine, a reducer, a schema, a type), trimmed to the decision and marked as coming from the prototype.
- **Criteria**: what makes a good test here (external behaviour only), the agreed seams and the modules under test, and similar tests already in the code to follow.
- **Limits**: what is out of scope.
- Any further notes.

Keep the guide proportional. For an authorized job with several deliveries, load `tasks` yourself and add its useful slices to this same document. Do not ask the user to run another command.
