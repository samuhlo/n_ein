---
name: previewer
description: Run p_reviewer on a work branch or a stacked PR chain and apply the findings the user selected in it. Use when the user says «aplica la revisión», "apply the review" or similar, accepts the reviewer, or asks to review a branch or PR chain with p_reviewer.
---

# p_reviewer

p_reviewer reviews a work branch in a disposable copy and keeps one session per branch: a plain tour of the change, findings with cited lines and probes it reran itself, and the user's rating and selection of each finding. The user decides what is valid; you apply only what they selected.

## Open the reviewer

1. Commit the work first: p_reviewer reviews commits, not uncommitted changes.
2. From the project, run `"$N_EIN_ROOT/bin/n-ein-previewer" review` with a timeout of 25 minutes. It takes a few minutes and one model run, and ends with a local link.
3. Report briefly: the summary, then each finding with its status (new, still present, resolved, not checked) and its evidence: explicit reproduction, check passed, inapplicable scenario, execution error or inconclusive result. A legacy exit code alone proves neither a defect nor a fix. A resolution based only on current code inspection must say so. Give the link: the user reads the tour, rates and selects there. Do not start fixing anything.

To show an existing review again without running a new one, run `"$N_EIN_ROOT/bin/n-ein-previewer" open` and give the link it prints. The link carries a private token: give it only to the user.

## Apply the review

1. From the project, run `"$N_EIN_ROOT/bin/n-ein-previewer" handoff`.
2. Follow what it prints: one task per selected finding in `WORK.md` and no others, reproduce before fixing, one commit per task. A finding that does not reproduce is reported back with the evidence, not fixed.
3. If nothing is selected, or there is no session for the branch, say so and stop.

Asking to apply the review authorizes fixing exactly the selected findings on this branch. Merging, pushing and pull requests still wait for the user.

## Review a PR chain

When the user asks for a chain, establish the intended ordered branches and PR bases from the current task or connected PR metadata. Do not guess the chain from every local branch. Ask only if its membership is genuinely ambiguous. GitHub is optional; local refs are sufficient. Fetch missing commits through the normal authorized read workflow when needed; never merge the branches to review them.

Prepare a temporary JSON manifest outside the project's tracked files:

```json
{"name":"feature-series","base":"main","steps":[
  {"name":"PR 1","head":"feature/one","prUrl":"https://github.com/owner/repo/pull/1"},
  {"name":"PR 2","base":"feature/one","head":"feature/two"}
]}
```

Each step's base defaults to the preceding head; an explicit base must match it. Run `"$N_EIN_ROOT/bin/n-ein-previewer" chain --file <path> --plan` to validate all ranges without inference or creating a session. Explain briefly that N stages mean N incremental reviews plus one integration review, then run the same command without `--plan` within the user's requested review scope. Allow for multiple sequential runs, not a single branch timeout; keep reporting progress. Nothing launches automatically at task closure.

The command freezes all SHAs, shares one session and preserves thread decisions. Repeating the same manifest and reviewer resumes unfinished stages without charging for completed ones. `--again` explicitly reruns a complete snapshot; changed refs or reviewer code create a new snapshot. Report partial results as partial. A moved ref does not make the saved snapshot a review of its new tip.

Use `chains` to list saved chains and `open --chain <name>` to return to the balance without inference. Historical stage links are for reading evidence; rate and select in the current balance. "First detected in PR 2" is evidence of detection, not proof that PR 2 introduced the defect.

When applying a chain review, use `handoff --chain <name>` and follow its final-head target and history. Preserve existing work when establishing the correct work branch; never apply it to an earlier PR merely because it is checked out. Only the user's selected, unresolved findings are in scope. An unchecked selection remains marked for reproduction. Offer to re-review the chain after authorized corrections, and run it when requested or already authorized within the task; merging, pushing and publication still require their own instruction.
