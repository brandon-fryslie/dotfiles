---
name: "do-test"
description: "Testing audit, recommendations, and implementation. Detects project maturity and works incrementally. Entry point for /do-more:test command."
context: fork
---

Testing command. Audit test coverage, get recommendations, build implementation plan.

<user-input>$ARGUMENTS</user-input>
<current-command>test</current-command>

## Topic Resolution

Determine what to analyze:

1. **If `$ARGUMENTS` provided** → Parse subcommand and target
2. **If no arguments** → Run full audit pipeline on entire project
3. **If specific area mentioned** → Focus audit on that area

Set `main_instructions` to the resolved topic.

---

## Subcommand Routing

Parse `main_instructions` for subcommands:

| Subcommand | Action |
|------------|--------|
| `status` | Quick status check → Jump to Status Flow |
| `audit` | Run audit only → Jump to Audit Flow |
| `recommend` | Run recommendations (needs audit) → Jump to Recommend Flow |
| `plan` | Run implementation plan (needs recommendations) → Jump to Plan Flow |
| `setup` | Set up test framework → `Skill("do:setup-testing")` |
| `add [target]` | Add tests to target → `Skill("do:add-tests")` with target |
| `fix [issue]` | Fix test quality issue → Jump to Fix Flow |
| *(default)* | Full pipeline → Jump to Full Pipeline |

---

## Status Flow (Quick Check)

Fast assessment without full audit.

**Step 1**: Detect test infrastructure

```bash
# Find test configuration
ls package.json pyproject.toml go.mod Cargo.toml 2>/dev/null
ls jest.config.* vitest.config.* pytest.ini setup.cfg conftest.py 2>/dev/null

# Count test files
find . -name "*test*" -o -name "*spec*" | wc -l

# Check for coverage config
ls .coveragerc coverage.* .nycrc* 2>/dev/null
```

**Step 2**: Quick inventory

```bash
# Sample test files
find . -name "*_test.*" -o -name "*.test.*" -o -name "test_*" | head -10
```

**Step 3**: Display status

```markdown
═══════════════════════════════════════
Test Status - [project]
═══════════════════════════════════════
Framework: [detected or "None"]
Test files: [count]
Last run: [if detectable from CI/coverage]

Quick assessment:
  [✅/⚠️/❌] Test framework configured
  [✅/⚠️/❌] Tests exist
  [✅/⚠️/❌] Coverage configured

For full audit: /do:test audit
═══════════════════════════════════════
```

**Exit after status.**

---

## Audit Flow

### Critical: Detect Existing Infrastructure FIRST

**Before any analysis**, detect and document existing test conventions:

```bash
# Detect test framework from config
cat package.json 2>/dev/null | grep -A5 '"devDependencies"'
cat pyproject.toml 2>/dev/null | grep -A10 '\[tool.pytest'
cat go.mod 2>/dev/null
```

**Step A1**: Document existing conventions

Read test configuration files and sample test files to understand:

| Convention | Detection |
|------------|-----------|
| Test framework | Config files (jest.config, pytest.ini, etc.) |
| Test directory | Where tests live (tests/, __tests__/, src/*.test.ts) |
| Naming pattern | How tests are named (test_*.py, *.spec.ts) |
| Fixtures location | Shared test setup (conftest.py, setupTests.ts) |
| Mock patterns | How mocking is done |
| Coverage tool | Coverage configuration |

**Write to `.agent_planning/do-command-state/<EXEC_ID>/EXISTING_TEST_CONVENTIONS.md`**:

```markdown
# Existing Test Conventions

## Framework
- Name: [pytest/jest/vitest/go test/etc.]
- Config: [path to config file]
- Version: [if detectable]

## Directory Structure
- Test location: [path]
- Naming pattern: [pattern]
- Example files:
  - [file1]
  - [file2]

## Fixtures/Setup
- Shared fixtures: [path or "none"]
- Setup files: [paths]

## Mocking
- Library: [mock library if detected]
- Patterns observed: [describe]

## Coverage
- Tool: [coverage tool]
- Config: [path]

## CI Integration
- Config: [path to CI config]
- Test command: [command used]

## CRITICAL: All new tests MUST follow these conventions.
```

**Step A2**: Run forensic audit

Invoke `do:test-coverage-audit` skill with context:

```
Skill("do:test-coverage-audit")
```

The skill will:
1. Detect architecture and complexity sources
2. Inventory existing tests
3. Assess test quality
4. Identify gaps
5. Generate comprehensive report

**Step A3**: Store audit results

Save to `.agent_planning/TEST-AUDIT-<timestamp>.md`

**Output**:

```
═══════════════════════════════════════
Test Coverage Audit Complete
═══════════════════════════════════════
Report: .agent_planning/TEST-AUDIT-<ts>.md

Summary:
  Architecture: [type]
  Test maturity: [None/Basic/Moderate/Mature]
  Critical gaps: [count]
  Quality issues: [count]

Next: /do:test recommend
═══════════════════════════════════════
```

**Step A4**: Capture critical gaps

For each critical gap (P0) identified in the audit, capture as deferred work:

```
Skill("do:deferred-work-capture") with:
  title: "Missing test: <gap summary>"
  description: |
    Critical test gap identified during test audit.

    Gap: <what's missing>
    Risk: <what could go wrong without this test>
    Location: <where test should go>
    Convention: <existing test pattern to follow>
  type: task
  priority: 0
  source_context: "test audit critical gap"
```

This ensures critical test gaps are tracked even if user stops after audit phase.

If subcommand was `audit`, exit here.

---

## Recommend Flow

### Prerequisite Check

**Step R0**: Check for existing audit

```bash
ls -t .agent_planning/TEST-AUDIT-*.md | head -1
```

If no audit exists OR audit is stale (> 24 hours):
- Inform user: "No recent audit found. Running audit first..."
- Jump to Audit Flow, then continue

**Step R1**: Load audit and conventions

Read:
- Latest `TEST-AUDIT-*.md`
- `EXISTING_TEST_CONVENTIONS.md`

**Step R2**: Generate recommendations

Invoke `do:test-recommendations` skill:

```
Skill("do:test-recommendations")
```

The skill will:
1. Parse audit findings
2. Apply strategic framework
3. Prioritize gaps (P0-P3)
4. Identify testability blockers
5. Generate recommendation report

**Step R3**: Validate recommendations against conventions

**CRITICAL CHECK**: Before finalizing recommendations:

For each recommendation that involves creating new tests:
- [ ] Does it use the existing framework?
- [ ] Does it follow the naming convention?
- [ ] Does it go in the correct directory?
- [ ] Does it use existing fixtures where applicable?

If any recommendation would deviate from conventions, flag it:

```markdown
⚠️ CONVENTION DEVIATION DETECTED

Recommendation #3 suggests creating integration tests.
Your project doesn't have integration tests yet.

Current structure:
  tests/unit/test_*.py

Options:
1. Create tests/integration/test_*.py (new directory)
2. Add to existing tests/ with naming like test_*_integration.py
3. Skip integration tests for now

Which approach? [1/2/3/explain]
```

**Step R4**: Store recommendations

Save to `.agent_planning/TEST-RECOMMENDATIONS-<timestamp>.md`

**Output**:

```
═══════════════════════════════════════
Test Recommendations Generated
═══════════════════════════════════════
Report: .agent_planning/TEST-RECOMMENDATIONS-<ts>.md

Priorities:
  P0 (Critical): [count] - [summary]
  P1 (Important): [count] - [summary]
  P2 (Nice to have): [count]

Testability blockers: [count]
Quick wins: [count]

Next: /do:test plan
═══════════════════════════════════════
```

If subcommand was `recommend`, exit here.

---

## Plan Flow

### Prerequisite Check

**Step P0**: Check for existing recommendations

```bash
ls -t .agent_planning/TEST-RECOMMENDATIONS-*.md | head -1
```

If no recommendations exist:
- Inform user: "No recommendations found. Running audit + recommend first..."
- Jump to Audit Flow, then Recommend Flow, then continue

**Step P1**: Load recommendations and conventions

Read:
- Latest `TEST-RECOMMENDATIONS-*.md`
- `EXISTING_TEST_CONVENTIONS.md`

**Step P2**: Generate implementation plan

Invoke `do:test-implementation-plan` skill:

```
Skill("do:test-implementation-plan")
```

The skill will:
1. Identify testability blockers to refactor
2. Sequence refactoring tasks
3. Generate test implementation tasks
4. Create phased timeline

**Step P3**: Validate plan against conventions

**CRITICAL**: Ensure every file path in the plan follows conventions:

```python
# Validation pseudocode
for task in plan.tasks:
    if task.creates_test_file:
        assert task.directory == conventions.test_directory
        assert task.naming matches conventions.naming_pattern
        assert task.uses_fixtures from conventions.fixtures
```

If validation fails, adjust plan or ask user.

**Step P4**: Present plan for approval

```markdown
═══════════════════════════════════════
Test Implementation Plan
═══════════════════════════════════════
Report: .agent_planning/TEST-PLAN-<ts>.md

Following your existing conventions:
  Framework: [detected]
  Test directory: [path]
  Naming: [pattern]

Phase 1: Foundation [if needed]
  - [refactoring/setup tasks]

Phase 2: P0 Tests
  - [list of P0 test tasks]

Phase 3: P1 Tests
  - [list of P1 test tasks]

Estimated scope: [X files, Y new tests]

Proceed with implementation? [Y/n/modify]
═══════════════════════════════════════
```

If subcommand was `plan`, exit here.

---

## Full Pipeline

Run all phases sequentially:

1. **Audit** → Generates TEST-AUDIT-*.md
2. **Present audit** → Show summary, ask to continue
3. **Recommend** → Generates TEST-RECOMMENDATIONS-*.md
4. **Present recommendations** → Show summary, ask to continue
5. **Plan** → Generates TEST-PLAN-*.md
6. **Present plan** → Show summary, ask to implement

At each step, user can:
- Continue to next phase
- Stop and review the artifact
- Modify focus/scope

---

## Fix Flow

For addressing specific test quality issues.

**Step F1**: Parse issue from `main_instructions`

Common issues:
- "fix flaky tests"
- "fix tautological tests"
- "fix over-mocking"
- "fix slow tests"

**Step F2**: Locate problematic tests

Based on issue type:

| Issue | Detection |
|-------|-----------|
| Flaky | Grep for `sleep`, `setTimeout`, timing deps |
| Tautological | Grep for `expect(mock)` patterns |
| Over-mocked | Count mocks per test file |
| Slow | Check test duration reports |

**Step F3**: Generate fix plan

Create specific fixes:
- Which files
- What changes
- How to verify fix worked

**Step F4**: Apply fixes (with approval)

For each fix:
1. Show current code
2. Show proposed change
3. Ask for approval
4. Apply change
5. Run test to verify

---

## Implementation Handoff

When user approves the plan, prepare for `/do:it`:

**Step H1**: Create handoff context

Write to `.agent_planning/HANDOFF-testing-<timestamp>.md`:

```markdown
# Testing Implementation Handoff

## Objective
Implement test improvements per TEST-PLAN-<ts>.md

## Existing Conventions (MUST FOLLOW)
[Copy from EXISTING_TEST_CONVENTIONS.md]

## Tasks
[Copy prioritized tasks from TEST-PLAN]

## Critical Rules
1. All tests go in: [test directory]
2. Naming pattern: [pattern]
3. Use fixtures from: [fixture location]
4. Framework: [framework] - do NOT add other frameworks

## Reference
- Audit: TEST-AUDIT-<ts>.md
- Recommendations: TEST-RECOMMENDATIONS-<ts>.md
- Plan: TEST-PLAN-<ts>.md
```

**Step H2**: Inform user

```
═══════════════════════════════════════
Ready for Implementation
═══════════════════════════════════════
Handoff: .agent_planning/HANDOFF-testing-<ts>.md

To implement:
  /do:it implement test plan

Or implement specific parts:
  /do:it add tests for [component]
  /do:it refactor [service] for testability
═══════════════════════════════════════
```

---

## Convention Enforcement

Throughout all flows, enforce these rules:

### Rule 1: Never Create Competing Structure

If tests exist in `tests/`, don't create `test/` or `__tests__/`.

### Rule 2: Ask Before New Patterns

If recommending something new (e.g., contract tests when none exist):
1. Explain why it's needed
2. Show where it would go
3. Get explicit approval

### Rule 3: Extend, Don't Replace

If fixtures exist, use them. If helpers exist, extend them.

### Rule 4: Document Deviations

If user approves a deviation from conventions:
- Document it in the handoff
- Explain the rationale
- Mark as intentional

---

## Beads Integration

If beads available, create issues for implementation:

```bash
# Create umbrella issue for testing improvements
bd create "Implement test improvements" \
  --type epic \
  -p 1 \
  --description "Per TEST-PLAN-<ts>.md" \
  --json

# Create sub-issues for each P0 task
bd create "[P0] Add auth flow E2E test" \
  --type task \
  -p 0 \
  --json

bd dep <child-id> <epic-id> --type parent-child
```

---

## Error Handling

### No Test Framework

If no test framework detected:
```
No test framework detected. Options:
1. Set up testing framework first → /do:test setup
2. Continue audit (will recommend framework)
3. This project intentionally has no tests

Which? [1/2/3]
```

### Conflicting Conventions

If multiple test patterns detected (e.g., both Jest and Vitest):
```
Multiple test frameworks detected:
- jest.config.js (12 test files)
- vitest.config.ts (3 test files)

Which is the primary framework? [jest/vitest/both]
```

### Stale Artifacts

If audit is old but user runs `recommend`:
```
Found TEST-AUDIT from 3 days ago.
The codebase may have changed.

Use existing audit or re-run? [use/rerun]
```
