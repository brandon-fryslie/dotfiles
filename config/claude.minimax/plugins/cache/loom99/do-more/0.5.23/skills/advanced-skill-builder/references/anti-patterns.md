# Anti-Patterns to Avoid

Common mistakes that make skills ineffective or broken.

## Quick Reference: Don't Do This

| Anti-Pattern | Why It's Bad |
|--------------|--------------|
| Nested references >1 level | Content may be partially read |
| Windows paths (`\`) | Breaks on Unix |
| README.md, CHANGELOG.md | Unnecessary clutter |
| First/second person descriptions | Breaks system prompt injection |
| "Helps with X" descriptions | Too vague for discovery |
| Multiple tools without default | Decision paralysis |
| Time-dependent instructions | Becomes incorrect |
| Inconsistent terminology | Confusing |
| Explaining common knowledge | Wastes tokens |
| Error-prone scripts | Unhelpful failures |
| Magic numbers | Unclear intent |
| Untested skills | Unknown reliability |

## Structure Anti-Patterns

### Deeply Nested References

**BAD:**
```
SKILL.md → advanced.md → details.md → actual-info.md
```

Claude may use `head -100` on nested files, missing critical content.

**GOOD:**
```
SKILL.md → forms.md
SKILL.md → validation.md
SKILL.md → examples.md
```

**RARELY (only large skills):**
```
SKILL.md → test-implementation-plan.md -> scenarios/cli.md
SKILL.md → test-implementation-plan.md -> scenarios/microservices.md
SKILL.md → test-implementation-plan.md -> refactoring/dependency-injectiono.md
SKILL.md → test-coverage-audit.md -> concepts/interactive-testing.md
SKILL.md → test-converage-audit.md -> languages/go.md
```

HIGHLY PREFER content one level deep, directly linked from SKILL.md.
Skills covering extremely log topics, two levels of nesting from SKILL.md is acceptable.

### Windows-Style Paths

**BAD:**
```markdown
See [guide.md](references\guide.md)
Run `python scripts\validate.py`
```

Breaks on Unix systems (most Claude environments).

**GOOD:**
```markdown
See [guide.md](references/guide.md)
Run `python scripts/validate.py`
```

Forward slashes work everywhere.

### Auxiliary Documentation

**BAD - Don't include:**
```
skill-name/
├── SKILL.md
├── README.md           # ❌ User-facing docs
├── CHANGELOG.md        # ❌ Version history
├── INSTALLATION.md     # ❌ Setup instructions
└── CONTRIBUTING.md     # ❌ Contributor guide
```

Skills are for AI agents, not humans. No auxiliary files.

**GOOD:**
```
skill-name/
├── SKILL.md
└── references/
    └── domain-specific.md  # Only what Claude needs
```

## Description Anti-Patterns

### Wrong Voice

**BAD - First person:**
```yaml
description: I can help you process PDF files and extract text.
```

**BAD - Second person:**
```yaml
description: You can use this skill to process PDF files.
```

**GOOD - Third person:**
```yaml
description: Processes PDF files and extracts text from documents.
```

Third person is required because descriptions inject into system prompts.

### Vague Descriptions

**BAD:**
```yaml
description: Helps with documents.
description: Data processing tool.
description: Useful utilities.
```

**GOOD:**
```yaml
description: Extracts text and tables from PDF files, fills forms, merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

Specific actions + explicit triggers.

### Missing Triggers

**BAD:**
```yaml
description: PDF text extraction and form filling.
```

What it does, but not when to use it.

**GOOD:**
```yaml
description: PDF text extraction and form filling. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

MUST: Explicit "Use when..." clause.

## Content Anti-Patterns

### Vague criteria

**BAD:**
```markdown
Use interactive-testing.md when you need to test an application.
Use web-application.md when you need to test a user facing web application.
Use application.md when you need to test that a user can use an application.
```

**GOOD:**
```markdown
Use interactive-testing.md when you need to test an interactive cli application, or a complex web frontend
Use full-stack-application.md when you need to test a web application that includes both a front-end and a back-end component 
Use ios-application.md when you need to test an application that runs on Apple's iOS platform
```
### Too Many Options

**BAD:**
```markdown
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or
camelot, or tabula-py, or pdfminer. Choose based on your needs.
```

Decision paralysis. Claude has to figure out which.

**GOOD:**
```markdown
Use pdfplumber for text extraction:
```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

Default recommendation with escape hatch for specific cases.

### Time-Sensitive Information

**BAD:**
```markdown
If you're doing this before August 2025, use the old API.
After August 2025, use the new API.
```

Will become incorrect. Requires skill updates.

**GOOD:**
```markdown
## Current method

Use the v2 API endpoint: `api.example.com/v2/`

<details>
<summary>Legacy v1 API (deprecated)</summary>

The v1 API used: `api.example.com/v1/`
This endpoint is no longer supported.
</details>
```

Old patterns section for historical context.

### Inconsistent Terminology

**BAD:**
```markdown
First, get the API endpoint URL.
Then call the API route with your data.
The path returns a JSON response.
```

Three different terms for the same thing.

**GOOD:**
```markdown
First, identify the API endpoint.
Then call the endpoint with your data.
The endpoint returns a JSON response.
```

Pick one term, use it consistently.

### Over-Explaining Common Knowledge

**BAD:**
```markdown
PDF (Portable Document Format) files are a common file format that
contains text, images, and other content. They were created by Adobe
in 1992 and have become the standard for document exchange. To work
with PDFs in Python, you'll need to install a library...
```

Claude already knows what PDFs are.

**GOOD:**
```markdown
Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
```

Only what Claude doesn't already know.

## Code Anti-Patterns

### Punting to Claude

**BAD:**
```python
def process_file(path):
    # Just fail and let Claude figure it out
    return open(path).read()
```

**GOOD:**
```python
def process_file(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating empty")
        return ''
```

Handle errors explicitly with helpful messages.

### Magic Numbers

**BAD:**
```python
TIMEOUT = 47
MAX_RETRIES = 7
BUFFER_SIZE = 8192
```

Why these specific values?

**GOOD:**
```python
# HTTP typically completes in <30s, buffer for slow connections
TIMEOUT = 30

# Most transient failures resolve by retry 2-3
MAX_RETRIES = 3

# 8KB matches typical filesystem block size
BUFFER_SIZE = 8192
```

Every value justified.

### Assumed Packages

**BAD:**
```markdown
Use the pdf library to process the file:
\```python
from pdf import extract
\```
```

What if `pdf` isn't installed?

**GOOD:**
```markdown
Install required package:
\```bash
pip install pdfplumber
\```

Then extract text:
\```python
import pdfplumber
\```
```

Explicit installation instructions.

## Testing Anti-Patterns

### Shipping Untested Skills

**BAD:**
```
1. Write skill
2. Ship it
3. Hope it works
```

**GOOD:**
```
1. Create 3+ evaluations
2. Test without skill (baseline)
3. Write minimal skill
4. Test with skill
5. Compare to baseline
6. Iterate until solid
7. Ship
```

### Single-Model Testing

**BAD:**
```
Tested with Opus → Ship for all models
```

**GOOD:**
```
Tested with Opus → Works
Tested with Sonnet → Works
Tested with Haiku → Needs more guidance, added details
→ Ship
```

Different models need different levels of guidance.

