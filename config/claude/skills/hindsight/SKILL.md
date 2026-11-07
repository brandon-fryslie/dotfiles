---
name: hindsight
description: Go back to the commit you started from, keeping what you learned and nothing you built. Use when a review or your own reading shows the work's premise was wrong — several findings share one cause, and fixing them would mean propping up a design that belongs somewhere else. Distills the learnings into fresh tickets written as if the work never happened, supersedes the ticket you were on, grooms the rest of the lane gently, destroys the branch, PR and worktree so nothing points at the old approach, has a planner who never saw it plan the new one, then hands off to a fresh session. Also the mechanical trigger: the fourth review pass in one PR's cycle that returned findings to fix — there is no fifth review, there is this. Triggers — "hindsight", "run hindsight on this", "is this a redesign situation", "the premise was wrong", "the findings all come from one cause", "the fourth review found things again", "start over from the commit I began on but keep what I learned".
---

# Hindsight

You built something, and now you know the problem better than when you started. The
thing you built is in the way of acting on that. This skill takes you back to where you
started, knowing what you didn't, and hands the start to someone who never saw the
detour.

## Is this a redesign?

Lay the findings side by side and ask what each one is an instance of. Seven findings
that are seven bugs get seven fixes, and this skill is not for that. Seven findings
that are one wrong premise breaking in seven places — a signal read from the wrong
source, a decision made at the wrong layer, a type that admits what it shouldn't —
get one redesign, and patching them instead adds a guard at each break. Each guard
is small, makes nothing strictly worse, and props up a thing that belongs somewhere
else. [LAW:carrying-cost] The test: write the cure for each finding, then ask whether
the cures survive moving the premise to where it belongs. If most of them vanish, you
are here.

You do not have to see the premise. There is a count, and it needs no diagnosis: a
review pass fails when it returns a finding you had to fix or rule on; a clean pass
doesn't count. **The fourth failed review in one PR's cycle is the last review that PR
gets.** What follows is this skill, not a fifth pass. The judgment test above catches a
redesign early, when you can see the shared cause; the count catches it when you can't,
which is often, because the author's eye is the one the paved path has already bent. At
the fourth, the voice says *"one more low and it's clean."* Four passes that each found
something is a PR that isn't converging, and the fifth finds the sixth.

Invoking this skill is the decision. It will reopen itself around the time you are
deleting the branch: *"it's only a few findings — patch them and move on."* The
number of findings was never the question. One wrong premise under seven findings is
seven findings next review too, under different names.

## Learnings travel as sentences; the artifact doesn't travel

What you know now splits cleanly in two.

The **learnings** are facts about the codebase and one sentence about why the approach
failed. "The server never closes the socket when its tmux dies." "A query can resolve
after its runner retires." "Reading connection loss off a call's error code can't tell
a drain from a death, and nothing promises a close follows a refusal." A stranger can
check each one against the code. None of them needs the diff to be true.

The **artifact** is the diff, the branch, the PR, the worktree, the plan written
against the diff — and any line anywhere that points at one of those. The artifact is
a paved path. A session that finds it walks it: reasons from the diff, patches it,
shapes the new work to fit the old seams, even when the ticket says the approach was
rejected. The pull is not a failure of discipline; it is what a path does. A link is the
path's on-ramp: one command and the reader is standing on it. So the link is the
artifact too, and it goes with it.

The temptation arrives in your most responsible voice, and it will be one of these:

- *"Keep the PR closed as evidence of what was tried."* Evidence of what? The learnings
  are already sentences in the ticket. The PR adds only the shape of the attempt, which
  is the one thing the next session must not inherit.
- *"Link it in the ticket so they know what was tried and don't repeat it."* The
  mechanism sentence does that. The link does the opposite: it hands them the attempt
  to repeat from.
- *"Cherry-pick the test file; the tests were fine."* The tests encode the old design's
  seams. They are the paved path in its most persuasive form, because they pass.
- *"`lit followup` — it files right beside the old ticket."* Its default description is
  a reference back to the old ticket. That is a link. Use `lit new`.

Write the sentences. Delete everything else. Nothing you write in the rest of this run
names the old ticket, branch, PR, session, or the fact that an attempt was made.

## 1. Verify the learnings

Check each learning against the code the next session will start from — `origin/master`
or its equivalent, not your branch. The branch is about to go, and a learning that was
only true on the branch goes with it. A learning you cannot verify is not written down;
it is dropped, or it becomes a question in the ticket ("confirm whether X").

Write the mechanism of the failed approach as one sentence that names no artifact: what
it read, from where, and why that source can't carry the signal. That sentence is what
stops the rediscovery, and it carries no pull because there is nothing to open.

## 2. Write the tickets from the problem

Write each ticket as if standing at the commit you started from, having read the code
and nothing else. The consumer's need first — what a person sees, what a caller gets
back, what a process can now rely on — then the learnings as plain facts, then the
mechanism sentence. `laws:backlog` governs the shape when there is more than one; the
usual case is one or two, in walking-skeleton order, with the one the others depend on
first.

File them in the same epic and lane as the ticket you are leaving, and give them its
place in the rank:

```
lit new --parent <epic> --lane <lane> --topic <topic> --title "..." --description-file -
lit rank <new> --above <old>
```

BAD:

> Supersedes 6sp.l8x. PR #215 tried classifying loss from BRIDGE_CLOSED and the review
> found 7 problems (see PR). Instead, retire the router only on transport close. The
> onResult change in client.ts should be reverted and the test in
> websocket-client-lifecycle.test.ts can be reused.

Four pointers and a shape. The next session opens PR #215 within a minute of reading it.

GOOD:

> A consumer watching a tmux server through the WebSocket connector learns that its
> connection is gone, and otherwise keeps its topology. Today the server does not close
> the socket when its own tmux dies (`src/connectors/websocket/server.ts`), so a client
> cannot learn this at all. A drain refusal and a real loss currently share the
> `BRIDGE_CLOSED` code. Reading connection loss off a single call's error code can't
> tell those apart, and nothing promises a close follows a refusal; loss is a transport
> lifecycle event and belongs to whatever owns the connection. Done when: killing the
> server's tmux closes the client's socket and the client's `onClose` fires; a refused
> call during drain reports as a refused call and the topology survives.

Forward-pointing text — the need, the criterion — at full precision. Backward-pointing
text — what was tried, where, by whom — absent. [LAW:one-source-of-truth]

## 3. Supersede, then groom gently

```
lit close <old> --resolution superseded --of <new>
```

The forward pointer is fine: a reader who lands on the closed ticket is sent to the live
one, and nothing sends anyone the other way.

Then read the rest of the lane with the new direction in mind. A ticket whose acceptance
criterion assumed the old design gets its criterion rewritten against the new one;
criteria are forward-pointing, so write them at full precision. A ticket that merely
sits downstream is left alone. Gently means the lane is corrected where it was wrong,
not rewritten to narrate the redesign — the next session should find a backlog, not a
manifesto.

## 4. Destroy the artifact

In this order, each one checked. The worktree goes before the local branch, because git
refuses to delete a branch a worktree has checked out:

```
gh pr close <n> --delete-branch        # closes the PR, deletes the remote branch
# remove the worktree: ExitWorktree if this session created it, else
git worktree remove <path>
git branch -D <branch>                  # the local branch, if one remains
```

Master was never touched, so there is nothing to rewind there — the next session starts
at the commit you started at because that is where master still is.

Check before going on: `git branch -a | grep <branch>` prints nothing; `lit backlog`
shows no claim from the removed checkout; `lit next` run from the main checkout names
`<new>`. If `lit next` says the lane is claimed elsewhere, the claim outlived its
checkout — file that against lit, and leave the bottle naming `<new>` directly; do not
work around it by keeping the worktree.

The pull is strongest here and it sounds like thrift: *"I'll keep the branch locally,
just in case."* In case of what? The learnings are in the ticket. The branch exists now
only to be found, and the one who finds it is the session you are about to start.

## 5. Plan it, blind

The planner must not have seen the artifact, and after step 4 it cannot: there is nothing
left to find. That is why planning comes after destruction and not before.

Spawn a `Plan` agent with the ticket text verbatim and the file names it mentions. It
sees only its prompt — no conversation, no diff, no memory of yours. Ask it to confirm or
refute each learning against the code and name the seams the fix touches. Do not tell it
what was tried. Read the plan it returns against the code and the ticket, never against
the diff you remember; you are the one reader in this run who still holds the old shape,
and "that's not how I did it" is not a finding. Record the plan on the ticket and your
review of it:

```
lit update <new> --plan-file <plan>
lit show <new>                                        # prints the plan's digest beside its version
lit verdict <new> pass --plan <digest>
lit verdict <new> fail --plan <digest> --law <token>  # a fail cites the law it breaks
```

A fail buys one revision: send the planner the verdict's reasons, not the design you have
in mind. If the second plan still misses, read the code yourself and write the plan; a
third round is you teaching the planner the old design by correction.

## 6. Fire the bottle

Load `memento:message-in-a-bottle` and fire it. The message is a pin: the ticket to start
and the phrase that tells the next session why it is starting where it is.

BAD:

> Picking up the WebSocket loss redesign. The previous attempt classified loss from error
> codes and the review found that the server never closes the socket; I filed two tickets
> and deleted PR #215. Start with the server one; the router one depends on it.

GOOD:

> `lit start tmux-server-events-6sp.p4k`. With hindsight. Read the ticket and its plan,
> then work it.

Say your one line to the user before you fire. The reset lands seconds later and takes
whatever you were mid-way through with it.

## Where this skill stops

At the bottle. You are the one agent alive who has the old diff in their head, which is
exactly why you are the wrong one to start the new work. The thought will be *"I
understand this better than a fresh session will, and there's context left."* You
understand the detour better. The fresh session understands the ticket, which is all
there is to understand now.

## Recap

- **Redesign, not repair.** Several findings, one premise. If the cures vanish when the
  premise moves, you are here.
- **Four failed reviews, no fifth.** A pass fails when it returns a finding you fixed or
  ruled on. The fourth in one PR's cycle invokes this skill; no diagnosis needed.
- **Sentences travel; the artifact doesn't.** Learnings are facts a stranger can check
  against master, plus one mechanism sentence naming no artifact.
- **A link is the artifact.** No pointer to the old ticket, branch, PR, or session in
  any ticket, comment, plan, or bottle. `lit new`, not `lit followup`.
- **Forward pointer only.** `lit close <old> --resolution superseded --of <new>`.
- **Destroy, then check.** PR closed, remote and local branch gone, worktree removed,
  `lit next` names the new ticket.
- **Plan after destruction.** The planner is blind because there is nothing to see.
  Review its plan against the code, not the diff you remember. One revision.
- **The bottle names the ticket and says "with hindsight."** Nothing about what was
  tried.
- **Stop at the bottle.** You hold the old shape; the fresh session doesn't.
