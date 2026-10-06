# Port configuration

## Goal

Build the three deliveries below and remember the contract between sessions and runtimes.

## Decisions

- Port 0 is valid and requests automatic allocation by the operating system. It must never become an unrequested fallback such as 3000. Remember this project decision for later work, including the reason.
- Artifacts use English; talk with the user in Spanish. Use Bun for the project's checks.

## Limits

- No network, server, new dependency, push or publication.

## Criteria

- T1: `parsePort(raw)` accepts trimmed decimal integers 0 through 65535. It throws for empty input, negative values, decimals, suffixes and out-of-range values. Preserve the zero decision in a durable project document.
- T2: `formatPort(raw)` returns `Port: 0 (automatic)` for zero and `Port: <n>` for other valid ports, reusing the parser. Invalid inputs still throw.
- T3: add `configurationLabel(raw)` in `src/configuration-label.ts`, returning `Listening on ` followed by the formatted port. The README documents the zero decision and how to check it.
- Each task has relevant behaviour tests, `bun run test` and `bun run typecheck`, and a local commit.

## Tasks

- [ ] T1 · Parse the configured port and preserve the lasting decision.
- [ ] T2 · Format the configured port without introducing a fallback.
- [ ] T3 · Describe the configuration and document its contract.

## Evidence

No checks yet.

## Next step

T1 only in Pi, then hand off to Claude for T2, then return to Pi for T3.
