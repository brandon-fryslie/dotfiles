---
name: variance-audit
description: Audit a codebase for shotgun-parser patterns, scattered discriminator checks, missing trust boundaries, and other variance-leakage seams that a typed absorption could collapse. Rank findings by architectural-outcome priority and create a single lit epic with ranked child issues for the most impactful one. Pairs with /absorbed-variance — this skill is the *strategy* (where to refactor next), /absorbed-variance is the *tactics* (how to refactor here). Use when the user says "find the seams", "where should we absorb variance", "what should we refactor next", "audit for shotgun parsers", or wants a strategic view of structural-purity work.
---

# Variance Audit: Finding Seams Worth Absorbing

## What this skill is for

`/absorbed-variance` answers "how do I refactor this tangle?" — tactics applied to one site at a time. This skill answers the prior question: **of all the tangles in this codebase, which one's absorption produces the best architectural outcome, and what's the implementation order to get there cleanly?**

The output is one `lit` epic with ranked child issues for **a single chosen seam**. Findings are surfaced inline in the chat run; only the chosen seam is ticketed. Re-running the skill re-derives findings against the current codebase — there is no audit document, because every absorption shifts what the next run would find.

## When to use

- "find the seams"
- "where should we absorb variance next"
- "what should we refactor for structural purity"
- "audit for shotgun parsers"
- After a feature lands and you want to see what cleanup the new shape unlocked
- Before a major feature, to identify which absorption would make that feature easier to build

## When NOT to use

- The user already knows what they want refactored — go straight to `/absorbed-variance`.
- Trivial codebases (< 20 source files) — skim by eye.
- The user wants a generic "complexity audit" covering god modules, dead code, UX special cases — that's `/complexity-audit`. This skill has a sharper lens: variance leakage and missing absorbing types specifically.

## Why one seam at a time

Boundary parsers are upstream of everything else: their types are the inputs that downstream absorptions dispatch on. Ticketing many seams in parallel invites work that produces *transient* types — invented for one absorption, thrown away when an upstream boundary parse later supersedes them. Sequencing prevents that churn, and the next audit run picks from a refreshed view.

## Workflow

### Phase 1: Map the trust boundaries

Identify where untrusted data enters the system. These are the candidate single-enforcer locations and the natural homes for absorbing types.

Look for:
- **CLI entry points**: argument parsing, flag handling, subcommand dispatch.
- **Network/IPC boundaries**: HTTP handlers, RPC servers, IPC message receivers.
- **Persistence boundaries**: DB query results, JSON unmarshal sites, file-format readers.
- **Plugin/extension boundaries**: where third-party or user code crosses into core.
- **Sync boundaries**: where remote state merges into local state.

Note the boundaries you find. Every later finding gets scored partly on which boundary it should migrate to.

### Phase 2: Scan for shotgun-parser fingerprints

These patterns are mechanically detectable. Use Grep / Glob aggressively. The signal is *repetition of the same check* at sites that should not have to know.

- **A. Scattered discriminator checks** — same string literal or enum value tested at N≥3 sites in `==`, `case`, `switch`, or `match`. Indicates a discriminated shape that should be a sum type with dispatch absorbed by the type system.
- **B. Repeated null/nil/empty guards on the same field** — N≥3 sites guarding the same field. Indicates optionality that should be encoded in the type.
- **C. Mode flags threaded through call signatures** — boolean or string parameters that select between branches, especially when threaded through multiple functions. Dispatch over a sum type masquerading as control flow.
- **D. Type-switch / `interface{}` consumers at multiple sites** — the discriminator IS the type system bypass. Worst kind of shotgun because the compiler can't help.
- **E. Validate-don't-parse boundaries** — a function returning a still-untyped raw shape after "validation". Telltale: assert/check blocks at the top of multiple functions checking the same invariant on the same input.
- **F. Convention-by-comment** — comments like "callers must ensure...", "X is non-nil after init". Each is an admission the type system isn't carrying an invariant.

### Phase 3: Sketch each finding

For every fingerprint hit, capture these fields. Keep them concrete — vague findings don't make actionable tickets, per the `audit_fixes_be_specific` discipline.

- **Pattern**: which fingerprint
- **Discriminator**: exact field/string/flag
- **Sites** (N): file:line references
- **Owning edge**: which boundary owns this — usually a Phase 1 trust boundary, but internal edges (module / class / function) qualify for findings that don't cross one (e.g., a mode flag threaded inside a single module)
- **Proposed absorbing type**: sketch (sum type / newtype / state machine / parsed config)
- **Single-enforcer location**: file/function where parse happens once
- **Checks deleted**: guard/check sites that vanish
- **Tier**: 1–5
- **Estimated diff**: rough LOC, files touched
- **Tests reframed/deleted**: implied test work
- **Dependencies**: other findings whose absorbing type this depends on

If you can't fill in **proposed absorbing type** and **single-enforcer location**, the finding isn't ready — study the data flow more or drop it.

### Phase 4: Rank all findings

Apply the tiering, **highest priority first**:

1. **Boundary parsers (parse-don't-validate at trust boundaries).** Top tier always — they produce types every downstream absorption consumes. Out-of-order ticketing here invents throwaway types.
2. **High fan-out shotguns.** Same discriminator/null-guard at N≥3 sites. Biggest cleanup-per-refactor.
3. **Cross-module shotguns within one domain.** Often expose a missing seam between modules; absorbing yields the right module split as a byproduct.
4. **Mode-flag absorptions.** Single function with a flag where variants want to be a sum type. Local, contained, low-risk.
5. **Defensive null-guard clusters with no clear boundary owner.** Last because they often dissolve once 1–3 land.

**Tiebreakers within a tier** (apply in order):
1. Higher fan-out wins.
2. Shorter estimated diff wins among equal fan-out.
3. **Deletes-a-test wins** — strongest "did variance actually disappear" signal.
4. Reusable absorbing type wins — if F-3's type would also be the input to F-7 and F-9, F-3 outranks an isolated peer.

Note: a boundary-parser finding stays Tier 1 even if it has only one site. Its downstream effects are the whole point.

### Phase 5: Pick the single most impactful seam

The top finding is the chosen seam. Write a one-line rationale: *"Selected F-N because Tier T, fan-out F, deletes K test assertions, unblocks F-X and F-Y."*

If your gut disagrees with the ranking, name what the rules don't capture — argue an exception in the rationale rather than silently override.

### Phase 6: Create the lit epic and child issues

The chosen seam becomes one epic. The work to absorb it becomes children.

#### 6.1 Create the epic

```bash
EPIC_ID=$(lit new --type epic \
  --title "Absorb variance: <discriminator name>" \
  --topic variance-<short-slug> \
  --description "<finding body + selection rationale>" \
  --json | jq -r .id)
```

#### 6.2 Decompose into child issues

A standard absorption decomposes into this canonical sequence (drop steps that don't apply):

1. **Define the absorbing type** at its single-enforcer location.
2. **Move enforcement to the boundary** (parse-don't-validate, construct the type once).
3. **Migrate one consumer** as a vertical slice to validate the design.
4. **Migrate remaining consumers** — one issue per consumer, or grouped if trivial.
5. **Delete the redundant checks** at the old guard sites.
6. **Reframe or delete the tests** that asserted the old defensive behavior.

For each step:

```bash
lit new --type task \
  --parent "$EPIC_ID" \
  --title "<step title>" \
  --topic variance-<short-slug>-<step-slug> \
  --description "<exact files, exact deletions, exact type signature>"
```

Each child issue body should be **mechanically specific** (per `audit_fixes_be_specific`): exact file paths and line numbers for the guards to delete, exact type signature for the absorbing type, exact assertion text for tests that change. Pick one path and spell it out — no "or", "consider", "centralize."

#### 6.3 Encode dependencies

Use `lit dep add` so `lit ready` will refuse to surface a child before its prerequisite is closed:

```bash
lit dep add <step-2-id> <step-1-id>   # type before boundary parse
lit dep add <step-3-id> <step-2-id>   # boundary before first consumer
lit dep add <step-4-id> <step-3-id>   # vertical slice before bulk migration
lit dep add <step-5-id> <step-4-id>   # migration before guard deletion
lit dep add <step-6-id> <step-5-id>   # guards deleted before test cleanup
```

This turns architectural sequencing into a machine-checkable constraint.

#### 6.4 Rank within the epic

```bash
lit rank <step-1-id> --top
lit rank <step-2-id> --below <step-1-id>
# ...etc
```

Rank within bulk-migration sub-issues by consumer fan-out (heaviest first).

### Phase 7: Report

Final chat reply, navigable-index form:

```
Trust boundaries: N
Findings: M (Tier 1: a, Tier 2: b, Tier 3: c, Tier 4: d, Tier 5: e)
  - F-1 <one-line>
  - F-2 <one-line>
  ...
Selected: F-X — <one-line description>
  Rationale: <one line>
Epic: <epic-id>
Child issues: <count>, ranked, dependencies set
```

The findings list is brief — one line each — so the user can sanity-check the ranking. The selected finding's full detail lives in the epic body.

## Pairing with /absorbed-variance

Once the epic exists, the user (or an agent) can `lit start <child-issue-id>` and invoke `/absorbed-variance` against that specific seam. The child issue's body — proposed absorbing type, single-enforcer location, exact guard sites to delete — is exactly the input that skill's Step 1 (diagnose the shotgun) and Step 2 (design the absorbing type) need.

The two skills compose by design: this one's output is the next one's input. Their concerns differ (strategic ordering vs tactical refactor), their outputs differ (lit epic vs code diff), and keeping them peer keeps each lens sharp.

**Vocabulary inherited.** The terms *absorb*, *shotgun parser*, *single enforcer*, *push variance to the edges*, *parse-don't-validate*, *load-bearing vs. incidental*, and *receipt vs. claim* are defined in `/absorbed-variance`'s `## Glossary`. When this skill mentions an *edge*, it deliberately means the broader concept (any boundary that owns an invariant: API, module, class, function, or trust boundary) — not the narrower security-flavored *trust boundary*, which is a strict subset. Phase 1's `Map the trust boundaries` is scoped to that subset on purpose, since trust-boundary parsers are Tier 1; later phases admit findings whose owning edge is internal.

## Guidance to keep in mind

- **Findings need a proposed type to graduate.** A "this looks tangled" hunch isn't a finding. If you can't sketch the absorbing type and the single-enforcer location, study more or drop it.
- **The ranking does the picking.** Tiers and tiebreakers exist to take gut out of the loop. If your gut disagrees, name the missing rule explicitly and argue an exception — don't silently override.
- **Boundary parsers stay Tier 1 even at low fan-out.** A one-site boundary refactor produces types that unblock everything downstream — that's the whole point.
- **Child issue bodies should be diff-ready.** An agent picking up the ticket via `/absorbed-variance` should have exact file paths, exact signatures, and exact guard sites to delete, not "explore this area."
- **Re-running this skill is the canonical update.** No audit doc to maintain — the codebase changes too fast for any persisted findings to stay accurate.

## Lit-specific tooling reference

```bash
# Create epic, capture ID
EPIC_ID=$(lit new --type epic --title "..." --topic "..." --description "..." --json | jq -r .id)

# Create children with parent
lit new --type task --parent "$EPIC_ID" --title "..." --topic "..." --description "..."

# Hard prerequisites (B blocked by A)
lit dep add <B-id> <A-id>

# Visual ranking
lit rank <id> --top
lit rank <id> --below <other-id>

# Verify the dependency graph holds
lit ready --query "parent:$EPIC_ID"
```

For non-lit projects, swap the ticket-creation phase for the project's tracker. The workflow shape (one epic, ranked children, dep edges) is tracker-agnostic; the ranking heuristic and findings format are unchanged.
