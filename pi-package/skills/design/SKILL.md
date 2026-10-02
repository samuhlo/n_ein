---
name: design
description: Shared vocabulary for designing deep modules. Use when designing or improving a module's interface, looking for deepening opportunities, deciding where a seam goes, or making code more testable or easier for agents to navigate; other skills load it for the vocabulary.
---

# Design

Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface. The aim is leverage for callers, locality for maintainers and testability for everyone. Use these words exactly; consistent language is the point.

## Vocabulary

- **Module**: anything with an interface and an implementation, at any scale: a function, a class, a package, a slice across tiers. _Avoid_: unit, component, service.
- **Interface**: everything a caller must know to use the module correctly: types, but also invariants, ordering, error modes, required config and performance. _Avoid_: API, signature (they name only the type surface).
- **Implementation**: the body inside the module.
- **Depth**: leverage at the interface, how much behaviour a caller or test gets per unit of interface it must learn. **Deep**: a lot behind a small interface. **Shallow**: the interface is nearly as complex as the implementation.
- **Seam** (Feathers): a place where behaviour can change without editing that place; where the interface lives. Where to put it is its own decision. _Avoid_: boundary.
- **Adapter**: a concrete thing that fills an interface at a seam. Names a role, not a substance.
- **Leverage**: what callers get from depth: one implementation pays back across many call sites and tests.
- **Locality**: what maintainers get from depth: change, bugs and knowledge concentrate in one place.

A module has one interface; depth is measured against it; a seam is where it lives; an adapter sits at the seam and fills it.

## Principles

- **Depth is a property of the interface.** Inside, a deep module can be made of small, swappable parts with **internal seams** used by its own tests; they are just not part of the interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If it reappears across N callers, it earned its place.
- **The interface is the test surface.** Callers and tests cross the same seam; wanting to test past it means the module has the wrong shape.
- **One adapter is a hypothetical seam; two adapters make a real one.** Add a seam only where something actually varies across it.

When designing an interface, ask: fewer methods? simpler params? more complexity hidden inside?

## Designing for tests

1. **Accept dependencies, don't create them**: `processOrder(order, gateway)` instead of building `new StripeGateway()` inside.
2. **Return results, don't produce side effects**: `calculateDiscount(cart): Discount` instead of mutating `cart.total`.
3. **Small surface**: fewer methods mean fewer tests; fewer params mean simpler setup.

## Going deeper

- **Deepening a cluster given its dependencies**: [DEEPENING.md](DEEPENING.md).
- **Comparing radically different interfaces before choosing**: [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md).
