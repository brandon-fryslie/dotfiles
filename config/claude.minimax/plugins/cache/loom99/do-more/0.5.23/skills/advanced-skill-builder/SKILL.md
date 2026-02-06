---
name: "do-advanced-skill-builder"
description: "Use when building new Claude skills, converting documentation to Claude skills, or improving existing Claude skills."
---

# Advanced Skill Builder

Autonomous skill creation from URLs, docs, or domain expertise. Outputs production-ready skill directories with proper progressive disclosure.

## Quick Start

**From URLs:**
```
1. Fetch all provided URLs
2. Extract key information and patterns
3. Generate skill with proper structure
4. Output to specified directory
```

**From conversation context:**
```
1. Gather domain knowledge through questions
2. Identify reusable patterns
3. Generate skill structure
4. Iterate based on feedback
```

## Process

### Phase 1: Information Gathering

**If URLs provided:**
- Fetch each URL with WebFetch
- Extract: purpose, workflows, examples, constraints, edge cases
- Note what Claude doesn't already know (skip common knowledge)

**If no URLs:**
- Ask clarifying questions (max 3-4 per message)
- "What specific task should this skill handle?"
- "Can you give 2-3 concrete examples of how it would be used?"
- "What would trigger this skill vs regular Claude?"

### Phase 2: Content Analysis

Analyze gathered content for:

| Element | Extract |
|---------|---------|
| Core workflow | Step-by-step process |
| Variations | Different modes/frameworks/options |
| Examples | Input/output pairs |
| Constraints | What must/must not happen |
| Edge cases | Error handling, special situations |

**Key question**: "What does Claude NOT already know?"

Only include information that:
- Is domain-specific (company schemas, APIs, policies)
- Requires specific sequences (fragile operations)
- Has non-obvious constraints
- Would be repeatedly explained otherwise

### Phase 3: Architecture Decision

Determine skill complexity:

| Complexity | Criteria | Structure |
|------------|----------|-----------|
| Simple | Single workflow, <100 lines needed | SKILL.md only |
| Medium | Multiple modes OR detailed examples | SKILL.md + 1-2 references |
| Complex | Multiple domains/frameworks, scripts | Full directory structure |

**Progressive disclosure levels:**
- **Level 1** (always loaded): name + description (~100 tokens)
- **Level 2** (on trigger): SKILL.md body (<500 lines)
- **Level 3** (as needed): references/, scripts/, assets/

### Phase 4: Generate Skill

**Directory structure:**
```
skill-name/
├── SKILL.md              # Required - core instructions
├── references/           # Optional - detailed docs
│   ├── domain-a.md       # Loaded when domain-a relevant
│   └── domain-b.md       # Loaded when domain-b relevant
├── scripts/              # Optional - executable code
│   └── utility.py        # Run without loading into context
└── assets/               # Optional - output resources
    └── template.md       # Used in output, not loaded
```

**Generate in order:**
1. SKILL.md with frontmatter (see `references/specifications.md`)
2. Reference files if needed (see `references/progressive-disclosure.md`)
3. Scripts if deterministic operations needed (see `references/scripts-and-code.md`)

### Phase 5: Validate

**Size discipline:**
- New skills should be tight. SKILL.md typically 50-150 lines.
- When improving existing skills: surgical changes only, preserve existing wording.
- Measure additions: if adding 50+ lines for a feature, reconsider approach.
- No template bloat, ASCII boxes, or repeated tables.

Before outputting, verify:

- [ ] `name`: lowercase, hyphens, ≤64 chars, no "anthropic"/"claude"
- [ ] `description`: ≤1024 chars, third person, includes triggers
- [ ] SKILL.md body: <500 lines
- [ ] References: one level deep from SKILL.md
- [ ] No time-sensitive information
- [ ] Consistent terminology
- [ ] No deeply nested references

See `references/anti-patterns.md` for common mistakes.

## Output Format

```
═══════════════════════════════════════
Skill Generated: [skill-name]

  Files created:
    - SKILL.md ([lines] lines)
    - references/[name].md (if any)
    - scripts/[name].py (if any)

  Description: [first 100 chars...]
  Triggers: [key trigger phrases]

  Location: [output path]
═══════════════════════════════════════
```

## Reference Files

| Topic | File | When to read |
|-------|------|--------------|
| Technical constraints | `references/specifications.md` | Always (for validation) |
| Writing descriptions | `references/descriptions.md` | When crafting frontmatter |
| Content organization | `references/progressive-disclosure.md` | For medium/complex skills |
| Executable code | `references/scripts-and-code.md` | When including scripts |
| Testing patterns | `references/testing.md` | Before finalizing |
| What to avoid | `references/anti-patterns.md` | Always (for validation) |

## Skill Types

### Documentation-to-Skill
Convert API docs, guides, or references into skills.
- Focus on procedural knowledge
- Extract workflows, not just facts
- Include concrete examples

### Workflow-to-Skill
Capture repetitive multi-step processes.
- Document exact sequences for fragile operations
- Provide flexibility for context-dependent steps
- Include validation/verification steps

### Domain-Expert-to-Skill
Package organizational knowledge.
- Company schemas, policies, conventions
- Domain-specific terminology
- Internal tools and integrations

### Tool-Integration-to-Skill
Create skills for specific tools/APIs.
- MCP tool references: `ServerName:tool_name`
- Error handling patterns
- Authentication/setup requirements
