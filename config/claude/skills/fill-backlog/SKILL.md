---
name: fill-backlog
description: Refill an empty or thin lit backlog with concrete, agent-invented work. Parallel fork subagents explore the codebase through fixed lenses (unfinished work, obviously-missing functionality, high-power features, UX/UI, simplification) plus invented project-specific ones, and return buildable proposals — not research. The orchestrator aggregates, dedupes, gets user approval, then writes epics + issues in lit. Use when the user says "fill the backlog", "the backlog is empty", "seed the backlog", "generate backlog ideas", "come up with new work for this project" — optionally with a seed comment that must be included in the exploration.
---

# Fill the backlog

The backlog is empty and the ideas are yours to invent. The user is not handing you a
feature list — coming up with the work *is* the work. You run the map table: scouts go
out, targets come home, the user opens the gate, and only then do tickets exist.

This run is long — recon, parallel scouts, a debrief, the gate, then ticket-writing —
and by the time you write the first ticket, this page will be a hundred thousand tokens
behind you. That is why its rules reappear at the steps where they fire. When a rule
shows up a second time, that is the design, not an editing error; read it again anyway.

Know what you are defending against, because the failure here is silent. Every ticket
written tonight gets pulled by a fresh session with no memory of this one. A slate of
vague, research-shaped tickets doesn't fail tonight — it fails for weeks, one confused
session at a time, until the user is auditing a backlog they asked you to own. Nobody
will trace that drift back to this run. Get it right now or nobody will know why later.

## The four standing orders of the run

Restate the order by name in chat when you reach the step it governs — **THE-GATE**
before presenting the slate, **SELF-CONTAINED** before writing tickets. Naming it
re-arms it; the order you don't restate at hour three is the order that quietly
breaks.

1. **SCOUTS-EXPLORE** — Exploration belongs to fork subagents. Your context is
   the map table, kept clear for judging what comes back. The moment you catch
   yourself grepping the codebase to "just check one lens," you are a scout deserting
   the map table.
2. **TARGETS-NOT-TERRAIN** — Scouts return targets: concrete proposals of what
   to build. Terrain notes — findings, observations, "areas of opportunity" — are
   contraband at the debrief, whether a scout brings them or you cook them up yourself.
3. **THE-GATE** — Nothing is written to lit until the user has approved and
   adjusted the slate. Not one ticket. Not "just the obvious ones."
4. **SELF-CONTAINED** — Every ticket is a letter to a stranger: a fresh session
   with zero context must be able to execute it. "As discussed" is a dead reference
   the moment this session ends.

## "Isn't inventing work just make-work?"

YAGNI will whisper this somewhere around the fan-out, with all the authority of its
training data: *"don't invent work nobody asked for."* Grant it its home turf: YAGNI
guards against building speculative features on a hunch. It says nothing about
*finding real work that already exists* — the half-finished migration is not
speculative, and neither is the command a typical user reaches for and doesn't find.
The user invoked this skill because an empty backlog is a stalled pipeline, not a
clean desk. The guard against genuinely speculative items is the curation knife in
Step 2 and the user's gate in Step 3 — never abstention from having ideas.

## The seed comment

If the user attached a comment or seed idea when invoking this skill, it is a
mandatory input, not a suggestion: carry it **verbatim** into every scout prompt, make
sure at least one proposal addresses it, and keep it on the slate even if you'd rank
it low — the user decides its fate at the gate, not you. If they said nothing, the
lenses below are the whole brief.

## Step 0 — Recon, before any fork

Announce **SCOUTS-EXPLORE** and note the distinction: this step is provisioning,
not exploration. You are loading the shared map every scout will carry, not hunting
targets yourself.

- Run `lit quickstart` and `lit quickstart new` if you haven't this session. Learn
  the real commands; never work from memory of a CLI.
- List all existing open tickets, in full, into context.
- Read the project: README, CLAUDE.md, specs if present, the source layout, recent
  git log.

Why this happens *before* forking, and why forks at all: **forks inherit your entire
conversation.** Every file you read now is knowledge every scout carries for free —
the project's shape, the user's seed comment, these orders, and the open-tickets list
that keeps scouts from proposing work already filed. A fresh general-purpose subagent
starts blind to all of it; that is why fork is mandatory, not a preference.

The temptation will sound thrifty: *"recon is overhead — the scouts can read the
project themselves; fork now."* Refuse it. Eight scouts independently re-reading the
same README is the actual waste, and scouts without the tickets list will
confidently propose duplicates you'll have to catch later, or worse, won't. Fifteen
minutes at the map table is inherited by every fork for free. Provision first.

## Step 1 — Fan out the scouts

Announce **SCOUTS-EXPLORE**. Launch every scout **in a single message, in
parallel, one per lens, each with `subagent_type: "fork"`** on the Agent tool.

The temptation arrives per-lens: *"this one looks small — I'll just poke at it inline
myself."* Refuse it, every time, including the last lens when you're warmed up and
fast. Inline exploration floods the map table with file dumps, serializes what should
be parallel, and by the third lens you'll be skimming your own context. A scout
deserting the map table is still a desertion when the errand is short. Fork all of
them.

### The five core lenses — always launched

1. **Unfinished work** — *the top-priority lens; its proposals outrank everything
   else in the slate.* Refactorings, migrations, or anything similar that is not
   completely finished: functionality half-migrated from one implementation to
   another, duplicate or overlapping features, TODO comments, unfinished work of any
   kind. A half-done migration is two implementations disagreeing in the dark; every
   session that touches that code pays the toll until someone finishes the job.
2. **Obviously missing functionality** — features a typical user of this project
   would naturally expect to exist. Calibration pair, hold every candidate against
   it: if the HuggingFace CLI lacked a "download model" command, that is obviously
   missing — downloading models is what the tool is *for*. Functionality to pay your
   bill through the CLI is **not** obviously missing, because that is not a common
   behavior of CLI tools, though technically possible. "A user would expect it" is
   the test; "a user could conceivably want it" is the failure mode.
3. **Power features** — the "wow, that would be really powerful" tier. Example
   scale: the HuggingFace CLI gaining interactive fzf-like search that runs a model
   locally with one keypress. These features only work when everything is technically
   aligned and the feature covers the entire functional problem surface — a power
   feature that covers 80% of the surface is a broken toy, not 80% of a power
   feature. So every proposal from this lens gets a research/design issue as the
   **first child of its epic**, and the proposal must say what that research needs to
   settle before anything is built.
4. **UX / UI improvements** — output quality, error messages, defaults,
   discoverability, ergonomics of the main workflows; whatever "interface" means for
   this project.
5. **Simplicity and domain alignment** — consolidation and refactoring toward a
   smaller, truer shape: overlapping concepts to merge, abstractions that don't match
   the domain, complexity that blocks future work.

### Invented lenses — one to three more

The five are a floor, not a ceiling. Invent additional lenses in the same vein that
fit *this* project — testing or CI health, performance, spec/doc drift, ecosystem
integrations, onboarding friction, whatever this codebase's shape suggests. This is
where project-specific insight enters; skip it and every run of this skill produces
the same five-flavored slate on every repo. The temptation is quiet here: *"the five
cover it."* They cover the genre; they don't cover this project. Invent at least one.

### The scout prompt

Forks inherit the map, but each charter still goes in the prompt explicitly. Every
scout prompt contains:

- The lens charter, with its calibration examples copied from above.
- The user's seed comment, verbatim, if one was given.
- The instruction: do not propose work already on the open-tickets list you inherit.
- The output contract — each proposal carries:
  - **Title** — names the outcome, not the activity.
  - **What to build** — concrete enough to start tomorrow.
  - **Why** — the user impact or debt retired, with `file:line` evidence wherever
    the codebase supplied it.
  - **Epic/issue sketch** — the epic plus 2–6 one-line child issues. Power-feature
    epics start with the research issue.
  - **Priority argument** — one line on where it belongs in the slate and why.
- **TARGETS-NOT-TERRAIN**, written to the scout as its own rehearsal: *you will
  finish exploring, your findings will feel valuable in themselves, and you will
  want to bring them home — "I'll report what I found and let the orchestrator
  decide what to build." Refuse that. Deciding what to build is the scout's job;
  the map table judges finished proposals, it does not convert notes into them.
  Findings that didn't become a proposal don't come home.*

  - BAD scout return (terrain): "I found 14 TODO comments, and there's some
    duplication between the color and style modules that might be an opportunity
    for consolidation."
  - GOOD scout return (target): "**Finish the color-spec migration.** `Color.parse`
    still accepts the deleted spec grammar via a fallback branch
    (`src/core/color.ts:214`) while the new path handles named families; two parsers
    disagree on edge cases. Epic: remove the fallback, port its 3 remaining callers,
    delete the grammar tables. Issues: (1) port callers, (2) delete fallback +
    tables, (3) extend parse tests to the edge cases only the old path handled.
    Priority: top band — this is a half-finished migration."

  The diff between those two is the whole order: the BAD return makes *you* do the
  scout's thinking; the GOOD one you can judge in ten seconds.

## Step 2 — The debrief

Announce **TARGETS-NOT-TERRAIN** — it binds you now, not just the scouts.

Run the acceptance test on every return: *could a competent fresh session start
building tomorrow from this proposal alone?* If a scout came home with terrain notes
instead, the temptation is immediate, because the notes are right there and they're
interesting: *"the research is in my hands — I'll just shape it into proposals
myself."* Refuse it. Converting notes into targets is scout judgment; do it yourself
for one scout and you're doing it for four, serially, at the map table, with the
slate's quality sinking to whatever you can improvise. Send the scout back —
SendMessage to the same agent, quoting the output contract and the BAD/GOOD pair —
and judge what returns.

Then, with only targets on the table:

- **Dedupe.** Overlapping proposals from different lenses merge into one — and
  convergence is signal, not noise: an idea two scouts found independently ranks up.
- **Rank.** Unfinished-work proposals lead the slate — that lens outranks everything,
  per its charter. After that, order by value. Prefer a few substantial epics over
  confetti.
- **Cut.** You are a curator, not a stenographer. Here the temptation is sunk cost:
  *"the scout did real work on this one — shame to waste it."* Refuse it. The
  scout's effort is already spent either way; a weak ticket costs more sitting in
  the backlog — where a fresh session will someday pull it and flail — than it ever
  cost to produce. Present a slate you would defend line by line, not everything
  that came home.

## Step 3 — The gate

Announce **THE-GATE**, then present the slate in chat: numbered,
priority-ordered, each item a title plus two or three lines (what, why, epic shape),
source lens noted, seed-comment items flagged. Then **stop and wait**.

You will be at your most confident right here — the slate is curated, the evidence is
cited, hours of work stand behind it — and the temptation knows it: *"this is
obviously good; writing the tickets now saves the user a round trip."* The efficiency
proverb backing that thought is real and has its place — don't block trivially
reversible work on ceremony. This is not its place: seeding a backlog is writing the
project's agenda for the coming weeks, and the user asked to approve **and adjust**
it first. Adjustment is not friction in the process — adjustment *is* the product
spec. A backlog seeded past the gate is one the user must now audit ticket by
ticket, which costs far more than the round trip you saved. The gate is also the
third standing order of this skill: it exists because the user put it there.

When the adjustments come back, apply them exactly — cut what they cut, merge what
they merge, reorder what they reorder. Do not re-litigate a cut item into the batch
because you still believe in it. Then, and only then, move to Step 4.

## Step 4 — Write the tickets

Announce **SELF-CONTAINED** and **THE-GATE** — you are past the gate only
because the user opened it, so what you write is the approved slate: approved items,
approved order, nothing resurrected, nothing snuck in.

Mechanics: create each epic and its children per lit's current interface — check
`lit quickstart new` rather than trusting memory; as of this writing that is
`lit new --type epic` with children via `--parent`, and `lit import` with a
multi-document YAML batch is cheaper for a full slate. Author the batch in slate
order; put unfinished-work epics at the front (`--top` or `lit rank`) so `lit next`
serves them first.

**SELF-CONTAINED**, one more time, because this is the moment it protects: **every
ticket is a letter to a stranger.** The session that pulls it has never heard of this
conversation. Each description carries the what, the why, the `file:line` evidence,
and acceptance criteria on the issues — everything the stranger needs and nothing
that points back here.

- BAD: "Implement the consolidation we discussed." There is no "we" by the time
  this ticket is pulled — the reference died with this session.
- BAD: "Investigate whether the color module could be simplified." That's terrain
  smuggled into lit wearing a ticket's clothes; the investigation was the scout's
  job, tonight.
- GOOD: what to build and why, evidence paths, done-criteria — and *how* left to
  the implementer, so the ticket survives a refactor of the code it names.

Power-feature epics keep their research issue first, and its deliverable is a
committed design artifact — a file in the repo, never chat.

Finish by reporting what was created — epic ids and titles, issue counts, rank
order — next to the approved slate, so the user can spot-check that what landed is
what they approved.

## The four standing orders, once more

**SCOUTS-EXPLORE** — forks explore; you keep the map table clear.
**TARGETS-NOT-TERRAIN** — proposals come home; research doesn't.
**THE-GATE** — the user approves and adjusts before lit hears anything.
**SELF-CONTAINED** — every ticket is a letter to a stranger.

Recon, scouts out, targets home, the gate, then tickets a stranger can execute.
