---
name: groom-backlog
description: Groom the lit backlog — correct the rank order, create missing tickets (a blocker with no ticket that clears it, an epic whose children don't reach its checkpoint, any other work the backlog needs), merge redundant tickets into their neighbors, set each ticket's level of detail by how close it is to being pulled, fix structural errors (false blocks, missing dependencies, wrong parentage), and close dead tickets. Runs autonomously and reports what changed. Use when the user says "groom the backlog", "clean up the backlog", "prioritize the tickets", "the backlog is a mess", "review the backlog", "re-rank the tickets", "make sure tickets have the right level of detail", "the epic has no workable tickets", "expand this epic", "what's blocking this and where's the ticket for it", or wants the queue made trustworthy and complete before picking up work. Optionally scope to one epic or topic by passing its id/slug.
---

# Groom Backlog

Groom a `lit` backlog into a rank-ordered queue where:

- the rank order is justified,
- the dependency graph is accurate and complete,
- each ticket has the level of detail its rank calls for,
- no ticket duplicates another, and
- dead tickets are closed.

**Success criterion: idempotence.** A second run immediately after the first should
change almost nothing: no tickets created or merged, little or no change to rank or
descriptions. If a second run would make substantial changes, the first run did too
much or too little.

## Setup

Run `lit quickstart` if you haven't this session; it documents the commands used
below. Read the full working set before changing anything:

- `lit backlog` — the rank-ordered view with dependency rationale. Blocked tickets
  show a blocked line; tickets without one are pullable.
- `lit show <epic-id>` for every epic in scope — its plan and checkpoint.
- `lit show <id>` for every open ticket.

**Scope:** the whole backlog by default. If the user passed an epic id or topic slug,
restrict every pass to that subtree or topic and state the scope in the report.

## Target state

The passes below establish these properties. Rank is relative, so read the whole
backlog before changing anything rather than grooming ticket by ticket from the top.

1. **Rank is a justified total order.** Each ticket's position relative to its
   neighbors has a reason; no arbitrary ties. Rank is the only record of priority —
   don't write "Priority: High" into a description, since it duplicates rank and goes
   stale.
2. **`--priority urgent` is rare.** Reserve it for drop-everything work. If many
   tickets are urgent, the flag means nothing.
3. **Detail matches rank** (see "Ticket detail").
4. **The graph is accurate and complete.** Blocked tickets are actually blocked;
   missing dependency edges are added; parentage and epic membership are correct.
   Every block has a ticket whose completion clears it, and every epic has children
   that reach its checkpoint. `lit ready` must be correct: a false "ready" sends an
   agent at work it can't start, and a block with no clearing ticket never clears.
5. **Every near-term ticket has a verifiable acceptance criterion** — something a
   deterministic check could judge.
6. **Dead tickets are closed and redundant tickets are merged.** A ticket whose only
   distinction from its neighbor is the ticket boundary has its criteria moved into
   the neighbor and is closed as a duplicate.

## Ticket detail

Detail varies on two independent axes:

- **Completeness** — how much a ticket contains. Depends on its rank tier.
- **Kind** — what type of statement each piece of detail is. The rule for each kind
  is the same at every tier.

### Kinds of detail

| Kind | What it is | Durability | Rule |
|---|---|---|---|
| References | Pointers into the current implementation (files, functions, lines, snippets) and observations of current behavior ("currently renders X", "the bug is in the retry path"). | Stale as soon as the code changes. | File names at most (see "Reference limit"). Re-verify observations. |
| Acceptance criteria | Required behavior: inputs, outputs, exact values, error cases. | Stable — they describe the target, not the code. | Keep at full precision. "Reject unknown keys, naming the offending key in the error" is a criterion, not over-detail. |
| Constraints | Required properties of the solution: dependency budget, performance bounds, compatibility. | Stable. | Keep at full precision. |
| Anchors | Citations of a spec, design doc, or architecture doc. | Stable only when pinned to a commit or another immutable version. | Pin or remove. An unpinned link is a reference. |

Use the kinds to judge detail a ticket already has. They are not a template; don't
add a constraints or anchors section to a ticket that doesn't need one. Within a
description, prefer removing text to adding it. That applies to description text
only; whether a ticket should exist is decided in the completeness pass.

### Reference limit (all tiers)

References go no finer than a file name: no function names, line numbers, code,
pseudocode, or signatures. Finer references go stale as the code changes, and they
make implementation decisions that belong to the implementer.

The limit doesn't change near the top of the backlog. A next-up ticket gets sharper
acceptance criteria and a list of the files involved, not deeper references.

- OK: "Make the parser reject unknown keys, in `config/loader.ts`."
- Not OK: "Add `if (!allowed.has(k)) throw` to `validateKeys()`."

When an existing ticket has sub-file references, assume they are stale. Work out what
they were meant to achieve, check that against the current code, and write it as
acceptance criteria; don't just edit the old wording. Re-verify observations against
the current code and remove any that don't hold or have no evidence. Never reduce the
precision of acceptance criteria or constraints.

### Completeness by tier

Rewrite descriptions to match the tier — expand thin ones, trim bloated ones. The
kind rules apply at every tier.

- **Top / next-up** (pullable, near the top): implementable from a cold start.
  Problem, why it matters, concrete acceptance criteria, and the constraints and links
  needed to start. No implementation design. Questions the implementer has to answer
  (which library, whether an API supports X) go in the ticket as part of its work.
- **Mid**: problem statement, rough size, why it matters. A one-line acceptance
  criterion is enough.
- **Deep**: a clear title and one or two sentences of problem. Remove references and
  speculative design; they will be wrong by the time the ticket is pulled. Acceptance
  criteria already written keep their precision — deep tickets are short because they
  carry fewer items, not vaguer ones.

Epics hold the plan and shared context; children hold the work. Don't copy epic
context into children.

## Add and merge in separate passes

The completeness pass (3) only creates tickets; the fold pass (4) only merges and
closes them. Don't combine them in one pass: an agent asked for completeness tends to
over-add, an agent asked for minimalism tends to miss gaps, and doing both at once
makes neither reliable. If you spot a merge during pass 3 or a missing ticket during
pass 4, note it and handle it in the correct pass on the next run.

Creating first means the fold pass sees the full set. The result after both passes is
the smallest set of tickets that still makes every epic checkpoint reachable and
every block clearable.

## What grooming doesn't do

Grooming organizes and describes work; it doesn't do the work. Don't write
implementation design into descriptions.

- **Unknown facts** a ticket depends on go into that ticket as questions for the
  implementer to resolve as part of the work. Don't create separate investigation or
  spike tickets.
- **Unmade decisions** a ticket depends on get a decision ticket that names the
  decision, ranked ahead of the ticket it blocks (pass 3).

## Passes

Run in order, then commit.

1. **Structure.** Fix the graph first; it determines what is ready, which determines
   rank.
   - Remove false blocks: `lit label rm <id> needs-design` when the blocker is gone.
   - Add missing dependency edges: `lit dep add --from <blocker> --to <blocked>
     --type blocks`. Only across epics or for tickets with no epic; within an epic,
     rank is the ordering and lit rejects the edge.
   - Fix parentage: `lit parent set --child <id> --parent <id>`.
   - Topic is immutable; don't try to change it.

2. **Staleness.** Close obsolete, completed, and duplicate tickets:
   `lit close <id> --resolution <obsolete|wontfix|duplicate|superseded> --reason "..."`
   (`duplicate` and `superseded` require `--of <canonical-id>`). Closing is
   reversible with `lit open`, so it's safe to do autonomously; the report is the undo
   record. Never delete a ticket. If one looks like it should be deleted, leave it and
   list it under "Needs your call".

3. **Completeness.** Create the tickets the backlog is missing. Common gaps:
   - **A block with no clearing ticket.** A `needs-design` / `needs-info` label, or a
     dependency on a decision, with no ticket whose completion removes it. If the
     blocker is already gone, the label comes off (pass 1). Otherwise create a
     decision ticket that names the decision and link it: same epic, rank it above
     the blocked ticket; different epic or no epic, `lit dep add --type blocks`.
   - **An epic with no path to its checkpoint.** No open child reaches the checkpoint
     in the epic's `lit show` body: there are no children, the children stop short of
     the checkpoint, or every child is blocked with nothing to unblock it. Add
     children until the ranked children reach the checkpoint.

   Example: a bug has `needs-design` and nothing removes it. Another ticket reads
   "Decide what this fork does with feature-gated dead code." If that ticket is the
   decision, add a `blocks` edge from it to the bug. If it isn't, create the decision
   ticket.

   **Delegate writing the new tickets.** Dispatch a fresh general-purpose subagent,
   not a fork — a fork inherits this session's loaded skills, which degrades the
   ticket text. Tell it to load `laws:backlog` and `laws:prompt` and nothing else.
   Include verbatim: the epic's `lit show` body, the existing children's titles and
   rank, the gap you found, the output of `lit quickstart new`, and the reference
   limit from this document. It returns proposed tickets as text. Read the proposed
   tickets themselves, not its summary; confirm each one addresses the gap; then
   create them with `lit new --parent <epic> --topic <slug>
   --type <task|feature|bug|chore> --title "..." --description "..."` and rank them.

4. **Fold.** Merge redundant tickets. There is one operation: move a ticket's
   acceptance criteria and constraints, at full precision, into a neighbor on the same
   path, then `lit close <id> --resolution duplicate --of <neighbor>`. Never close
   without moving the criteria. Never merge across epics; each epic's checkpoint must
   stay reachable from its own children.

   For each open ticket, ask: if this ticket were closed and its criteria moved to its
   neighbor, what would be lost? If only the ticket boundary, merge it. If it is a
   separate decision, needs a different reviewer, or is a stage that has to land
   before the next one starts, keep it.

   - Merge existing spike or investigation tickets into the ticket they inform; their
     question becomes an open question in that ticket.
   - Don't reduce the precision of criteria while merging.

   Example: "Pick the session driver to copy" and "The copied driver runs one
   session."
   - Wrong: close the first because the choice seems obvious. The "which driver, and
     why" criterion is lost.
   - Right: add "the driver copied is <path>, chosen because <the pick's criterion>"
     to the second ticket and close the first as its duplicate. Or keep the first, if
     the choice needs review before any code is copied. The report says which and why.

   **Expected merge rate.** On a backlog that pass 3 just expanded, roughly 15% of
   tickets (about one in seven) typically merge. This is a diagnostic, not a target.
   No merges after substantial growth suggests pass 3 added too little; a third
   merging suggests it added too much. Don't look for extra merges to hit the number;
   a forced merge usually loses something. On a second run over a groomed backlog,
   zero merges is expected.

5. **Rank.** Set the order with `lit rank` (`--top` / `--bottom` / `--above` /
   `--below`). Move only tickets that are mis-ranked and leave correctly placed
   tickets alone; this is what keeps the skill idempotent. Decision tickets from
   pass 3 go directly above the tickets they block, not at the top of the backlog.

6. **Detail.** Rewrite each remaining ticket's description to fit, with
   `lit update <id> --description "..."`:
   - Completeness: expand thin near-term tickets, trim bloated deep ones, and add a
     verifiable acceptance criterion to every near-term ticket that lacks one.
   - Kind: apply the reference limit to every ticket regardless of tier. Replace
     sub-file references with acceptance criteria verified against the current code.
     Re-verify observations and remove the ones that don't hold. Pin anchors to a
     commit or remove them. Don't reduce the precision of acceptance criteria or
     constraints.
   - Tickets that received criteria in pass 4: rewrite as one coherent description.

7. **Urgent flag.** Set `--priority urgent` only on genuine drop-everything work;
   clear it everywhere else.

8. **Commit.** lit persists its own data; commit anything else and leave the working
   tree clean.

## Report

Changes were applied without review, so always end with an audit the user can check
or undo:

- **Reranked:** `#id: rank A → B`, with a one-line reason.
- **Closed:** `#id (resolution)` — reopen with `lit open`.
- **Created:** `#id — <title>`, the gap it fills, and what it unblocks. Undo with
  `lit close`.
- **Merged:** `#id → #target`, with why only the boundary was lost. Then: N merged of
  M after pass 3, and whether that suggests pass 3 added too little, about right, or
  too much.
- **Rewritten:** which tickets, whether expanded or trimmed, and any kind fixes
  (references replaced with criteria, observations re-verified or removed, anchors
  pinned). A ticket whose intent couldn't be confirmed against the code goes under
  "Needs your call" instead of being rewritten.
- **Structure:** blocks, dependencies, and parentage changed.
- **Needs your call (not actioned):** deletion candidates, ambiguous priorities,
  merges that could go either way, epics whose checkpoint is too vague to break down.

If the backlog was already groomed, say so: no tickets created, none merged, and rank
unchanged is a correct result.
