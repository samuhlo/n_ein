# Logic prototype

One self-contained HTML file, a **shareable demo**, that lets anyone drive a state model by clicking. For questions about business logic, state transitions or data shape: the things that look fine on paper and only feel wrong once real cases go through them. One file with nothing to install means you can hand it to a designer, a PM or a domain expert, so it speaks their language, not the code's.

Right shape when: "does this state machine handle X then Y?", "can this data model represent the case where…?", "let me feel the API before writing it", anything where someone wants to **press buttons and watch state change**. For "what should it look like", use [UI.md](UI.md).

## Steps

1. **State the question** in a visible intro paragraph at the top of the demo: which state model, which question. A prototype that answers the wrong question is pure waste.
2. **Isolate the logic in a portable module**: one `<script>` block written as a small pure module that could later move into the real code unchanged. Pick the shape the question needs, not the easiest to wire: a pure reducer `(state, action) => state` for discrete events; an explicit state machine when "which actions are legal now" is part of the question; a few pure functions when there is no current state; a class with a clear method surface when the logic owns evolving state. Keep it pure: no DOM, no `document`, no handlers inside. The page calls the module; nothing flows back.
3. **Build the page** in plain HTML/CSS/JS, everything inline: no framework, no bundler, no server. Domain language on every label. Top to bottom: title and one-line explanation; **current state** as a readable panel (labelled fields, not a JSON dump) re-rendered after every click, with what just changed called out; **free-play buttons**, one per action; **guided walkthroughs**, one scenario per tab with a plain description and its buttons in order, each starting from a known initial state. Choose scenarios that show the awkward cases: the happy path, a tricky edge, an attempt at something that should be illegal. Clean type, generous spacing, one accent colour, no animation.
4. **Hand it over.** The interesting moments are "wait, that shouldn't be possible" or "I assumed X would differ": bugs in the idea, which is the whole point. Add actions or scenarios when asked; prototypes evolve.
5. **Keep the answer**: the validated reducer, machine or functions move into the real module; the HTML shell goes to the throwaway branch, where it stays one double click away.

## Anti-patterns

Tests (a prototype that needs them is no longer one) · the real database · generalising for later · logic tangled with the page · frameworks or dev servers · shipping the HTML shell to production.
