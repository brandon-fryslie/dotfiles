---
name: something-just-came-up
description: Park the ticket you are on and file the real fix instead. Use when work in progress hits the fork between adding one more mode to a local minimum — small, nothing strictly worse, one more stake in the carrying-cost pile — and the real fix, which does not fit in this session. Parks the current ticket with a single pointer comment, writes the escape up as a top-ranked epic or ticket (proof the minimum is actually escaped, law compliance across the blast radius, the parked work smoothed into a reusable block), grooms both ends so the top is pullable cold and the parked work resumes after it, then hands off to a fresh session. Triggers — "something just came up", "park this and file the real fix", "this needs a bigger fix than the ticket", "we are in a local minimum", "stop and write this up instead".
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
this run executes it. [LAW:escape-local-minima]

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

Draft the pin here; **post it in step 3**, once the writeup has an id to point at. One
comment, not a placeholder plus a correction.

**Commit and push now, before anything else here.** The bottle at step 4 resets this
session, and a pin naming a branch that exists only in your uncommitted diff points at
nothing. This is the step that fails silently: the comment reads fine, the handoff
fires, and the next agent arrives to a dirty tree it cannot explain.

The pin carries at most:

- where the work stops — the branch, or the commit, or "nothing written yet"
- the files in play, at file granularity and no finer (function names and line numbers
  are pointers into a moving artifact — the reference ceiling in `groom-backlog`
  applies here too)
- the id of the work that parked it, so the resumer knows what changed underneath
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

**File it outside the parked ticket's epic** — its own epic, or free-floating. Inside
one epic, rank is lit's ordering signal and a blocks edge between siblings is refused
outright, so filing the escape as a sibling of the work it supersedes costs you the
mechanism step 3 parks with.

## 3. Groom both ends

Two ends. The second is the one that gets dropped.

**The top.** Run `groom-backlog` scoped to the new work — it owns what groomed means,
so do not re-derive its rules here. Done when the ticket a fresh agent will pull first
is pullable cold, by an agent holding nothing but that ticket.

**The parked ticket.** It has to come back *after* the new work, and come back better
than it left. Four commands, and the first two are a pair — either one alone leaves the
park broken:

- `lit open <parked-id> --reason "parked behind <new-id>"`. This clears `in_progress`.
  It does **not** release the lane claim — the assignee survives the reopen — and that
  is fine; what matters is that `in_progress` is gone. Leave it set and `lit next` hands
  the ticket straight back to the very next session, *"already in progress in a lane you
  hold — continue where you left off"*, because lit routes claims-first and an
  in-progress lane this checkout holds outranks rank, blocks edges, and focus alike. The
  park undoes itself in one command, before the fresh agent has read anything.
- `lit dep add --from <new-id> --to <parked-id> --type blocks`. This holds it back
  while the escape is in flight, and lifts on its own when the new work closes — which
  is what makes "resume afterwards" true rather than hopeful. If the escape ended up
  inside the parked ticket's epic anyway, lit refuses this edge (`code=3`, siblings);
  rank the escape above it instead — `lit rank <new-id> --above <parked-id>` — and know
  what you traded: rank orders the lane, it does not gate it.
- `lit comment add <parked-id> --body "..."` — post the pin you drafted in step 1, now
  that `<new-id>` exists.
- `lit update <parked-id> --description "..."` — rewrite its acceptance criteria against
  the world the new work creates, not the one you are leaving. The parked ticket's job
  is to *consume* the new foundation; criteria written against the old shape walk it
  right back into the minimum. Full precision here — criteria are forward-pointing, so
  this is not where the no-claims rule bites.

**Then read the park back before you go on**, and read it knowing what a *good* park
looks like: `lit next` exits nonzero — `code=6`, *"no ready work in your claimed
lane(s) — blocked on <new-id>"*. That error is the success signal. The lane is still
claimed by this checkout (reopening clears `in_progress`, not the assignee), and the
blocks edge is now holding it, so routing has nowhere to go and says so, naming the
work that must land first.

A `lit next` that cheerfully **names a ticket** is the failure. It means either the
reopen did not take (it names the parked ticket, *"already in progress in a lane you
hold"*) or the edge did not land (it names the parked ticket as ready). Both broken
states name a ticket; only the good one errors. Do not "fix" the error by pulling the
edge — that is tearing out the park because the park worked.

Check this before you go on, every time. You cleared `in_progress` in the first command
of this step, so a refusal or typo in the second leaves the ticket loose with nothing
holding it, and the bottle ends the session a moment later. It is the one check here
that cannot be deferred: after the reset, nobody knows a park was attempted.

## 4. Fire the bottle

Load `memento:message-in-a-bottle` and fire it. It resets the next agent to a blank
slate — the epic and the code, and none of your session's residue — which is exactly
what this skill wants: a summary of the run you just had is a map, and maps are the
thing this skill refuses to draw. If a `/goal` is active, carry it — that skill says
how.

The message is a pin like the others: the minimum that points the next agent the right
way, and no more.

BAD:

> Picking up the resolver epic. The old approach used per-mode dispatch, which I found
> duplicates validation in the config loader — see my analysis in the epic. The right
> move is a parse-don't-validate boundary at load time, and the tests will probably
> need restructuring since they assert on internal structure. Start with the second
> child; the first is mostly research.

GOOD:

> `lit start proj-resolver-9x2.a1` — first child of epic #proj-resolver-9x2, filed just
> now. Read the epic, then work the child. The ticket it parked is blocked behind it.

**Name the ticket; do not send them to a bare `lit next`.** While the parked lane sits
blocked behind the new work, `lit next` does not route around it — it exits nonzero
with *"no ready work in your claimed lane(s)"* and tells the reader to re-focus
deliberately. Handing a fresh session `/next` opens it on an error. The id is a pin
like any other, and it is the one pointer this message cannot do without.

Say your one line to the user *before* you fire, not after: the handoff ends your
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
- **Release the claim, then block it.** `lit open <parked-id>`, then `lit dep add
  --from <new-id> --to <parked-id> --type blocks`. Claims outrank everything, so a
  parked ticket left `in_progress` is handed straight back to the next session and the
  blocks edge never gets a word in.
- **Read the park back before the bottle.** A good park makes `lit next` exit `code=6`
  naming the new work as the blocker. A `lit next` that names a ticket is the failure —
  both broken states name one, only the good one errors.
- **Name the first ticket in the bottle.** A bare `lit next` exits nonzero while the
  parked lane sits blocked; `/next` opens the fresh session on an error.
- **Stop at the launcher's line.** You filed the work. You do not start it.
