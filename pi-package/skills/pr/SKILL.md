---
name: pr
description: Write a pull request body that shows the change, its evidence and its merge risk. Use when writing or updating a PR description.
---

Write the body in the artifact language with this shape (translate the headings too):

```markdown
## Summary

<diagram, diff sketch or tree>

## Evidence

- **Before:** <screenshot / output / failing test>
  **After:** <screenshot / output / passing test>

## Merge risk

**Door:** <one-way or two-way>

<optional: why>

**Blast radius:** <one word>

<optional: what could break>
```

No preamble, brief prose, and the domain language of `GLOSSARY.md`. Pull the goal and decisions from `WORK.md` and the evidence from its evidence section and the task commits.

## Summary

Pick the smallest view that makes the key point clear, next to the short text it supports. Keep only the calls, files, props, states and boundaries the reader needs; one view is often enough, several are fine, all of them never.

- **Logic or an algorithm** → pseudocode:

  ```text
  on(save)
    if content is unchanged
      return cached result
    write new content
    return fresh result
  ```

- **Runtime control flow** → a call tree:

  ```text
  submitForm
    createSession
      persistPrompt
      launchAgent
    navigateToSession
  ```

- **UI structure** → a component tree with the state and module boundaries that matter:

  ```text
  <SessionPage> (apps/web/src/routes/session.tsx)
    useSessionEvents()
    <SessionToolbar>
      <RunSkillButton> (packages/ui)
  ```

- **File responsibilities or a broad refactor** → a shallow file tree with one comment per entry.
- **Interaction or data flow between parts** → a Mermaid sequence diagram.
- **What changes inside a shape that already exists** → a `diff` of that shape (component tree, file tree, call tree or control flow):

  ```diff
   submitForm
     createSession
       persistPrompt
  +    expandSkillMention
       launchAgent
  ```

- **Mostly new code, or order and ownership matter** → the whole block.

## Evidence

Proof that the change works, as before and after. Screenshots are best when the change is visual and the environment allows it; next best is execution: the exact test that failed and now passes (as pseudocode), or the command output.

## Merge risk

A **two-way door** can be walked back cheaply; a **one-way door** cannot (destructive actions, data migrations, hard-to-reverse decisions). The **blast radius** is everything the change could touch: layout shifts, consumers of an API, mobile behaviour, performance. Think through all of it before naming it.
