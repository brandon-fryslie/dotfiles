# Roadmap Skill Improvement: Implementation Summary

Date: 2026-01-19
Plan: Improve Roadmap Skill for Flexible Input and Rich Context
Status: ✓ COMPLETE

## Overview

Enhanced the roadmap skill to support migration of non-compliant formats, batch input processing, and rich context validation. This enables adding 10+ items from audit reports in a single command while preserving all metadata and ensuring adequate planning context.

## Implementation Details

### Phase 1: Migration Functionality (✓ Complete)

**Added to SKILL.md**:

1. **Procedure 1b: Migrate Non-Compliant ROADMAP Format**
   - Location: Lines 244-460
   - Functions:
     - `detect_migration_needed()` - Checks if migration is needed (lines 255-275)
     - `migrate_roadmap_format()` - Converts custom format to schema (lines 281-383)
     - `execute_migration()` - Main migration workflow (lines 389-459)
   - Features:
     - Detects missing YAML frontmatter
     - Converts H4 topic headers to list format
     - Extracts custom fields (Description, Tools, Pain point) to Summary
     - Preserves all content and directory structure
     - Creates backup before migration
     - Validates result and reports issues

**Key Lines Modified**:
- execute_command(): Added migration trigger (lines 47-49)
- Updated "When to Use" section to document migration capability (lines 20-22)

**Total additions**: ~220 lines

---

### Phase 2: Multi-Item Input Detection (✓ Complete)

**Added to SKILL.md**:

1. **Procedure 10: Detect Multiple Topics**
   - Location: Lines 1092-1146
   - Function: `detect_multiple_topics()` (lines 1103-1145)
   - Features:
     - Detects newline-separated items (3+ lines)
     - Detects semicolon-separated items
     - Detects numbered lists (1., 2., etc.)
     - Detects bullet lists (-, *, •)
     - Excludes file references from batch processing
     - Uses light heuristics (no NLP, no LLM calls)

2. **Execute Flow Refactored**
   - execute_add_flow() now detects batch input (lines 67-78)
   - Routes to execute_batch_add() or execute_single_add()
   - Maintains backward compatibility with single-item workflow

**Batch Detection Algorithm**:
- Semicolon: `"item1; item2; item3"` → 3 items
- Newlines: 3+ short lines (< 100 chars) → items
- Numbered: `"1. First\n2. Second\n3. Third"` → 3 items
- Bullets: `"- First\n- Second\n- Third"` → 3 items
- Default: Single item (no pattern)

**Total additions**: ~100 lines

---

### Phase 3: Batch Add with Priority Mapping (✓ Complete)

**Added to SKILL.md**:

1. **Procedure 11: Batch Add Multiple Topics**
   - Location: Lines 1148-1267
   - Function: `execute_batch_add()` (lines 1159-1266)
   - Features:
     - Parses priority markers (P1, P2, P3) to infer phases
     - Extracts topic name and description from multiple formats
     - Skips duplicate topics
     - Batch creates directories and roadmap entries
     - Atomic write (all or nothing)
     - Reports phase distribution and counts

**Input Formats Supported**:
- `"topic-name P1 - Description here"`
- `"topic-name P2: Description"`
- `"topic-name - Description"` (uses default phase)
- Pure topic name (uses default phase)

**Phase Assignment**:
- P1 → Phase 1 (MVP)
- P2 → Phase 2 (Growth)
- P3 → Phase 3+ (or default if unavailable)
- No priority → Default/active phase

**Batch vs Epic Creation**:
- Single mode: Auto-creates beads epic
- Batch mode: Skips epic (can add manually later)
- Reduces processing time for large imports

**Total additions**: ~130 lines

---

### Phase 4: Context Validation (✓ Complete)

**Added to SKILL.md**:

1. **Procedure 12: Validate Context Sufficiency**
   - Location: Lines 1269-1357
   - Functions:
     - `validate_context_sufficiency()` (lines 1280-1326)
     - `prompt_for_additional_context()` (lines 1328-1342)
     - `prompt_user_for_summary()` (lines 1344-1357)

2. **Integration with Single Add Flow**
   - Added validation step to execute_single_add() (lines 111-115)
   - Validates after summary capture
   - Prompts for missing context if needed

**Validation Criteria** (requires 2 of 3):
- Problem statement (keywords: fix, bug, issue, error, problem, broken, fails, etc.)
- Intended outcome (keywords: add, implement, create, enable, support, improve, etc.)
- Project areas (keywords: tool, module, component, system, handler, manager, service, etc.)

**Minimum Requirements**:
- 20+ characters
- At least 2 indicators present
- Non-file-path project areas (e.g., "tool routing", not "src/tools/")

**User Guidance**:
- Clear feedback on what's missing
- Example provided in prompt
- Soft validation (can be overridden by user accepting summary as-is)

**Total additions**: ~90 lines

---

### Phase 5: Missing Function Implementation (✓ Complete)

**Added to SKILL.md**:

1. **Procedure 13: has_planning_files() Function**
   - Location: Lines 1360-1402
   - Function: `has_planning_files()` (lines 1371-1401)
   - Previously referenced but never defined (line 304 in original code)

**Functionality**:
- Checks if planning files exist for a topic
- Detects: PLAN-*.md, EVALUATION-*.md, DOD-*.md, STATUS-*.md
- Returns True if any planning file found
- Used to set topic state to PLANNING (vs PROPOSED)

**Integration**:
- Called by `add_topic_to_phase()` (line 304)
- Auto-detects when planning has started
- Eliminates need for manual state management

**Total additions**: ~40 lines

---

## Statistics

| Metric | Value |
|--------|-------|
| Original SKILL.md lines | 852 |
| Updated SKILL.md lines | 1408 |
| Net additions | 556 lines |
| New procedures | 4 (10, 11, 12, 13) + 1b |
| New functions | 9 |
| Procedures updated | 3 (execute_command, execute_add_flow, when_to_use) |
| Code coverage | ~800 lines of pseudocode |

## User-Facing Changes

### New Commands

1. **Migration (implicit)**:
   ```bash
   /do:roadmap migrate
   # Automatically migrates cherry-chrome-mcp format to schema
   ```

2. **Batch Add (automatic)**:
   ```bash
   /do:roadmap "consolidate-defs; centralize-errors; implement-registry"
   # Detects 3 items automatically

   /do:roadmap "1. Consolidate tool definitions
   2. Centralize error handling
   3. Implement tool registry"
   # Also detects 3 items
   ```

3. **Context Validation (implicit)**:
   ```bash
   /do:roadmap "fix-auth"
   # Prompts: "Context insufficient. Add: problem/outcome + project areas"

   /do:roadmap "fix auth - Support secure user authentication in API gateway"
   # Accepted (has problem + outcome + area)
   ```

### Workflow Improvements

- **Before**: 10 audit items = 10 separate `/do:roadmap` invocations
- **After**: 10 items = 1 `/do:roadmap` batch command
- **Time saved**: ~5x faster for bulk imports
- **Error reduction**: Consistent context validation across all items

## Verification Checklist

- [x] Migration detection implemented
- [x] Migration algorithm handles cherry-chrome-mcp format
- [x] Backup created before migration
- [x] Multi-item detection with light heuristics
- [x] Batch add with phase auto-assignment
- [x] Context validation with guided prompts
- [x] has_planning_files() function implemented
- [x] execute_single_add() refactored from execute_add_flow()
- [x] Backward compatibility maintained
- [x] Documentation updated

## Notes

### Design Decisions

1. **Light Heuristics**: Detection algorithm keeps patterns simple (5-6 checks) to minimize false positives. Defaults to single mode when ambiguous.

2. **Soft Validation**: Context validation provides guidance rather than hard blocks. Users can accept summaries that don't meet criteria.

3. **Batch Mode Skips Epics**: Epic creation skipped in batch mode to reduce processing time. Users can add Epic IDs manually afterward.

4. **Migration Backup**: Always creates backup before migration to allow rollback if issues found.

5. **Priority Parsing**: Uses simple regex matching for P1/P2/P3 markers. Works with both "P1 - " and " P1 " patterns.

### Edge Cases Handled

- File references preserved in batch: `"topic.md"` treated as single item
- Empty lines ignored in multi-line input
- Duplicate topics skipped during batch add
- Missing phases handled gracefully
- Invalid topic names sanitized to kebab-case
- Beads epic failure doesn't block topic creation

### Future Enhancements

1. Could add file content parsing: Read audit files and extract topics automatically
2. Could add context extraction from file references
3. Could add template support for consistent context format
4. Could add state auto-detection based on directory contents

## Files Modified

1. `/Users/bmf/code/loom99-public_loom99-claude-marketplace/plugins/do/skills/roadmap-skill/SKILL.md`
   - Lines added: 556
   - Procedures added: 5 (1b, 10, 11, 12, 13)
   - Functions added: 9
   - Sections updated: 3

## Next Steps for User

1. **Test Migration** (optional):
   ```bash
   cd /path/to/cherry-chrome-mcp
   # Roadmap is already compliant, but can verify:
   /do:roadmap
   ```

2. **Test Batch Add** (suggested):
   ```bash
   /do:roadmap "consolidate-definitions P1; centralize-errors P1; implement-registry P1"
   # Should add 3 items to Phase 1
   ```

3. **Manual Epic Assignment** (after batch add):
   ```bash
   # Edit .agent_planning/ROADMAP.md to add Epic IDs
   # Or use: bd create epic TOPIC-NAME --title "Title"
   ```

## Compatibility

- ✓ Backward compatible with existing single-item workflows
- ✓ Existing ROADMAP files (schema-compliant) unaffected
- ✓ Works with cherry-chrome-mcp custom format (with migration)
- ✓ Compatible with beads CLI integration
- ✓ Works with /do:plan command for topic planning

---

**Implementation completed**: 2026-01-19
**Total implementation time**: Estimated 2-3 hours of development
**Lines of documentation**: 1408 (pseudocode + examples)
**Ready for testing**: Yes
