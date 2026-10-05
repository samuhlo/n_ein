---
name: diagnose
description: Diagnosis loop for hard bugs and performance regressions. Use when the user asks to diagnose or debug, or reports something broken, throwing, failing or slow.
---

# Diagnose

A discipline for hard bugs. Skip a phase only with an explicit reason.

Read `GLOSSARY.md` if it exists for a clear model of the modules involved, and check the ADRs of the area.

**Redact first.** You will show commands, output and captured artifacts: write `<REDACTED>` in place of every secret, build loops on environment variables so credentials stay out of what you show, and quote only the lines of a capture that carry the signal. If the redacted output is not enough, say so and ask the user.

## 1. Build a red loop

**This is the skill; everything after it is mechanical.** With a **tight** pass/fail signal that goes **red** on _this_ bug, you will find the cause: bisection, hypotheses and instrumentation only consume it. Without one, no amount of staring at code helps. Spend disproportionate effort here. Be relentless and creative.

Ways to build it, roughly in this order:

1. A **failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. A **curl/HTTP script** against a running dev server.
3. A **CLI run** with a fixture input, diffing stdout against a known-good snapshot.
4. A **headless browser script** (Playwright, Puppeteer) asserting on DOM, console or network.
5. **Replay a captured trace**: save a real request, payload or event log and replay it through the code path in isolation.
6. A **throwaway harness**: the smallest slice of the system (one service, doubled dependencies) that hits the bug path with one call.
7. A **property or fuzz loop** for "sometimes wrong": a thousand random inputs, look for the failure mode.
8. A **bisection harness** when the bug appeared between two known states: automate "boot at X, check" and `git bisect run` it.
9. A **differential loop**: the same input through old and new version (or two configs), diff the outputs.
10. A **human-in-the-loop script**, last resort: if a person must click, drive them with `scripts/hitl-loop.template.sh` so the loop stays structured.

**Tighten it.** Faster (cache setup, skip unrelated init, narrow the scope), sharper (assert on the exact symptom, not "didn't crash"), more deterministic (pin time, seed randomness, isolate the file system, freeze the network). A 30-second flaky loop barely beats no loop; a 2-second deterministic one is a superpower.

**Non-deterministic bugs**: aim for a higher reproduction rate, not a clean repro. Loop the trigger, parallelize, add load, narrow timing windows. A 50% bug is debuggable; a 1% bug is not yet.

**When you truly cannot build a loop**, stop and say so, list what you tried, and ask for access to an environment that reproduces it, a redacted capture (HAR, logs, core dump, timed recording) or permission for temporary instrumentation. Hypotheses start once a loop exists.

**Done when** you can name **one command** you have **already run** (show it and its redacted output) that is:

- [ ] **Red-capable**: it drives the real bug path and asserts the user's exact symptom, so it goes red now and green once fixed.
- [ ] **Deterministic**: same verdict every run (flaky bugs: a pinned, high reproduction rate).
- [ ] **Fast**: seconds, not minutes.
- [ ] **Unattended**: you can run it yourself; a person only through the HITL script.

If you catch yourself reading code to build a theory before that command exists, stop: jumping to a hypothesis is the exact failure this skill prevents.

## 2. Reproduce and minimise

Run the loop and watch it go red. Confirm it is the failure the **user** described (wrong bug, wrong fix), that it reproduces across runs, and capture the exact symptom so later phases can check the fix against it.

Then shrink it to the **smallest scenario that is still red**: cut inputs, callers, config, data and steps one at a time, rerunning after each cut. Done when every remaining piece is load-bearing: removing any one turns the loop green. A minimal repro narrows the hypotheses and becomes the regression test.

## 3. Locate and hypothesise

Now use CodeGraph to locate: `codegraph_explore` on the symbols the repro exercises gives you their source and call paths in one call. For a wide area, query CodeGraph again from each caller the first answer names.

Write **3–5 ranked hypotheses** before testing any; one hypothesis anchors on the first plausible idea. Each must be **falsifiable**: "If <X> is the cause, then <changing Y> makes the bug disappear / <changing Z> makes it worse." No prediction, no hypothesis.

**Show the ranked list to the user before testing**: they often know which one was just deployed or already ruled out. Cheap checkpoint; keep going with your own ranking if they are away.

## 4. Instrument

Each probe maps to one prediction. **Change one variable at a time.** Prefer a debugger or REPL (one breakpoint beats ten logs), then targeted logs at the boundaries that separate hypotheses; never "log everything and grep".

Tag every debug log with a unique prefix, such as `[DEBUG-a4f2]`, so cleanup is one grep. **Performance**: logs are usually the wrong tool; take a baseline measurement (timing harness, profiler, query plan), then bisect. Measure first, fix second.

## 5. Fix with a regression test

Write the regression test **before the fix**, if there is a **correct seam**: one where the test exercises the real bug pattern as it happens at the call site. A seam too shallow for the pattern (single caller when the bug needs several, a unit that cannot replay the chain) gives false confidence. **No correct seam is itself the finding**: note it, the architecture is preventing the bug from being locked down.

With a correct seam: turn the minimal repro into a failing test, watch it fail, fix, watch it pass, then rerun the phase 1 loop against the original, unminimised scenario.

## 6. Clean up

- [ ] The original repro no longer reproduces (rerun the loop)
- [ ] The regression test passes, or the missing seam is documented
- [ ] Every `[DEBUG-...]` probe removed (grep the prefix)
- [ ] Throwaway harnesses deleted or moved to a clearly marked debug place
- [ ] The hypothesis that proved right is in the commit message, so the next person learns from it
