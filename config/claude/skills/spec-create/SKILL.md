---
name: spec-create
description: Create or extend a comprehensive documentation spec for a project by studying its source code. Produces spec markdown files under ./spec/ built entirely from source as the single source of truth. Use when the user says "write specs for this project", "document the codebase as a spec", "translate the code into a specification", "build a spec from src/", or wants to bootstrap/grow a spec that mirrors an existing implementation.
---

# Spec Create

Translate a codebase into a documentation specification. The spec describes **behavior and contracts** — what the system does and guarantees — not an implementation tour.

## Hard rules

1. **Source is the only ground truth.** Read only the source tree the user names (usually `./src/**`). Do **not** read tests, docs, CHANGELOG, examples, issues, or prior specs when establishing facts. The spec must be derivable from source alone.
2. **Behavior, not structure.** Document contracts, invariants, state machines, data flow, and guarantees. Not file layouts or implementation tours.
3. **Orchestrator owns the checklist.** Subagents do the writing; only the orchestrator (you) checks items off, and only after validating the work.
4. **When all items are checked: delete the checklist, commit, end the session.** This is non-negotiable.

## Inputs the user must provide (ask if missing)

- **Source root** (e.g. `./src/`) — the only material agents may read.
- **Spec output directory** (default `./spec/`).
- **Spec layout** — flat `./spec/*.md`, or a structured layout like `./spec/spec-src/NN-topic.md` plus a coverage matrix? If unsure, default to the structured layout: numbered topic files plus `99-source-coverage-matrix.md`.
- **Scope** — bootstrap from scratch, or extend an existing spec?
- **Working directory for plan + reports** (default `.prompts/`).

## Phase 1 — Plan (orchestrator only, no subagents yet)

1. Read `.prompts/IMPLEMENTATION_PLAN.md` if it exists. Do **not** read any spec files during planning.
2. Survey the source tree with `Glob` to enumerate modules. Do not read source contents yet — just get the shape.
3. Write `.prompts/IMPLEMENTATION_PLAN.md` as a checklist, one item per planned spec file or per audit pass. Include:
   - Owning module list per spec file (from the survey).
   - Standing rules (source-only, behavior-not-structure, orchestrator-checks-off, delete-on-done).
   - A section for discovered work that subagents can append to.
4. If a coverage matrix is part of the layout, add an item for it: "produce `99-source-coverage-matrix.md` mapping every source module to an owning spec file."

## Phase 2 — Dispatch subagents

Up to 250 subagents may run across the session, but dispatch in parallel batches sized to avoid source-file contention. Each agent picks exactly one of:

- **Add.** The item is missing from the spec. Study the assigned source deeply and document it.
- **Update.** The item exists but is incomplete or stale. Fix it in place.
- **Audit.** Deeply review the spec for inconsistencies or omissions and either fix them (if the user's intent is "grow the spec") or report them (if the user's intent is a read-only audit — see `spec-audit` skill for that).

Every dispatch prompt must include these non-negotiable constraints:

```
CRITICAL:
- Source material is ONLY <source-root>. Do not read tests, docs, CHANGELOG,
  examples, or anything outside that tree.
- Your assigned spec file is <path>. You may read any spec file, but only
  write to your assigned file and to <plan-path> (to append newly discovered
  work at the bottom, unchecked).
- Describe behavior and contracts, not file structure or implementation tour.
- Cite source locations (file:line) when helpful for future verification.
- Preserve existing headings unless a section is genuinely wrong.
- Return a concise report: what changed, what behaviors you documented,
  and any follow-up work you appended to the plan.
```

## Phase 3 — Validate each returned report

Before checking an item off:

1. Spot-read the assigned spec file to confirm the subagent actually wrote what it claimed.
2. Spot-check 1–2 claims against source if anything looks suspicious.
3. Check `git status <spec-root>` to confirm the agent only touched its assigned file.
4. Integrate any follow-up work the agent reported as new unchecked items in the plan.
5. **Only then** mark the item `[x]` in `.prompts/IMPLEMENTATION_PLAN.md`.

If the subagent report is thin, the spec file is unchanged, or coverage is obviously shallow — re-dispatch with sharper instructions instead of checking it off.

## Phase 4 — Cover the coverage matrix

If the layout includes a coverage matrix:

- The matrix maps every `.py` (or equivalent) file under source-root to its owning spec file.
- Verify with `Glob` that every source file is present in the matrix. Add missing rows. Remove rows for deleted files. Update the summary totals.
- The matrix is the canonical ledger — if a module isn't in it, the module isn't covered.

## Phase 5 — Finish

**When every checkbox in `IMPLEMENTATION_PLAN.md` is checked:**

1. Verify `git status spec/` shows the expected changes and nothing unexpected.
2. Delete `.prompts/IMPLEMENTATION_PLAN.md`.
3. Stage and commit the spec changes with a descriptive message. Do **not** skip hooks. Do **not** amend prior commits.
4. End the session. No further work unless the user explicitly asks.

## Failure modes to avoid

- **Reading tests/docs to "shortcut" understanding.** The whole point is that the spec is derivable from source alone. Cross-contaminating with tests or existing docs breaks the contract.
- **Implementation tour instead of behavior contract.** If the spec reads like "this file has these functions," rewrite it as "this subsystem guarantees X under conditions Y and transitions state like Z." Behavior, not structure.
- **Letting subagents check their own work off.** Only the orchestrator checks items off, and only after Phase 3 validation. Subagents reporting "done" is not the same as done.
- **Forgetting the terminal step.** When all boxes are checked, the session MUST end with: delete checklist → commit → stop. Leaving a fully checked plan in the tree is a failure state.
- **Silently expanding scope.** If a subagent finds new work, it appends unchecked items to the plan. The orchestrator decides whether to dispatch them in this session or defer. Scope creep without plan-tracking is forbidden.
- **Audit pass that becomes an edit pass on the wrong artifact.** If the user wants a read-only audit of existing specs, use the `spec-audit` skill instead of this one. This skill writes and updates specs; `spec-audit` only reports on them.

## Invocation checklist

When the user runs `/spec-create`:

1. Confirm scope (source root, spec dir, layout, bootstrap vs extend).
2. Read existing `IMPLEMENTATION_PLAN.md` if any; otherwise Glob the source tree to survey shape.
3. Write/update `.prompts/IMPLEMENTATION_PLAN.md`.
4. Dispatch subagents per Phase 2 in parallel batches.
5. Validate each returned report per Phase 3 before checking off.
6. Handle the coverage matrix per Phase 4 if applicable.
7. When all boxes checked: delete plan, commit, stop (Phase 5).
