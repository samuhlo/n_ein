---
name: tdd
description: Test-first development, red then green. Use when building behaviour or fixing a bug with a runnable test and a clear expected result, when the user mentions red-green-refactor or integration tests, or when the project has TDD on.
---

# Test first

TDD is the **red → green** loop. This skill is what makes that loop leave tests worth keeping: what a good test is, where it goes, the anti-patterns and the rules of the loop. Every section applies on every cycle.

Read `GLOSSARY.md` if it exists, so test names and interface words match the domain, and respect the ADRs of the area.

## A good test

It checks behaviour through a public interface, never implementation details. The code behind it can change completely; the test should not. A good test reads like a spec ("user can check out with a valid cart") and survives refactors because it does not care about internal structure. Examples in [tests.md](tests.md); when to use test doubles in [mocking.md](mocking.md).

## Seams

A **seam** is the public boundary you test at: where behaviour is observable without reaching inside. Tests live at seams.

**Declare the seams before the first test**, in one line, and go on; if `WORK.md` already lists them under its criteria, use those. Ask the user only when choosing the seam is a real decision about scope or behaviour: "What is the public interface, and which seams should we test?" You cannot test everything; fixing the seams up front puts the effort on critical paths and complex logic instead of every edge case.

When the shape of the interface itself is in question (how deep the module is, where the seam belongs, what it should expose), load `design` for the vocabulary.

## Anti-patterns

- **Implementation-coupled**: doubles internal collaborators, tests private methods, or verifies through a side channel (queries the database instead of using the interface). The tell: it breaks on a refactor that kept the behaviour.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`), so it passes by construction. Expected values come from an independent source: a known literal, a worked example, the spec.
- **Horizontal slicing**: all tests first, then all code. Bulk tests check imagined behaviour and lock in a test structure before you understand the implementation. Work in **vertical slices**: one test → one implementation → repeat, each test a **tracer bullet** shaped by what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test and watch it fail, then write only the code that makes it pass. No speculative features, no tests for the future.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactor at review, not inside the loop.** It belongs to `review`, after green.
- **No red possible** (docs, untestable change, no runner): say so and run the proportionate functional or structural check instead.
