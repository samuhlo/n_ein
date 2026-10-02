---
name: prototype
description: Build a throwaway prototype that answers one design question. Use when the user wants to feel out whether some logic or state model is right, or to explore what a UI should look like.
---

# Prototype

A prototype is **throwaway code that answers one question**. The question decides its shape.

## Pick the branch

- **"Is this logic or state model right?"** → [LOGIC.md](LOGIC.md): one shareable HTML file that drives the state model through the cases that are hard to reason about on paper, usable by someone who does not code.
- **"What should this look like?"** → [UI.md](UI.md): several radically different variants on one route, switched with a URL param and a floating bar.

The two produce very different artifacts, so getting this wrong wastes the prototype. If the question is truly ambiguous and the user is away, pick the branch that matches the surrounding code (a backend module → logic; a page or component → UI) and state the assumption at the top of the prototype.

## Rules for both

1. **Throwaway from day one, and clearly marked.** Put it next to what it prototypes so the context is obvious, but name it so anyone sees it is not production. Follow the project's routing conventions for throwaway routes.
2. **Trivial to run.** One command from the project's task runner, or a single HTML file opened with a double click.
3. **No persistence by default.** State lives in memory; persistence is what a prototype may be checking, not something it depends on. If the question is about a database, use a scratch one named "PROTOTYPE, wipe me".
4. **No polish.** No tests, no error handling beyond what makes it run, no abstractions. The point is to learn fast.
5. **Show the state.** After every action (logic) or every variant switch (UI), render the full relevant state so the user sees what changed.
6. **Keep the answer.** Fold the validated decision into the real code; commit the prototype itself to a throwaway branch, off the main one, and leave a pointer to that branch and the verdict (the question and its answer) in `WORK.md`. The main branch keeps only the decision.
