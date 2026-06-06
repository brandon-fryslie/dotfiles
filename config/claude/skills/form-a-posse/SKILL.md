---
name: form-a-posse
description: Turn law-audit findings (the "what") into a planned, ticketed, groomed backlog (the "how"). Consumes a sheriff-is-in-town report — or runs the audit first — designs the remediation for each finding cluster at planning altitude (the missing constraint that makes the violation unrepresentable), writes lit tickets in dependency order, and grooms them into the backlog. Use when the user says "form a posse", "plan the fixes", "turn the audit into tickets", "make a remediation plan", "break the law findings into tickets", "plan the cleanup", or has a law-audit report and wants it actioned into work. Pairs with sheriff-is-in-town (finds the what) and groom-backlog (does the grooming).
---

# Form A Posse

The sheriff named the outlaws (the *what*). The posse plans the hunt and writes the warrants:
for each violation, the **how** at planning altitude, decomposed into `lit` tickets and groomed
into the backlog. Plans and files work — does **not** write the fix code.

## Input

Findings from `sheriff-is-in-town` (file:line + `[LAW:<token>]` + blast radius). If none exist
yet, run the sheriff first — you can't plan a fix for violations you haven't found. [LAW:verifiable-goals]

## Don't restate what's already owned

- The **laws** live in CLAUDE.md (`universal-laws`) — cite by token, never paraphrase.
- The **grooming rules** (rank, detail calibration, the file-name granularity ceiling) live in
  `groom-backlog` — don't re-derive them; hand off (step 7). [LAW:one-source-of-truth]

## Process — one pipeline: findings → root causes → constraint plan → tickets → groomed backlog

1. **Cluster by root cause.** Several findings usually descend from one upstream missing
   constraint: a type, seam, source of truth, enforcer, lifecycle owner, dependency direction,
   or verification contract. Group them — one structural fix unrepresents many violations at
   once. The cluster, not the individual finding, is the unit of planning.
   [LAW:types-are-the-program]
2. **Design the how, at planning altitude.** For each cluster, the remediation *is* the
   missing constraint that makes the illegal state unrepresentable. Capture the named owner
   of that constraint and the behavior it guarantees: the parsed type, canonical source,
   single enforcer, seam, dependency boundary, lifecycle owner, data-driven representation,
   or machine-verifiable done state. A plan that names functions or pastes a diff has dropped
   below ticket altitude; stay above it. [LAW:types-are-the-program]
3. **Check for existing tickets first.** `lit backlog`, `lit ls --search <area>`. A finding
   already ticketed is updated, never duplicated. [LAW:one-source-of-truth]
4. **Rank clusters by architectural leverage.** Highest rank goes to the cluster whose missing
   constraint sits farthest upstream and deletes the most downstream residue. Use these
   law-agnostic tiebreakers: boundary-owned constraints before interior cleanup; higher fan-out
   before isolated sites; cross-module fixes before local fixes; fixes that delete obsolete
   guards, shims, tests, or duplicate artifacts before fixes that mostly add scaffolding.
   If your judgment disagrees with the tiebreakers, state the exception instead of silently
   overriding the ranking.
5. **Decompose every multi-step cluster in the same order.** Drop steps that do not apply, but
   do not invent a separate path for a particular law:
   - Name the missing constraint and its owner.
   - Install the owner/boundary that enforces or represents it.
   - Migrate one consumer as a proof slice.
   - Migrate the remaining consumers.
   - Delete the old residue: duplicate checks, fallback paths, stale copies, timing shims,
     defensive tests, dead helpers, or structure-asserting tests.
   - Reframe verification so done means the law holds and the old violation is unrepresentable.
6. **Create tickets.** One epic per multi-step cluster (`lit new --type epic`), children for the
   ordered steps above; a lone task when the fix is atomic. Each ticket's *done* = the law now
   holds / the violation is no longer representable, written as a verifiable criterion. Add deps
   where one fix must land before another (`lit dep add`). `--topic` = the affected area.
   [LAW:verifiable-goals]
7. **Groom.** Run `groom-backlog` scoped to the new epic/topic to rank, size, and dep-check the
   tickets. Grooming is its job — don't reimplement it here. [LAW:single-enforcer]

## Output

A report: the root-cause clusters, the epic/ticket ids created (and any updated), and the
plan-altitude *how* for each cluster. Then the backlog is ready to pull.

## The posse plans; it does not fix

Filing and grooming the work is the whole job. Writing the remediation code is the implementer's
pull-time work — a separate seam, different blast radius and trust. [LAW:locality-or-seam]
