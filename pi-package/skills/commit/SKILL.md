---
name: commit
description: "Commit the loose changes in the working tree as Conventional Commits, one per logical change, on a work branch."
disable-model-invocation: true
---

Commit the changes the user has in the working tree, usually edits made outside a job. Inside an active `WORK.md` job, its work-unit commits apply instead: tick the task and commit as the flow says.

1. **Read the state** in one go: branch, `git status --porcelain=v1 -uall`, `git diff HEAD` (the staged diff in a repository with no commits), the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, else `main` or `master`) and `git log --oneline -15`. With nothing to commit, say so and stop.
2. **Group** the changes by logical change: one feature, one fix, one refactor, the docs or tests that go with them. A group holds whole files; when one file mixes two changes, keep it in the group it serves most and say so.
3. **Ask once**, with the groups and their messages on screen:
   - **Commit only** (recommended): on the current branch.
   - **Commit and push.**
   - **New branch**: named after the changes (`fix/date-parsing`), then commit there.
   On the default branch, never commit there: offer only a new branch, with or without push. Where you cannot ask, commit only.
4. **Stage each group by path** (`git add -- <paths>`), then commit it. Never `git add -A`, `git add .` or `commit -a`: another session may share the tree. Never stage `.env*` (`.env.example` is fine), keys, credential files or a diff that shows a token; list them as left out.
5. **Write each message** as `type(scope): summary`: imperative, under 72 characters, in the language of the repository's recent commits, a body only when the why is not obvious. No `Co-Authored-By`, session links or any assistant attribution. Commit as the configured git identity, never change it, and never skip hooks with `--no-verify`: when a hook fails, fix the cause or report it and stop.
6. **Push** only when chosen: `git push -u origin HEAD`, never force. Without a remote, or on a failed push, report the error and stop.
7. **Report** each commit (short hash and message), what was left uncommitted and why, and the push result.
