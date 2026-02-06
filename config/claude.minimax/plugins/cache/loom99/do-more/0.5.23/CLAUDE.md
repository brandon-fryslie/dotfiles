# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`do-more` is an expansion pack for the `do` plugin, providing specialized development workflows. Commands orchestrate work via: commands (intent detection) → skills (workflows) → agents (execution).

**Note**: This plugin extends the base `do` plugin. Use `/do:plan`, `/do:it`, `/do:tdd` from the base plugin for core planning and implementation workflows.

## Architecture

```
User Command → Command (intent detection) → Skill (workflow) → Agent(s) (execution)
```

**Execution Flow Example**: `/do:it fix auth bug`
1. `commands/it.md` detects "fix" intent
2. Invokes `do:fix` skill
3. Skill spawns `researcher` agent (investigation) then `iterative-implementer` (fix)

## Commands

| Command | Purpose |
|---------|---------|
| `/do:it [args]` | Implement: build, fix, refactor, debug, test, review |
| `/do:handoff [topic]` | Create context handoff document for agent transfer |
| `/do:explore [question]` | Explore: codebase questions, internal investigation |
| `/do:external-research [topic]` | Research: external sources, web search |
| `/do:docs [type]` | Docs: README, API, architecture documentation |
| `/do:release` | Release: versioning, changelog (stub) |
| `/do:test [args]` | Test: audit coverage, recommendations, implementation |
| `/do:audit [type]` | Comprehensive code/planning/security/test audits |
| `/do:deferred-work-cleanup [quick\|deep]` | Find incomplete migrations, dual code paths, legacy fallbacks |

### `/do:it` Intent Detection

| Intent signals | Invokes skill |
|----------------|---------------|
| "refactor", "restructure", "clean up" | `do:refactor` |
| "debug", "investigate", "root cause" | `do:debug` |
| "fix", "bug", "broken", "not working" | `do:fix` |
| "review", "PR", "code review" | `do:review` |
| "test", "add tests", "coverage" | `do:add-tests` |
| "setup testing", "add test framework" | `do:setup-testing` |
| "tdd", "test first" | `do:tdd-workflow` |
| "iterate", "build incrementally" | `do:iterative-workflow` |
| *(default)* | Auto-select TDD or iterative based on context |

### `/do:test` Intent Detection

| Intent signals | Invokes skill |
|----------------|---------------|
| "status", "quick" | Quick status check |
| "audit" | `do:test-coverage-audit` |
| "recommend" | `do:test-recommendations` |
| "plan" | `do:test-implementation-plan` |
| "setup" | `do:setup-testing` |
| "add [target]" | `do:add-tests` |
| "fix [issue]" | Targeted test quality fix |
| *(default)* | Full pipeline: audit → recommend → plan |

## Agent Mapping

**Base `do` Plugin Agents** (available to all commands):

| Agent | Used By | Purpose |
|-------|---------|---------|
| iterative-implementer | `/do:it` | Iterative implementation |
| project-architect | `/do:plan` | Project initialization |
| project-evaluator | `/do:plan` | Gap analysis |
| status-planner | `/do:plan` | Backlog generation |
| work-evaluator | `/do:it`, `/do:status` | Runtime validation |
| researcher | `/do:research` | Investigation |
| functional-tester | (available if needed) | Test design |
| product-visionary | `/do:feature-proposal`, planning | Feature proposal generation |

**do-more Plugin Agents** (enhance base do):

| Agent | Used By | Purpose |
|-------|---------|---------|
| test-driven-implementer | `/do:tdd` | TDD implementation |
| test-auditor | `/do:test` | Test coverage forensics |
| execution-summarizer | (not yet wired) | Execution logging (planned) |

## Skill-Agent Invocations

| Skill | Agents Invoked | Sequence |
|-------|----------------|----------|
| `do:tdd-workflow` | functional-tester → project-evaluator → test-driven-implementer → work-evaluator | TestLoop then ImplementLoop |
| `do:iterative-workflow` | iterative-implementer → work-evaluator | Loop until COMPLETE |
| `do:fix` | researcher → iterative-implementer → work-evaluator | Investigate → Fix → Verify |
| `do:debug` | researcher → work-evaluator | Investigate → Report (no fix) |
| `do:refactor` | project-evaluator → iterative-implementer → work-evaluator | Analyze → Restructure → Verify |
| `do:review` | project-evaluator | Single-pass review |
| `do:add-tests` | project-evaluator → functional-tester → work-evaluator | Find gaps → Write tests → Verify |
| `do:competitive-audit` | researcher | External research |
| `do:explore-skill` | researcher (explore mode) | Codebase search |
| `do:stuff-skill` | project-evaluator, status-planner, researcher, (tdd or iterative) | Full orchestration |

## Skill Dependencies

### Audit Pipeline
```
/do:audit
    └── audit-master
        ├── [code] → deep-audit
        ├── [planning] → planning-audit
        ├── [security] → security-audit
        ├── [competitive] → competitive-audit → researcher
        └── [testing] → test-coverage-audit
```

### Testing Pipeline
```
/do:test
    └── testing-master
        ├── setup → setup-testing
        ├── audit → test-coverage-audit
        ├── recommend → test-recommendations
        └── plan → test-implementation-plan
```

### Implementation Pipeline
```
/do:it OR /do:stuff
    └── stuff-skill
        ├── [no plan] → project-evaluator → status-planner
        ├── [unknowns] → researcher
        └── [implement] → tdd-workflow OR iterative-workflow
```

## Workflow Decision Trees

### /do:it Intent Detection
```
User says...
├── "tdd", "test first" → tdd-workflow
├── "refactor", "restructure" → refactor skill
├── "debug", "investigate" → debug skill
├── "fix", "bug", "broken" → fix skill
├── "review", "PR" → review skill
├── "test", "add tests" → add-tests skill
├── "iterate", "build" → iterative-workflow
└── (default) → auto-select based on:
    ├── test framework exists + API/logic → tdd-workflow
    └── otherwise → iterative-workflow
```

### /do:test Intent Detection
```
User says...
├── "status", "quick" → quick status check
├── "audit" → test-coverage-audit
├── "recommend" → test-recommendations
├── "plan" → test-implementation-plan
├── "setup" → setup-testing
├── "add [target]" → add-tests skill
├── "fix [issue]" → targeted fix
└── (default) → full pipeline: audit → recommend → plan
```

## Planning Files

Agents coordinate via `.agent_planning/<topic>/`:

| File Pattern | Access | Purpose |
|--------------|--------|---------|
| `EVALUATION-*.md` | Read-only | Current project state |
| `SPRINT-<ts>-<slug>-PLAN.md` | Read-only | Sprint plan with confidence level |
| `SPRINT-<ts>-<slug>-DOD.md` | Read-only | Acceptance criteria |
| `SPRINT-<ts>-<slug>-CONTEXT.md` | Read-only | Implementation context |
| `USER-RESPONSE-*.md` | Read-write | User approval record |
| `TODO-*.md` | Read-write | Immediate tasks |

**Confidence Levels** (in sprint plans):
- HIGH → Ready for `/do:it`
- MEDIUM → Research unknowns first
- LOW → Explore with user, then re-plan

## Subcommand Chaining

Commands detect `/do:` patterns in arguments and route them:
```
/do:plan feature auth /do:it tdd
```
Executes plan feature first, then it tdd with context from plan.

## Deferred Work Capture

The `do:deferred-work-capture` skill (from base `do` plugin) ensures discovered work items aren't silently lost:

### What Gets Captured

| Source | Captured Items |
|--------|----------------|
| `work-evaluator` | PAUSE questions, BLOCKED reasons |
| `status-planner` | Out-of-scope/deferred items |
| `test-driven-implementer` | Discovered bugs during implementation |
| `work-checkpoint` | Incomplete work when user stops |
| `iterative-workflow` | Work remaining on INCOMPLETE/BLOCKED |
| `audit-master` | P0/P1 findings from audits |
| `/do:test` | Critical test gaps |

### How It Works

1. **Primary**: Writes to `.agent_planning/DEFERRED-WORK.md`
2. **Deduplication**: Checks for similar existing items before creating

### Processing Deferred Work

- `/do:deferred-work-cleanup` - Find and process deferred items
- Review `.agent_planning/DEFERRED-WORK.md`

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `do:audit-master` | Multi-dimension comprehensive audit |
| `do:refactor` | Safe code restructuring |
| `do:debug` | Root cause investigation |
| `do:fix` | Bug fix workflow |
| `do:review` | Code review |
| `do:add-tests` | Add test coverage |
| `do:setup-testing` | Configure test framework |
| `do:tdd-workflow` | Test-driven development |
| `do:iterative-workflow` | Incremental implementation |
| `do:evaluation-profiles` | Context-aware validation |
| `do:advanced-skill-builder` | Skill creation helper |
| `do:deferred-work-capture` | Capture and persist discovered work (from base do plugin) |
| `do:test-coverage-audit` | Forensic test analysis |
| `do:test-recommendations` | Prioritized test recommendations |
| `do:test-implementation-plan` | Test implementation plan with refactoring |
| `do:work-checkpoint` | Present completed work for verification |

## Common Patterns

### Handoff → Execute (Recommended)
```bash
/do:handoff auth             # Creates handoff doc with all context
/do:it auth                  # Executes (spawns agent or works interactively)
```
Captures context before implementation, enables efficient agent execution.

### Quick Handoff for Current Work
```bash
/do:handoff current          # Creates handoff for current conversation topic
```
Captures context before spawning agent or switching tasks.

### Scoped Implementation
```bash
/do:it fix login (only email validation, leave UI alone)
```
Parenthetical constraints are respected.

### Full Autonomous Run
```bash
/do:it refactor everything
```
Works autonomously, documents decisions for review.

### Test Coverage Audit
```bash
/do:test                       # Full pipeline: audit → recommend → plan
/do:test status                # Quick status check
/do:test audit                 # Forensic analysis only
/do:test recommend             # Generate recommendations (needs audit)
/do:test plan                  # Generate implementation plan (needs recommendations)
/do:test setup                 # Set up test framework
/do:test add auth              # Add tests to specific area
```
Detects existing test infrastructure, respects conventions, works incrementally from any starting point.

**Critical**: The testing audit system:
1. **Detects before recommending** - Finds existing framework, conventions, patterns
2. **Respects existing structure** - Never creates competing test directories
3. **Asks before new patterns** - Gets approval for new test types (e.g., contract tests)
4. **Works incrementally** - Starts from wherever the project is
