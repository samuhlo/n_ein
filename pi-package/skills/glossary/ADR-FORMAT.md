# ADR format

ADRs live in `docs/adr/` with sequential numbers: `0001-slug.md`, `0002-slug.md`. Take the highest existing number and add one; create the folder with the first ADR.

```md
# {Short title of the decision}

{One to three sentences: the context, what was decided and why.}
```

That is all an ADR needs. Its value is recording *that* a decision was made and *why*. Add a section only when it earns it: **Status** (`proposed | accepted | deprecated | superseded by ADR-NNNN`) when decisions get revisited, **Considered options** when the rejected ones are worth remembering, **Consequences** when downstream effects are not obvious.

## What qualifies

When all three hold (hard to reverse, surprising without context, a real trade-off):

- **Architectural shape**: "We use a monorepo." "Writes are event-sourced; reads are projected into Postgres."
- **Integration between contexts**: "Ordering and Billing talk through domain events, not synchronous HTTP."
- **Technology with lock-in**: database, message bus, auth provider, deploy target; not every library, only the ones a quarter would not replace.
- **Ownership and scope**: "Customer data belongs to the Customer context; others reference it by ID." The explicit no's are worth as much as the yes's.
- **Deliberate deviations from the obvious**: "Hand-written SQL instead of an ORM because X." These stop the next person from "fixing" something on purpose.
- **Constraints invisible in the code**: compliance, contractual response times.
- **Non-obvious rejected alternatives**: if GraphQL lost to REST for subtle reasons, write it down before someone proposes GraphQL again.
