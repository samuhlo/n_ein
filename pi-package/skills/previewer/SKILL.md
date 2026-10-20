---
name: previewer
description: Run p_reviewer on the current work branch and apply the findings the user selected in it. Use when the user says «aplica la revisión», "apply the review" or similar, when they accept the offer to open the reviewer, or ask to review the branch with p_reviewer.
---

# p_reviewer

p_reviewer reviews a work branch in a disposable copy and keeps one session per branch: a plain tour of the change, findings with cited lines and probes it reran itself, and the user's rating and selection of each finding. The user decides what is valid; you apply only what they selected.

## Open the reviewer

1. Commit the work first: p_reviewer reviews commits, not uncommitted changes.
2. From the project, run `"$N_EIN_ROOT/bin/n-ein-previewer" review` with a timeout of 25 minutes. It takes a few minutes and one model run.
3. Report its result briefly: the summary, then each finding with its status (new, still present, resolved, not checked) and whether its probe demonstrated it. Do not start fixing anything: the user rates and selects first.

## Apply the review

1. From the project, run `"$N_EIN_ROOT/bin/n-ein-previewer" handoff`.
2. Follow what it prints: one task per selected finding in `WORK.md` and no others, reproduce before fixing, one commit per task. A finding that does not reproduce is reported back with the evidence, not fixed.
3. If nothing is selected, or there is no session for the branch, say so and stop.

Asking to apply the review authorizes fixing exactly the selected findings on this branch. Merging, pushing and pull requests still wait for the user.
