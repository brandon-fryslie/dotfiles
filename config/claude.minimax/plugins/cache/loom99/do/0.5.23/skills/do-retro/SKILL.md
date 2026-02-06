---
name: "do-retro"
description: "Keep track of systemic problems with your workflow so they don't get lost. Add items, or run a retrospective to brainstorm and implement solutions. Entry point for /do:retro command."
context: fork
---

# Retro Command

Quick capture of workflow friction, wins, and observations for later review and continuous improvement.

## Design Philosophy

- **Instant capture** - Adding items must be instantaneous, no ceremony
- **Agent participation** - Claude can add observations alongside you
- **Actionable outcomes** - Retros lead to concrete improvements via beads tasks
- **Persistent memory** - Items accumulate until explicitly reviewed

## Usage Modes

### 1. Quick Add (Default - Ultra Fast)

When arguments provided, immediately append to retro log. No questions, no output delay.

```bash
/retro <item text>
/retro <category>: <item text>
```

**Valid categories:**
- `friction` - Things that slow you down
- `success` - Things that worked well
- `confusion` - Things that were unclear
- `observation` - Patterns noticed over time
- `debt` - Technical debt causing problems
- `tooling` - Tool/workflow improvements needed

**Default category:** `friction` (if no category specified)

**Examples:**
```bash
# Quick friction capture (most common)
/retro Tests failed mysteriously, took 15min to debug

# Explicit categories
/retro success: New testing workflow saved tons of time
/retro debt: Legacy auth code blocking new features
/retro confusion: Unclear which agent handles test implementation
/retro tooling: Need better way to track deferred work
```

**Implementation:**
1. Parse optional category prefix pattern `<category>: <text>`
2. Default to `friction` if no category
3. Create JSON entry: `{timestamp, source:"user", category, text, context:{working_dir, last_command}}`
4. Append line to `.agent_planning/retro/items.jsonl`
5. Count total items
6. Output: `✓ Added to retro (N items pending)`

**Critical:** This must be FAST. No validation, no questions, just append and confirm.

---

### 2. Run Retro Session

```bash
/retro session
/retro run
```

Launch retrospective agent to facilitate collaborative review:

**Session Flow:**
1. Load all items from `items.jsonl`
2. Group and cluster by category + similarity
3. Present items for review with context
4. Collaborative brainstorming on solutions
5. Create actionable next steps (convert to beads tasks)
6. Archive session notes to `sessions/RETRO-<timestamp>.md`
7. Clear `items.jsonl` (items now in session archive)

**Output:** Session notes + list of created beads tasks

---

### 3. List Pending Items

```bash
/retro list
/retro show
```

Display all pending items grouped by category with counts.

**Format:**
```
┌─ Retro Items (12 pending) ─────────────────────┐
│                                                 │
│ Friction (7):                                   │
│  • Tests failed mysteriously... (2h ago)        │
│  • Import paths keep breaking (1d ago)          │
│  ...                                            │
│                                                 │
│ Success (3):                                    │
│  • New testing workflow... (3h ago)             │
│  ...                                            │
│                                                 │
│ Debt (2):                                       │
│  • Legacy auth code blocking... (1d ago)        │
│  ...                                            │
│                                                 │
│ Run: /retro session                             │
└─────────────────────────────────────────────────┘
```

---

## Data Storage

### Structure
```
.agent_planning/retro/
├── items.jsonl                  # Append-only log of pending items
└── sessions/
    ├── RETRO-2025-01-11-143000.md   # Archived session notes
    └── RETRO-2025-01-15-091500.md
```

### items.jsonl Format

One JSON object per line (JSONL format):

```json
{"timestamp": "2025-01-11T14:30:00Z", "source": "user", "category": "friction", "text": "Had to manually fix import paths after refactor", "context": {"working_dir": "/path", "last_command": "/do:it"}}
{"timestamp": "2025-01-11T15:45:00Z", "source": "agent", "category": "observation", "text": "User asked same question about test setup 3 times this week", "context": {"trigger": "repeated_question"}}
```

**Fields:**
- `timestamp` (required) - ISO 8601 timestamp
- `source` (required) - `"user"` or `"agent"`
- `category` (required) - One of: friction, success, confusion, observation, debt, tooling
- `text` (required) - Item description
- `context` (optional) - Any metadata (working_dir, command, trigger reason, etc.)

---

## Agent Participation

Agents can add retro items automatically when they observe patterns. Items are added **silently** - no interruption to flow.

### Agent Trigger Conditions

Add retro item when:
- User asked same question >2 times in conversation
- Same error encountered multiple times
- Test suite takes >2x longer than expected
- User had to manually fix something agent broke
- User expressed frustration or confusion
- Workflow took significantly longer than anticipated
- Agent noticed repeated manual work that could be automated

### Agent Implementation

When trigger detected, agent appends to items.jsonl:
```json
{
  "timestamp": "<now>",
  "source": "agent",
  "category": "observation|friction",
  "text": "Clear description of pattern observed",
  "context": {
    "trigger": "repeated_question|repeated_error|manual_fix|...",
    "frequency": 3,
    "details": "..."
  }
}
```

**Important:** Agent additions are silent. User sees count during `/retro list` or `/do:status`.

---

## Integration with Other Commands

### /do:status Integration

When pending retro items >5, include in status output:

```
┌─ Retro Items ──────────────────────────────────┐
│ 12 items pending - workflow friction captured  │
│ Run: /retro list                                │
└─────────────────────────────────────────────────┘
```

### Post-Completion Hooks

After `/do:it` or `/do:stuff` completes, agent may silently add observations:
- If user had to intervene multiple times → friction item
- If tests failed unexpectedly → observation item
- If workflow was notably smooth → success item

### Pre-Compact Reminder

If >20 items pending before conversation compact, remind user:
```
🔔 You have 23 retro items pending. Consider running /retro session
   before compacting to preserve observations.
```

---

## Example Retro Session Output

```markdown
# Retrospective Session - 2025-01-11

## Items Reviewed (15 total)

### Friction (8 items)
- Tests failed mysteriously, took 15min to debug
- Import paths keep breaking after refactor
- [Agent] User had to fix same linting error 3 times
- ...

### Success (4 items)
- New testing workflow saved tons of time
- Agent fixed complex bug on first try
- ...

### Debt (3 items)
- Legacy auth code blocking new features
- ...

## Brainstorming & Solutions

### Problem: Tests failing mysteriously
**Root cause:** Flaky test setup with timing issues
**Solutions discussed:**
1. Add retry logic (quick fix)
2. Fix underlying timing issue (proper fix)
**Decided:** Create beads task for proper fix

### Problem: Import paths breaking
**Root cause:** Manual path updates after moves
**Solutions discussed:**
1. Use path aliases in tsconfig
2. Automated refactoring tool
**Decided:** Implement path aliases now

## Action Items Created

✓ Created beads task: "Fix flaky test timing issues" (#142)
✓ Created beads task: "Add TypeScript path aliases" (#143)
✓ Implemented immediately: ESLint auto-fix on save

## Next Steps

Run `/do:it` to work on created tasks, or `/beads ready` to see what's unblocked.
```

---

## Implementation Notes

### For Command Handler

The `/retro` command should:

1. **Quick add mode** (default when args provided):
   - Parse category from `<category>: <text>` pattern
   - Default to `friction` if no category
   - Ensure `.agent_planning/retro/` directory exists
   - Append JSON line to `items.jsonl`
   - Count total lines in file
   - Output confirmation with count

2. **Session mode** (`session` or `run` arg):
   - Launch agent (use existing agent patterns)
   - Agent loads items.jsonl
   - Agent facilitates interactive session
   - Agent creates beads tasks for action items
   - Agent archives to sessions/ directory
   - Agent clears items.jsonl

3. **List mode** (`list` or `show` arg):
   - Read items.jsonl
   - Group by category
   - Sort by timestamp (recent first)
   - Display formatted output

### For Agents

When agent wants to add retro item:
```python
import json
from pathlib import Path
from datetime import datetime

def add_retro_item(category: str, text: str, context: dict = None):
    retro_dir = Path(".agent_planning/retro")
    retro_dir.mkdir(parents=True, exist_ok=True)

    item = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "agent",
        "category": category,
        "text": text,
        "context": context or {}
    }

    with open(retro_dir / "items.jsonl", "a") as f:
        f.write(json.dumps(item) + "\n")
```

---

## Why This Design Works

1. **Minimal friction** - Adding item is single command with instant feedback
2. **No interruption** - Agent can participate without disrupting flow
3. **Persistent memory** - Items survive conversation compaction
4. **Actionable** - Sessions produce concrete tasks via beads
5. **Flexible** - Works for quick wins and deep problems
6. **Discoverable** - Integration with /do:status surfaces pending items

This creates a continuous improvement loop that's effortless to maintain.
