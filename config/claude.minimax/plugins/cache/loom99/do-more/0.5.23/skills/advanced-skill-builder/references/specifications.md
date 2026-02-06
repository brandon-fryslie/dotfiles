# Technical Specifications

Hard constraints for valid skills. Violating these causes failures.

## YAML Frontmatter (Required)

Every SKILL.md must start with:

```yaml
---
name: skill-name-here
description: What it does and when to use it.
---
```

### `name` Field

| Constraint | Requirement |
|------------|-------------|
| Length | Maximum 64 characters |
| Characters | Lowercase letters, numbers, hyphens only |
| Format | No spaces, no underscores, no special chars |
| Reserved | Cannot contain "anthropic" or "claude" |
| XML | Cannot contain XML tags |

**Valid examples:**
- `pdf-processing`
- `analyzing-spreadsheets`
- `bigquery-sales-metrics`
- `form-validation-v2`

**Invalid examples:**
- `PDF_Processing` (uppercase, underscore)
- `my skill` (space)
- `claude-helper` (reserved word)
- `super_cool_skill!` (underscore, special char)

### `description` Field

| Constraint | Requirement |
|------------|-------------|
| Length | Maximum 1024 characters |
| Content | Must be non-empty |
| XML | Cannot contain XML tags |
| Voice | Must be third person |

**Why third person matters:**

The description is injected into Claude's system prompt. Inconsistent point-of-view causes discovery problems.

```yaml
# GOOD - Third person
description: Processes Excel files and generates formatted reports.

# BAD - First person
description: I can help you process Excel files.

# BAD - Second person
description: You can use this to process Excel files.
```

## SKILL.md Body

| Constraint | Requirement |
|------------|-------------|
| Length | Under 500 lines for optimal performance |
| Format | Markdown |
| Content | Instructions Claude follows when skill triggers |

If approaching 500 lines, split content into reference files.

## Directory Structure

```
skill-name/           # Must match `name` field
├── SKILL.md          # Required
├── references/       # Optional - docs loaded on-demand
├── scripts/          # Optional - executable code
└── assets/           # Optional - output resources (templates, images)
```

**Do NOT include:**
- README.md
- CHANGELOG.md
- INSTALLATION_GUIDE.md
- Any user-facing documentation

Skills are for AI agents, not humans. No auxiliary documentation.

## File Paths

Always use forward slashes, even on Windows:

```markdown
# GOOD
See [guide.md](references/guide.md)
Run `python scripts/validate.py`

# BAD
See [guide.md](references\guide.md)
Run `python scripts\validate.py`
```

## Token Budget Reference

| Level | When Loaded | Typical Cost |
|-------|-------------|--------------|
| Level 1: Metadata | Always (startup) | ~100 tokens per skill |
| Level 2: SKILL.md body | When skill triggers | <5000 tokens |
| Level 3: References/scripts | As needed | Unlimited (scripts execute without loading) |

## Validation Checklist

Before finalizing any skill:

```
[ ] name ≤64 chars, lowercase/numbers/hyphens only
[ ] name does not contain "anthropic" or "claude"
[ ] description ≤1024 chars, non-empty
[ ] description is third person
[ ] description includes what AND when
[ ] SKILL.md body <500 lines
[ ] All file paths use forward slashes
[ ] No auxiliary documentation files
[ ] Directory name matches `name` field
```
