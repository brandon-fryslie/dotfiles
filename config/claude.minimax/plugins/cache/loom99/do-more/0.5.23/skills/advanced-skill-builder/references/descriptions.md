# Writing Effective Descriptions

The description is the most critical field. Claude uses it to decide whether to trigger your skill from potentially 100+ available skills.

## The Discovery Problem

At startup, Claude only sees skill metadata (name + description). The SKILL.md body isn't loaded until after triggering. This means:

- **All "when to use" info must be in the description**
- "When to Use This Skill" sections in the body are useless for discovery
- Vague descriptions = skill never triggers

## Anatomy of a Good Description

```
[What it does] + [When to use it / trigger phrases]
```

**Formula:**
1. Action verbs describing capabilities
2. Specific file types, tools, or domains
3. Explicit trigger conditions

## Examples: Good vs Bad

### PDF Processing

**GOOD** (specific, includes triggers):
```yaml
description: Extracts text and tables from PDF files, fills forms, merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**BAD** (vague):
```yaml
description: Helps with documents.
```

**BAD** (missing triggers):
```yaml
description: Processes PDF files.
```

### Excel Analysis

**GOOD**:
```yaml
description: Analyzes Excel spreadsheets, creates pivot tables, generates charts and reports. Use when analyzing .xlsx files, spreadsheets, tabular data, or when creating data visualizations.
```

**BAD**:
```yaml
description: Works with Excel.
```

### Git Commits

**GOOD**:
```yaml
description: Generates descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages, reviewing staged changes, or formatting conventional commits.
```

**BAD**:
```yaml
description: Helps with git.
```

### BigQuery

**GOOD**:
```yaml
description: Queries company BigQuery data warehouse for sales, finance, and product metrics. Use when analyzing revenue, pipeline, ARR, or when the user mentions BigQuery, SQL queries, or data analysis.
```

**BAD**:
```yaml
description: Database queries.
```

## Naming Conventions

Prefer **gerund form** (verb + -ing) for clarity:

| Gerund (Preferred) | Alternative | Avoid |
|--------------------|-------------|-------|
| `processing-pdfs` | `pdf-processor` | `pdf` |
| `analyzing-spreadsheets` | `spreadsheet-analysis` | `excel` |
| `managing-databases` | `database-manager` | `db-utils` |
| `testing-code` | `code-tester` | `tests` |
| `writing-documentation` | `doc-writer` | `docs` |

**Never use:**
- `helper`, `utils`, `tools` (too vague)
- `my-skill`, `new-skill` (meaningless)
- Single words without context

## Include Key Terms

Think about what users will say when they need this skill:

| Domain | Include These Terms |
|--------|---------------------|
| Documents | PDF, Word, DOCX, Excel, XLSX, PowerPoint, PPTX |
| Data | spreadsheet, CSV, JSON, database, SQL, query |
| Code | git, commit, PR, review, test, debug |
| Web | API, REST, GraphQL, endpoint, request |
| Files | extract, convert, merge, split, validate |

## Length Guidelines

- **Minimum**: ~50 characters (enough to be specific)
- **Sweet spot**: 150-300 characters
- **Maximum**: 1024 characters (hard limit)

Don't pad for length. Be as concise as possible while including all triggers.

## Testing Your Description

Ask yourself:
1. If I had 100 skills installed, would this stand out for its intended use?
2. What would a user say that should trigger this?
3. Does it include those exact phrases?

**Test prompt**: "I need to [task]" → Does your description contain words matching [task]?

## Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| First person | "I help with PDFs" | "Processes PDFs" |
| Second person | "You can use this for PDFs" | "Processes PDFs" |
| Too vague | "Document helper" | "Extracts text from PDF files..." |
| Missing triggers | "PDF processor" | "...Use when working with PDF files" |
| Jargon only | "OOXML manipulation" | "Edits Word documents (.docx)..." |
