---
name: groom-backlog
description: Groom the lit backlog — make the rank order defensible, right-size every ticket's detail to its distance from being pulled, fix structural lies (false blocks, missing deps, wrong parentage), and close dead tickets. Runs fully autonomously and reports what changed. Use when the user says "groom the backlog", "clean up the backlog", "prioritize the tickets", "the backlog is a mess", "review the backlog", "re-rank the tickets", "make sure tickets have the right level of detail", or wants the queue made trustworthy before picking up work. Optionally scope to one epic or topic by passing its id/slug.
---

# Groom Backlog

Turn a drifting `lit` backlog into a trustworthy, rank-ordered queue where every
ticket carries exactly the detail its position warrants — no more, no less.

A groomed backlog is a **fixpoint**: run this skill twice in a row and the second
run changes almost nothing. That property is the success criterion. If your second
pass would churn rank or rewrite bodies again, the first pass over- or under-reached.

## Init

Run `lit quickstart` if you haven't this session — it defines the commands below.
Then read the whole working set before changing anything: `lit backlog` (full
rank-ordered view with the dependency rationale) and `lit ready` (what's actually
pullable). For every epic in scope, `lit show <epic-id>` prints its plan.

**Scope:** default is the entire workable backlog. If the user passed an epic id or
topic slug, restrict every pass to that subtree / topic and say so in the report.

## What "groomed" means

These are the invariants. Each pass below establishes one. Don't groom ticket-by-ticket
top-to-bottom — rank is *relative*, so build the global picture first, then mutate.

1. **Rank is a defensible total order.** Position relative to neighbors is justified;
   no cosmetic ties. Rank is the one source of truth for priority — never write
   "Priority: High" into a description. That duplicates rank and immediately drifts.
2. **The urgent flag (`--priority 1`) is a rare exception**, not a sorting field.
   Reserve it for genuinely drop-everything work. If many tickets are "urgent", none are.
3. **Detail is calibrated to distance-from-pull** (the core judgment — see below).
4. **Structure doesn't lie.** Blocked items are *really* blocked; missing dependency
   edges that should gate readiness are added; parentage and epic membership are correct.
   `lit ready` must be trustworthy — a backlog whose "ready" is wrong is worse than none.
5. **Every near-term ticket has a verifiable "done"** — a concrete acceptance criterion
   a deterministic check could judge. No testable done → not groomed, however nice the prose.
6. **Dead tickets are closed**, not carried.

## The core judgment: detail has two independent axes

Detail is not one dial. Two orthogonal axes govern it, and they move independently:

- **Completeness** — *how filled-in* a ticket is. This varies by distance-from-pull (the
  tiers below). A far-off ticket is sparse; a next-up ticket is complete.
- **Granularity** — *how deep into the "how"* a ticket is allowed to go. This is a **fixed
  ceiling that never rises**, identical for every ticket regardless of tier.

### The granularity ceiling (hard rule, all tiers)

**The maximum granularity in any ticket is a specific file name. Nothing more granular —
ever.** No function names. No line numbers. No code or pseudocode. No method signatures.

A ticket describes **functionality, capability, behavior, outcome** — the *what*. The code
is the one source of truth for the *how*. The moment a ticket names a function or pastes a
snippet, it becomes a divergent copy of the implementation that rots the instant the code
moves, and it steals the implementer's pull-time judgment. Naming a file is the floor of
the implementer's map and is stable enough to survive; anything below it is the work itself,
not a description of it.

This ceiling does **not** rise as a ticket nears the top. A next-up ticket becomes *more
complete* — clearer outcome, acceptance criteria, possibly which files are in play — but
never *more granular*. "Make the parser reject unknown keys, in `config/loader.ts`" is the
deepest a ticket goes; "add an `if (!allowed.has(k)) throw` to `validateKeys()`" is over the
line. (Capability / functionality / file name are *examples* of the general rule — describe
the what, cap granularity at file — not a required schema to fill in.)

When grooming, this ceiling means most "too-detailed" tickets are *also too granular*:
trimming them is partly shortening and partly **translating code-level detail back up into
capability language**, deleting the function/line/code references entirely.

### Completeness by tier

Calibrate by tier, and **rewrite bodies to hit the tier** (enrich the thin, trim the bloated).
The granularity ceiling above applies at every tier — these only set *completeness*:

- **Top / next-up** (pullable, near the top of rank): implementer-ready. Must carry the
  problem, the *why*, concrete acceptance criteria, and the constraints/links needed to
  start cold. Stops short of implementation design — that's pull-time work, not grooming.
- **Mid backlog**: rankable and scoped. Problem statement, rough size, why it matters.
  Acceptance criterion can be a single line. No deep detail.
- **Deep backlog**: just enough to be rankable and not lost — a sharp title and a sentence
  or two of problem. **Strip speculative implementation detail**; it will be wrong by the
  time the ticket rises.

For epics: the epic holds the plan and shared context; children hold the work. Don't copy
the epic's context into every child — that's a second source of truth that drifts.

## Where grooming stops

Grooming shapes the queue and each ticket's framing. It does **not** solve the tickets.
Writing implementation design into a description is front-running the work and over-detailing
by definition. If a top ticket genuinely can't be made implementer-ready without design
decisions, that's a `needs-design` block to surface — not a place to invent the solution.

## Passes (run in this order, then commit)

1. **Structural.** Fix the graph first, because it determines what's truly ready and
   therefore how rank should read. Remove false blocks (`lit label rm <id> needs-design`
   where the blocker is gone), add real dependency edges (`lit dep add <blocker> <blocked>
   --type blocks`) so unstartable work stops surfacing as ready, correct parentage
   (`lit parent set`). Topic is immutable — never try to change it.

2. **Staleness.** Identify obsolete / already-done / duplicate tickets and **close** them
   (`lit close <id> --reason "..."`; reason = wontfix | obsolete | duplicate). Close is
   reversible (`lit open`), so it's safe to do autonomously — the report is the undo trail.
   **Never `delete` autonomously.** If something looks like it should be deleted rather than
   closed, leave it and list it under "needs your call" in the report.

3. **Rank.** Produce the defensible total order with `lit rank` (`--top`/`--bottom`/
   `--above`/`--below`). **Minimal churn:** only move what's actually mis-ranked. Leaving a
   correctly-placed ticket alone is the right action, not a skipped one — that's what makes
   the skill a fixpoint.

4. **Detail calibration.** For each surviving ticket, rewrite the description to fit
   (`lit update <id> --description "..."`) along both axes. *Completeness:* enrich the thin
   top, trim the bloated deep, add a verifiable acceptance criterion to every near-term
   ticket that lacks one. *Granularity:* enforce the file-name ceiling on **every** ticket —
   strip function names, line numbers, and code, translating that detail back up into
   capability/behavior language. Granularity violations are independent of tier; a deep-backlog
   ticket can be too granular, and a next-up ticket is still capped at file names.

5. **Urgent flag.** Ensure `--priority 1` is set only on genuine exceptions; clear it
   elsewhere.

6. **Commit.** Commit the work (lit persists its own data; still leave the tree clean).

## Report (always, since changes were applied without a checkpoint)

End with a terse audit so the user can review or undo:

- **Reranked:** each move as `#id: rank A → B` with a one-line why.
- **Closed:** each `#id (reason)` — recoverable via `lit open`.
- **Rewritten:** which tickets were re-detailed — completeness direction (enriched / trimmed)
  and any granularity fixes (code/function/line detail translated up to capability language).
- **Structure:** blocks/deps/parentage changed.
- **Needs your call:** deletion candidates, genuinely ambiguous priorities, tickets that
  need design input before they can be made implementer-ready. These are *not* actioned.

If the backlog was already clean, say so plainly — a no-op is a valid, good outcome.
