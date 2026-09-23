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

1. The PR is merged.
2. The ticket's goals were checked against the actual diff **twice** — before review and
   after the last review fix.
3. The ticket is closed with `lit done`.
4. This checkout is on master, 0 ahead / 0 behind origin, `git status` clean.

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

Use the Agent tool (`general-purpose`), foreground or background as suits you. The worker
sees only your prompt: no conversation, no CLAUDE.md, no user requirements. Anything left
out does not exist for it. Fill in this template; keep every section.

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

Repo: [absolute path]. Before touching code: `git checkout master && git pull --rebase`,
confirm 0 ahead / 0 behind, then `git checkout -b <descriptive-branch>`. Load the
`laws:code` skill before writing code. Read the code the ticket touches before changing it.

Build it, prove it works (run the tests; run the thing itself where that is possible), commit
it as focused commits, push the branch, and open a PR with `gh pr create` whose body states
what changed and how you verified it.

Do NOT: merge the PR. Run `lit done` or close the ticket. Run /code-review — reviews are
run for you. Expand scope beyond the goals; note extra findings in your report instead.

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
SendMessage (load it with ToolSearch `select:SendMessage` if needed). A fresh agent
per round would start with none of the context the fixes depend on.

## 4. Validate before review

When the worker reports, read the **artifact, not the report**: `gh pr diff <n>` in full,
and the tests it claims to have run — run them yourself where it is cheap. Take the goals
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
3. `/code-review low <PR#>` — the merge gate, never skipped

After each round, send the worker the findings verbatim and wait for its per-finding reply.
Then check the reply against the pushed diff: a "fixed" that changed nothing, or a
"declined" on a finding that is plainly right, goes back to the worker with your reason.
You judge the disagreements; you still do not write the fix. Fixes pushed in response to a
round are part of the cycle — carry on to the next round rather than restarting.

If the low pass finds a P0, the worker fixes it and low runs again until it is clean. If the
worker cannot fix a major finding, stop and report to the user instead of merging.

## 6. Validate after review

Review fixes move code, and they can quietly undo a goal. The low pass coming back clean
will feel like the finish line — *"it's reviewed, it's green, merge it."* It is not the
finish line: review checked the code, not the ticket. Re-read the final `gh pr diff` and
walk the goals checklist again, with evidence. Any goal no longer met → back to the worker,
and the change that restores it gets one `/code-review medium` before merge.

## 7. Merge and close

Merge the way the repo merges (read `git log --oneline` on master; squash merges show as
`Title (#N)`): e.g. `gh pr merge <n> --squash --delete-branch`. Then:

- `git checkout master && git pull --rebase` — 0 ahead / 0 behind, `git status` clean.
- `lit done <id>`, and record any follow-ups the worker surfaced with `lit followup`.
- Tell the user: the ticket, the PR, what each review round found and how it was resolved,
  and the goals checklist with its final evidence.

## Recap

You pick the ticket with the user, settle its goals, and spawn one worker; the worker writes
every line, including every review fix. You read the diff, not the report. Goals checked
before review and again after it — a clean review is not a met ticket. Three rounds: high,
medium, low. Done is merged, verified twice, `lit done`, master clean.
