---
allowed-tools: Read, Write, Glob, Bash(mkdir:*)
description: "Refactor a command into a skill with light wrapper. Pattern: command content → skill, command → wrapper."
argument-hint: <plugin:command> (e.g., do:plan)
---

# Refactor Command to Skill

Refactor the specified command into a skill with a light wrapper command.

**Input:** $ARGUMENTS (format: `plugin:command` or just `command` if in current plugin context)

## Pattern

1. **Command content** moves to `skills/<command>-skill/SKILL.md`
2. **Command file** becomes a light wrapper that invokes the skill

## Process

### Step 1: Parse Input

Parse the command identifier from: $ARGUMENTS

Expected format: `plugin:command` (e.g., `do:plan`, `do-more:audit`)

### Step 2: Locate Command

Find the command file. Search in:
- `plugins/<plugin>/commands/<command>.md`
- If plugin not specified, search current directory context

### Step 3: Read Command Content

Read the full content of the command file, including:
- YAML frontmatter (preserve description, argument-hint)
- Command body (this becomes the skill content)

### Step 4: Create Skill

Create skill directory and SKILL.md:

```
plugins/<plugin>/skills/<command>-skill/SKILL.md
```

SKILL.md format:
```markdown
---
name: <command>-skill
description: "<description from command frontmatter>. Entry point for /<plugin>:<command> command."
context: fork
---

<command body content here - moved verbatim>
```

### Step 5: Replace Command with Wrapper

Replace the command file with a light wrapper:

```markdown
---
argument-hint: <preserved from original>
description: "<preserved from original>"
---

Skill("<plugin>:<command>-skill") with:
  <appropriate args based on $ARGUMENTS>
```

### Step 6: Verify

Confirm both files exist and contain expected content.

## Example

**Before:**
```
plugins/do/commands/plan.md (100+ lines of content)
```

**After:**
```
plugins/do/skills/plan-skill/SKILL.md (content moved here)
plugins/do/commands/plan.md (7 lines - light wrapper)
```

## Output

Report what was done:
- Source command path
- Created skill path
- Updated command path
- Summary of changes
