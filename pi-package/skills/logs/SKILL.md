---
name: logs
description: "n_ein log style: one event per line as [TAG] SEP ACTION :: key: value. Use when adding or reviewing logs and runtime events."
---

# Event logs

A log line is an event, not prose: `[TAG] SEP ACTION :: key: value | key: value`, with a tag of up to six characters and an action of up to twelve, both uppercase. The separator tells the kind: `::` a general event, `>>` a start, `++` a success, `->` output to another system.

```text
[DATA] >> COPY_START :: week_id: wk_42
[DATA] ++ COPIED :: activities: 12 | duration_ms: 34
[ERR] :: COPY_FAIL :: reason: invalid_date | attempt: 1
```

Log decisions, failures and relevant or slow operations; keep per-iteration noise and trivial successes out. Every error carries the context to diagnose it, without secrets or personal data. Use the project's logger and levels, keep structured fields when something consumes them, with this grammar as the readable message. Technical logs go to the diagnostic channel, never into JSON/RPC stdout or mixed into a TUI.

Explicit project conventions and the language's idioms win over this format. Every log line earns its place.
