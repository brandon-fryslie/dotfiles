---
name: spec-audit
description: Audit documentation spec files against source code without modifying them. Produces a read-only findings report per spec (inaccuracies, omissions, stale claims) with verbatim quotes and source citations. Use when the user says "audit the specs", "check the specs against source", "verify spec accuracy", or asks for a spec review that must not edit the specs themselves.
---

# Spec Audit

An **audit** is a read-only report. It identifies discrepancies between a spec and its source of truth. It does **not** modify the artifact under audit. Remediation is a separate phase.

If you find yourself editing spec files, stop — that's not an audit.

## Inputs the user must provide (ask if missing)

- **Spec location** (e.g. `./spec/spec-src/*.md`)
- **Source of truth** (e.g. `./src/**` — the only code the audit may read)
- **Coverage map** — does one exist (like a `99-coverage-matrix.md`)? If not, derive one from the spec file structure before dispatching.
- **Scope** — audit everything, or a subset?
- **Output location** — default `.prompts/audit/`

## Phase 1 — Define the deliverable

Write `.prompts/audit/AUDIT_TEMPLATE.md` so every subagent produces the same shape of report:

```markdown
# Audit: <spec file path>

## Scope
- Spec file: <path>
- Source modules in scope: <list from coverage map>
- Source commit SHA: <git rev-parse HEAD>
- Audit date: <date>

## Coverage notes
- Modules read end-to-end: <list>
- Modules grep-sampled only: <list with reason>
- Modules not examined: <list with reason>

## Findings

### F1 — <short title>
- Severity: blocker | major | minor | nit
- Category: factual-error | omission | stale-api | ambiguity | contradicts-other-spec
- Spec location: <file>:<line> or <section heading>
- Source location: <file>:<line>
- Claim in spec: > <verbatim quote>
- Reality in source: > <verbatim quote or precise description>
- Recommendation: <what should change — DO NOT change it>

### F2 — ...

## Sections with no findings
- <list explicitly — empty findings are not the same as unchecked>
```

## Phase 2 — Build the audit plan

Write `.prompts/audit/AUDIT_PLAN.md` as a checklist, one item per spec file. Each item's deliverable is a report file at `.prompts/audit/<n>-<name>.md`. Only the orchestrator checks items off.

Include standing rules at the top:
- Subagents read source and their assigned spec. Nothing else.
- Subagents write **only** their assigned report file under `.prompts/audit/`.
- Subagents must not Edit or Write any file under the spec directory.
- Findings quote verbatim and cite `file:line`.
- Coverage notes are mandatory.

## Phase 3 — Dispatch read-only subagents

For each spec file, spawn a subagent with a prompt containing these non-negotiable constraints:

```
CRITICAL READ-ONLY CONTRACT:
- You may Read files under <source-root> and the single spec file assigned to you.
- You must NOT Read tests, docs, CHANGELOG, or any path outside <source-root> and the assigned spec.
- You must NOT Edit or Write any file under <spec-root>.
- The ONLY file you may Write is your audit report at `.prompts/audit/<assigned-name>.md`.
- Use the template at `.prompts/audit/AUDIT_TEMPLATE.md` exactly.
- Quote spec claims verbatim. Cite source as file:line.
- For files larger than 1000 lines: either read in full, or explicitly note "grep-sampled only" in Coverage notes with the grep patterns used. No silent skipping.
- If a section has no issues, list it under "Sections with no findings." Empty findings ≠ unchecked.
- Return when the report is written. Do not summarize — the report IS the deliverable.
```

Dispatch in parallel batches sized to avoid source-file contention. Agents auditing disjoint spec files can run concurrently.

## Phase 4 — Validate each report as it lands

This is the step most audits skip, and it's what makes the difference between a real audit and a theater one.

For each returned report:

1. **Spot-check 2–3 findings yourself.** Read the cited source lines. If a finding doesn't reproduce, the report is suspect — re-dispatch with sharper instructions.
2. **Check coverage notes.** If a huge file was "grep-sampled only," decide whether that's acceptable for this audit's rigor level. If not, re-dispatch with an explicit "read <file> end-to-end" instruction.
3. **Confirm the spec was not modified.** Run `git status <spec-root>` after each report lands. It must be clean. If it isn't, the subagent broke contract — revert and re-dispatch.
4. **Only then check the item off** in `AUDIT_PLAN.md`.

## Phase 5 — Cross-check layered specs

If the project has both a topic-spec layer and a consolidated/uber-spec layer (or any hierarchy), audit the inner layer first. Then audit the outer layer using the **inner-layer audit reports** as an additional input, not just the inner specs themselves.

Outer-layer findings come in two flavors:
- Contradictions with source (same process as inner audit).
- Contradictions with the inner specs that are not themselves flagged as wrong by the inner audit.

## Phase 6 — Consolidate

Write `.prompts/audit/SUMMARY.md`:

- Total findings by severity (blocker / major / minor / nit).
- Top N blockers, with links to the individual reports.
- Hotspots: specs or source modules with the most findings.
- **Source-level bugs surfaced** — bugs in the code the spec describes, not bugs in the spec itself. These are a separate deliverable and should go to the issue tracker, not the remediation phase.
- **Coverage gaps** — what was not audited deeply enough, with an explicit recommendation (accept / re-audit).

## Phase 7 — Stop

The audit ends at the summary. Do not remediate in the same session unless the user explicitly asks. Present the summary and ask what they want to do:

- Fix the spec? (separate task, separate commits, may be subagent-driven)
- Fix the source bugs? (separate issues in the tracker)
- Accept some findings as intentional abstraction?
- Re-audit anything that had weak coverage?

Keep audit, decision, and remediation as three distinct phases with three distinct commits.

## Anti-patterns to avoid

- **"Audit and fix" in one pass.** That's an edit pass justified by an audit. If the user asked for an audit, they want findings, not a diff.
- **Trusting subagent reports without spot-checking.** Subagents can hallucinate findings or miss obvious ones. Step 4 is mandatory.
- **Grep-sampling large files silently.** If a file is too big to read fully, say so in coverage notes. Don't pretend you audited it.
- **Rolling everything into one final "spec looks good" verdict.** The deliverable is findings, not a verdict. The user decides what to do with them.
- **Editing specs to "pre-empt" remediation.** Even one-line "obvious" fixes. If you're editing the spec, you're no longer auditing.

## Invocation checklist

When the user runs `/spec-audit`:

1. Confirm scope with the user (which specs, which source root, rigor level).
2. Create `.prompts/audit/` and write `AUDIT_TEMPLATE.md` + `AUDIT_PLAN.md`.
3. Dispatch read-only subagents per Phase 3.
4. Validate each report per Phase 4 before checking items off.
5. Dispatch outer-layer audits per Phase 5 if applicable.
6. Write `SUMMARY.md` per Phase 6.
7. Present summary, ask for next-phase direction, stop.
