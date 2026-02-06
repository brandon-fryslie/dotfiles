---
name: "do-chores"
description: "[quick|thorough|git|planning|dead-code|deps|debt] Chores - maintenance, cleanup, housekeeping. Entry point for /do:chores command."
context: fork
---

Maintenance and housekeeping. Cleanup of any sort.

<user-input>$ARGUMENTS</user-input>
<current-command>chores</current-command>

## Topic Resolution

Determine scope of chores:

1. **If `$ARGUMENTS` provided** → Use `$ARGUMENTS` to determine chore type/scope
2. **If no arguments, check conversation context** → If we were just discussing a subject, scope chores to that area
3. **If no obvious subject in conversation** → Run quick chores (default)

Set `main_instructions` to the resolved scope.

---

## Main Workflow

### Modes

Using `main_instructions`:

| Mode | Trigger | Duration | Scope |
|------|---------|----------|-------|
| **Quick** | default, "quick" | 5-10 min | Git hygiene, planning cleanup, quick code scan |
| **Thorough** | "thorough", "deep" | 20-40 min | All quick + dead code, doc sync, tech debt |
| **Specific** | chore name | varies | Single chore type |

**Specific chores**: `git`, `planning`, `dead-code`, `deps`, `debt`, `docs`

### Process

Use do:iterative-implementer to execute chores.
- If there are minor issues or standard tasks to tidy up, do them immediately.
- If there are larger concerns or a large amount of ambiguity, use /do:plan track to add an item to the backlog (print in summary)

**Quick chores**:
- Git hygiene (clean status, stale branches)
- Planning file cleanup (archive old STATUS/PLAN)
- Quick code scan (TODOs, debug code, secrets)
- Dependency quick check

**Thorough chores**:
- All quick chores AND
- Dead code detection
- Documentation sync
- Technical debt inventory
- Actually fix simple issues found

### Output

Display a summary of work completed:

```
═══════════════════════════════════
Chores Complete ([quick | thorough | specific])
  Cleaned up:
   - [list items cleaned up]
  Fixed:
   - [list issues]
  Addl work tracked:
    - [list items]
  Flagged:
    - [list items]

  [Summary of what was done]
═══════════════════════════════════
```
