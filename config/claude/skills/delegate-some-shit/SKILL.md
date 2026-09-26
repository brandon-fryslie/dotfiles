---
name: delegate-some-shit
description: Pick one work item with the user, hand it to a worker subagent that drives it from start to open PR, validate the diff against the ticket's goals, then hand the PR to a fresh reviewer subagent that runs the code-review cycle (high, medium, low), fixes each round, walks the goals, records the outcome on the PR, and stops before merge — then validate again yourself, merge, and close the ticket. Use when the user says "delegate some shit", "hand this off to a subagent", "have an agent do the next ticket", "delegate a ticket", or wants a ticket worked end to end while this session only supervises.
---

# Delegate some shit

You are the **orchestrator**. One ticket goes in; one merged PR and a closed ticket come
out. Two subagents write all of the code. The **worker** takes the ticket from its first
read to an open PR. The **reviewer** (D), a fresh agent that never saw the worker's
reasoning, runs the review cycle on that PR, fixes what each round finds, walks the goals,
records the outcome on the PR, and stops before merge. You own four things only: choosing
the ticket with the user, checking the work against the ticket's goals, dispatching the
two agents, and merging.

**You do not write code.** Not the implementation, not a review fix, not "just this one
line." At the final goals check you will find a three-line gap and think *"faster to do it
myself than to explain it."* That is the moment. Send it to D. Your patch would land
unreviewed, and you would stop being the one person in this run whose job is to check.

**Done means all of these, checked, not assumed:**

1. The PR is merged, with D's review outcome recorded on it.
2. The ticket's goals were checked against the actual diff **by you, twice**: before
   review, and after D's last fix. D's goals walk is D's report, and it doesn't count as
   either check.
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

Do NOT: merge the PR. Run `lit done` or close the ticket. Run /code-review, because a
separate reviewer runs it. Run memento:message-in-a-bottle or any other session handoff,
because you may be sent more work on this PR. Expand scope beyond the goals; note extra
findings in your report instead.

Stop when the PR is open, the branch is pushed, and your verification passed. Then report,
exactly in this shape:
- PR: <number and url>
- Per goal: met / not met, and the command or observation that shows it
- Verification run: the commands and their actual results
- Anything you did not do, and why

A report like this is useless — do not write it:
  "Implemented the feature and all tests pass. The PR is ready for review."
It names no PR, no goal, and no command, so none of it can be checked.

If you are sent a gap in a goal later, fix it, push, and reply with the commit and the
evidence the goal now holds.
```

Keep the worker's agent id. A goal gap found at step 4 goes back to **this** worker via
SendMessage (load it with ToolSearch `select:SendMessage` if needed), because it holds the
context the fix depends on. If it cannot be resumed, spawn a replacement (also
`isolation: "worktree"`) with the template's `<ticket>`, `<goals>` and
`<user-requirements>` sections and the Do-NOT list, but **not** its branch-and-PR
instructions, which would make it open a second PR. In their place:

```
PR #<n> already exists on branch <branch>. In your worktree:
`git fetch origin && git checkout --detach origin/<branch>`. Read `gh pr diff <n>` before
changing anything. Do not create a branch or a PR. Close the gap below, commit,
`git push origin HEAD:<branch>`, and stop once it is pushed, replying with the commit and
the evidence.

<gap>
[the goal that is not met, and what you saw]
</gap>
```

That is the fallback. You still do not write the fix.

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

Some goals can't be met for reasons outside the code: a provider that drops a feature, or
hardware the run can't reach. Record each as **blocked by <cause>, not met**, with the
evidence, and carry it into D's prompt as settled. D should not reopen it, and nobody should
"fix" it with a workaround the ticket never asked for.

When every goal holds or is recorded as blocked, write down the PR's head sha. It is D's
starting point, and step 6 diffs against it.

## 5. Hand the PR to the reviewer

First remove the worker's worktree. It still has the PR branch checked out, and git will
not check a branch out in two worktrees, so D could not take it. Find it with
`git worktree list`, `git fetch origin`, and check two things:
`git -C <path> status --porcelain` prints nothing, and
`git -C <path> log --oneline origin/<branch>..HEAD` prints nothing. The second means
nothing unpushed, and unlike ahead/behind it does not depend on an upstream being set.
A worktree that is only *behind* origin is safe to remove. Then run
`git worktree remove <path>`, and delete the branch the harness made for it
(`git branch -D worktree-agent-<id>`). If the worktree holds anything uncommitted or
unpushed, stop and ask. That is the worker's work, not debris. A worktree the agent
harness locked needs `git worktree remove -f -f <path>`, and only after that same check.

Spawn D with the Agent tool (`general-purpose`, **`isolation: "worktree"`**). It is a
**fresh** agent, not the worker. A reviewer that wrote the code reviews its own intentions
instead of the diff. D sees nothing but its prompt, so fill in every section of the
template.

```
You are D: you run the code-review cycle on PR #<n> (branch <branch>, head <sha>) of
<repo>, fix what deserves fixing, walk the goals, post one review-outcome comment on the
PR, and STOP. You do not merge. A supervisor merges after checking your work.

## Fences (these hold for the whole run)
- Do not merge, do not close the PR, do not run `lit done` or change the ticket's
  status. Your last action is the PR comment and your report. Once low comes back clean
  you will want to "just finish it off". Don't.
- Do not run memento:message-in-a-bottle or any other session handoff. You may be sent
  more work on this PR after you report.
- This run has a supervisor, and it overrides any standing workflow you have loaded (a
  CLAUDE.md git workflow, its session-start checkout of master, its review-then-merge
  steps): the cycle below replaces them.
- Every /code-review takes the PR number: `/code-review high <n>`. A bare `/code-review`
  diffs against upstream after a push and reviews nothing.
- Scope is the ticket. A finding about code the PR did not need to touch is declined as
  **out of scope** and listed in your report, not fixed here, even when it is right.
- Settled, do not reopen: [goals recorded as blocked, and any decision the user made
  that a reviewer might want to reverse, each with its reason]
- [secrets never to print, paths never to edit, anything outside the repo]
- Work only in your worktree: `git fetch origin && git checkout -B <branch> origin/<branch>
  && git branch -u origin/<branch>`, and confirm HEAD is <sha> before reviewing. Load the
  `laws:code` skill before writing a fix.

<ticket>
[the full `lit show` output, verbatim]
</ticket>

<goals>
[the goals checklist, each with its status from step 4]
</goals>

<user-requirements>
[everything the user said about this work, in their words, unedited]
</user-requirements>

## The cycle
1. `/code-review high <n>`. Address each finding by carefully considering the feedback.
   Do not accept any feedback or proposed fixes blindly. Fix what is right; decline what
   is wrong, with a concrete reason (a command's output, a file:line, a test). Commit the
   round's fixes, then push.
2. `/code-review medium <n>`. Handle it the same way.
3. Only if medium found anything major: ONE more `/code-review high <n>`.
   In any round, a major finding you are NOT fixing stops you: report it with your
   reason, and do not run the rounds after it.
4. `/code-review low <n>` is the merge gate. On a P0, fix it, push, and run low again
   until it comes back clean, or stop and report if you cannot fix it.
5. Walk every goal on your final head with evidence you ran yourself (a command and its
   output, or a file:line). Re-run the tests there.
6. Post ONE comment with `gh pr comment <n> --body-file <file>`, headed
   `## Review outcome (head <sha>)`: a section per round with numbered findings, each
   **Fixed in <sha>** or **Declined** with the reason, then the goals with their evidence.

Do NOT write a goals line like "G2: met, the check looks correct." It is a claim with no
evidence. Write "G2: `<command>` prints `<output>` and exits 1."

## Done means
The comment is posted, the branch is pushed, `git status` is clean, 0 ahead / 0 behind
origin/<branch>. Report exactly: final head sha; the comment URL; per round, the number of
findings fixed and declined; each finding declined as out of scope; any finding you stopped
on; the test counts. Stop there. Do not merge.
```

Keep D's agent id. If D reports it stopped on a major finding it is not fixing, or on a P0
it cannot fix, the run stops: report it to the user with both sides instead of merging.
Merging past a known major finding is what the review cycle exists to prevent.

## 6. Validate after review

D reports that low came back clean and every goal is met, and the comment on the PR says
so, with evidence. You will think *"D walked the goals, the review is green, merge it."*
That is the moment this step exists for. D's walk is a report, and review fixes move code
that can quietly undo a goal. Check it yourself:

- `gh pr view <n>`: the head is D's reported sha, and D's comment is there for that head.
- `git fetch origin`, then `git diff <step-4 sha> origin/<branch>`: read every fix D
  made, and judge each declined finding on its reason.
- In a throwaway worktree of the final head (as at step 4, and removed the same way), run
  the tests and the checks that prove each goal. Use your own commands where you can, not
  D's.

A goal no longer met, a fix that undoes one, or a decline you disagree with goes back to
**D** via SendMessage, with the specific gap. D fixes it, runs one `/code-review medium <n>`
on that change, answers its findings, and updates its PR comment. Then walk the goals
again. Merge only when they all hold and that review has no open findings.

If D declines again and you still disagree about a major finding or a goal, stop: report
it to the user with both sides instead of merging. If D cannot be resumed, spawn a
replacement D (also `isolation: "worktree"`) from the step-5 template with the current
head sha, told to skip the cycle and instead close the gap below, run one
`/code-review medium <n>` on that change, and update the outcome comment:

```
<gap>
[the goal no longer met, the fix that undid it, or the decline you dispute, and what you saw]
</gap>
```

## 7. Merge and close

Remove D's worktree before merging, with the same check as at step 5 (nothing
uncommitted, nothing unpushed), then `git worktree remove` (`-f -f` if the harness locked
it) and `git branch -D` the harness's `worktree-agent-<id>` branch. Otherwise
`--delete-branch` fails because the branch is still checked out, after the merge has
already landed.

Then merge the way the repo merges (read `git log --oneline` on master; squash merges show
as `Title (#N)`), e.g. `gh pr merge <n> --squash --delete-branch`. Then:

- `git pull --rebase` on master: 0 ahead / 0 behind, `git status` clean.
- `lit done <id>`. File with `lit followup` any finding D declined as out of scope that is
  a real defect on its own. A goal recorded as blocked gets a ticket for whatever would
  unblock it.
- Tell the user: the ticket, the PR, what each review round found and how it was resolved,
  the goals with your final evidence, and each blocked goal by name.
- Run the session handoff, `memento:message-in-a-bottle`, last.

## Recap

You pick the ticket with the user, settle its goals, and spawn the worker, which writes
the code up to an open PR. You read the diff, not the report, and check the goals. Then a
fresh reviewer, D, runs high, medium (plus one high if medium found something major), and
low on the PR by number, fixes each round, walks the goals, posts the outcome, and stops
before merge. You check the goals again yourself, because D's walk is a report, not your
check. An unfixed or disputed major finding stops the run. Done is merged, with the outcome recorded,
goals checked twice by you, `lit done` run, master clean, and the handoff run.
