# Improvements Over examples/claude-code-skill

This document captures the key differences and improvements in this skill compared to the original `examples/claude-code-skill`.

## 1. CLI-First Focus

**Original**: Mixed MCP and CLI guidance, general patterns
**New**: Pure CLI focus with concrete command examples throughout

Every example uses actual `bd` commands that can be copy-pasted:
```bash
bd create "Title" --description="..." -t bug -p 1 --deps discovered-from:bd-42 --json
```

## 2. Dependency Inversion Gotcha - Prominent Treatment

**Original**: Mentioned in DEPENDENCIES.md reference
**New**: Featured prominently in main SKILL.md AND deep dive in references

This is the #1 mistake agents make. The new skill:
- Explains WHY temporal language causes the inversion
- Provides clear WRONG vs RIGHT examples
- Gives a mnemonic: `bd dep add NEEDS NEEDED`
- Includes verification step: `bd blocked` should show tasks blocked BY prerequisites

## 3. `bd sync` as Mandatory Session End

**Original**: Mentioned as recommendation
**New**: Emphasized as MANDATORY with warning about consequences

The new skill makes clear:
- Without `bd sync`, changes stay in 30s debounce window
- Session is NOT complete until sync runs
- Includes verification: `git status` should show "up to date"

## 4. Streamlined Structure

**Original**: 7 reference files (645 lines in SKILL.md)
**New**: 4 reference files (194 lines in SKILL.md)

| Original References | New References |
|---------------------|----------------|
| BOUNDARIES.md | (merged into SKILL.md decision table) |
| CLI_REFERENCE.md | CLI_COMMANDS.md |
| DEPENDENCIES.md | DEPENDENCIES.md |
| ISSUE_CREATION.md | (merged into BEST_PRACTICES.md) |
| RESUMABILITY.md | (merged into SESSION_LIFECYCLE.md) |
| STATIC_DATA.md | (removed - edge case) |
| WORKFLOWS.md | SESSION_LIFECYCLE.md |

## 5. Clearer bd vs TodoWrite Decision

**Original**: Detailed decision tree across multiple files
**New**: Simple table in SKILL.md with clear rule of thumb

```
| Use bd when | Use TodoWrite when |
|-------------|-------------------|
| Multi-session work | Single-session tasks |
| Complex dependencies | Linear execution |
| Need context after compaction | Immediate context sufficient |

Rule of thumb: If resuming after 2 weeks would be difficult without notes, use bd.
```

## 6. Session Lifecycle as First-Class Concept

**Original**: Scattered across WORKFLOWS.md and SKILL.md
**New**: Dedicated SESSION_LIFECYCLE.md with clear phases

- **Start**: Checklist + example report format
- **During**: Claiming, discovering, checkpointing
- **End**: Mandatory checklist with `bd sync`
- **Post-Compaction**: Recovery workflow
- **Side Quest Handling**: Complete example flow

## 7. Quality Checklists

**New addition**: BEST_PRACTICES.md includes actionable checklists:
- Before Creating an Issue
- Before Session End
- Writing Good Notes
- Adding Dependencies

## 8. Discovered Work Pattern - One Command

**Original**: Shows two-command approach
**New**: Emphasizes single-command approach (preferred)

```bash
# Old way (two commands)
bd create "Bug" -t bug -p 1 --json
bd dep add bd-new bd-parent --type discovered-from

# New way (one command - preferred)
bd create "Bug" -t bug -p 1 --deps discovered-from:bd-parent --json
```

## 9. Clearer Notes Format

**Original**: General guidance on notes
**New**: Explicit format with labeled sections

```
COMPLETED: Specific deliverables
KEY DECISION: Important choices with rationale
IN PROGRESS: Current state
NEXT: Immediate next step
BLOCKER: What's preventing progress
```

## 10. Removed Non-Essential Content

**Removed**:
- STATIC_DATA.md (edge case for using bd as reference database)
- Extensive TodoWrite integration patterns (simplified to decision table)
- MCP server references (CLI-only focus)
- Database selection details (auto-discovery handles this)

**Result**: More focused skill that teaches the essential 80% without overwhelming detail.

## 11. Added Operational Commands

**New addition**: `references/OPERATIONS.md` covers commands that are core to agent workflows but weren't in the original:

- **`bd prime`** - Context injection for hooks, prevents forgetting bd after compaction
- **`bd compact`** - Memory decay chores (agent-driven summarization)
- **`bd stale`** - Find forgotten issues
- **`bd duplicates`** - Deduplication and merging
- **`bd config`** - Project-level configuration
- **`bd rename-prefix`** - Change issue prefix
- **Agent Mail awareness** - Multi-agent coordination, collision prevention

These aren't "advanced" - they're operational commands agents should know about.

## Summary

The new skill is:
- **More actionable** - concrete CLI commands throughout
- **More focused** - CLI-only, essential patterns
- **Safer** - dependency gotcha and `bd sync` prominently featured
- **Shorter** - 194 lines SKILL.md vs 645 lines original
- **Better structured** - clear session lifecycle phases
