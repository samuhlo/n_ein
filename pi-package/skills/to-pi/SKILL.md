---
name: to-pi
description: Hand the current job from Claude to Pi only when the user explicitly asks to switch or continue with Pi, including ordinary language such as "sigamos con Pi". A question about Pi is not a transfer request. The slash command is an optional shortcut.
---

# Claude → Pi

The user's explicit request to continue with Pi activates this skill. Load it yourself when that request is made in ordinary language; do not ask the user to invoke another command or confirm the same choice again. Never choose to transfer on your own. Only use this in Claude, not in Pi itself.

1. Finish or stop any tool or background agent that could keep writing.
2. When document writes are authorized, bring `WORK.md` up to date: what is done, decisions, pending work and checks with their freshness. For a read-only request, leave project files unchanged and put any new observations in the handoff note instead. It stays the one board.
3. Check Git and write a short note for Pi: the real outcome, the decisions it must not reopen, and the next step.
4. Run `"$N_EIN_ROOT/bin/n-ein-prepare-pi" "<note>"` from the project. It adds the commit, the diff and the paths, so the handoff does not rest on your account alone. If it fails, explain the error; the handoff is not ready.
5. When it confirms the path, explain the single host action: "The handoff is ready. Enter `/exit` to close Claude; Pi will open automatically." Do not ask for other setup commands. In a non-interactive session, finish the response and the process exits normally. The launcher waits for Claude to exit and then opens Pi with the summary.

Pi is started by the launcher, not by you. A design-only session stays design-only: the handoff does not turn the agreement into permission to build.
