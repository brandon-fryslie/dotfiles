---
name: "do-docs"
description: "[readme|api|architecture|changelog] Docs - README, API docs, architecture documentation. Entry point for /do-more:docs command."
context: fork
---

Documentation tasks. Create, update, or improve project documentation.

<user-input>$ARGUMENTS</user-input>
<current-command>docs</current-command>

## Topic Resolution

Determine what to document:

1. **If `$ARGUMENTS` provided** → Use `$ARGUMENTS` as the topic
2. **If no arguments, check conversation context** → If we were just discussing a subject, document that
3. **If no obvious subject in conversation** → Assess all docs and suggest improvements

Set `main_instructions` to the resolved topic.

---

## Main Workflow

### Intent Detection

Using `main_instructions`:

| Intent signals | Action |
|----------------|--------|
| "readme", "README" | Update/create README.md |
| "api", "API docs" | Generate/update API documentation |
| "architecture", "arch" | Update ARCHITECTURE.md or create diagrams |
| "changelog", "CHANGELOG" | Update CHANGELOG.md |
| "contributing", "CONTRIBUTING" | Update CONTRIBUTING.md |
| *(default)* | Assess docs and suggest improvements |

### Process

**Step 1: Assess**
- Check what documentation exists
- Identify gaps between code and docs
- Check for stale/outdated sections

**Step 2: Update**
Use do:iterative-implementer to:
- Update documentation to match current code
- Add missing sections
- Improve clarity and examples

**Step 3: Verify**
- Ensure code references are accurate
- Check links work
- Verify examples run

### Output

```
═══════════════════════════════════════
Docs Complete
  Updated: [list of files]
  Added: [new sections/files]

  [Summary of changes]
═══════════════════════════════════════
```
