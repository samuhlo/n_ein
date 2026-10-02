---
name: research
description: Investigate a question in high-trust primary sources and keep the findings as a Markdown note in the repo. Use when the user wants a topic researched, documentation or API facts gathered, or reading delegated.
---

Hand the reading to **nein-scout** (a subagent in Claude) so you keep working while it reads. The scout reads the repo, installed packages and local docs; sources that live on the web you fetch yourself, or give to a Claude subagent with web access. The brief:

1. Investigate the question in **primary sources**: official documentation, source code, specs, the provider's own API. Follow every claim back to the source that owns it, not to a write-up of it.
2. Separate checked facts, assumptions, contradictions, how fresh each source is, and gaps.
3. Return the findings with the source of each claim.

When it comes back, write the note yourself: one Markdown file where the repo already keeps such notes (or a sensible place, saying where), every claim with its source. Then tell the user the recommendation, its trade-offs and what remains open for the decision at hand.
