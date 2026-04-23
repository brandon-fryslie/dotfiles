---
name: organize-commits
description: Use when the user has a dirty working tree with multiple logical changes and wants it reviewed and committed properly. Triggers on "organize into commits", "review and commit", "commit these changes", "clean up the working tree", "make commits out of this", or when the user asks for a review of uncommitted work before committing. Reads every dirty/untracked file, surfaces any problems or rule violations, proposes commit groupings by concern, and — after the user confirms or for unambiguous cases — executes each commit as a focused unit.
---

# Organize Commits

Review a dirty working tree, surface problems, and split it into logical commits.

## Process

1. **Enumerate everything dirty.** `git status` first. List every modified, staged, untracked, and deleted path. Do not rely on memory or on what was discussed — re-read the tree.

2. **Read every change.** `git diff` for modified files. `cat` / `Read` for untracked files. Don't skim. You are about to author commit messages that claim to describe these changes — earn the right to make that claim.

3. **Surface problems before grouping.** Look explicitly for:
   - Files that look like debug leftovers (console.log, print, TODO/FIXME the user wouldn't want shipped).
   - Secrets, tokens, credentials, .env contents, API keys.
   - Conflicting edits (two changes in different files that contradict each other).
   - Rule violations against CLAUDE.md / AGENTS.md / repo conventions.
   - Duplicate sources of truth introduced or worsened by the changes.
   - Files clearly unrelated to the stated work (stray edits picked up by an editor, untracked scratch files).
   - Large binaries, lockfiles with surprising churn, generated output that shouldn't be tracked.
   Report problems before proposing commits. Do not paper over them with a commit message.

4. **Propose groupings by concern, not by file count.** Each commit should answer one question ("what changed and why") with a single coherent answer. Mixing a bug fix with a refactor with a settings tweak is three commits, not one. A single multi-file change that serves one purpose is one commit, not three.

5. **Show the plan before executing.** Present the proposed commits as a numbered list: `N. <type>(<scope>): <subject> — <files>`. Include any problems surfaced above. Wait for the user to confirm, adjust, or reject.

6. **Execute commits one at a time.** For each group:
   - `git add <specific paths>` — never `git add -A` or `git add .` (picks up stray files, violates scope).
   - `git commit -m "..."` with a focused subject line and, where the *why* is non-obvious, a brief body.
   - Do NOT include changes the user didn't approve.
   - After the commit, `git status` to confirm the tree shrank by exactly the expected files.

7. **Final verification.** After the last commit, `git status` one more time. Any remaining dirty files are either intentional (tell the user) or an error (stop and ask).

## Hard rules

- **Never use `git add -A` / `git add .` / `git commit -a`.** Always stage specific paths. A working tree is a pile of intentions; don't commit intentions you haven't identified.
- **Never amend or rebase without an explicit request.** Create new commits.
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`). If a hook fails, investigate; don't bypass.
- **Never force-push.** Not in this skill's scope.
- **Never delete or overwrite uncommitted changes.** If a file's state is confusing, stop and ask — it may be in-progress user work.
- **Never invent a description for a change you haven't actually read.** If a diff is large, read it; if it's binary, say so in the commit message rather than guessing.

## Problem-surface examples

Surface, don't silently fix:

- "Two files both edit `settings.json` — one reverts a line the other adds. They contradict. Which is right?"
- "`config/foo/bar.md` contains what looks like a Stripe live key on line 42. Stop and confirm before any commit."
- "`package-lock.json` has 4000 lines of churn but `package.json` didn't change. That's unusual — regenerate or investigate?"
- "The new file `scratch.md` looks like a personal note, not part of the change. Commit, ignore, or remove?"

## Commit message style

- Match the repo's existing commit style. Read `git log --oneline -20` before the first commit to confirm conventions (conventional-commits scope/type, subject case, etc.).
- Subject line ≤70 chars, imperative mood.
- Body only when *why* is not obvious from the subject + diff. No redundant restatement of the diff.
- No `Co-Authored-By` / trailer noise unless the repo already uses it (check recent commits).

## When to stop and ask

- Any file you can't confidently classify.
- Any problem from step 3 that isn't trivially resolvable.
- When the groupings could reasonably split multiple ways and the user hasn't indicated a preference.
- When staged changes already exist and don't match a clean grouping — ask whether to use or reset them.

Do not interpret the user's request as permission to ship without understanding. "Organize into commits" means *review first, then commit* — not *commit everything as fast as possible*.
