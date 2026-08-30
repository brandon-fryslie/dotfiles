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
- **Kind** — *what sort of statement* each detail is. Kind, not volume, decides whether a
  detail belongs at all, and each kind's treatment is fixed, identical at every tier.

### The four kinds of detail

Every sentence in a ticket points one of two ways: **backward at the implementation as it
stands**, or **forward at the outcome being targeted**. Backward-pointing text decays as
the code moves; forward-pointing text is what the work steers by. Four kinds:

- **References** point backward: code locations (a file, a function, a line, a pasted
  snippet) and, just as much, observations of current behavior ("currently renders X",
  "the fault is in the retry path"). Both describe *now*, and now moves — the moment any
  ticket lands, every reference elsewhere may silently be a lie.
- **Specifications** point forward: what the thing must do — behavior, inputs, outputs,
  exact values. A spec references nothing; it *is* the target. The code moves toward it,
  so it cannot drift when neighboring tickets land, and its precision is unbounded:
  "reject unknown keys, naming the offending key in the error" is not too granular — it
  is the requirement.
- **Constraints** are specifications of the solution's properties rather than its
  behavior — dependency budget, performance bounds, compatibility — with the same
  durability and the same unbounded precision.
- **Anchors** cite the ground truth a spec or constraint derives from, and only count
  when pinned: a specific document at a specific commit, or an otherwise immutable
  artifact. An unpinned "see the design doc" is no anchor — it is a reference, and it
  decays like one.

The kinds are a lens, not a template — they judge detail a ticket already carries, never
a schema of sections to fill in. The pull will come: *"every ticket should get a
constraints line and an anchor."* Refuse it: every addition is pollution, and subtraction
is polishing.

### The reference ceiling (hard rule, all tiers)

**The maximum granularity of a reference is a specific file name. Nothing finer — ever.**
No function names. No line numbers. No code or pseudocode. No method signatures. Naming a
file is the floor of the implementer's map and stable enough to survive; anything finer is
a pointer into a moving artifact — a divergent copy of the implementation that rots the
instant the code shifts, and a theft of the implementer's pull-time judgment besides.

The ceiling does **not** rise as a ticket nears the top. A next-up ticket becomes *more
complete* — sharper spec, acceptance criteria, which files are in play — never more deeply
referenced. "Make the parser reject unknown keys, in `config/loader.ts`" is as deep as a
reference goes; "add an `if (!allowed.has(k)) throw` to `validateKeys()`" is over the
line — not because it is precise, but because it points into the implementation. Precision
was never the offense; direction is.

When grooming, sub-file references are **contamination, not raw material**. A ticket that
held them is presumed stale: once its pointers have drifted you cannot trust the intent
they implied, and refining the text upward just launders rot into something that *looks*
trustworthy. Recover the **intent**, verify it against the current code, and re-express it
as specification — regenerate from intent; never translate the stale text. Observations
get the adjacent treatment: re-verify them against reality and keep only what holds — an
observation nobody verified is speculation wearing evidence's clothes. Specifications and
constraints are the one thing this pass never trims: shaving their precision is damage,
not grooming.

### Completeness by tier

Calibrate by tier, and **rewrite bodies to hit the tier** (enrich the thin, trim the bloated).
The kind rules above hold at every tier — these only set *completeness*:

- **Top / next-up** (pullable, near the top of rank): implementer-ready. Must carry the
  problem, the *why*, concrete acceptance criteria, and the constraints/links needed to
  start cold. Stops short of implementation design — that's pull-time work, not grooming.
- **Mid backlog**: rankable and scoped. Problem statement, rough size, why it matters.
  Acceptance criterion can be a single line. No deep detail.
- **Deep backlog**: just enough to be rankable and not lost — a sharp title and a sentence
  or two of problem. **Strip references and speculative design**; they will be wrong by the
  time the ticket rises. A spec already written down keeps its precision — sparseness comes
  from carrying fewer things, not vaguer ones.

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
   ticket that lacks one. *Kind:* enforce the reference ceiling on **every** ticket. When a
   ticket carries sub-file references — function names, line numbers, code — treat them as
   stale: recover the **intent** they served, verify it against the current code, and
   re-express it as specification. Re-verify observations; discard any that no longer hold
   or never carried evidence. Pin unpinned anchors to a commit, or drop them. Leave
   specification and constraint precision untouched — trimming a spec is damage, not
   grooming. Kind violations are independent of tier; a deep-backlog ticket can be
   over-referenced, and a next-up ticket is still capped at file names.

5. **Urgent flag.** Ensure `--priority 1` is set only on genuine exceptions; clear it
   elsewhere.

6. **Commit.** Commit the work (lit persists its own data; still leave the tree clean).

## Report (always, since changes were applied without a checkpoint)

End with a terse audit so the user can review or undo:

- **Reranked:** each move as `#id: rank A → B` with a one-line why.
- **Closed:** each `#id (reason)` — recoverable via `lit open`.
- **Rewritten:** which tickets were re-detailed — completeness direction (enriched / trimmed)
  and any kind fixes (sub-file references discarded and re-expressed as specification;
  observations re-verified or dropped; anchors pinned). Note any ticket whose intent could
  not be confirmed against the code — that's a "needs your call", not a silent rewrite.
- **Structure:** blocks/deps/parentage changed.
- **Needs your call:** deletion candidates, genuinely ambiguous priorities, tickets that
  need design input before they can be made implementer-ready. These are *not* actioned.

If the backlog was already clean, say so plainly — a no-op is a valid, good outcome.
