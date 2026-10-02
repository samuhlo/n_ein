---
name: glossary
description: Build and sharpen the project's domain language. Use when discussing the project's terminology, writing or editing GLOSSARY.md, or recording or editing an ADR.
---

# Glossary

Build the project's domain model actively while you design: challenge terms, invent edge-case scenarios, and write terms and decisions down the moment they settle. (Merely reading `GLOSSARY.md` for vocabulary is a habit any skill has; this skill is for changing the model.)

## Where things live

Most repos have one context: `GLOSSARY.md` at the root and decisions in `docs/adr/0001-<slug>.md`. A root `GLOSSARY-MAP.md` means several contexts, each with its own `GLOSSARY.md` and `docs/adr/`, while system-wide decisions stay at the root. Create files only when you have something to write in them. Format details: [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md) and [ADR-FORMAT.md](ADR-FORMAT.md).

## During the conversation

- **Challenge against the glossary.** When the user's word clashes with `GLOSSARY.md`, say so on the spot: "Your glossary defines *cancellation* as X, but you seem to mean Y. Which is it?"
- **Sharpen fuzzy words.** Propose one precise term for a vague or overloaded one: "By *account*, do you mean the Customer or the User? They are different things."
- **Test relations with scenarios.** Invent concrete cases that probe the edges between concepts and force precision.
- **Check against the code.** When the user says how something works, check whether the code agrees and surface contradictions: "The code cancels whole orders, but you just said partial cancellation exists. Which is right?"
- **Write each term as it settles**, one at a time, in `GLOSSARY.md`. It holds language only: term definitions, no implementation details. Specs and decisions live in `WORK.md` and the ADRs.

## ADRs, sparingly

Offer an ADR only when all three hold: **hard to reverse** (changing your mind later costs something real), **surprising without context** (a future reader would ask "why on earth?"), and **a real trade-off** (genuine alternatives, one picked for specific reasons). Missing any one, no ADR.
