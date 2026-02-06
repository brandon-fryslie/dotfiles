# Test Coverage Audit - Usage Guide

A forensic testing audit system that analyzes your project's test coverage quality, generates recommendations, and helps you build out testing infrastructure incrementally.

## Quick Start

```bash
# Full audit → recommendations → implementation plan
/do:test

# Quick status check
/do:test status

# Focus on specific area
/do:test auth module
/do:test payment integration
```

## What This Does

### The Three-Skill Pipeline

```
┌─────────────────────┐
│ test-coverage-audit │  → "What do we have? What's missing?"
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ test-recommendations│  → "What should we test? In what order?"
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│test-implementation  │  → "How do we do it? What refactoring needed?"
│        -plan        │
└─────────────────────┘
```

### 1. Audit Phase (test-coverage-audit)

Performs forensic analysis to detect:

**Complexity Sources**
- Architecture type (monolith, microservices, serverless)
- Database and cache interactions
- External API integrations
- File system operations
- Interactive/user input patterns

**Test Inventory**
- Existing test files and frameworks
- Test categorization (unit, integration, e2e, contract)
- Coverage metrics

**Quality Assessment**
- Red flags (tautological tests, over-mocking, flaky tests)
- Gap analysis with risk prioritization (P0-P3)

**Output**: Comprehensive audit report with exhaustive accounting of what exists, what's missing, and what's broken.

### 2. Recommendations Phase (test-recommendations)

Transforms audit findings into actionable plan:

- Prioritized list of gaps to address (P0 first)
- Recommended test type for each gap
- Testability blockers identified
- Quick wins highlighted
- Implementation sequence

**Output**: Strategic test plan with specific recommendations.

### 3. Implementation Plan Phase (test-implementation-plan)

Creates execution-ready plan:

- Refactoring steps to make code testable
- Test implementation tasks
- File-by-file changes needed
- Timeline with phases

**Output**: Step-by-step implementation guide.

---

## Critical Principles

### 1. Work WITH Existing Infrastructure

The system will:
- **Detect** existing test framework, directory structure, naming conventions
- **Follow** your project's patterns (if tests go in `__tests__/`, new tests go there too)
- **Extend** existing fixtures, helpers, and utilities
- **Never** create competing test structures without explicit approval

If existing conventions are detected:
```markdown
Detected existing test infrastructure:
  Framework: pytest (pyproject.toml)
  Test directory: tests/
  Naming: test_*.py
  Fixtures: tests/conftest.py

All recommendations will follow these conventions.
```

### 2. Incremental Improvement

Works at ANY starting point:

| Current State | What Happens |
|---------------|--------------|
| No tests at all | Recommends framework, creates initial structure, starts with P0 gaps |
| Framework exists, few tests | Identifies gaps, recommends next tests to write |
| Good coverage, some gaps | Focuses on specific missing areas |
| Mature testing, quality issues | Addresses flaky tests, over-mocking, tautological tests |

### 3. Approval Required for Big Changes

The system will **ask before**:
- Creating new test framework configuration
- Changing existing directory structure
- Adding new dependencies
- Refactoring production code for testability
- Creating a fundamentally different test organization

Example approval request:
```
Your project uses Jest with tests in `src/__tests__/`.
However, there's no E2E framework for user journey testing.

Options:
1. Add Playwright alongside Jest (recommended)
2. Continue with Jest only, mock at boundaries
3. Let me explain the tradeoffs

Which approach?
```

### 4. Language/Framework Agnostic

Supports:
- **Languages**: Python, TypeScript/JavaScript, Go, Rust, Java, Ruby
- **Scenarios**: CLI, web frontend, web backend, fullstack, library, mobile, infrastructure, AI/agents, data pipelines, real-time systems, embedded/IoT, desktop apps, browser extensions, games, blockchain

Each has specific reference docs with framework-specific guidance.

---

## Example Workflows

### Workflow 1: Brand New Project (No Tests)

```bash
/do:test
```

Output:
```
═══════════════════════════════════════
Test Coverage Audit - my-project
═══════════════════════════════════════

ARCHITECTURE: Monolith (FastAPI backend)
LANGUAGE: Python

CURRENT STATE:
  Test framework: None detected
  Test files: 0
  Coverage: 0%

COMPLEXITY SOURCES:
  ✗ PostgreSQL via SQLAlchemy (untested)
  ✗ Redis cache (untested)
  ✗ Stripe integration (untested)
  ✗ SendGrid email (untested)

P0 GAPS (Critical):
  1. No test framework configured
  2. Payment processing untested
  3. Auth flow untested

RECOMMENDATION: Set up pytest first, then address P0 gaps.

Proceed with setup? [Y/n]
```

### Workflow 2: Some Tests Exist

```bash
/do:test
```

Output:
```
═══════════════════════════════════════
Test Coverage Audit - my-project
═══════════════════════════════════════

ARCHITECTURE: Microservices (3 services detected)
LANGUAGE: TypeScript

CURRENT STATE:
  Test framework: Jest (jest.config.js)
  Test directory: src/__tests__/
  Test files: 23
  Unit tests: 45
  Integration tests: 0
  E2E tests: 0
  Coverage: 34%

QUALITY ISSUES:
  ⚠️ 8 tests mock everything (likely tautological)
  ⚠️ No contract tests between services
  ⚠️ No error path testing

P0 GAPS:
  1. User Service API - no integration tests
  2. Payment webhooks - untested
  3. Auth token refresh - untested

P1 GAPS:
  4. Cache invalidation - untested
  5. Rate limiting - untested

TESTABILITY BLOCKERS:
  - PaymentService has hard-coded Stripe client
  - UserService uses global state for sessions

QUICK WINS (high value, low effort):
  - Add error response tests to existing API tests
  - Add validation tests for user input

Continue to recommendations? [Y/n]
```

### Workflow 3: Mature Project with Quality Issues

```bash
/do:test
```

Output:
```
═══════════════════════════════════════
Test Coverage Audit - my-project
═══════════════════════════════════════

CURRENT STATE:
  Test framework: pytest + pytest-cov
  Test files: 156
  Coverage: 78%

QUALITY ASSESSMENT:
  ❌ 12 tautological tests detected
     - test_user_service.py: mocks return what they mock
  ❌ 5 flaky tests (time-dependent)
     - test_cache.py: uses sleep() for timing
  ⚠️ Over-mocked: 23 tests mock all dependencies
  ⚠️ Happy path only: 34 tests have no error cases

TEST PYRAMID:
  Unit: 89% (fine)
  Integration: 6% (too low)
  E2E: 5% (adequate)

The main issue isn't coverage - it's test quality.

RECOMMENDATIONS:
  P0: Fix tautological tests (12 tests)
  P0: Fix flaky tests (5 tests)
  P1: Add integration tests for service boundaries
  P1: Add error path testing

Continue to implementation plan? [Y/n]
```

---

## Command Reference

### /do:test

Full testing audit command with subcommands:

| Subcommand | Description |
|------------|-------------|
| (none) | Full audit → recommendations → plan |
| `status` | Quick status check only |
| `audit` | Run audit only |
| `recommend` | Run recommendations only (assumes audit exists) |
| `plan` | Run implementation plan only (assumes recommendations exist) |
| `setup` | Set up test framework (invokes setup-testing skill) |
| `add [target]` | Add tests to specific area (invokes add-tests skill) |
| `fix [issue]` | Fix specific test quality issue |

### Integration with Other Commands

```bash
# After audit, implement the recommendations
/do:test                    # Generates plan
/do:it implement test plan  # Executes the plan

# Focus on TDD for new feature
/do:it tdd new auth system  # Uses tdd-workflow skill

# Add tests to existing code
/do:test add payment module # Uses add-tests skill

# Set up framework from scratch
/do:test setup              # Uses setup-testing skill
```

---

## Planning Artifacts

The audit creates files in `.agent_planning/`:

```
.agent_planning/
├── TEST-AUDIT-<timestamp>.md      # Full audit report
├── TEST-RECOMMENDATIONS-<ts>.md   # Prioritized recommendations
├── TEST-PLAN-<timestamp>.md       # Implementation plan
└── do-command-state/
    └── <exec-id>/
        └── TEST_CONTEXT.md        # Context for subsequent commands
```

These are referenced by `/do:it` when implementing.

---

## Skill Invocation

The skills can also be invoked directly:

```python
# In a Claude conversation
Skill("do:test-coverage-audit")
Skill("do:test-recommendations")
Skill("do:test-implementation-plan")
```

Or by agents:
```python
Task(
    subagent_type="Explore",
    prompt="Use the test-coverage-audit skill to analyze this project's testing"
)
```

---

## Reference Documentation

The skills include extensive reference docs:

### Concepts
- `testing-levels.md` - When to use unit vs integration vs e2e
- `llm-testing-mistakes.md` - Common AI testing anti-patterns
- `interactive-testing.md` - Testing CLI, TUI, device-specific features
- `unknown-ui-testing.md` - Behavior-based UI testing

### Detection
- `microservices.md` - Detecting distributed architectures
- `data-interactions.md` - Database, cache, file system detection
- `external-apis.md` - HTTP client, webhook, SDK detection

### Strategies
- `pyramid.md` - Classic test pyramid
- `contract-testing.md` - Consumer-driven contracts
- `event-driven.md` - Message queue testing
- `data-validation.md` - Data pipeline testing
- `property-based.md` - Property/fuzz testing

### Refactoring
- `dependency-injection.md` - Making dependencies injectable
- `extract-interface.md` - Creating testable interfaces
- `remove-global-state.md` - Eliminating singletons
- `seam-creation.md` - Legacy code testing
- `pure-function-extraction.md` - Isolating testable logic

### Scenarios (15)
- CLI, Web Frontend, Web Backend, Fullstack, Library
- Mobile, Infrastructure, AI/Agents
- Data Pipelines, Real-time Systems, Embedded/IoT
- Desktop Apps, Browser Extensions, Games, Blockchain

### Languages (6)
- Python, TypeScript/JS, Go, Rust, Java, Ruby

---

## FAQ

**Q: Will this mess up my existing tests?**
A: No. The audit is read-only. All modifications require explicit approval.

**Q: What if I disagree with a recommendation?**
A: Skip it. The plan adapts. Lower priority items become suggestions, not requirements.

**Q: Can I run just part of this?**
A: Yes. Use `/do:test status` for quick check, or run individual skills.

**Q: How does it handle monorepos?**
A: Detects workspace structure and can audit per-package or holistically.

**Q: What about CI integration?**
A: The implementation plan includes CI configuration recommendations when relevant.
