# Batching Checklist

## Preflight
- [ ] Canonical DB resolved with `scripts/resolve_canonical_beads_db.sh`
- [ ] No bare `bd` commands without `--db`
- [ ] DB path points to main repo, not worktree

## Decomposition Quality
- [ ] Work split into at least 2 parallel tickets in Batch A
- [ ] Same-batch tickets minimize file overlap
- [ ] Dependencies explicitly wired for blocked work

## Ticket Quality
For each ticket:
- [ ] Has canonical reference implementation
- [ ] Defines unified model
- [ ] Defines signal-specialized path to remove
- [ ] Lists exact files to edit
- [ ] Includes before/after pattern
- [ ] Includes `Settled Context (Do Not Re-Investigate)`
- [ ] Settled context includes known facts + explicit "do not re-investigate" + escalation boundary
- [ ] Includes `Conflict Avoidance Plan (No-Worktree Mode)`
- [ ] Conflict plan includes owned files + possible overlap + one-line coordination note
- [ ] Includes acceptance command with `just` fallback
- [ ] Includes done criteria

## Output Quality
- [ ] Batch list includes IDs + titles
- [ ] Batch order reflects dependencies (A -> B -> C)
- [ ] Canonical DB path included in output
- [ ] Clear "start now" batch identified
