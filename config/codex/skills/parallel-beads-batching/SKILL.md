---
name: parallel-beads-batching
description: Use when the user asks to split work into parallel streams and create beads tickets. Produces self-contained, implementation-ready tickets in the canonical main-repo beads DB (never worktree-local DB), with explicit file lists, before/after patterns, references, dependencies, and lightweight no-worktree conflict notes.
allowed-tools: "Read,Bash(bd:*),Bash(git:*),Bash(rg:*)"
version: "1.3.0"
---

# Parallel Beads Batching

Create high-quality beads tickets for parallel execution without forcing agents to rediscover architecture.

## When To Use

Activate when the user asks to:
- batch up work
- parallelize workstreams
- create beads tickets for migration/refactor initiatives
- provide batch IDs for agent assignment

## Hard Requirements

1. **Use canonical DB only**
- Always target the canonical repo DB, never a worktree-local `.beads` DB.
- Use `scripts/resolve_canonical_beads_db.sh` to get the DB path.
- Every `bd` command must include `--db "$(scripts/resolve_canonical_beads_db.sh)"`.

2. **Self-contained ticket descriptions**
- Each ticket must include all required sections from `references/TICKET_TEMPLATE.md`.
- Do not create thin tickets.

3. **Ticket author must front-load investigation**
- The ticket writer is responsible for including already-validated assumptions, exact files, and concrete before/after patterns.
- Do not offload rediscovery to implementation agents.

4. **Re-investigation guard is mandatory**
- Every ticket must include `## Settled Context (Do Not Re-Investigate)`.
- Keep this section short and concrete:
  - known facts/assumptions already validated
  - explicit instruction: implementer should not re-investigate this scope
  - escalation boundary: only re-open investigation if blocked by contradiction or missing artifact

5. **Parallel-safe decomposition**
- Split by file ownership seams and dependency seams.
- Minimize overlapping files across same-batch tickets.
- Encode prerequisites via `bd dep add`.

6. **No-worktree conflict note is mandatory (lightweight)**
- Assume agents may work on the same branch without worktrees.
- Every ticket must include `## Conflict Avoidance Plan (No-Worktree Mode)`.
- Keep this section short and concrete:
  - owned files for this ticket
  - likely overlap files (if any)
  - simple coordination note (merge/rebase order)

7. **Batch output is mandatory**
- Return explicit batch lists in dependency order (Batch A/B/C...), each with IDs and titles.

8. **Working acceptance command**
- Use command fallback, never assume `just` exists:

```bash
if command -v just >/dev/null 2>&1 && [ -f Justfile ]; then
  just check
else
  pnpm run typecheck && pnpm test
fi
```

## Workflow

### 1) Preflight

1. Resolve canonical DB:
```bash
DB="$(scripts/resolve_canonical_beads_db.sh)"
```
2. Optional import/sync safety:
```bash
bd --db "$DB" sync --import-only --json || true
```
3. Confirm commands work against canonical DB:
```bash
bd --db "$DB" ready --allow-stale --json | head
```

### 2) Analyze and Split Work

Use `rg` to locate impacted files/symbols and split into tracks:
- Block-level migration tracks (by block family)
- Compiler IR/model tracks
- Runtime vestige removal tracks
- Test/forbidden-pattern hardening tracks

Heuristics:
- One ticket should own one coherent seam.
- Avoid tickets that require broad repo-wide edits and unknown ownership.
- Keep each ticket executable by one agent in one session.

No-worktree heuristics:
- Prefer **disjoint file sets** per same-batch ticket.
- If shared files are unavoidable, isolate to one owner ticket and make others depend on it.
- Keep "global" files (barrels, large type hubs, forbidden-pattern tests) in dedicated later-phase tickets.

### 3) Author Ticket Bodies

Use `references/TICKET_TEMPLATE.md`.

Mandatory content per ticket:
- **Canonical reference implementation** (existing file agents should copy pattern from)
- **Unified model definition** (what replaces legacy behavior)
- **Signal-specialized path definition** (what exact patterns to remove)
- **Exact files to edit**
- **Before -> after pattern**
- **Settled Context (Do Not Re-Investigate)** (validated assumptions and escalation boundary)
- **Conflict Avoidance Plan (No-Worktree Mode)** (lightweight ownership/overlap/coordination)
- **Implementation checklist**
- **Acceptance command** (with just/pnpm fallback)
- **Done criteria**

### 4) Create/Update Tickets

Prefer deterministic IDs for batching.

Create/update flow:
1. Create ticket (or update if exists)
2. Attach parent if needed
3. Add dependencies
4. Sync DB

Use helper script:
```bash
scripts/create_or_update_ticket.sh --id <id> --title "..." --priority <0-4> --body-file /tmp/body.md [--parent <id>] [--depends-on <id1,id2,...>]
```

### 5) Validate Ticket Quality

Run:
```bash
scripts/validate_ticket_body.sh /tmp/body.md
```

Reject ticket bodies missing required sections.

### 6) Output to User

Always provide:
- Canonical DB path used
- Batch lists in order
- IDs + short titles
- Which batch is ready to start now

## Canonical Output Format

```text
Canonical DB: /path/to/main/repo/.beads/beads.db

Batch A (run now, parallel):
- repo-xxxx | Title
- repo-yyyy | Title

Batch B (blocked on A):
- repo-zzzz | Title

Batch C (blocked on B):
- repo-qqqq | Title
```

## Common Failure Modes

- Using `.beads` from a worktree path
- Thin tickets without file lists/patterns/reference implementation
- Missing settled-context section that prevents re-investigation
- Missing conflict-avoidance note for no-worktree execution
- Missing dependency wiring
- Claiming `just check` when `Justfile` is absent
- Giving only an epic without actionable child tickets

## Resources

- Template: `references/TICKET_TEMPLATE.md`
- Checklist: `references/BATCHING_CHECKLIST.md`
- DB resolver: `scripts/resolve_canonical_beads_db.sh`
- Ticket helper: `scripts/create_or_update_ticket.sh`
- Body validator: `scripts/validate_ticket_body.sh`
