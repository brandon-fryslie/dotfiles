# Repomix Documentation Skill Workflow

This document describes the standard workflow for querying large documentation packed with Repomix. Any documentation skill using this pattern should reference this file.

## Structure

A Repomix documentation skill should have:

```
<skill-name>/
  SKILL.md              # Skill metadata + reference to this workflow + path to index
  references/
    index.md            # Topic-to-file mapping (skill-specific)
    files.md            # Repomix-packed documentation (DO NOT READ DIRECTLY)
    project-structure.md # Optional: file tree with line counts
    summary.md          # Optional: statistics and metadata
```

## Workflow

### Step 1: Read the Index

Read `references/index.md` to find which documentation file covers your topic. The index maps topics to file paths within the packed output.

### Step 2: Attach the Packed Output

```
mcp__plugin_repomix-mcp_repomix__attach_packed_output
path: <absolute-path-to-skill>/references/files.md
```

This returns an `outputId`. **Note:** The outputId expires between sessions - you must re-attach each time.

### Step 3: Grep for Content

To read a specific documentation file, grep for its header and use `afterLines`:

```
mcp__plugin_repomix-mcp_repomix__grep_repomix_output
outputId: <from-step-2>
pattern: "## File: <file-path>"
afterLines: <appropriate-line-count>
```

**Regex notes:**
- Escape `.` as `\\.` (e.g., `docs/foo\\.rst`)
- The file header format is `## File: <path>`

### Choosing afterLines

Check `project-structure.md` for line counts per file, or use these guidelines:
- Small files (<100 lines): `afterLines: 100`
- Medium files (100-300 lines): `afterLines: 250`
- Large files (300-500 lines): `afterLines: 400`
- Very large files (500+): `afterLines: 600` or search for specific sections

### Keyword Searches

For searching across all files (not targeting a specific file):

```
mcp__plugin_repomix-mcp_repomix__grep_repomix_output
outputId: <from-step-2>
pattern: "your_keyword"
contextLines: 5
```

## Why This Workflow?

- `files.md` is typically 200KB-500KB+ and should NEVER be loaded directly into context
- Repomix MCP grep operates on the file without loading it into the conversation
- The index provides O(1) lookup for topics instead of scanning the entire file
- `afterLines` retrieves just the relevant section

## Creating an Index

A good index maps user questions to file paths. Structure it as:

```markdown
## Category Name

| Topic | File | Notes |
|-------|------|-------|
| User question/concept | `path/to/file.ext` | Optional context |
```

Include:
- Common questions users ask
- Key configuration options
- Feature names
- Troubleshooting topics

## Template SKILL.md

```markdown
---
name: <skill-name>
description: <when to use this skill>
---

# <Title>

<file-count> files | <line-count> lines | <token-count> tokens

## Overview

<What this documentation covers>

## Usage

**IMPORTANT:** `files.md` is large and should NEVER be loaded directly into context!

See `../../_templates/repomix-docs-workflow.md` for the standard query workflow.

### Quick Reference

| Topic | Pattern | afterLines |
|-------|---------|------------|
| <common-topic-1> | `## File: path/to/file\\.ext` | <lines> |
| <common-topic-2> | `## File: path/to/file\\.ext` | <lines> |
| <keyword-search> | `<keyword>` (use `contextLines: 5`) | - |

## Index

See `references/index.md` for the complete topic-to-file mapping.
```
