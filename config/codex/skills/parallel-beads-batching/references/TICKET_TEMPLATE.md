## Objective
One sentence: what outcome this ticket must produce.

## Canonical Reference Implementation
List 1-3 existing files already using the target pattern. Agents should copy these patterns.
- `path/to/reference-file.ts`
- `path/to/reference-file.ts`

## Unified Model (What Replaces Legacy Behavior)
Describe the target architectural behavior in concrete terms.

## Signal-Specialized Path (What To Remove)
List concrete legacy patterns to remove:
- guard/branch pattern
- symbol names
- legacy assumptions

## Exact Files To Edit
Be explicit. No vague scope.
- `path/to/file-a.ts`
- `path/to/file-b.ts`

## Before -> After Pattern
### Before
```ts
// legacy pattern
```

### After
```ts
// target pattern
```

## Settled Context (Do Not Re-Investigate)
Keep this short and concrete:
- **Known facts**: assumptions already validated by ticket author.
- **Do not re-investigate**: implementing agent should execute this plan as written.
- **Escalate only if blocked**: contradiction, missing file/symbol, or acceptance criteria cannot be met.

## Conflict Avoidance Plan (No-Worktree Mode)
Keep this short:
- **Owned files**: list files this ticket owns.
- **Possible overlap**: list any shared files that might conflict.
- **Coordination note**: one line on merge/rebase order.

## Implementation Checklist
1. Specific edit 1
2. Specific edit 2
3. Specific edit 3

## Acceptance Command
```bash
rg -n "pattern1|pattern2" src
if command -v just >/dev/null 2>&1 && [ -f Justfile ]; then
  just check
else
  pnpm run typecheck && pnpm test
fi
```

## Done Criteria
- Deterministic checklist item
- Deterministic checklist item
- Acceptance command passes

## Non-Goals
List what should NOT be changed in this ticket.
