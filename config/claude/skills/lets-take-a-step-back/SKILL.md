---
name: lets-take-a-step-back
description: Stop when the work is bogged down, go back to the commit where the ticket started, find the decision that caused the trouble, and restart from there with a plan that carries the lesson. Handed a wider scope than one ticket (several tickets, a range of days), it investigates first and decides which tickets restart before reverting anything. Use when complexity surprises you — a fix that needs another fix, a workaround or special case for code you wrote earlier, a step far harder than the plan expected, a rabbit hole with no clear strategy out. Unexpected complexity is the signal, and "I'm nearly there, one more fix" is the thought that keeps you in the hole. Also the mechanical trigger: the fourth review pass in one PR's cycle that returned findings to fix. Nothing is deleted: the abandoned branch stays where it is. Triggers — "let's take a step back", "take a step back", "this is getting too complicated", "why is this so hard", "we're in a rabbit hole", "this isn't converging", "the fourth review found things again".
---

# Let's take a step back

Some work is complex because the problem is: that is essential complexity, and no
design removes it. Other work becomes complex because of a decision made along the
way: accidental complexity. It announces itself as surprise. The change that should
have been one line is forty, every fix needs another fix, and the code starts working
around code written an hour ago. Unexpected complexity is the most reliable sign that
a decision upstream was wrong. Pressing on stacks more on top of it, and every later
step pays interest on it. [LAW:carrying-cost]

This skill stops the work, goes back to where the ticket started, finds the root
cause, and restarts from there with the lesson. Handed a wider scope than one ticket, it
investigates first and decides which tickets restart.

## When to run it

The trigger is a thought, not a metric: *"This is harder than it should be, but I'm
nearly there, one more fix."* "Nearly there" is how every rabbit hole feels from the
inside, because each step down looks small. The next fix will be followed by another.

Signs the complexity is accidental:

- It targets your own code rather than the problem: guards, special cases, adapters,
  flags, a second code path beside the first.
- Each fix exposes the next one, or one change needs edits scattered across many
  places.
- You can no longer state the strategy in one sentence.
- A review cycle won't converge: the fourth pass with findings to fix.

The test for essential complexity: would this complexity exist in any correct solution,
or only in this one? The domain really having twelve cases is essential complexity.
Twelve cases that exist because of where you put the state is accidental.

Two arguments will be offered for pressing on:

- *"Make it work, then make it right."* That holds when the design is sound and only
  polish is missing, because a sound design cleans up. It fails here. Complexity that
  came from a wrong decision doesn't get cleaned up later; it gets built on, and each
  layer makes the decision harder to reverse.
- *"We've built too much this way to turn back."* That is the sunk cost fallacy. The
  work is spent either way. The only live question is what the remaining work will
  cost on the current design compared with a sound one.

## 1. Go back to the start of the ticket

When the trouble is in the ticket you are working, which is the usual case, go back to
the commit where that ticket started: the point where its branch diverged from its base
(`git merge-base <base> HEAD`, with `<base>` the branch the PR targets). Every change
after that commit is discarded. Nothing is judged commit by commit, and nothing is kept
but the lesson from step 2.

When you are handed a wider scope (several tickets, a range of commits, the last few
days), you are investigating, and the scope is where to look, not where to go back to.
The pull is to read "the last four days are a mess" as "go back four days": that throws
out every sound change in the window along with the wrong ones, before anything was
assessed. Find the root causes first (step 2), each with the ticket that made it and the
commit where that ticket started. Then decide, for each, what restarts:

- **Accidental complexity from a decision:** the ticket that made it restarts at its
  start.
- **A goal not worth reaching:** the ticket is dropped, not restarted. That is
  Brandon's call.
- **Work built on a restarted or dropped ticket** goes with it. It is not restarted on
  its own, because it would be rebuilt on a foundation that is changing or gone.
- **Essential complexity:** nothing restarts.

Nothing is reverted, reset or discarded before that verdict. Each ticket that restarts
then goes back to its own start, as above.

## 2. Find the root cause

Name the decision, and say why it went wrong. It is usually one of these:

- **A false premise or assumption:** a fact about the code, the data, a tool or the
  requirement that turned out untrue.
- **A misguided goal:** the goal as stated isn't worth reaching, and the right move is
  a different direction. The goal is Brandon's call: bring him what you found and what
  you would do instead.
- **A small implementation decision that cascaded:** where a piece of state lives,
  which layer makes a decision, a type that admits more than it should.

Then write the lesson as a root cause statement: what was decided, why it looked
right, and what it forced afterward. Write it so that a stranger could check it
against the code.

- BAD: "Lesson: be more careful with state." Nobody can act on this, so the lesson
  will be learned again.
- GOOD: "The cache decided when to invalidate, but only writers know when data
  changes, so every writer grew a hook into the cache. Writers publish the change and
  the cache subscribes."

The lesson is what keeps the next attempt out of the same hole. It does that work
alone: the abandoned code doesn't need to go anywhere.

## 3. Plan for the lowest total complexity

Write a new plan, starting from the commit where the restarted ticket started, with the
root cause statement in it. Judge the plan by its total complexity over the whole
effort: the area under the complexity curve, not its height at any one moment. A plan
that is cheap today and forces a workaround at every later step loses to one that costs
more up front and stays flat. For each decision in the plan, ask again how hard it will
be to change later, and prefer the one that stays cheap to change.

State the lesson in the plan itself, so whoever implements it sees why the obvious
route is closed. In a lit repo, the plan goes on the ticket:
`lit update <id> --plan-file <file>`.

## 4. Restart from where the ticket started

Commit anything uncommitted onto the current branch first. `git switch` carries
uncommitted changes along, which would bring the abandoned work with you. Then branch
from the commit where the ticket started and implement the plan there:

```
git switch -c <new-branch> <ticket-start-commit>
```

The abandoned branch stays where it is, and there is nothing to clean up. If the
ticket has already been merged, branch from the current base instead, and make
reversing that ticket, and the work built on it, the plan's first step.

Build from the plan, not from the abandoned branch. The thought will come mid-way
through: *"That function on the old branch was fine. I'll copy it over."* Code copied
across brings the decisions it was written under. Write it again against the new plan,
and if it comes out the same, good. Reading the old diff for ideas pulls the same way.

## Recap

- **Unexpected complexity means a wrong decision upstream.** "One more fix" is the
  trigger, not the way out.
- **One ticket: go back to where it started.** Discard every change after that commit
  and keep only the lesson.
- **A wider scope is where to look, not where to go back to.** Investigate first, then
  decide which tickets restart; what was built on them goes with them; a goal not worth
  reaching is Brandon's call to drop.
- **Essential or accidental:** would it exist in any correct solution, or only in this
  one?
- **Ask how hard each decision is to reverse.** Two-way doors are usually right;
  one-way doors are usually where things went wrong.
- **Write the root cause as a statement a stranger can check.** "Be more careful" is
  not a lesson.
- **Plan for the lowest total complexity,** the area under the curve.
- **Restart on a fresh branch from where the ticket started.** Commit first; the
  abandoned branch stays put. Build from the plan, not from the old code.
