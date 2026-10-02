---
name: to-pi
description: Hand the current job over from Claude to Pi.
disable-model-invocation: true
---

# Claude → Pi

The user runs this to move the job to Pi.

1. Finish or stop any tool or background agent that could keep writing.
2. Bring `WORK.md` up to date: what is done, the decisions, what is pending, and the checks with how fresh they are. It stays the one board.
3. Check Git and write a short note for Pi: the real outcome, the decisions it must not reopen, and the next step.
4. Run `"$N_EIN_ROOT/bin/n-ein-prepare-pi" "<note>"` from the project. It adds the commit, the diff and the paths, so the handoff does not rest on your account alone. If it fails, explain the error; the handoff is not ready.
5. When it confirms the path, tell the user to close this session with `/exit`. The launcher waits for Claude to exit and then opens Pi with the summary.

Pi is started by the launcher, not by you. A design-only session stays design-only: the handoff does not turn the agreement into permission to build.
