---
name: "do-debug"
description: "Systematic root cause investigation. Use when user reports a bug, error, or unexpected behavior and wants to find the cause."
---

# Debug

Systematic root cause investigation.

## Process

**Step 1**: Use do:researcher in **debug mode**:
- Gather information about symptoms
- Search codebase for relevant paths
- Identify potential causes
- Form hypotheses

**Step 2**: Use do:work-evaluator to test hypotheses:
- Add logging/debugging if needed
- Run code to gather evidence
- Narrow down root cause

**Step 3**: Document findings.

## Output

Does NOT fix the bug - just identifies root cause.

```
═══════════════════════════════════════
Debug Investigation Complete
  Symptom: [original description]
  Root Cause: [identified cause]
  Location: [file:line]

  Suggested fix: [brief description]
Next: /do:it fix [description]
═══════════════════════════════════════
```
