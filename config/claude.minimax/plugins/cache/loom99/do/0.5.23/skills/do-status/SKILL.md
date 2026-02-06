---
name: "do-status"
description: "Quick status check - WIP, uncommitted changes, in-progress work, recent plans, and next queued work. Entry point for /do:status command."
context: fork
---

# Status Command

Fast, lightweight status check. No deep evaluation - just surface the current state.

Use the /Explore agent for this task.

## Output

display results from the /Explore agent and save files.

### 1. Git Status (WIP / Uncommitted Changes)

```bash
git status --short
git stash list
```

Display:
```
┌─ Working Directory ────────────────────────────────┐
│ Uncommitted changes: [n files]                     │
│ Staged: [list or "none"]                           │
│ Unstaged: [list or "none"]                         │
│ Stashes: [n stashes or "none"]                     │
└────────────────────────────────────────────────────┘
```

### 2. In-Progress Work

Check for active work in `.agent_planning/`:

```bash
ls -t .agent_planning/*/SPRINT-*-PLAN.md 2>/dev/null | head -5
```

For each found, extract:
- Topic name (from directory)
- Sprint slug (from filename)
- Confidence level (from file header: HIGH/MEDIUM/LOW)
- Status (from file content - look for checked/unchecked items)
- Last modified

Display:
```
┌─ In-Progress Work ─────────────────────────────────┐
│ 1. auth/auth-core [HIGH] - 2/5 items (2h ago)      │
│ 2. auth/auth-oauth [MEDIUM] - research needed      │
│ 3. payments/stripe-int [LOW] - exploration needed  │
│ [or "No active sprints found"]                     │
└────────────────────────────────────────────────────┘
```

**Confidence indicators:**
- HIGH → Ready for `/do:it`
- MEDIUM → Research unknowns first
- LOW → Explore options with user

### 3. Recent Plans (by Confidence)

```bash
ls -t .agent_planning/*/SPRINT-*-PLAN.md 2>/dev/null | head -5
```

Group by confidence level:

Display:
```
┌─ Recent Plans ─────────────────────────────────────┐
│ HIGH (ready for implementation):                   │
│   auth/auth-core - "Implement login flow"          │
│                                                    │
│ MEDIUM (research needed):                          │
│   auth/auth-oauth - "OAuth integration"            │
│   payments/stripe-int - "Stripe setup"             │
│                                                    │
│ LOW (exploration needed):                          │
│   payments/refunds - "Refund handling"             │
└────────────────────────────────────────────────────┘
```

### 4. Next Queued Work

Find highest priority work, preferring HIGH confidence:

```bash
# Find highest priority incomplete item from HIGH confidence sprints first
# Fall back to MEDIUM/LOW if no HIGH confidence work available
```

Display:
```
┌─ Next Up ──────────────────────────────────────────┐
│ Sprint: auth/auth-core [HIGH]                      │
│ P0: Implement password validation                  │
│ Status: Not started                                │
│                                                    │
│ Run: /do:it auth                                   │
│                                                    │
│ Waiting (needs research first):                    │
│   auth/auth-oauth [MEDIUM] - OAuth provider choice │
│   payments/refunds [LOW] - Refund policy unclear   │
└────────────────────────────────────────────────────┘
```

### 5. Retro Items (if >5 pending)

Check for pending retro items:

```bash
wc -l .agent_planning/retro/items.jsonl 2>/dev/null | awk '{print $1}'
```

If count >5, display:
```
┌─ Retro Items ──────────────────────────────────────┐
│ 12 items pending - workflow friction captured      │
│ Run: /retro list                                    │
└────────────────────────────────────────────────────┘
```

If count >20, make it more prominent:
```
┌─ ⚠️  Retro Items ───────────────────────────────────┐
│ 23 items pending - consider running retro          │
│ Run: /retro session                                 │
└────────────────────────────────────────────────────┘
```

---

## Full Output Example

```
═══════════════════════════════════════════════════════
Status Check
═══════════════════════════════════════════════════════

Working Directory:
  Uncommitted: 3 files (2 staged, 1 unstaged)
  Stashes: none

In-Progress:
  auth/ - 2/5 complete (2h ago)

Recent Plans:
  1. auth/PLAN-2024-12-13.md - "Implement login flow"
  2. payments/PLAN-2024-12-12.md - "Add Stripe"

Next Up:
  P0: Implement password validation (auth/)
  → /do:it auth

Retro Items:
  12 items pending - workflow friction captured
  → /retro list

═══════════════════════════════════════════════════════
```

---

## Important Notes

- This is a **quick check** - no deep evaluation or agent spawning
- Does NOT run tests or validate implementation
- For deep evaluation, use `/do:plan` which evaluates before planning
- Use this for "where am I?" orientation at start of session
