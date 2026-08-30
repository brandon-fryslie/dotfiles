---
name: fill-backlog
description: Refill an empty or thin lit backlog with concrete, agent-invented work. Parallel fork subagents explore the codebase through fixed lenses (unfinished work, obviously-missing functionality, high-power features, UX/UI, simplification) plus invented project-specific ones, and return buildable proposals — not research. The orchestrator aggregates, dedupes, gets user approval, then writes epics + issues in lit. Use when the user says "fill the backlog", "the backlog is empty", "seed the backlog", "generate backlog ideas", "come up with new work for this project" — optionally with a seed comment that must be included in the exploration.
---

# Fill the backlog

The backlog is empty and the ideas are yours to invent. The user is not handing you a
feature list — coming up with the work *is* the work. You orchestrate: scouts explore,
you curate, the user approves, and only then does anything land in lit.

If the user attached a comment or seed idea when invoking this skill, it is a mandatory
input: carry it verbatim into every scout prompt and make sure at least one proposal
addresses it. If they said nothing, the lenses below are the whole brief.

## Ground rules

1. **Scouts explore; you orchestrate.** Exploration goes to fork subagents, run in
   parallel. Your context is the aggregation workspace — keep it clean for judging.
2. **Scouts return targets, not terrain notes.** Every scout comes back with concrete
   proposals of what to build. Raw research, observations, and "areas of opportunity"
   are contraband at the debrief.
3. **Nothing is written to lit until the user approves the slate.** No exceptions.
4. **Approved items become epics + issues in lit**, self-contained enough for a fresh
   session with zero context to execute.

## Step 0 — Orient

- Run `lit quickstart` and `lit quickstart new` if you haven't this session — learn the
  real commands; don't work from memory of them.
- List existing open tickets. Even a "thin" backlog has some; scouts must not propose
  work that's already ticketed, so you need this list in context before forking.
- Read the project into your own context: README, CLAUDE.md, specs if present, the
  source layout, recent git log. Do this **before** forking — forks inherit your entire
  conversation, so every file you read now is knowledge every scout carries for free.
  This shared base is the reason forks are required: a fresh subagent starts blind to
  the project, the user's seed comment, and these rules.

## Step 1 — Fan out the scouts

Launch the scouts **in parallel, one per lens, each with `subagent_type: "fork"`** on
the Agent tool. Fork is not optional — the user requires scouts that understand the
entire context, and fork is the mechanism that provides it.

The temptation, in your own voice: *"this lens looks small — I'll just explore it
inline myself."* Refuse it. Inline exploration floods the aggregation workspace with
file dumps, serializes what should be parallel, and by the third lens you'll be
skimming. Fork every lens, even the one that looks trivial.

### The five core lenses — always launched

1. **Unfinished work** — *the top-priority lens.* Refactorings, migrations, or anything
   similar that isn't completely finished: functionality half-migrated from one
   implementation to another, duplicate or overlapping features, TODO comments,
   unfinished work of any kind. Proposals from this lens outrank everything else in the
   final slate.
2. **Obviously missing functionality** — features a typical user of this project would
   naturally expect to exist. Calibration pair: if the HuggingFace CLI lacked a
   "download model" command, that's obviously missing — downloading models is what the
   tool is for. Functionality to pay your bill through the CLI is *not* obviously
   missing, because that's not a common behavior of CLI tools, though technically
   possible. Hold every candidate against this pair.
3. **Power features** — the "wow, that would be really powerful" tier. Example scale:
   the HuggingFace CLI gaining interactive fzf-like search that runs a model locally
   with one keypress. These only work when everything is technically aligned and the
   feature covers the entire functional problem surface — so every proposal from this
   lens must have a research/design issue as the first child of its epic, and the
   proposal must say what that research needs to settle.
4. **UX / UI improvements** — output quality, error messages, defaults, discoverability,
   ergonomics of the main workflows; whatever "interface" means for this project.
5. **Simplicity and domain alignment** — consolidation and refactoring toward a smaller,
   truer shape: overlapping concepts to merge, abstractions that don't match the
   domain, complexity that blocks future work.

### Invented lenses — one to three more

The five lenses are a floor, not a ceiling. Invent additional lenses in the same vein
that fit *this* project — testing or CI health, performance, spec/doc drift, ecosystem
integrations, onboarding friction, whatever the project's shape suggests. Skipping this
step means every run of this skill produces the same five-flavored slate regardless of
the project; the invented lenses are where project-specific insight enters.

### The scout prompt

Forks inherit your context, but the charter still goes in the prompt explicitly. Each
scout prompt contains:

- The lens charter, including its calibration examples from above.
- The user's seed comment, verbatim, if one was given.
- The list of existing open tickets (or a pointer to where you loaded it), with the
  instruction: do not propose work already ticketed.
- The output contract — each proposal has:
  - **Title** — names the outcome, not the activity.
  - **What to build** — concrete enough that you could start tomorrow.
  - **Why** — the user impact or debt retired, with evidence (`file:line`) where the
    codebase supplied it.
  - **Epic/issue sketch** — the epic plus 2–6 one-line child issues. Power-feature
    epics start with a research issue.
  - **Priority argument** — one line on where it belongs in the slate and why.
- The debrief rule, stated to the scout as its own temptation: you will finish
  exploring, your findings will feel valuable in themselves, and you will want to
  return them — *"I'll report what I found and let the orchestrator decide what to
  build."* Refuse it. Deciding what to build is the scout's job; the orchestrator
  judges finished proposals, it does not convert notes into them. Findings that
  didn't become a proposal don't come home.

  - BAD scout return: "I found 14 TODO comments, and there's some duplication between
    the color and style modules that might be an opportunity for consolidation."
  - GOOD scout return: "**Finish the color-spec migration.** `Color.parse` still
    accepts the deleted spec grammar via a fallback branch (`src/core/color.ts:214`)
    while the new path handles named families; two parsers disagree on edge cases.
    Epic: remove the fallback, port its 3 remaining callers, delete the grammar
    tables. Issues: (1) port callers, (2) delete fallback + tables, (3) extend parse
    tests to cover the edge cases only the old path handled. Priority: top band —
    this is a half-finished migration."

## Step 2 — Aggregate and curate

When the scouts report:

- **Dedupe.** Overlapping proposals from different lenses merge into one — and
  convergence is signal: an idea two lenses found independently ranks up.
- **Rank.** Unfinished-work proposals lead the slate; after that, order by value.
  Within the slate, prefer a few substantial epics over confetti.
- **Cut.** You are a curator, not a stenographer. Weak, speculative, or
  project-misfit proposals die here — present a slate you'd defend, not everything
  the scouts brought home.

## Step 3 — The approval gate

Present the slate to the user in chat: numbered, priority-ordered, a title plus two or
three lines each (what, why, epic shape), with its source lens noted. Then stop and
wait for approval and adjustments.

This is a hard gate. The temptation: *"the slate is obviously good — writing the
tickets now saves a round trip."* Refuse it. The user asked to approve **and adjust**
before anything is written; a backlog seeded without that pass is a backlog they now
have to audit, which costs more than the round trip saved. Cut, reorder, and merge per
their adjustments, and only then write.

## Step 4 — Write to lit

For each approved item, create the epic and its child issues (`--type epic`, children
via `--parent`; `lit import` with a YAML batch is cheaper for a full slate — check
`lit quickstart new` for the current interface). Then:

- **Self-contained tickets.** Each ticket will be executed by a fresh session with no
  memory of this one. Descriptions carry the what, the why, the evidence paths, and
  acceptance criteria on the issues. BAD: "implement the consolidation we discussed."
  There is no "we" by the time the ticket is pulled.
- **Describe what and why; leave how to the implementer** — write what survives a
  refactor of the code it concerns.
- **Order = approved rank.** Author the batch in slate order; put unfinished-work
  epics at the front (`--top` or `lit rank`) so `lit next` serves them first.
- **Power-feature epics start with their research issue**, whose deliverable is a
  committed design artifact — not chat.

Finish by reporting what was created: epic ids and titles, issue counts, and the rank
order — so the user can spot-check the result against the slate they approved.
