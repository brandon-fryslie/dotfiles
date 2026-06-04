---
name: sheriff-is-in-town
description: Audit a repository against the universal architectural laws and report where the code breaks them — read-only findings, no fixes. Each finding cites the exact [LAW:<token>] it violates, with file:line, the behavior that breaks it, its blast radius, and the constraint that would make it unrepresentable. Use when the user says "sheriff is in town", "audit against the laws", "law audit", "where are we breaking the laws", "check for law violations", or wants a lawfulness pass before a refactor or merge. Optionally scope to a path, subsystem, or the current diff.
---

# Sheriff Is In Town

The sheriff enforces the law — doesn't write it, doesn't fix the town. This skill walks the
code and reports where it breaks the **universal architectural laws**. Read-only.

## The rubric is already loaded

The laws live in your global CLAUDE.md (`universal-laws`). That is the single source of truth
for what counts as a violation. **Do not restate or paraphrase them here** — read them there
and cite them by token. [LAW:one-source-of-truth]

## Scope

Default: the whole repo. If the user named a path, a subsystem, or "the diff", audit only
that. State the scope at the top of the report so it's unambiguous what was *not* checked.

## Process

1. **Read the code in scope** — actually read it, don't skim. A law violation is a property
   of behavior and shape, invisible to grep.
2. **Map each violation to the one law it most breaks** — the canonical token, not a list.
   If it seems to break three, find the upstream one the other two descend from. [LAW:one-type-per-behavior]
3. **Do not edit anything.** The sheriff reports; the town fixes. [LAW:single-enforcer]

## Finding shape

Each finding, terse:

- `path:line` — `[LAW:<token>]`
- **Breaks it by:** what the code *does* that violates the law (behavior, one line — not "this is ugly")
- **Blast radius:** who pays, and what future change it taxes (this is the severity signal)
- **Fix direction:** the constraint that would make the violation unrepresentable — the type/seam
  that absorbs it, not a spot-patch. Point at the cure, don't apply it.

## Rank

By **blast radius** — how much future work the violation taxes — never by count or by how easy
it is to fix. The loudest findings are where roughness compounds, not where it's most visible.

## The sheriff does not shoot

Read-only by default. If the user wants the violations actioned, that's a separate
deputization — hand the report to `form-a-posse`, which plans the *how* and writes the lit
tickets. Auditing, planning, and remediating have different blast radius and trust; keep them
separate jobs. [LAW:locality-or-seam]
