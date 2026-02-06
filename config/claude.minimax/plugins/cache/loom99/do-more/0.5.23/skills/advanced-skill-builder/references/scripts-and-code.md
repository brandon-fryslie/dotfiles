# Scripts and Executable Code

When to include scripts, how to write them, and platform considerations.

## When to Include Scripts

Include scripts when:
- Same code would be rewritten repeatedly
- Deterministic reliability is critical
- Operation is fragile and error-prone
- Validation must be machine-verifiable

**Don't include scripts for:**
- Simple one-liners Claude can write
- Highly variable operations
- Context-dependent logic

## Script Benefits

| Benefit | Explanation |
|---------|-------------|
| Token efficient | Scripts execute without loading into context |
| Deterministic | Same input → same output, always |
| Reliable | Tested once, works every time |
| Fast | No generation time |

## Directory Structure

```
skill-name/
├── SKILL.md
└── scripts/
    ├── analyze.py      # Analysis utility
    ├── validate.py     # Validation checker
    └── process.py      # Main processing
```

## Referencing Scripts

Be explicit about execution vs reading:

**Execute (most common):**
```markdown
Run the validation script:
```bash
python scripts/validate.py input.json
```
```

**Read as reference (rare):**
```markdown
See `scripts/validate.py` for the validation algorithm.
```

## The "Solve, Don't Punt" Principle

Scripts should handle errors, not fail and leave Claude guessing.

**BAD - Punt to Claude:**
```python
def process_file(path):
    # Just fail if anything goes wrong
    return open(path).read()
```

**GOOD - Handle errors:**
```python
def process_file(path):
    """Process file, creating default if missing."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating default")
        with open(path, 'w') as f:
            f.write('')
        return ''
    except PermissionError:
        print(f"Cannot access {path}, using empty default")
        return ''
```

## No "Voodoo Constants"

Every configuration value must be justified.

**BAD - Magic numbers:**
```python
TIMEOUT = 47  # Why 47?
MAX_RETRIES = 5  # Why 5?
BATCH_SIZE = 237  # ???
```

**GOOD - Self-documenting:**
```python
# HTTP requests typically complete within 30 seconds
# Extra buffer for slow connections
REQUEST_TIMEOUT = 30

# Most transient failures resolve by second retry
# Third retry catches edge cases without excessive delay
MAX_RETRIES = 3

# 100 items balances memory usage vs API call overhead
# Tested with typical payload sizes of 1-5KB per item
BATCH_SIZE = 100
```

## Feedback Loop Pattern

For quality-critical operations, use validator → fix → repeat:

```markdown
## Document editing workflow

1. Make edits to `word/document.xml`
2. **Validate immediately**: `python scripts/validate.py unpacked/`
3. If validation fails:
   - Review error message
   - Fix the issue
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python scripts/pack.py unpacked/ output.docx`
```

## Plan-Validate-Execute Pattern

For batch or destructive operations:

```markdown
## Batch update workflow

1. **Plan**: Generate `changes.json` with proposed updates
2. **Validate**: `python scripts/validate_changes.py changes.json`
   - Checks all referenced fields exist
   - Validates data types
   - Detects conflicts
3. **Execute** (only if valid): `python scripts/apply_changes.py changes.json`
4. **Verify**: `python scripts/verify_output.py`
```

**Benefits:**
- Catches errors before changes
- Machine-verifiable plans
- Reversible until execute step
- Clear debugging

## Checklist Pattern

For complex multi-step workflows:

````markdown
## Research synthesis

Copy this checklist and track progress:

```
[ ] Step 1: Read all source documents
[ ] Step 2: Identify key themes
[ ] Step 3: Cross-reference claims
[ ] Step 4: Create structured summary
[ ] Step 5: Verify citations
```

**Step 1: Read all sources**
...
````

Works for both code and non-code workflows.

## Platform Constraints

Different platforms have different capabilities:

| Platform | Network | Packages | Notes |
|----------|---------|----------|-------|
| claude.ai | Varies by settings | Can install from npm/PyPI | Most flexible |
| Claude API | None | Pre-installed only | Most restrictive |
| Claude Code | Full | Local install only | Like local dev |

**For API skills:**
- Verify packages in code execution docs
- No external API calls
- No runtime installation

**For Claude Code skills:**
- Can use any installed packages
- Avoid global installs (use local)
- Full network access

## MCP Tool References

When referencing MCP tools, always use fully qualified names:

```markdown
# GOOD - Fully qualified
Use the `BigQuery:get_schema` tool to retrieve table schemas.
Use the `GitHub:create_issue` tool to create issues.

# BAD - Ambiguous
Use the `get_schema` tool...
```

Format: `ServerName:tool_name`

## Script Documentation

Every script should include:

```python
#!/usr/bin/env python3
"""
validate_form.py - Validate PDF form field mappings

Usage:
    python validate_form.py fields.json

Output:
    "OK" if valid
    List of errors if invalid

Exit codes:
    0 - Valid
    1 - Validation errors
    2 - File not found
"""
```

Clear usage, output format, and exit codes.
