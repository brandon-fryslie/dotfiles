# Commands Reference

Do More Now provides seven commands, all following the pattern: `/do:<command> [intent] [area]`

Both `[intent]` and `[area]` are optional. Claude figures it out from context.

## Command Overview

| Command | Purpose | Common Use Cases |
|---------|---------|------------------|
| `/do:it` | Implementation | Build, fix, refactor, debug, test, review |
| `/do:plan` | Planning | Evaluate status, create plans, manage backlog |
| `/do:explore` | Internal research | Ask questions about the codebase |
| `/do:external-research` | External research | Web search, docs, competitors |
| `/do:chores` | Maintenance | Cleanup, git hygiene, tech debt |
| `/do:docs` | Documentation | README, API docs, architecture |
| `/do:release` | Release management | Versioning, changelog (stub) |

---

## `/do:it` - Implementation

The workhorse command. Detects intent and routes to the appropriate workflow.

### Basic Usage

```bash
/do:it                              # Auto-select based on context
/do:it fix the login bug            # Bug fix workflow
/do:it add user authentication      # Feature implementation
/do:it refactor the database layer  # Safe restructuring
```

### Intent Detection

| Keywords | Skill Invoked | Description |
|----------|---------------|-------------|
| "refactor", "restructure", "clean up" | `do:refactor` | Safe code restructuring |
| "debug", "investigate", "root cause" | `do:debug` | Root cause investigation |
| "fix", "bug", "broken", "not working" | `do:fix` | Bug fix workflow |
| "review", "PR", "code review" | `do:review` | Code review |
| "test", "add tests", "coverage" | `do:add-tests` | Add test coverage |
| "setup testing", "add test framework" | `do:setup-testing` | Configure test framework |
| "tdd", "test first" | `do:tdd-workflow` | Test-driven development |
| "iterate", "build incrementally" | `do:iterative-workflow` | Iterative implementation |
| *(default)* | Auto-select | TDD if test framework exists, else iterative |

### Forcing a Workflow Mode

```bash
/do:it tdd add payment processing     # Tests first, then implement
/do:it iterate build dashboard UI     # Build incrementally
```

### Gate Signals

Control how much Claude asks for approval:

```bash
/do:it carefully refactor auth        # BLOCKING: ask before each decision
/do:it verify when done              # Checkpoint at end only
/do:it autonomous fix everything      # NONBLOCKING: work independently
/do:it ask about security changes     # CUSTOM: specific trigger rule
```

### Scoped Implementation

Use parentheses to constrain scope:

```bash
/do:it fix login (only email validation, leave UI alone)
/do:it add caching (redis only, not memcached)
```

### Examples

```bash
# Simple fixes
/do:it fix the typo in the error message
/do:it fix the null pointer in user.ts

# Feature implementation
/do:it add password reset functionality
/do:it implement rate limiting for the API

# Code quality
/do:it refactor the database connection pool
/do:it clean up the authentication module

# Investigation
/do:it debug why tests are flaky
/do:it investigate the memory leak

# Testing
/do:it add tests for the payment service
/do:it improve test coverage for auth
```

---

## `/do:plan` - Planning

Evaluate current state, create plans, and manage work items.

### Basic Usage

```bash
/do:plan                            # Evaluate + generate backlog
/do:plan status                     # Quick status check
/do:plan user authentication        # Plan specific feature
```

### Intent Detection

| Keywords | Skill Invoked | Description |
|----------|---------------|-------------|
| "init", "initialize", "new project" | `do:init-project` | Project initialization |
| "audit", "deep analysis" | `do:audit` | Comprehensive analysis |
| "status", "where are we", "check" | `do:status-check` | Quick diagnostic |
| "feature", "proposal", "design" | `do:feature-proposal` | Feature design |
| "track" | Beads integration | Create issue (requires Beads) |
| *(default)* | Evaluate + plan | Full planning workflow |

### Audit Modes

```bash
/do:plan audit                      # Code quality audit
/do:plan audit security             # Security-focused audit
/do:plan audit comprehensive        # All dimensions
```

Available audit dimensions:
- **Code Quality**: Architecture, design, efficiency, correctness
- **Planning Alignment**: Strategy → Architecture → Plans → Implementation
- **Security**: Dependencies, secrets, auth, OWASP Top 10
- **Competitive**: Feature comparison with alternatives

### Project Initialization

```bash
/do:plan init my-project            # New project setup
/do:plan init                       # Initialize in current directory
```

Walks through project type, architecture decisions, and initial setup.

### Feature Proposals

```bash
/do:plan feature user notifications
/do:plan feature payment integration
```

Creates structured feature proposals with user value focus.

### Beads Integration (Optional)

```bash
/do:plan track fix login bug        # Create issue
/do:plan track P1 auth session leak # Create with priority
```

### Examples

```bash
# Status checks
/do:plan status                     # Quick overview
/do:plan                            # Full evaluation + backlog

# Feature planning
/do:plan feature dark mode
/do:plan feature webhook integrations

# Audits
/do:plan audit
/do:plan audit security
/do:plan audit comprehensive

# Project setup
/do:plan init backend-service
/do:plan init cli-tool
```

---

## `/do:explore` - Internal Research

Ask questions about the codebase. Fast, codebase-only queries.

### Basic Usage

```bash
/do:explore where is auth handled
/do:explore how does caching work
/do:explore what files handle routing
```

### Characteristics

- **Fast**: 30 seconds to 2 minutes
- **Codebase-only**: No web search
- **Read-only**: Doesn't modify files

### Output

- Simple queries (1-3 files): Inline answer with file:line references
- Complex queries (4+ files): Creates `PEEK-<topic>-<timestamp>.md`

### Examples

```bash
/do:explore where is the database connection created
/do:explore how are errors handled in the API layer
/do:explore what middleware runs before routes
/do:explore compare REST vs GraphQL patterns here
```

### When to Use Something Else

- Need external docs or best practices → `/do:external-research`
- Need to assess correctness → `/do:plan status`
- Need implementation → `/do:it`

---

## `/do:external-research` - External Research

Research external sources: web search, documentation, competitors.

### Basic Usage

```bash
/do:external-research JWT best practices 2024
/do:external-research React Server Components patterns
/do:external-research competitors to Stripe
```

### What It Does

1. Searches web for relevant sources
2. Gathers information from official docs
3. Analyzes options and tradeoffs
4. Produces recommendation with rationale

### Output

Creates `RESEARCH-<topic>-<timestamp>.md` with:
- Context and constraints
- Options identified
- Tradeoffs analysis
- Clear recommendation

### Market Research

```bash
/do:external-research market payment processing
/do:external-research competitors to our auth solution
```

### Examples

```bash
# Technology decisions
/do:external-research GraphQL vs REST for our use case
/do:external-research database options for time-series data
/do:external-research authentication libraries for Node.js

# Best practices
/do:external-research microservices patterns 2024
/do:external-research API versioning strategies

# Market analysis
/do:external-research competitors to Notion
/do:external-research demand for CLI developer tools
```

---

## `/do:chores` - Maintenance

Housekeeping, cleanup, and tech debt management.

### Basic Usage

```bash
/do:chores                          # Quick cleanup
/do:chores thorough                 # Deep cleanup
```

### Intent Detection

| Keywords | Action |
|----------|--------|
| "thorough", "deep" | Comprehensive cleanup |
| "git", "branches" | Git hygiene (stale branches, etc.) |
| "planning", "docs" | Planning file cleanup |
| "dead-code", "unused" | Dead code removal |
| "deps", "dependencies" | Dependency updates |
| "debt", "tech debt" | Tech debt inventory |
| *(default)* | Quick cleanup |

### Examples

```bash
# Cleanup
/do:chores                          # Quick pass
/do:chores thorough                 # Everything

# Specific areas
/do:chores git                      # Branch cleanup
/do:chores deps                     # Update dependencies
/do:chores dead-code                # Remove unused code
/do:chores debt                     # Inventory tech debt
```

---

## `/do:docs` - Documentation

Create and update project documentation.

### Basic Usage

```bash
/do:docs                            # Assess and suggest
/do:docs readme                     # Update README
```

### Intent Detection

| Keywords | Action |
|----------|--------|
| "readme", "README" | Update/create README.md |
| "api", "API docs" | Generate API documentation |
| "architecture", "arch" | Update architecture docs |
| "changelog", "CHANGELOG" | Update CHANGELOG.md |
| "contributing" | Update CONTRIBUTING.md |
| *(default)* | Assess gaps, suggest improvements |

### Examples

```bash
/do:docs                            # What docs need work?
/do:docs readme                     # Update README
/do:docs api                        # Document API endpoints
/do:docs architecture               # Update ARCHITECTURE.md
```

---

## `/do:release` - Release Management

Versioning and changelog management.

### Status

**Stub** - Not yet fully implemented.

### Planned Features

```bash
/do:release bump                    # Bump version
/do:release changelog               # Update changelog
/do:release notes                   # Generate release notes
/do:release tag                     # Create git tag
/do:release publish                 # Publish package
```

---

## Command Chaining

Chain multiple commands in one prompt:

```bash
/do:plan feature auth /do:it tdd
```

Executes in sequence, passing context between commands.

### How It Works

The `route-subcommands` skill:
1. Detects `/do:` patterns
2. Extracts pre-commands (before main instruction)
3. Extracts post-commands (after main instruction)
4. Executes in order: pre → main → post

### Examples

```bash
# Plan then implement
/do:plan feature auth /do:it

# Plan, implement, then cleanup
/do:plan /do:it /do:chores

# Research then plan
/do:external-research auth patterns /do:plan feature auth
```

---

## Gate Integration by Command

| Command | Decision Gate | Security Gate | Checkpoint Gate |
|---------|---------------|---------------|-----------------|
| `/do:it` | Yes | Yes | Yes |
| `/do:plan` | - | - | Yes |
| `/do:external-research` | Yes | - | Yes |
| `/do:chores` | Yes | Yes | Yes |
| `/do:docs` | Yes | - | Yes |
| `/do:explore` | - | - | - |
| `/do:release` | Yes | Yes | Yes |

See [GATING.md](./GATING.md) for configuration details.

---

## Related Documentation

- [Agents Reference](./AGENTS.md) - The agents that commands invoke
- [Skills Reference](./SKILLS.md) - The workflow skills
- [Workflows Guide](./WORKFLOWS.md) - When to use which workflow
- [Gating Configuration](./GATING.md) - Decision checkpoint system
