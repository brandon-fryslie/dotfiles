#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: validate_ticket_body.sh <ticket-body-file>" >&2
  exit 1
fi

file="$1"
[[ -f "$file" ]] || { echo "File not found: $file" >&2; exit 1; }

required_sections=(
  "## Objective"
  "## Canonical Reference Implementation"
  "## Unified Model"
  "## Signal-Specialized Path"
  "## Exact Files To Edit"
  "## Before -> After Pattern"
  "## Settled Context (Do Not Re-Investigate)"
  "## Conflict Avoidance Plan (No-Worktree Mode)"
  "## Acceptance Command"
  "## Done Criteria"
)

missing=0
for section in "${required_sections[@]}"; do
  if ! rg -Fq "$section" "$file"; then
    echo "Missing required section: $section" >&2
    missing=1
  fi
done

# Must include at least one code path in backticks
if ! rg -q '`[^`]+\.[a-z]+' "$file"; then
  echo "Missing explicit file path references in backticks" >&2
  missing=1
fi

# Settled context must explicitly prevent reinvestigation and define escalation boundary
if ! rg -q 'Do not re-investigate|do not re-investigate' "$file"; then
  echo "Settled context should explicitly instruct implementers not to re-investigate" >&2
  missing=1
fi
if ! rg -q 'Escalate only if blocked|escalate only if blocked|blocked' "$file"; then
  echo "Settled context should include escalation boundary" >&2
  missing=1
fi

# Conflict plan should mention ownership and coordination (lightweight check)
if ! rg -q 'Owned files|owned files' "$file"; then
  echo "Conflict plan should mention owned files" >&2
  missing=1
fi
if ! rg -q 'overlap|shared' "$file"; then
  echo "Conflict plan should mention possible overlap/shared touchpoints" >&2
  missing=1
fi
if ! rg -q 'coordination|merge|rebase' "$file"; then
  echo "Conflict plan should include a coordination note" >&2
  missing=1
fi

# Must include acceptance command fallback pattern signal (just + pnpm)
if ! rg -q 'just check|pnpm run typecheck' "$file"; then
  echo "Missing acceptance command guidance" >&2
  missing=1
fi

if [[ $missing -ne 0 ]]; then
  exit 1
fi

echo "OK: ticket body passes required structure checks"
