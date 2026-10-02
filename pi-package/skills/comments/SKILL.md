---
name: comments
description: n_ein comment style (file headers, tags such as [FLOW], short MOTIVE -> notes). Use when writing or reviewing code comments, in TypeScript, Go or any other language.
---

# Comments that help walk the code

Comment the decisions, rules and traps a reader cannot easily infer; let clear names carry the obvious lines. In non-trivial files, a short header and sections make the flow findable. Tag a block with `[CORE]`, `[FLOW]`, `[DATA]`, `[AUTH]` or `[UI]` when it orients the reader.

```ts
// =============================================================================
// [FLOW] RESUME WORK
// Recovers what is pending and checks the evidence against the current files.
// =============================================================================

// GUARD -> A later edit invalidates the earlier check.
```

Short notes can open with an uppercase motive and `->` for cause and effect (`GUARD ->`, `BLINDAJE ->` in Spanish code); at most one such accent per logical block. Headers only for files that deserve them; no emojis, no filler. Write comments in the file's language and follow its conventions. Apply the style to new code and the blocks you touch; leave untouched files and generated code as they are.

In Go, keep doc comments and directives valid: the visual tags sit next to them, never replace them.
