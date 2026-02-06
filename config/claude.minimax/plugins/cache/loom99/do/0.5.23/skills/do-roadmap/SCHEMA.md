# ROADMAP.md Schema

Version: 1.0

## Overview

ROADMAP.md defines hierarchical project planning with phases and topics. It lives at `.agent_planning/ROADMAP.md` and serves as the authoritative source for project organization.

## File Structure

```yaml
---
version: "1.0"
created: YYYY-MM-DD-HHmmss
updated: YYYY-MM-DD-HHmmss
---

# Project Roadmap

## Phase N: [Phase Name]

Goal: [What this phase achieves]
Status: [active | queued | completed]

### Topics

- topic-name-slug [STATE]
  - Epic: TOPIC-NAME-1
  - Directory: .agent_planning/topic-name-slug/
  - Dependencies: other-topic, another-topic
  - Labels: frontend, critical

## Phase M: [Next Phase Name]
...
```

## Schema Components

### YAML Frontmatter (Required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version (currently "1.0") |
| `created` | timestamp | Yes | When roadmap was created (YYYY-MM-DD-HHmmss) |
| `updated` | timestamp | Yes | Last modification timestamp (YYYY-MM-DD-HHmmss) |

### Phases (H2 Headers)

Format: `## Phase N: [Name]`

**Metadata (indented):**
- `Goal:` - Brief description of phase objective
- `Status:` - One of: `active`, `queued`, `completed`

**Topics Section:**
- `### Topics` (H3 header)
- List of topics (see below)

### Topics (List Items)

Format: `- topic-slug [STATE]`

**Topic naming convention**: kebab-case (lowercase, hyphen-separated)
- "User Authentication" → `user-authentication`
- "Payment Processing" → `payment-processing`
- "Dashboard UI" → `dashboard-ui`

**State values**:
| State | Meaning |
|-------|---------|
| `PROPOSED` | Idea stage, not yet planned |
| `PLANNING` | Planning files exist, implementation not started |
| `IN PROGRESS` | Active implementation |
| `COMPLETED` | All acceptance criteria met |
| `ARCHIVED` | Completed but no longer maintained |

**Topic metadata (indented, optional):**
- `Summary:` - Brief description captured from conversation when added (context for `/do:plan`)
- `Epic:` - Beads epic ID (e.g., `USER-AUTH-1`)
- `Directory:` - Planning directory path (e.g., `.agent_planning/user-auth/`)
- `Dependencies:` - Comma-separated list of topic slugs this depends on
- `Labels:` - Comma-separated custom labels (e.g., `frontend, critical`)

## Complete Example

```yaml
---
version: "1.0"
created: 2025-12-18-120000
updated: 2025-12-18-120000
---

# Project Roadmap

## Phase 1: MVP

Goal: Deliver core user-facing functionality
Status: active

### Topics

- user-authentication [IN PROGRESS]
  - Summary: Users need secure login/logout. Support email+password initially, OAuth later.
  - Epic: USER-AUTHENTICATION-1
  - Directory: .agent_planning/user-authentication/
  - Labels: backend, security

- payment-processing [PLANNING]
  - Summary: Stripe integration for subscriptions. Need webhook handling for failed payments.
  - Epic: PAYMENT-PROCESSING-1
  - Directory: .agent_planning/payment-processing/
  - Dependencies: user-authentication
  - Labels: backend, critical

- dashboard-ui [PROPOSED]
  - Summary: Main user dashboard showing account status, recent activity, quick actions.
  - Directory: .agent_planning/dashboard-ui/
  - Dependencies: user-authentication
  - Labels: frontend

## Phase 2: Growth

Goal: Scale and optimize for production use
Status: queued

### Topics

- performance-optimization [PROPOSED]
  - Directory: .agent_planning/performance-optimization/
  - Dependencies: dashboard-ui
  - Labels: performance

- analytics-dashboard [PROPOSED]
  - Directory: .agent_planning/analytics-dashboard/
  - Dependencies: dashboard-ui
  - Labels: frontend, analytics
```

## Parsing Rules

1. **YAML Frontmatter**: Parse between `---` delimiters at file start
2. **Phases**: Match `## Phase N: Name` pattern (H2 headers)
3. **Phase metadata**: Indented `Key: value` lines after phase header
4. **Topics section**: Look for `### Topics` (H3 header) under each phase
5. **Topics**: Match `- topic-slug [STATE]` list items
6. **Topic metadata**: Indented `- Key: value` lines after topic line
7. **Unknown fields**: Ignore gracefully (forward compatibility)
8. **Missing optional fields**: Use defaults or null values

## Data Model (Parsed Structure)

```typescript
interface Roadmap {
  version: string;
  created: string;
  updated: string;
  phases: Phase[];
}

interface Phase {
  name: string;
  number: number;
  goal: string;
  status: 'active' | 'queued' | 'completed';
  topics: Topic[];
}

interface Topic {
  name: string;        // kebab-case slug
  state: 'PROPOSED' | 'PLANNING' | 'IN PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  summary?: string;    // Brief description from conversation (context for /do:plan)
  epic?: string;       // Beads epic ID
  directory?: string;  // Planning directory path
  dependencies?: string[];  // Topic slugs
  labels?: string[];   // Custom labels
}
```

## Validation Rules

### Required Fields
- Frontmatter: `version`, `created`, `updated`
- Phase: name, status
- Topic: name, state

### Format Validation
- Timestamps: `YYYY-MM-DD-HHmmss` format
- Topic names: kebab-case (lowercase, hyphens only)
- Phase status: Must be `active`, `queued`, or `completed`
- Topic state: Must be one of 5 valid states

### Semantic Validation
- At most one phase with `status: active`
- Topic directories should exist if state is not PROPOSED
- Topic dependencies should reference existing topics
- Epic IDs should follow pattern `[A-Z-]+-\d+`

## Extension Points

The schema is designed for extensibility:

**Phase extensions:**
- `StartDate:`, `EndDate:` - Timeline tracking
- `Owner:` - Phase lead
- `Budget:` - Resource allocation

**Topic extensions:**
- `Priority:` - Numeric priority within phase
- `Estimate:` - Complexity estimate
- `Assignee:` - Current owner

**Future additions:**
- Milestones within phases
- Cross-phase dependencies
- Risk annotations

## Migration Guide

### For Existing Projects

If you have existing `.agent_planning/<topic>/` directories:

1. Create `.agent_planning/ROADMAP.md` with initial structure:
```yaml
---
version: "1.0"
created: 2025-12-18-120000
updated: 2025-12-18-120000
---

# Project Roadmap

## Phase 1: MVP

Goal: Deliver core functionality
Status: active

### Topics
```

2. Add topics for each existing directory:
```bash
ls -d .agent_planning/*/ | while read dir; do
  topic=$(basename "$dir")
  echo "- $topic [IN PROGRESS]"
  echo "  - Directory: $dir"
done
```

3. Organize into phases as appropriate

4. Add Epic IDs if using beads:
```bash
bd list --format json | jq -r '.[] | "\(.key): \(.epic)"'
```

### For New Projects

Run `/do:roadmap <first-topic>` to auto-create ROADMAP.md with:
- Initial "Phase 1: MVP" phase
- First topic with auto-created beads epic
- Proper directory structure

## Best Practices

**Phase organization:**
- MVP → Enhancement → Optimization is a common pattern
- Keep phases focused (3-7 topics per phase)
- Complete one phase before starting next

**Topic naming:**
- Use descriptive, searchable names
- Consistency matters: `user-auth` vs `auth-user`
- Avoid abbreviations unless obvious

**State transitions:**
- PROPOSED → PLANNING (when STATUS.md exists)
- PLANNING → IN PROGRESS (when implementation starts)
- IN PROGRESS → COMPLETED (when DoD met)
- COMPLETED → ARCHIVED (when no longer maintained)

**Dependencies:**
- Keep dependency graphs shallow (avoid deep chains)
- Break circular dependencies into phases
- Use labels to group related topics

**Maintenance:**
- Update `updated` timestamp when modifying
- Keep states current (run `/do:roadmap` to sync)
- Archive completed topics periodically

## Troubleshooting

**Parse errors:**
- Check YAML frontmatter is properly delimited with `---`
- Verify all topic lines have `[STATE]` brackets
- Ensure consistent indentation (2 spaces)

**Sync issues:**
- Topic state doesn't match beads epic → Run status sync
- Missing directories → Create with `mkdir -p .agent_planning/<topic>/`
- Epic IDs don't match → Update manually or via beads integration

**Performance:**
- Large roadmaps (50+ topics) → Consider splitting into sub-roadmaps
- Frequent updates → Use `.updated` field for caching
- Complex dependencies → Visualize with external tool

## Version History

**1.0** (2025-12-18):
- Initial schema definition
- Phase and topic structure
- YAML frontmatter metadata
- State and status enums
- Optional extensions design
