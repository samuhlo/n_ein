# Design it twice

Your first interface is rarely the best one. When the user wants alternatives for a chosen candidate:

## 1. Frame the problem

Write for the user: the constraints any new interface must meet, the dependencies it relies on and their category ([DEEPENING.md](DEEPENING.md)), and a rough code sketch that makes the constraints concrete (an illustration, not a proposal). Show it, then go straight on while the user reads.

## 2. Ask for radically different designs

Draft three or more designs yourself, one at a time and each from scratch, from the same technical brief (paths, coupling, dependency category, what sits behind the seam) and the vocabulary of [SKILL.md](SKILL.md) and `GLOSSARY.md`, each under a different constraint. Do not let a later design borrow from an earlier one:

- "Minimise the interface: one to three entry points, maximum leverage each."
- "Maximise flexibility: many use cases and extension."
- "Optimise for the most common caller: make the default case trivial."
- "Design around ports and adapters for the cross-seam dependencies." (when it applies)

Each returns: the interface (types, methods, params, invariants, ordering, error modes), a caller's usage example, what the implementation hides, the dependency strategy, and where leverage is high or thin.

## 3. Compare and recommend

Present the designs one by one, then compare them in prose by **depth**, **locality** and **seam placement**. Finish with your recommendation and why; propose a hybrid when parts combine well. Be opinionated: the user wants a strong read, not a menu.
