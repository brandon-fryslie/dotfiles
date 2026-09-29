---
name: groom-backlog
description: Groom the lit backlog — make the rank order defensible, complete the graph (a blocker with no ticket that clears it gets one, an epic with no workable path to its checkpoint gets children, an unknown gets a spike), fold the padding back into neighbors, right-size every ticket's detail to its distance from being pulled, fix structural lies (false blocks, missing deps, wrong parentage), and close dead tickets. Runs fully autonomously and reports what changed. Use when the user says "groom the backlog", "clean up the backlog", "prioritize the tickets", "the backlog is a mess", "review the backlog", "re-rank the tickets", "make sure tickets have the right level of detail", "the epic has no workable tickets", "expand this epic", "what's blocking this and where's the ticket for it", or wants the queue made trustworthy and complete before picking up work. Optionally scope to one epic or topic by passing its id/slug.
---

# Groom Backlog

Turn a drifting `lit` backlog into a trustworthy, rank-ordered queue where every
ticket carries exactly the detail its position warrants — no more, no less — and
where the graph is whole: every blocker has the ticket that clears it, every epic has
children that reach its checkpoint, and nothing stands that a neighbor already covers.

A groomed backlog is a **fixpoint**: run this skill twice in a row and the second
run changes almost nothing — it adds no ticket, folds no ticket, and barely touches
rank or bodies. That property is the success criterion. If your second pass would
churn rank, rewrite bodies, or re-create something the first pass removed, the first
pass over- or under-reached.

## Init

Run `lit quickstart` if you haven't this session — it defines the commands below.
Then read the whole working set before changing anything: `lit backlog` (full
rank-ordered view with the dependency rationale; blocked rows are shown inline, so
what is pullable is what carries no blocked line). For every epic in scope,
`lit show <epic-id>` prints its plan, and `lit show <id>` on every open ticket is
where the detail pass's judgments come from.

**Scope:** default is the entire workable backlog. If the user passed an epic id or
topic slug, restrict every pass to that subtree / topic and say so in the report.

## What "groomed" means

These are the invariants. Each pass below establishes one. Don't groom ticket-by-ticket
top-to-bottom — rank is *relative*, so build the global picture first, then mutate.

1. **Rank is a defensible total order.** Position relative to neighbors is justified;
   no cosmetic ties. Rank is the one source of truth for priority — never write
   "Priority: High" into a description. That duplicates rank and immediately drifts.
2. **The urgent flag (`--priority urgent`) is a rare exception**, not a sorting field.
   Reserve it for genuinely drop-everything work. If many tickets are "urgent", none are.
3. **Detail is calibrated to distance-from-pull** (the core judgment — see below).
4. **Structure doesn't lie — by commission or omission.** Blocked items are *really*
   blocked; missing dependency edges that should gate readiness are added; parentage
   and epic membership are correct. And the graph is *complete*: a `needs-design`
   label with no ticket that will ever remove it, an epic whose checkpoint no child
   reaches, a next-up ticket that turns on a fact nobody holds — each is a lie told by
   what is missing. `lit ready` must be trustworthy — a backlog whose "ready" is wrong
   is worse than none, and a backlog whose "blocked" has no exit is a wall painted to
   look like a door.
5. **Every near-term ticket has a verifiable "done"** — a concrete acceptance criterion
   a deterministic check could judge. No testable done → not groomed, however nice the prose.
6. **Dead tickets are closed**, not carried — and **padding is folded**, not carried: a
   ticket whose only contribution is a boundary between itself and its neighbor moves
   its criteria into that neighbor and closes as its duplicate.

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
- **Acceptance criteria** point forward: what the thing must do — behavior, inputs,
  outputs, exact values. A criterion references nothing; it *is* the target. The code
  moves toward it, so it cannot drift when neighboring tickets land, and its precision is
  unbounded: "reject unknown keys, naming the offending key in the error" is not too
  granular — it is the requirement.
- **Constraints** are acceptance criteria on the solution's properties rather than its
  behavior — dependency budget, performance bounds, compatibility — with the same
  durability and the same unbounded precision.
- **Anchors** are citations of a document that anchors the behavior being targeted — a
  spec, a design doc, an architecture doc — and only count when pinned: a specific
  document at a specific commit, or an otherwise immutable artifact. An unpinned "see the
  design doc" is no anchor — it is a reference, and it decays like one.

The kinds are a lens, not a template — they judge detail a ticket already carries, never
a schema of sections to fill in. The pull will come: *"every ticket should get a
constraints line and an anchor."* Refuse it: inside a ticket, every addition is
pollution, and subtraction is polishing. (That rule governs detail *within* a ticket.
Whether a ticket should *exist* is the completeness pass's question, answered below —
don't let this sentence answer it for you.)

### The reference ceiling (hard rule, all tiers)

**The maximum granularity of a reference is a specific file name. Nothing finer — ever.**
No function names. No line numbers. No code or pseudocode. No method signatures. Naming a
file is the floor of the implementer's map and stable enough to survive; anything finer is
a pointer into a moving artifact — a divergent copy of the implementation that rots the
instant the code shifts, and a theft of the implementer's pull-time judgment besides.

The ceiling does **not** rise as a ticket nears the top. A next-up ticket becomes *more
complete* — sharper acceptance criteria, which files are in play — never more deeply
referenced. "Make the parser reject unknown keys, in `config/loader.ts`" is as deep as a
reference goes; "add an `if (!allowed.has(k)) throw` to `validateKeys()`" is over the
line — not because it is precise, but because it points into the implementation. Precision
was never the offense; direction is.

When grooming, sub-file references are **contamination, not raw material**. A ticket that
held them is presumed stale: once its pointers have drifted you cannot trust the intent
they implied, and refining the text upward just launders rot into something that *looks*
trustworthy. Recover the **intent**, verify it against the current code, and re-express it
as acceptance criteria — regenerate from intent; never translate the stale text.
Observations get the adjacent treatment: re-verify them against reality and keep only what
holds — an observation nobody verified is speculation wearing evidence's clothes.
Acceptance criteria and constraints are the one thing this pass never trims: shaving their
precision is damage, not grooming.

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
  time the ticket rises. A criterion already written down keeps its precision — sparseness
  comes from carrying fewer things, not vaguer ones.

For epics: the epic holds the plan and shared context; children hold the work. Don't copy
the epic's context into every child — that's a second source of truth that drifts.

## Grow, then prune — in that order, never blended

Here is why this skill has the shape it has. An agent has a natural tendency to add,
elaborate, fill, and grow. It has no natural tendency to subtract, trim, condense, or make
efficient. Ask it for "a complete backlog" and it grows one without limit; ask it for "a
lean backlog" and it never notices the epic with no path to its checkpoint. Neither
instinct can be trusted to hold the other in check *in the same pass*, because whichever
one is active writes the rules for that moment.

So the two directions run as **separate passes, in sequence**, and each pass is allowed
exactly one direction:

- The **completeness pass** grows. Its only question is *what must exist for the graph to
  be true* — and it may not prune, not even the ticket it just noticed is padding.
- The **fold pass** prunes. Its only question is *what could vanish into a neighbor with
  nothing lost* — and it may not add, not even the spike it just noticed is missing.

Grow first, so the fold has the whole to prune against. Then prune to **minimum viable
completeness**: the smallest set of tickets whose closing still makes every epic's
checkpoint true and every blocker's exit real. Not the minimum — the minimum *viable*.

You will want to blend them. Mid-completeness the thought arrives: *"while I'm here, these
two are obviously one ticket — I'll merge them now."* And mid-fold: *"this epic is clearly
missing a step — I'll add it while I have the context."* Refuse both. The moment one pass
does the other's work, it is doing that work under the wrong instinct — the grower merging
with a grower's leniency, the pruner adding with a pruner's stinginess — and the fixpoint
goes. Note it, finish the pass you are in, and let the next pass pick it up under its own
rules. A pass with two directions is a pass with no direction.

## Where grooming stops

Grooming shapes the queue, each ticket's framing, and the graph's completeness. It does
**not** solve the tickets. Writing implementation design into a description is
front-running the work and over-detailing by definition. The line is this: grooming
never writes a *solution*; it writes the *ticket that will produce one*. If a top ticket
genuinely can't be made implementer-ready because a decision is unmade or a fact is
unknown, that is not a place to invent the answer — it is a place to make sure the
ticket that *will* answer it exists, sits ahead of the work it informs, and says exactly
which question it settles. The completeness pass owns that.

## Passes (run in this order, then commit)

1. **Structural.** Fix the graph first, because it determines what's truly ready and
   therefore how rank should read. Remove false blocks (`lit label rm <id> needs-design`
   where the blocker is gone), add real dependency edges (`lit dep add --from <blocker>
   --to <blocked> --type blocks` — cross-epic or free-floating only; inside one epic,
   rank *is* the ordering signal and lit refuses the edge) so unstartable work stops
   surfacing as ready, correct parentage (`lit parent set --child <id> --parent <id>`).
   Topic is immutable — never try to change it.

2. **Staleness.** Identify obsolete / already-done / duplicate tickets and **close** them
   (`lit close <id> --resolution <obsolete|wontfix|duplicate|superseded> --reason "..."`;
   `duplicate` and `superseded` require `--of <canonical-id>`). Close is reversible
   (`lit open`), so it's safe to do autonomously — the report is the undo trail.
   **Never `delete` autonomously.** If something looks like it should be deleted rather
   than closed, leave it and list it under "needs your call" in the report.

3. **Completeness.** Grow the graph until it stops lying by omission. Three shapes, and
   only these three — each one is a place where `lit ready` or an epic's checkpoint is
   currently untrue:

   - **A block with no exit.** A `needs-design` / `needs-info` label, or a dependency on
     a decision, with no ticket whose closing removes it. Either the blocker is gone and
     the label comes off (that was pass 1), or a decision ticket is created that names
     the one question it settles, and the blocked ticket points at it — same epic: rank
     it above; different epic or free-floating: `lit dep add --type blocks`.
   - **An epic with no path.** An epic whose checkpoint (its `lit show` body) no open
     child reaches — zero children, or children that stop short of the checkpoint, or
     children all blocked with no sibling to close first. Children are written until a
     reader can trace from the ranked children to the checkpoint being true.
   - **A near-term ticket that turns on an unknown.** A top or next-up ticket that cannot
     be made implementer-ready in pass 6 because it needs a fact nobody holds — which of
     three libraries, whether the API tolerates X, what the existing tool does on Y. It
     gets a **spike**: one ticket, sized to answer the one question and record the answer
     where the blocked ticket will read it, ranked directly above the ticket it informs.

   The writing is delegated. Decomposing an epic is `laws:backlog` work and each ticket's
   text is `laws:prompt` work (a ticket is text a future agent reads); dispatch a **fresh
   general-purpose subagent — not a fork** — told to load those two skills and nothing
   else (a fork carries this session's loaded crafts into the ticket text, and the text
   comes out wrong). The prompt carries, verbatim:
   the epic's `lit show` body, its existing children's titles and rank, the gap you found
   in the words above, the output of `lit quickstart new`, and the reference ceiling from
   this document. It returns proposed tickets as text; **you** verify each proposed child
   is on the path to the checkpoint and each spike names exactly one question, then write
   them with `lit new --parent <epic> --topic <slug> --type <task|feature|bug|chore>
   --title "..." --description "..."` and rank them into place. Read the tickets it
   produced, not its summary of them.

   What completeness is **not** — this is the boundary that drifts, so hold it hard:

   - WRONG: "The loop will need logging eventually — I'll add a ticket for it."
     Nothing in the graph is false without that ticket. That is invention; it belongs to
     `fill-backlog`, not here.
   - WRONG: "This ticket is big — I'll split it into three for tidiness." Size is the
     detail pass's concern, and the fold pass will merge the three back.
   - WRONG: "The spike would take five minutes — I'll just answer the question in the
     description." That is writing the solution. Grooming writes the ticket that will.
   - RIGHT: a bug ticket carries `needs-design` and nothing in the backlog removes it;
     elsewhere sits "Decide once what this fork does with feature-gated dead code" →
     either that *is* the decision and gets a `blocks` edge to the bug, or it isn't and
     the decision ticket is created. One of the two makes the label honest.

   The proverb you will reach for is this document's own: *"every addition is
   pollution."* Grant it its ground — inside a ticket, it is exactly right, and pass 6
   enforces it. But a ticket the graph needs in order to be true is not an addition to
   anything; its absence is the pollution, and creating it is subtraction of a lie.

4. **Fold.** Prune to minimum viable completeness. The fold pass has **one operation**:
   move a ticket's acceptance criteria and constraints, at full precision, into a
   neighbor on the same path, then `lit close <id> --resolution duplicate --of
   <neighbor>`. It never closes without moving, and never moves across epics — the
   epic's checkpoint must stay provable from its own children.

   For each open ticket ask: *if this vanished and its criteria lived in its neighbor,
   what is lost?* If the answer is "one ticket boundary," fold it. If the answer names a
   real thing — a separate decision, a different reviewer, a stage that must land before
   the next can start — it stands.

   Two folds are forbidden because they destroy what the completeness pass just built:

   - **A spike never folds into the ticket it informs.** That puts the unknown back at
     pull time, which is the exact failure the spike exists to prevent. Spikes fold only
     into other spikes on the same path, when they are one question wearing two titles.
   - **Criteria never lose precision in the move.** A fold that shaves a criterion to
     make it fit the neighbor's body is damage — the detail pass's rule, enforced here.

   Now the number. The requester's calibration is that a grown backlog, pruned to minimum
   viable completeness, lands around **85% of the grown count** — roughly one ticket in
   seven folds. **That figure is a thermometer, not a thermostat.** It reads back on the
   completeness pass: fold nothing on a backlog that pass just grew and completeness
   likely under-reached; fold a third and it over-expanded. It is never a quota. The
   temptation, and it will feel like diligence: *"I've folded two of forty — I need four
   more to hit 85%."* Refuse it. A fold that has to be hunted for is a fold that loses
   something, and you will find out what it lost when the implementer does. On a second
   run over an already-groomed backlog, zero folds is not a miss — it is the fixpoint.

   - WRONG: "'Pick the session driver to copy' and 'The copied driver runs one session'
     — I'll close the pick, it's obvious which one." (Closed without moving; the
     "which driver, and why" criterion is gone.)
   - RIGHT: the copy ticket's criteria gain the line "the driver copied is <path>, chosen
     because <the pick's criterion>"; the pick closes `--resolution duplicate --of <the
     copy ticket>`. Or the pick stands, because choosing the driver is a decision someone
     reviews before code is copied — and the report says which and why.

5. **Rank.** Produce the defensible total order with `lit rank` (`--top`/`--bottom`/
   `--above`/`--below`). **Minimal churn:** only move what's actually mis-ranked. Leaving a
   correctly-placed ticket alone is the right action, not a skipped one — that's what makes
   the skill a fixpoint. Spikes and decision tickets created in pass 3 sit directly above
   the work they inform, not at the top of the backlog.

6. **Detail calibration.** For each surviving ticket, rewrite the description to fit
   (`lit update <id> --description "..."`) along both axes. *Completeness:* enrich the thin
   top, trim the bloated deep, add a verifiable acceptance criterion to every near-term
   ticket that lacks one. *Kind:* enforce the reference ceiling on **every** ticket. When a
   ticket carries sub-file references — function names, line numbers, code — treat them as
   stale: recover the **intent** they served, verify it against the current code, and
   re-express it as acceptance criteria. Re-verify observations; discard any that no longer
   hold or never carried evidence. Pin unpinned anchors to a commit, or drop them. Leave
   acceptance-criterion and constraint precision untouched — trimming a
   criterion is damage, not grooming. Kind violations are independent of tier; a
   deep-backlog ticket can be over-referenced, and a next-up ticket is still capped at
   file names. Tickets that received a fold in pass 4 are re-read here as one body, so the
   merged criteria read as one ticket and not two stapled together.

7. **Urgent flag.** Ensure `--priority urgent` is set only on genuine exceptions; clear it
   elsewhere.

8. **Commit.** Commit the work (lit persists its own data; still leave the tree clean).

## Report (always, since changes were applied without a checkpoint)

End with a terse audit so the user can review or undo:

- **Reranked:** each move as `#id: rank A → B` with a one-line why.
- **Closed:** each `#id (resolution)` — recoverable via `lit open`.
- **Created:** each new ticket as `#id — <title>`, which of the three completeness shapes
  it fills (block with no exit / epic with no path / near-term unknown), and what it
  informs or unblocks. A created ticket the user disagrees with is a `lit close` away.
- **Folded:** each `#id → #target`, with the one-line answer to "what would be lost" that
  came back as "nothing but a boundary." Then the reading: folded N of M grown, and
  whether that says completeness reached, under-reached, or over-reached.
- **Rewritten:** which tickets were re-detailed — completeness direction (enriched / trimmed)
  and any kind fixes (sub-file references discarded and re-expressed as acceptance
  criteria; observations re-verified or dropped; anchors pinned). Note any ticket whose
  intent could not be confirmed against the code — that's a "needs your call", not a
  silent rewrite.
- **Structure:** blocks/deps/parentage changed.
- **Needs your call:** deletion candidates, genuinely ambiguous priorities, a fold you
  could argue either way, an epic whose checkpoint is too vague to decompose against.
  These are *not* actioned.

If the backlog was already clean, say so plainly — a no-op is a valid, good outcome: no
ticket created, none folded, rank untouched. That is the fixpoint, and it is the goal.
