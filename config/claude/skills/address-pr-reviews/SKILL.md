---
name: address-pr-reviews
description: Address open PR review threads with judgment — read each thread, decide whether the feedback is actually the right move, comment with a proposed solution, apply the fix (if warranted), comment with the resolution, and resolve the thread. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Threads

A script-driven loop. The bundled helper at `~/.claude/skills/address-pr-reviews/copilot-review.py` owns the state machine — you just run the step it tells you to run next, and do the judgment work it asks for in between.

## Quick start

If the user didn't give you a PR number, infer it from the current branch:

```bash
gh pr view --json url --jq .url
```

Then start the loop:

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py step 1 <PR_URL>
```

Read the script's output. It always ends with one of three blocks:

- `=== NEXT: run step N ===` — just run the listed command.
- `=== NEXT: agent work, then step N ===` — do the listed judgment work first (read files, decide, write a JSON file, apply code edits, commit), then run the listed command.
- `=== DONE ===` — the loop converged. The script merged the PR. Report the iteration summary to the user.

If the script exits non-zero with `Loop is blocked`, surface the specific reason to the user and stop.

## What the loop does

Each iteration runs five steps:

| Step | Script does | Then you... |
|---|---|---|
| 1 | Waits for any in-progress Copilot review (gh polls every 30s, capped at 15min); snapshots HEAD | run step 2 |
| 2 | Fetches unresolved threads + Copilot's full session reasoning to `/tmp/address-pr-<N>-iter-<I>-*` | decide on each thread, write decisions JSON, run step 3 |
| 3 | Posts proposal comments on every thread | apply code fixes for valid/different_fix threads + commit, write resolutions JSON, run step 4 |
| 4 | Posts resolution comments + resolves all addressed threads | run step 5 |
| 5 | Compares HEAD against the step-1 snapshot. **Unchanged** → merges the PR (DONE). **Moved** → pushes, triggers fresh Copilot review, bumps iteration → return to step 1 | run step 1 (next iteration) or report DONE |

State persists in `/tmp/address-pr-<NUM>.state.json` — safe to resume across context compaction. To restart from scratch, delete that file. <!-- [LAW:one-source-of-truth] workflow state has one home, in the state file, not in the agent's head -->

The iteration cap is 3 (a 4th round of pushed fixes is treated as non-convergence and surfaced to the user).

## Judgment work between steps

The script is mechanical. You do the thinking in three places.

### Between step 2 and step 3 — classify each thread

Read `/tmp/address-pr-<N>-iter-<I>-threads.json` (unresolved threads) and `/tmp/address-pr-<N>-iter-<I>-suppressed.md` (Copilot's full session reasoning — includes comments that were dropped under the inline-comment cap and never posted as threads). Open the referenced code at `thread.path:thread.line`.

The suppressed file's header includes `**Latest overview:** N comment(s) generated` or `**Latest overview:** no 'generated N comments' phrase`. That phrase, parsed from Copilot's submitted PR overview, is the **authoritative** signal for "did Copilot find anything this iteration." Absent phrase + `is_copilot_review_pending=false` (which step 1 already enforced) = clean review. If the phrase says `N` and you see fewer than `N` unresolved threads, the difference is almost always already-resolved findings from earlier iterations — not a missing review. Never trust stored-comment counts or event-stream stability over this number.

For each thread, write an entry to `/tmp/address-pr-<N>-iter-<I>-decisions.json`:

```json
[{ "thread_id": "...", "decision": "valid", "proposal": "Proposal: ..." }]
```

Decision buckets:

- **`valid`** — reviewer is right. The change strengthens architecture, aligns with project goals, or genuinely improves the work. Apply it.
- **`different_fix`** — reviewer identified a real problem but proposed the wrong solution. Apply a better fix.
- **`invalid`** — reviewer is wrong, or the suggestion violates an architectural law: defensive null guards, silent fallbacks, mode explosion, duplicate enforcement, control-flow guards in place of data-flow variance, etc. Push back. Cite the law in your proposal text (e.g. `[LAW:no-defensive-null-guards]`).
- **`already_fixed`** — resolved by a later commit. Note and resolve.

Cross-reference suppressed comments in the same review — sometimes a posted thread and a suppressed comment touch related concerns, and addressing them together gives a better fix.

### Between step 3 and step 4 — apply fixes and write resolutions

For threads classified `valid` or `different_fix`, edit the code and commit. Commit messages describe the **why** (the architectural concern), not "address review comment" — the thread is context, the commit must stand alone in `git log`. Batch related concerns; separate unrelated.

If a worthwhile finding lives only in the suppressed Copilot reasoning (no thread exists to reply on), fix it in the same commit pass and mention it in your final report to the user — do **not** invent inline threads to "post" suppressed comments.

Then write `/tmp/address-pr-<N>-iter-<I>-resolutions.json`:

```json
[{ "thread_id": "...", "resolution": "Resolution: ..." }]
```

One resolution entry per thread you addressed this iteration — including pushbacks (the resolution body is the durable record of *why you won't change it*).

### After DONE — report to user

The script's DONE block contains the iteration summary. Expand it for the user:

- **Iterations run**, with per-iteration counts (threads addressed, code-change verdict, decision-bucket breakdown from `decision_counts`)
- **Threads addressed across the run** — fixes vs pushbacks, with law citations on pushbacks
- **Suppressed-comment findings addressed**, with file:line + commit SHA
- **Commits pushed** during the run
- **Final state** — merged (with merge result) or blocked (with reason)

## Rules

- **Never silently ignore a thread.** Every unresolved thread gets a fix+resolution or an explicit pushback. The script will refuse to skip threads — write `invalid` decisions with reasoning instead.
- **Never blindly apply suggestions.** Architectural laws override reviewer authority. Refuse suggestions that would introduce defensive null guards, silent fallbacks, mode explosions, or duplicate enforcement, and cite the law you're invoking.
- **Resolve every thread you addressed, including pushbacks.** Automated reviewers don't respond. The pushback comment is the durable record; if a human disagrees, they can re-open the thread cheaply. Open threads accumulate forever.
- **Commit messages stand alone in `git log`.** No "address review comment" — describe the architectural concern.
- **If threads conflict with each other**, surface the conflict to the user before acting. Don't pick a side silently.
- **Suppressed comments are not threads.** Address worthwhile ones in your fix commits and mention them in the final report.
- **Don't track loop state yourself.** The script is the source of truth for iteration/step/HEAD-snapshot. Always run the step the previous output told you to run — don't skip ahead, don't second-guess. If you need to recover from an error, fix the underlying condition and re-run the same step. <!-- [LAW:one-source-of-truth] -->
