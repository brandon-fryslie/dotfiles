---
name: delegate-some-shit
description: Pick one work item with the user, hand it to a worker subagent that drives it from start to open PR, then orchestrate the PR yourself — validate the diff against the ticket's goals, run three rounds of code review (high, medium, low) with the worker fixing each round, validate again, merge, and close the ticket. Use when the user says "delegate some shit", "hand this off to a subagent", "have an agent do the next ticket", "delegate a ticket", or wants a ticket worked end to end while this session only supervises.
---

# Delegate some shit

You are the **orchestrator**. One ticket goes in; one merged PR and a closed ticket come
out. The worker writes all of the code — from the first read of the ticket to an open PR
and every review fix after it. You own four things only: choosing the ticket with the user,
checking the work against the ticket's goals, running the reviews, and merging.

**You do not write code.** Not the implementation, not a review fix, not "just this one
line." Around round two you will read a finding, see the three-line fix, and think *"faster
to do it myself than to explain it."* That is the moment. Send it to the worker. The worker
holds the context of why the code looks the way it does; your patch lands without it, and
you stop being the one person in this run whose job is to check.

**Done means all of these, checked, not assumed:**

1. The PR is merged, with the review outcome recorded on it.
2. The ticket's goals were checked against the actual diff **twice** — before review and
   after the last review fix.
3. The ticket is closed with `lit done`.
4. This checkout is on master, 0 ahead / 0 behind origin, `git status` clean.
5. The session handoff (`memento:message-in-a-bottle`) has run — last, after everything
   above.

## 1. Gate

Run the session-start git steps from CLAUDE.md (status, checkout master, set upstream,
`git pull --rebase`). Master must be 0 ahead / 0 behind with a clean tree. If it is not,
stop and report the exact state — do not choose a ticket on top of a dirty or diverged
master.

## 2. Choose the work item with the user

Run `lit quickstart work`, then `lit backlog`. Present the top few workable tickets — id,
title, one line on what each would take — and recommend one. If the user already named
the work, find its ticket (`lit ls --search`); if it has none, file one with them
(`lit quickstart new`) so there is something to close at the end.

Once the user picks, `lit show <id>` and read the whole ticket. Write down its **goals** as
a short checklist of observable outcomes — "`just validate` rejects a duplicate link
target", not "improve validation." This checklist is what you validate against at steps 4
and 6. If the goals are too vague to check, settle them with the user now, before the
worker starts. `lit start <id>` to claim it.

The ticket is now settled. Scope does not grow or shrink later because a review suggested
it or the worker found something interesting — new work becomes a new ticket.

## 3. Spawn the worker

Use the Agent tool (`general-purpose`) with **`isolation: "worktree"`**, so the worker's
branch lives in its own checkout and yours stays on a clean master the whole run — your
verification, your reviews and your `git status` never land on a half-edited tree.

Write the prompt as if the worker sees nothing else: none of this conversation, none of the
user's requirements. It may load the standing CLAUDE.md, and that is the danger — its git
workflow ends with the worker reviewing and merging its own PR and handing the session off.
The template overrides those steps by name; keep that paragraph. Fill in the template; keep
every section.

```
You are implementing one ticket end to end, from reading it to an open pull request.

<ticket>
[the full `lit show` output, verbatim]
</ticket>

<goals>
[your observable-outcome checklist from step 2]
</goals>

<user-requirements>
[everything the user said about this work, in their words, unedited]
</user-requirements>

You are in a git worktree of [repo path]. Before touching code: `git status` must be
clean; `git fetch origin`; `git checkout -b <descriptive-branch> origin/master`; confirm
the branch is 0 ahead / 0 behind origin/master. If any of that fails, stop and report the
exact state instead of building. Load the `laws:code` skill before writing code. Read the
code the ticket touches before changing it.

Build it, prove it works (run the tests; run the thing itself where that is possible), commit
it as focused commits, push the branch, and open a PR with `gh pr create` whose body states
what changed and how you verified it.

This run has a supervisor, and it overrides any standing workflow you have loaded (a
CLAUDE.md git workflow, a mandatory session handoff): opening the PR is where your part of
that workflow ends. The review passes, the merge, the ticket close and the handoff are the
supervisor's.

Do NOT: merge the PR. Run `lit done` or close the ticket. Run /code-review — reviews are
run for you. Run memento:message-in-a-bottle or any other session handoff — you will be
sent more work on this PR. Expand scope beyond the goals; note extra findings in your
report instead.

Stop when the PR is open, the branch is pushed, and your verification passed. Then report,
exactly in this shape:
- PR: <number and url>
- Per goal: met / not met, and the command or observation that shows it
- Verification run: the commands and their actual results
- Anything you did not do, and why

A report like this is useless — do not write it:
  "Implemented the feature and all tests pass. The PR is ready for review."
It names no PR, no goal, and no command, so none of it can be checked.

Later you will receive review findings. For each one, decide whether it is right. Fix the
ones that are; push back on the ones that are not, with the reason. Push the fixes, then
reply with one line per finding: fixed (commit) / declined (why).
```

Keep the worker's agent id — every later round goes back to **this** worker via
SendMessage (load it with ToolSearch `select:SendMessage` if needed), because it holds the
context the fixes depend on. If SendMessage is unavailable or the worker cannot be resumed,
spawn a replacement (also `isolation: "worktree"`) with the template's `<ticket>`, `<goals>`
and `<user-requirements>` sections and the Do-NOT list, but **not** its branch-and-PR
instructions — those would make it open a second PR. In their place:

```
PR #<n> already exists on branch <branch>. In your worktree:
`git fetch origin && git checkout -B <branch> origin/<branch>`. Read `gh pr diff <n>` before
changing anything. Do not create a branch or a PR. Fix the findings below the way the
reply rules describe, push to <branch>, and stop once the fixes are pushed and you have
replied one line per finding.

<findings>
[the round's findings, verbatim]
</findings>
```

That is the fallback — you still do not write the fix.

## 4. Validate before review

When the worker reports, read the **artifact, not the report**: `gh pr diff <n>` in full,
and the tests it claims to have run — run them yourself where it is cheap, in a throwaway
worktree of the PR head (`git fetch origin <branch> && git worktree add --detach
<tmp-path> FETCH_HEAD`, then `git worktree remove <tmp-path>`), never by checking the
branch out in your own checkout. Take the goals
checklist one line at a time: met, or not met, with the evidence you saw.

Any goal not met, or verification you could not reproduce → send it back to the worker with
the specific gap, and repeat this step. Do not start review on a PR that does not yet do
what the ticket asked; reviewers check code quality, not whether the ticket's goals were
met.

## 5. Three rounds of review

Run the reviews yourself, on the PR, in this order — this is the review cycle from the
CLAUDE.md git workflow, and its rules (including the step-11 escalation) apply:

1. `/code-review high <PR#>`
2. `/code-review medium <PR#>`
   - **Only if medium found major issues:** one more `/code-review high <PR#>`, once.
3. `/code-review low <PR#>` — the merge gate, never skipped

After each round, send the worker the findings verbatim and wait for its per-finding reply.
Then check the reply against the pushed diff: a "fixed" that changed nothing, or a
"declined" on a finding that is plainly right, goes back to the worker with your reason.
You judge the disagreements; you still do not write the fix. Fixes pushed in response to a
round are part of the cycle — carry on to the next round rather than restarting.

**A major finding that ends up unfixed stops the run** — whether the worker could not fix it
or declined it and you could not settle the disagreement. Report it to the user with both
sides instead of merging; merging past a known major finding is what the review cycle
exists to prevent. If the low pass finds a P0, the worker fixes it and low runs again until
it is clean.

## 6. Validate after review

Review fixes move code, and they can quietly undo a goal. The low pass coming back clean
will feel like the finish line — *"it's reviewed, it's green, merge it."* It is not the
finish line: review checked the code, not the ticket. Re-read the final `gh pr diff` and
walk the goals checklist again, with evidence. Any goal no longer met → back to the worker.
The change that restores it gets one `/code-review medium`; the worker answers its findings
as in step 5; then walk the goals again. Repeat until the goals all hold and that review has
no open findings — only then merge.

## 7. Merge and close

First record the review outcome on the PR — `gh pr comment <n>` with each round, what it
found, and how each finding was resolved, and the goals checklist with its evidence.

Remove the worker's worktree before merging — it still has the PR branch checked out, and
git will not delete a branch checked out in another worktree, so `--delete-branch` would
fail after the merge already landed. Find it with `git worktree list`; confirm it has no
uncommitted changes and nothing unpushed (`git -C <path> status -sb`); then
`git worktree remove <path>`. If it holds anything unpushed, stop and ask — that is the
worker's work, not debris.

Then merge the way the repo merges (read `git log --oneline` on master; squash merges show as
`Title (#N)`): e.g. `gh pr merge <n> --squash --delete-branch`. Then:

- `git pull --rebase` on master — 0 ahead / 0 behind, `git status` clean.
- `lit done <id>`, and record any follow-ups the worker surfaced with `lit followup`.
- Tell the user: the ticket, the PR, what each review round found and how it was resolved,
  and the goals checklist with its final evidence.
- Run the session handoff, `memento:message-in-a-bottle`, last.

## Recap

You pick the ticket with the user, settle its goals, and spawn one worker; the worker writes
every line, including every review fix. You read the diff, not the report. Goals checked
before review and again after it — a clean review is not a met ticket. Three rounds: high,
medium, low, plus one high if medium found major issues; an unfixed major finding stops the
run. Done is merged with the outcome recorded, verified twice, `lit done`, master clean,
handoff run.
