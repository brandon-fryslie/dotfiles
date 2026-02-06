---
name: "do-deferred-work-cleanup"
description: "Find incomplete migrations, legacy fallbacks, dual code paths, and deferred work causing unnecessary complexity. Entry point for /do-more:deferred-work-cleanup command."
context: fork
---

Scan for technical debt from incomplete transitions, migrations, and deferred work.

<user-input>$ARGUMENTS</user-input>
<current-command>deferred-work-cleanup</current-command>

## Depth Selection

Parse `$ARGUMENTS` for depth:

| Argument | Depth | Description |
|----------|-------|-------------|
| `quick` | Quick | Pattern-based search, fast results |
| `deep` | Deep | Comprehensive review including git history, planning docs |
| *(empty)* | Ask | Prompt user to choose |

If no argument provided, ask:

```json
{
  "questions": [{
    "question": "How thorough should the scan be?",
    "header": "Depth",
    "options": [
      {"label": "Quick scan", "description": "Pattern-based search for common indicators (~2 min)"},
      {"label": "Deep analysis", "description": "Includes git history, planning docs, comprehensive review (~10 min)"}
    ],
    "multiSelect": false
  }]
}
```

---

## Quick Scan

Fast pattern-based detection of common debt indicators.

### Step Q1: Code Pattern Detection

Search for common indicators of incomplete work:

**Migration/Transition Indicators:**
```bash
# TODO/FIXME mentioning migration, legacy, or temporary
grep -rn "TODO.*migrat\|FIXME.*migrat\|TODO.*legacy\|FIXME.*legacy\|TODO.*temporary\|FIXME.*temporary" --include="*.{ts,js,py,go,rs,java}" .

# Explicit legacy markers
grep -rn "LEGACY\|DEPRECATED\|OLD_\|_OLD\|_LEGACY\|V1_\|_V1\|V2_" --include="*.{ts,js,py,go,rs,java}" .

# Fallback patterns
grep -rn "fallback\|Fallback\|FALLBACK" --include="*.{ts,js,py,go,rs,java}" .
```

**Dual Code Path Indicators:**
```bash
# Feature flags that might be stale
grep -rn "feature.*flag\|featureFlag\|FEATURE_FLAG\|USE_NEW\|USE_OLD\|ENABLE_\|DISABLE_" --include="*.{ts,js,py,go,rs,java}" .

# Conditional new/old logic
grep -rn "useNew\|useOld\|isLegacy\|isNew\|newImplementation\|oldImplementation" --include="*.{ts,js,py,go,rs,java}" .

# Version-specific code paths
grep -rn "if.*version\|switch.*version" --include="*.{ts,js,py,go,rs,java}" .
```

**Incomplete Refactoring:**
```bash
# Commented out code blocks (potential dead code)
grep -rn "^[[:space:]]*//.*{$\|^[[:space:]]*#.*def \|^[[:space:]]*//.*function" --include="*.{ts,js,py,go,rs,java}" .

# Temporary workarounds
grep -rn "HACK\|WORKAROUND\|TEMP\|XXX\|KLUDGE" --include="*.{ts,js,py,go,rs,java}" .
```

### Step Q2: Categorize Findings

Group findings by type:

| Category | Risk | Examples |
|----------|------|----------|
| **Incomplete Migration** | High | "TODO: migrate to new API", LEGACY_ prefixes |
| **Dual Code Paths** | High | Feature flags, useNew/useOld patterns |
| **Legacy Fallbacks** | Medium | Fallback code that may no longer be needed |
| **Deferred Cleanup** | Low | TODO/FIXME for cleanup, commented code |

### Step Q3: Quick Report

```markdown
═══════════════════════════════════════════════════════════════
Deferred Work Scan - Quick Results
═══════════════════════════════════════════════════════════════

## Summary
- **Incomplete Migrations**: [count] found
- **Dual Code Paths**: [count] found
- **Legacy Fallbacks**: [count] found
- **Deferred Cleanup**: [count] found

## High Priority (should address soon)

### Incomplete Migrations
| File | Line | Issue |
|------|------|-------|
| [file] | [line] | [description] |

### Dual Code Paths
| File | Line | Issue |
|------|------|-------|
| [file] | [line] | [description] |

## Medium Priority

### Legacy Fallbacks
[List...]

## Low Priority

### Deferred Cleanup
[List...]

═══════════════════════════════════════════════════════════════

For deeper analysis: /do:deferred-work-cleanup deep
To start cleanup: /do:it fix [specific-item]
```

---

## Deep Analysis

Comprehensive review including history and planning context.

### Step D1: Run Quick Scan First

Execute all quick scan steps (Q1-Q3) to gather baseline.

### Step D2: Planning Document Analysis

Check planning docs for documented deferred work:

```bash
# Find planning files
ls -la .agent_planning/*.md 2>/dev/null

# Search for deferred/blocked items
grep -rn "DEFERRED\|BLOCKED\|OUT.OF.SCOPE\|FUTURE\|LATER\|BACKLOG" .agent_planning/ 2>/dev/null
```

Read recent STATUS and PLAN files to identify:
- Items marked as "deferred to future sprint"
- Known technical debt acknowledged but not addressed
- Blocked items waiting on external dependencies

### Step D3: Git History Analysis

Look for patterns suggesting incomplete work:

```bash
# Recent commits mentioning migration/refactor
git log --oneline --since="3 months ago" --grep="migrat\|refactor\|legacy\|cleanup" | head -20

# Branches that might be stale migrations
git branch -a | grep -i "migrat\|refactor\|legacy\|cleanup"

# Large commits that might indicate rushed merges
git log --oneline --since="3 months ago" --shortstat | grep -B1 "files changed.*insertion"
```

### Step D4: Dependency Analysis

Check for version mismatches suggesting incomplete upgrades:

```bash
# Node.js projects
cat package.json 2>/dev/null | grep -A50 '"dependencies"' | head -60

# Python projects
cat pyproject.toml requirements.txt 2>/dev/null | grep -i "==\|>=\|<="

# Look for pinned old versions with comments
grep -rn "pinned\|locked\|frozen" package.json pyproject.toml Cargo.toml go.mod 2>/dev/null
```

### Step D5: Cross-Reference Beads

If beads is available, check for stale issues:

```bash
bd stale --days 30 --json 2>/dev/null || echo "Beads not available"
bd list --status blocked --json 2>/dev/null || echo ""
```

### Step D6: Deep Report

```markdown
═══════════════════════════════════════════════════════════════
Deferred Work Analysis - Deep Results
═══════════════════════════════════════════════════════════════

## Executive Summary

**Overall Technical Debt Level**: [Low/Medium/High/Critical]

Key findings:
- [X] incomplete migrations affecting [areas]
- [Y] dual code paths that could be consolidated
- [Z] items documented as deferred but not tracked

## Code Analysis

### Incomplete Migrations
[Detailed findings with file paths, line numbers, and context]

**Impact Assessment**:
- Affected components: [list]
- Risk if not addressed: [description]
- Recommended timeline: [suggestion]

### Dual Code Paths
[Detailed findings...]

**Consolidation Opportunities**:
- [Specific suggestions for merging code paths]

### Legacy Fallbacks
[Detailed findings...]

**Removal Candidates**:
- [Fallbacks that appear safe to remove]

## Planning Context

### Documented Deferred Work
From .agent_planning/:
- [Item 1]: [status, when deferred, why]
- [Item 2]: [status, when deferred, why]

### Beads Issues (if available)
- Stale issues: [count]
- Blocked issues: [count]
- [List of relevant issues]

## Git History Insights

### Incomplete Branches
| Branch | Last Activity | Purpose |
|--------|---------------|---------|
| [branch] | [date] | [inferred purpose] |

### Migration-Related Commits
[Summary of recent migration work and whether it appears complete]

## Recommended Actions

### Immediate (This Sprint)
1. [High-priority item with rationale]
2. [High-priority item with rationale]

### Short-Term (Next 2-4 Weeks)
1. [Medium-priority item]
2. [Medium-priority item]

### Long-Term (Backlog)
1. [Lower-priority item]

═══════════════════════════════════════════════════════════════

## Next Steps

To address specific items:
  /do:it fix [item-description]

To track as beads issues:
  bd create "Cleanup: [description]" -t chore -p 2

To create a cleanup plan:
  /do:plan cleanup [area]
```

---

## Beads Integration

If significant deferred work found, offer to create tracking issues:

```json
{
  "questions": [{
    "question": "Found [N] items needing attention. Create beads issues to track cleanup?",
    "header": "Track",
    "options": [
      {"label": "Create issues", "description": "Create beads issues for each high-priority item"},
      {"label": "Just report", "description": "Show findings without creating issues"},
      {"label": "Create umbrella issue", "description": "Create one epic to track all cleanup work"}
    ],
    "multiSelect": false
  }]
}
```

If "Create issues" selected:
```bash
# Create umbrella epic
bd create "Tech Debt Cleanup Sprint" \
  --type epic \
  -p 2 \
  --description "Cleanup work identified by /do:deferred-work-cleanup on $(date)" \
  --json

# Create individual issues linked to epic
bd create "[Cleanup] [specific item]" \
  --type chore \
  -p [priority] \
  --json
```

---

## Output Persistence

Save findings to `.agent_planning/DEFERRED-WORK-AUDIT-<timestamp>.md` for future reference.

This allows:
- Tracking progress over time
- Comparing before/after cleanup sprints
- Onboarding new team members to existing debt
