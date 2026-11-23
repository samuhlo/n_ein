---
name: spec
description: "Turn an agreed conversation into a concise work document when the user asks to record it or an authorized job cannot be resumed from the request and the diff alone. Use the settled scope; no extra interview."
---

Turn what the conversation and the code already say into a spec. Synthesise; open decisions belong to `intent`, not here.

1. **Look** at the code first if you have not (CodeGraph first). Use the glossary's language throughout and respect the ADRs of the area.
2. **Sketch the test seams.** Prefer existing seams to new ones and the highest meaningful one. State your choice and proceed; ask only when it changes the user's scope or observable behaviour.
3. **Write the spec into the job's work document** (`docs/work/<YYYY-MM-DD>-<short-name>.md`, shape in the n_ein workflow; complete an open one instead of duplicating it), in the artifact language:

- **Header**: `Objetivo:` the problem and the solution from the user's point of view, in one or two sentences; `Autorización:`, `Rama:` and `Siguiente:` as the workflow says.
- **Asks** (`## Pedidos`): the user's actual asks in their words, the observable result of each, what makes a good test for it (external behaviour only), the agreed seams and similar tests already in the code. Use stories only when they clarify different actors or paths; do not expand a small feature into a requirements inventory.
- **Decisions** (`## Decisiones`): each implementation decision with its reason: modules built or changed, interfaces that change, architecture, schema changes, API contracts, notable interactions; and what is out of scope. No file paths or code snippets, which go stale fast; the one exception is a snippet from a prototype that pins a decision better than prose (a state machine, a reducer, a schema, a type), trimmed to the decision and marked as coming from the prototype.
- **Log** (`## Registro`): the original request verbatim. Nothing else yet.

Keep the guide proportional. For an authorized job with several deliveries, load `tasks` yourself and add its useful slices to this same document. Do not ask the user to run another command.
