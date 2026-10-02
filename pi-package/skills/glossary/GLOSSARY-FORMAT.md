# GLOSSARY.md format

```md
# {Context name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
{One or two sentences defining the term.}
_Avoid_: purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: bill, payment request
```

Rules:

- **Be opinionated.** Several words for one concept: pick the best, list the rest under `_Avoid_`.
- **Tight definitions.** One or two sentences; say what it IS, not what it does.
- **Project terms only.** General programming concepts (timeouts, error types, utility patterns) stay out even when the project uses them a lot.
- **Group under subheadings** when natural clusters appear; a flat list is fine otherwise.
- Write it in the artifact language.

## Several contexts

A root `GLOSSARY-MAP.md` lists them, where they live and how they relate:

```md
# Glossary map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md): receives and tracks customer orders
- [Billing](./src/billing/GLOSSARY.md): issues invoices and takes payments

## Relationships

- **Ordering → Billing**: Ordering emits `OrderPlaced`; Billing consumes it to issue the invoice
```

With a map, infer which context the topic belongs to; ask if it is unclear. With neither file, create a root `GLOSSARY.md` when the first term settles.
