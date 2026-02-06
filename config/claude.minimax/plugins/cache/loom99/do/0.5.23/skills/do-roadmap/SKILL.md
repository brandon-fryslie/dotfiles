---
name: "do-roadmap"
description: "Parse and manipulate ROADMAP.md for hierarchical project planning. Supports single/batch topic addition, migration, and context validation."
context: fork
---

# Roadmap Skill

## Purpose

Manage `.agent_planning/ROADMAP.md` hierarchical roadmaps with phases and topics. Supports viewing, adding topics (single or batch), migrating formats, and validating planning context.

## When to Use

- View roadmap tree: `/do:roadmap`
- Add single topic: `/do:roadmap "topic-name - description"`
- Batch add: `/do:roadmap "topic1; topic2; topic3"` or numbered/bulleted list
- Migrate format: `/do:roadmap migrate` (auto-converts cherry-chrome-mcp format)
- Topics with priority: Use P1/P2/P3 markers to auto-assign phases

## Features

- **Batch Input Detection**: Recognizes multi-item input (semicolon, newline, numbered, bullet)
- **Priority Mapping**: P1/P2/P3 auto-assign to phases
- **Context Validation**: Ensures topics have problem + outcome + project areas
- **Format Migration**: Auto-converts narrative formats to schema
- **State Detection**: Auto-sets PLANNING if planning files exist

## Entry Point

The skill is invoked by `/do:roadmap` command via `Skill("do:roadmap-skill")`.

## Implementation

All heavy lifting is in `scripts/` directory with executable Python scripts:

- `roadmap_lib.py` - Shared utilities (parsing, writing, CRUD)
- `migrate_roadmap.py` - Format migration logic
- `batch_add.py` - Batch topic addition
- `validate_context.py` - Context sufficiency validation

### Main Workflow

**View Roadmap** (no arguments):
1. Check if ROADMAP.md exists
2. Parse it using `roadmap_lib.parse_roadmap()`
3. Format and display tree view

**Add Topics** (with topic argument):
1. Use `roadmap_lib.detect_multiple_topics()` to check if batch input
2. If batch (2+ items): Call `batch_add.py` script
3. If single: Prompt user for phase, summary, validate context, create directory, add to roadmap

**Migrate Format** (topic="migrate"):
1. Call `migrate_roadmap.py` script
2. Detect if migration needed
3. Backup original, migrate to schema format, write updated file

### Script Outputs

All scripts return JSON. Examples:

**migrate_roadmap.py** success:
```json
{"status": "migrated", "phases": 3, "topics": 8, "backup": "...backup-timestamp"}
```

**batch_add.py** success:
```json
{"status": "batch_added", "added": 3, "skipped": 0, "phases": {"Phase 1: MVP": 3}}
```

**validate_context.py**:
```json
{"valid": true, "feedback": ""}
{"valid": false, "feedback": "Need: problem/outcome, project areas"}
```

## Data Model

ROADMAP.md structure (schema):

```yaml
---
version: "1.0"
created: YYYY-MM-DD-HHmmss
updated: YYYY-MM-DD-HHmmss
---

# Project Roadmap

## Phase 1: MVP

Goal: Deliver core functionality
Status: active

### Topics

- topic-slug [STATE]
  - Summary: Brief description with problem + outcome
  - Epic: TOPIC-1
  - Directory: .agent_planning/topic-slug/
  - Dependencies: other-topic
  - Labels: frontend, critical
```

**States**: PROPOSED, PLANNING, IN PROGRESS, COMPLETED, ARCHIVED

**Phase Status**: active, queued, completed

## Integration Points

**Beads CLI**: For epic management
- Create: `bd create epic TOPIC-NAME --title "Title"`
- Query: `bd show EPIC-ID --json`

**File System**:
- `.agent_planning/ROADMAP.md` - Main roadmap
- `.agent_planning/<topic-slug>/` - Topic directories
- `PLAN-*.md`, `EVALUATION-*.md`, `DOD-*.md` - Planning files

**Commands**:
- `/do:roadmap` - This skill
- `/do:plan <topic>` - Create planning for topic
- `/do:prompt-questioning` - User interactions

## Usage Examples

### View Roadmap
```bash
/do:roadmap
```
Output: Tree view with phases, topics, completion %, epic status

### Add Single Topic
```bash
/do:roadmap "improve-auth - Add OAuth2 support to API gateway P1"
```
Flow:
1. Detect single item
2. Ask which phase
3. Validate context (has problem + outcome)
4. Create directory
5. Add to roadmap

### Batch Add (Semicolon)
```bash
/do:roadmap "consolidate-defs P1; centralize-errors P1; implement-registry P1"
```
Result: 3 topics added to Phase 1 atomically

### Batch Add (Numbered List)
```bash
/do:roadmap "1. Fix auth bugs - Support SSO in corporate environments
2. Enhance permissions - Add role-based access control
3. Improve audit logs - Track all authentication events"
```
Result: 3 topics added to default/active phase

### Migrate Format
```bash
/do:roadmap migrate
```
Flow:
1. Detect if migration needed
2. Backup original (timestamp)
3. Convert H4 headers to list items
4. Extract custom fields to Summary
5. Write migrated ROADMAP.md

## Error Handling

**Script execution**:
- Scripts output JSON on stdout
- Errors are caught and reported
- Backups created before migrations
- Duplicate topics skipped (not fatal)

**Validation**:
- Context validated: must have 2 of 3 (problem, outcome, areas)
- Phase validation: warns if phase doesn't exist
- Topics deduplicated by slug

## Schema Reference

See `SCHEMA.md` for full format specification, parsing rules, validation, and examples.

See `IMPLEMENTATION-SUMMARY.md` for architecture and design decisions.

## Best Practices

- **Naming**: Use descriptive kebab-case slugs (user-authentication, not auth)
- **Descriptions**: Include problem, solution, and affected areas
- **Phases**: Keep 3-7 topics per phase; complete one phase before starting next
- **Dependencies**: Use sparingly; prefer sequential phases to deep chains
- **Epic Creation**: Use batch mode for imports, manual cleanup for epics
- **Migration**: Always backup before migrating; verify results before committing

## Troubleshooting

**No roadmap yet**: Run `/do:roadmap <topic>` to create first topic

**Batch not detected**: Must have 2+ items; use semicolons or newlines

**Context validation fails**: Add problem statement + outcome + project area

**Migration issues**: Check backup in `.agent_planning/ROADMAP.md.backup-*`

**Topics not added**: Check for duplicates (skipped silently) or invalid phase

## Architecture

**Separation of Concerns**:
- `roadmap_lib.py` - Pure parsing/writing logic
- `migrate_roadmap.py` - Migration-specific logic
- `batch_add.py` - Batch add logic
- `validate_context.py` - Validation logic
- `SKILL.md` - Orchestration and user interaction

**Hooks Available**:
- PreToolUse: Validate inputs before tool calls
- PostToolUse: Process script outputs after execution
- Stop: Cleanup on session end

**No Runtime Dependencies**: Scripts are self-contained, execute independently.
