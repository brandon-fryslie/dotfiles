---
name: spec-remediate
description: Apply accepted audit findings back to spec files. Consumes the read-only reports produced by /spec-audit, triages findings with the user, then edits specs to resolve accepted findings with full traceability. Use when the user says "apply the audit", "fix the spec issues", "remediate the findings", "write the audit fixes back to the specs", or wants to act on a completed spec audit.
---

# Spec Remediate

Apply `/spec-audit` findings to spec files. This is the third phase of the audit → triage → remediate pipeline. Audit finds. Triage decides. Remediate applies.

If the audit hasn't been run, stop and run `/spec-audit` first. This skill consumes audit reports; it does not produce them.

## Hard rules

1. **Audit reports are the source of truth for *what* to change.** Source code is still the ground truth for *whether the finding is correct*. Spot-check before applying.
2. **Nothing is edited until the user signs off the triage.** The triage artifact is the user's veto point. Silent auto-acceptance is forbidden.
3. **Every spec edit is traceable to a finding ID.** Commit messages list applied finding IDs. Per-spec audit reports are updated with applied / deferred / rejected status so the historical record stays honest.
4. **Do not re-audit during remediation.** If remediation uncovers new issues the audit missed, note them in a new `.prompts/audit/FOLLOW_UP.md` and surface them to the user — do not silently fix them. Re-run `/spec-audit` for new material.

## Inputs (ask if missing)

- **Audit directory** (default `.prompts/audit/`). Must contain per-spec reports and `SUMMARY.md`. If missing, tell the user to run `/spec-audit` first.
- **Spec root** (the directory containing the files to be edited).
- **Source root** (for spot-checking findings before applying).
- **Severity filter** — apply all findings, or only blocker/major? Defaults to "ask during triage."

## Phase 1 — Triage

Read `SUMMARY.md` and every per-spec report under the audit directory. Build `.prompts/audit/TRIAGE.md`:

```markdown
# Audit Triage

Source audit: <path>
Audit date: <date>
Total findings: <n>

## Proposed disposition

### <spec-file-name>
- F1 (<severity>, <category>): <one-line summary>
  - Disposition: accept | reject | defer | needs-user-input
  - Reason: <one line>
- F2 ...

### <next-spec>
...

## Summary counts
- Accept: <n>
- Reject: <n>
- Defer: <n>
- Needs user input: <n>
```

Default dispositions:
- **blocker** / **major** factual-errors → `accept`
- **minor** / **nit** → `defer` unless the user set a broader filter
- **ambiguity** / **needs-user-input** → `needs-user-input`
- Anything where the finding's claim looks wrong on spot-check → `reject` with reason

Write the triage and **stop**. Show the user the triage file and ask them to review, amend, and confirm before proceeding.

## Phase 2 — User confirmation

Do not edit any spec files until the user explicitly says to proceed. They may:
- Accept the triage as-is.
- Amend dispositions inline in `TRIAGE.md`.
- Downscope (e.g. "only blockers this pass").
- Reject the whole thing.

Re-read `TRIAGE.md` after they confirm to pick up any edits they made.

## Phase 3 — Apply

For each spec file with at least one `accept` disposition, dispatch one subagent. Each subagent prompt must contain:

```
CRITICAL:
- You are remediating audit findings against a single spec file.
- Spec file (the ONLY file you may edit): <spec-path>
- Findings to apply (from TRIAGE.md, disposition=accept): <finding IDs + full text>
- Source root for spot-checking: <source-root>

For EACH finding:
  1. Read the cited source location to confirm the finding's claim still holds.
     If the source has changed and the finding no longer reproduces, skip the
     finding and note it in your report as "stale — not applied."
  2. Edit the spec file to implement the finding's recommendation. Preserve
     surrounding structure. Do not rewrite unrelated sections.
  3. Keep the edit minimal — smallest diff that resolves the finding.

You must NOT:
- Edit any file other than the assigned spec.
- Read tests, docs, CHANGELOG, or anything outside the source root and the
  audit directory.
- Introduce changes not tied to a finding ID.
- "Improve" the spec while you're in there.

Return a report listing:
- Findings applied (ID + one-line summary of the edit)
- Findings skipped as stale (ID + reason)
- Any new issues discovered incidentally (do NOT fix — just report)
```

Dispatch in parallel batches sized to avoid spec-file contention (agents on disjoint files can run concurrently).

## Phase 4 — Validate

For each returned report:

1. Read the edited spec sections. Confirm they match the finding's recommendation, not something the subagent invented.
2. Run `git diff <spec-file>`. Every change should trace to a listed finding ID.
3. If the subagent reported new incidental issues, append them to `.prompts/audit/FOLLOW_UP.md` (do not act on them now).
4. Update the per-spec audit report with a new section:

   ```
   ## Remediation status
   - Applied: F1, F2, F5
   - Skipped (stale): F3
   - Deferred: F4 (see TRIAGE.md)
   - Rejected: F6 (see TRIAGE.md)
   ```

   This keeps the audit artifact honest about what was acted on.

If the diff doesn't match the finding, revert the subagent's edit and re-dispatch with sharper instructions. Do not check anything off until validation passes.

## Phase 5 — Commit

Commit one spec file (or one batch of related spec files) per commit. Commit message format:

```
spec: apply audit findings to <spec-area>

Applied findings from .prompts/audit/<report-name>:
- F1: <one-line summary>
- F2: <one-line summary>
- F5: <one-line summary>

Deferred: F4
Rejected: F6 (see TRIAGE.md)
```

Audit reports and `TRIAGE.md` stay in `.prompts/audit/` as the historical record. Do **not** delete them — they are the traceability trail. Only `IMPLEMENTATION_PLAN.md`-style working files get deleted at end of session.

## Phase 6 — Report and stop

After all accepted findings are applied and committed, summarize for the user:

- Total findings applied, deferred, rejected, skipped-as-stale.
- New issues surfaced in `FOLLOW_UP.md` (if any).
- Recommended next step (usually: re-run `/spec-audit` to confirm the spec now matches source, or address deferred findings in a later pass).

Stop. Do not start the next phase of work unless the user explicitly asks.

## Failure modes to avoid

- **Auto-accepting all findings without triage.** This is the exact failure mode the audit → triage → remediate split exists to prevent. Triage is mandatory.
- **Re-auditing during remediation.** If you find new issues, log them to `FOLLOW_UP.md`. Do not silently fix them. Remediation only applies pre-existing accepted findings.
- **"While I'm in here" edits.** Every spec change must tie to a finding ID. Unrelated improvements are forbidden in this skill — they belong to `/spec-create`.
- **Deleting audit reports after applying.** The audit directory is the historical trail. It survives remediation.
- **Checking off a validation without spot-checking the diff.** If you didn't look at the diff, you didn't validate.
- **Applying findings against the wrong spec file.** Each subagent gets exactly one spec file. Cross-file edits are a hard no.
- **Trusting the subagent's "applied" claim without reading the file.** Phase 4 validation is mandatory. Subagent reports are not self-certifying.

## Invocation checklist

When the user runs `/spec-remediate`:

1. Verify `.prompts/audit/` exists and has the expected shape. If not, tell the user to run `/spec-audit` first and stop.
2. Build `.prompts/audit/TRIAGE.md` per Phase 1.
3. Present triage to user, wait for explicit confirmation (Phase 2).
4. Dispatch remediation subagents per Phase 3.
5. Validate each returned edit per Phase 4.
6. Commit per Phase 5.
7. Report status per Phase 6 and stop.
