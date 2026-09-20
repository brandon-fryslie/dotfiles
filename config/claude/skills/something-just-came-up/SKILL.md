---
name: something-just-came-up
description: Park the ticket you are on and file the real fix instead. Use when work in progress hits the fork between adding one more mode to a local minimum — small, nothing strictly worse, one more stake in the carrying-cost pile — and the real fix, which does not fit in this session. Parks the current ticket with a single pointer comment, writes the escape up as a top-ranked epic (proof the minimum is actually escaped, law compliance across the blast radius, the parked work smoothed into a reusable block), grooms both ends so the top is pullable cold and the parked work resumes after it, then hands off to a fresh session. Triggers — "something just came up", "park this and file the real fix", "this needs a bigger fix than the ticket", "we are in a local minimum", "stop and write this up instead".
---

# Something Just Came Up

You are mid-ticket and something came up that is bigger than the ticket. This skill
parks what you are on, files what you found, and hands the work to a fresh session —
in that order, ending with your turn over.

## The fork you are standing at

Two roads, and you have just seen both.

One **adds a mode**. It is small, it makes nothing strictly worse, the ticket closes
today. It also drives another stake into a local minimum — one more thing every future
change works around. That pile is the carrying cost, and no single stake in it ever
looks like the problem. [LAW:carrying-cost]

The other is the **real fix**, and it does not fit in this session.

Check the second road before you commit to it: if what came up is a bug you can fix
in five minutes, fix it and carry on — this skill is for the case where the real fix
genuinely does not fit. That check is about the *discovery*, never about the mode. "The
mode is only five minutes" is not this guard; it is the first road wearing the guard's
coat.

Invoking this skill *is* choosing the second road. The decision is made; the rest of
this run executes it.

It will try to reopen itself, roughly when the epic you are writing starts to look
expensive: *"the extra mode doesn't make anything strictly worse — and YAGNI says
don't build the big thing on spec."* Two answers. YAGNI is a statement about features
with real carrying cost; it has nothing to say about substrate, and the laws already
fence it out. [LAW:carrying-cost] And "makes nothing strictly worse" is the local
minimum's entire defense mechanism — it was true of every step that got you here,
which is exactly why you are here. The mode that goes in "just this once" is the one
the epic you are writing will have to work around.

## Drop a pin; the next agent draws its own map

You are about to write three things — a park comment, a slate of tickets, a bottle —
and one discipline governs all three.

A **pin** is a pointer: a ticket id, a branch, a file, the question you were in the
middle of answering. Following a pin costs the reader one command.

A **claim** is an assertion about state: "the parser handles nested groups now",
"tests pass", "the fault is in the retry path". Following a claim costs the reader the
whole verification — *and* it cost you the tokens to write. The reader must reverify
whatever you state, relevant or not, because it has no way to tell which of your
claims survived. So the claim does not save the work; it duplicates it. You pay twice
for one map, and a claim that went stale between writing and reading sends the reader
confidently down a road that has closed.

The temptation arrives in your own voice: *"I verified this — writing it down saves
the next agent from redoing it."* It does not. It adds a step and bills you for it.
Drop the pin and let them make their own map; theirs will be true.

**One exemption, and it is not a loophole.** Forward-pointing text — acceptance
criteria, constraints, the outcome being targeted — references nothing and cannot go
stale, because the code moves toward it. Write that at full precision, everywhere it
belongs. The ban is on backward-pointing assertions about how things currently are.
The code is the source of truth for its own state; a sentence restating it is a second
copy that drifts. [LAW:one-source-of-truth]

## 1. Park the ticket

One comment on the ticket you were working: `lit comment add <id> --body "..."`. One.
If the parked work has no ticket, file one first — a pin needs somewhere to land.

**Commit and push before you write the comment.** The bottle at step 4 resets this
session, and a pin naming a branch that exists only in your uncommitted diff points at
nothing. This is the step that fails silently: the comment reads fine, the handoff
fires, and the next agent arrives to a dirty tree it cannot explain.

The pin carries at most:

- where the work stops — the branch, or the commit, or "nothing written yet"
- the files in play, at file granularity and no finer (function names and line numbers
  are pointers into a moving artifact — the reference ceiling in `groom-backlog`
  applies here too)
- the id of the epic that parked it, so the resumer knows what changed underneath
- the one question you were in the middle of answering, if there was one

Nothing else. No status report, no what-works list, no session summary.

BAD:

> Parked. The mode dispatch in `resolver.py` works for the 3 existing modes; I added
> the 4th and 2 of 5 tests pass. The failure is in the fallback path — it doesn't
> handle the empty-config case. Next agent should fix `_resolve_fallback()` first,
> then re-run the suite. Note the config loader does its own validation, which
> duplicates this.

Every sentence is a claim, so the reader reverifies all of them before it can trust
any of them — and by the time it reads this, the branch may not exist.

GOOD:

> Parked for #proj-resolver-9x2. Work stops at branch `resolver-mode-4`, pushed,
> nothing merged. In play: `config/resolver.py`, `tests/test_resolver.py`. Resume once
> that epic lands and its blocks edge lifts.

## 2. Write up the something

`laws:backlog` governs the slate — read it when the writeup runs past a couple of
tickets. The shape is whatever the work actually is: one ticket with an acceptance
criterion, or an epic with children. Do not inflate a ticket into an epic for
ceremony, and do not crush a real epic into one ticket to look decisive.

Three strands go in, and the writeup is not scoped until all three are present:

1. **The escape, and the proof it escaped.** The fix, plus a criterion that can tell
   you afterwards whether you are out of the local minimum or merely standing in a new
   one. "Adding the next mode touches data, with no logic edit" is such a criterion.
   [LAW:verifiable-goals]
2. **Law compliance across everything the fix touches.** The fix moves code, and the
   code it moves must land lawful. Name the `[LAW:<token>]`s you already know are
   broken in the blast radius; where you do not know, the ticket is a
   `sheriff-is-in-town` pass scoped to that surface.
3. **Smooth bricks out of the parked work.** Your in-flight work either becomes a block
   in the new pool or stays a rough seam the epic routes around. The work that makes it
   smooth is work, and it goes in the writeup. [LAW:composability]

The temptation fires the moment strand 1 feels like padding: *"escaping the minimum is
obviously what the fix does — a ticket to verify it is ceremony."* It is the reverse.
Without strand 1 nothing distinguishes escaping the minimum from relocating it, and
relocating is the usual outcome — the new shape absorbs the old pain, everyone declares
victory, and the mode after next goes in by hand anyway.

Rank it to the top: `--top` at creation, or `lit rank <id> --top`.

## 3. Groom both ends

Two ends. The second is the one that gets dropped.

**The top.** Run `groom-backlog` scoped to the new epic — it owns what groomed means,
so do not re-derive its rules here. Done when the first child is pullable cold by an
agent holding nothing but the ticket.

**The parked ticket.** It has to come back *after* the epic, and come back better than
it left.

- `lit dep add --from <epic-id> --to <parked-id> --type blocks`. Without that edge the
  parked lane is still `in_progress` and claimed by this checkout, so `lit next` serves
  it straight back to the very next session — ahead of the epic you just ranked to the
  top, and the park quietly undoes itself. This one command is what makes "resume
  afterwards" true rather than hopeful.
- Rewrite its acceptance criteria against the world the epic creates, not the one you
  are leaving. The parked ticket's job is to *consume* the new foundation; criteria
  written against the old shape walk it right back into the minimum.

Full precision here — criteria are forward-pointing, so this is not where the no-claims
rule bites.

## 4. Fire the bottle

Load `memento:message-in-a-bottle` and fire it with `--reset clear`. Clear, not
compact: the next agent should start from the epic and the code, never from your
session's residue. A compacted summary of the run you just had is a map, and maps are
the thing this skill refuses to draw. If a `/goal` is active, carry it — that skill
says how.

The message is a pin like the others: the minimum that points the next agent the right
way, and no more.

BAD:

> Picking up the resolver epic. The old approach used per-mode dispatch, which I found
> duplicates validation in the config loader — see my analysis in the epic. The right
> move is a parse-don't-validate boundary at load time, and the tests will probably
> need restructuring since they assert on internal structure. Start with the second
> child; the first is mostly research.

GOOD:

> /next — top of the backlog is #proj-resolver-9x2, filed just now. Read the epic and
> its children. The ticket it parked is blocked behind it.

Say your one line to the user *before* you fire, not after: `--reset clear` ends your
turn at the launcher's line.

## Where this skill stops

At the launcher's line. You filed the work. You do not start it.

The pull is strongest right here and it sounds responsible: *"I just wrote this epic, I
understand it better than any fresh agent will, and there's context left — I'll make a
start."* That is how the session that was supposed to escape the local minimum spends
its last tokens building the first half of a mode into it. The clean break is the whole
value: a fresh agent, the epic, no residue. Everything you know is already in the
tickets — anything "making a start" would add is precisely the map you were told not to
draw.

Two smaller ones, same answer. The quick thing you noticed while writing the epic: file
it, do not fix it. A tidy report to the user in place of the handoff: the bottle is the
deliverable.

## Recap

- **Pin, not map.** Pointers, never claims about current state — a claim is reverified
  anyway, so writing it burns the tokens twice and can go stale in between.
- **Forward-pointing text is exempt.** Acceptance criteria and constraints cannot go
  stale. Full precision, everywhere they belong.
- **Commit and push before you pin.** The reset is coming.
- **Three strands, or the writeup is not scoped.** The escape and its proof, law
  compliance across the blast radius, the parked work smoothed into a block.
- **The blocks edge** — `lit dep add --from <epic> --to <parked> --type blocks` — or
  the park undoes itself on the next session's `lit next`.
- **Stop at the launcher's line.** You filed the work. You do not start it.
