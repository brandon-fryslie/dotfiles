---
name: "do-evaluation-profiles"
description: "Context-aware validation criteria for evaluator agents. Use this skill when running project-evaluator or work-evaluator to select the appropriate validation profile based on project type. Prevents wasted effort on irrelevant validations (e.g., pagination checks on prompts, concurrent access testing on CLIs). Profiles include CLI tools, web apps, agent prompts, libraries, and APIs."
---

# Evaluation Profiles

This skill provides context-aware validation criteria to make evaluator agents efficient and focused.

## The Problem

Evaluators waste 50-70% of time on irrelevant validations:
- Checking pagination on non-paginated features
- Testing concurrent access on single-user CLIs
- Running memory profiling on prompt files
- Repeating the same validations across invocations

## Solution: Profile-Based Validation

Select the appropriate profile based on what you're evaluating. Each profile defines:
1. **ALWAYS run** - Quick, universally applicable checks (~5 seconds)
2. **RUN IF applicable** - Conditional checks based on feature presence
3. **SKIP unless requested** - Expensive checks only when user explicitly asks
4. **SKIP entirely** - Irrelevant for this profile

## Profile Selection

Before starting evaluation, determine the profile:

| If evaluating... | Use profile |
|------------------|-------------|
| Command-line tool, script, CLI | `cli-tool` |
| Web application, frontend, UI | `web-app` |
| Agent definition, skill, prompt | `agent-prompt` |
| Library, SDK, package for others | `library` |
| Compiler, pipeline, data transforms, kernels | `library-pipeline` |
| REST/GraphQL API, backend service | `api-service` |
| Configuration, infrastructure | `config-infra` |

**Mixed projects**: Use the profile matching the component under evaluation, not the overall project type.

## Profile Reference Files

After selecting a profile, read the corresponding reference file for specific validation criteria:

- **CLI tools**: Read `references/cli-tool.md`
- **Web applications**: Read `references/web-app.md`
- **Agent prompts**: Read `references/agent-prompt.md`
- **Libraries**: Read `references/library.md`
- **Library/Pipeline**: See inline profile below (no separate reference file)
- **API services**: Read `references/api-service.md`
- **Config/Infra**: Read `references/config-infra.md`

## Validation Caching

To avoid redundant work across evaluator invocations:

1. **Check existing STATUS files** - If a validation was already performed and code hasn't changed, skip it
2. **Note what was validated** - Include in STATUS output which checks were run
3. **Mark unchanged areas** - "Config validation: unchanged since EVALUATION-2024-12-08"

## When Validation Is Difficult

If a validation cannot be easily automated:

1. **Don't attempt impossible checks** - Skip with note "Requires manual verification"
2. **Suggest user validation** - "To verify X, user should: [specific steps]"
3. **Never waste time** - If you've spent >30 seconds without progress on a validation, skip it

## Quick Reference: Universal Checks (All Profiles)

These apply regardless of profile (~10 seconds total):

```
✅ ALWAYS RUN:
- Grep for TODO/FIXME in completed code
- File existence for referenced paths
- Syntax validation (parse without error)
- Import/dependency resolution

⚠️ CONDITIONAL:
- Test execution (only if tests exist)
- Build/compile (only if build system present)

❌ NEVER BY DEFAULT:
- Memory profiling
- Load testing
- Security audits
- Concurrent access testing
```

## Universal Red Flags (All Profiles)

These indicate incomplete or shortcut implementations regardless of project type:

**Fake completeness:**
- TODO/FIXME comments in code marked as "complete"
- Placeholder values or stub implementations
- Error handlers that swallow exceptions silently
- Functions that return hardcoded values

**Test-specific cheating:**
- Code paths that only execute during tests
- Environment checks that bypass real logic
- Hardcoded values matching test expectations

**Shortcut indicators:**
- Loading states that never resolve
- Buttons/actions that don't respond
- Forms that submit but don't save
- Error messages containing "TODO" or generic text

## Ambiguity Detection Checklist (All Profiles)

Signs the LLM had to guess (check for these universally):

**Arbitrary decisions:**
- Magic numbers without explanation (why 100? why 30 seconds?)
- Implementation choices with no documented rationale
- Multiple valid approaches where one was chosen without justification

**Uncertainty markers:**
- Comments like "assuming...", "probably...", "might need to..."
- Inconsistent patterns (different approaches for similar problems)
- Overly defensive code (checking for things that "shouldn't" happen)

**Questions that should have been asked:**
- What should happen when X fails?
- What's the expected behavior for edge case Y?
- Which of these two valid approaches is preferred?
- What are the performance/scale requirements?

## Data Flow Templates

Profile-specific data flow verification patterns:

**CLI Tool:**
```
Args → Parse → Validate → Process → Output → Exit Code
```

**Web App:**
```
User Input → Validation → Processing → Storage → Retrieval → Display
```

**API Service:**
```
Request → Auth → Validate → Process → Database → Response
```

**Library:**
```
Call → Validate → Transform → Return (+ side effects if any)
```

**Agent/Prompt:** (No runtime data flow - verify structural integrity only)

**Config/Infra:** (No runtime data flow - verify parse + reference resolution)

## Profile: library-pipeline (Inline)

**Use for:** Compilers, data pipelines, render systems, signal processing, transformation chains, pure-function kernels, IR generation, schedule execution.

**Key insight:** There is no UI to click. "Runtime evidence" means running the actual pipeline with real inputs and verifying outputs are correct, correctly shaped, and produced in the right order.

### ALWAYS RUN:

**Pipeline entry point test:**
- Identify the real entry point (the function/class the rest of the system actually calls)
- Call it with realistic inputs
- Verify outputs have correct types, shapes, and values

**Stage ordering verification:**
- If the pipeline has stages that must run in order, verify the orchestration layer calls them in order
- SPY on the real orchestrator — do NOT manually call stages in sequence (that's a tautology)

**Invariant checks:**
- Pure functions: same inputs → bitwise identical outputs (test with repeated calls)
- No-mutation: input buffers unchanged after pipeline runs (snapshot before/after)
- Type constraints: output types match declared contracts (Float32Array, stride N, etc.)

**Tautology scan:**
- For each test: "If I deleted the implementation, would this test still pass?"
- For each integration test: "Does this invoke the real orchestration layer?"
- For each ordering test: "Does this spy on the real pipeline, or manually sequence calls?"

### RUN IF applicable:

**Performance (if pipeline processes large data):**
- Run with N=10000+ elements — no crash, reasonable time
- No per-element allocations (check for `new` or object literals in hot paths)

**Composition (if pipeline has composable stages):**
- Verify stages compose correctly (output of stage N is valid input for stage N+1)
- Verify removing/reordering optional stages doesn't break required stages

**Determinism (if outputs must be reproducible):**
- Run same inputs twice → bitwise identical outputs
- Run with different initial states → same outputs (no hidden state leakage)

### SKIP unless requested:

- Memory profiling
- Benchmarking (unless performance is an acceptance criterion)
- Concurrency testing (unless pipeline is multi-threaded)
- Visual output verification (unless rendering is the point)

### SKIP entirely:

- Browser/UI interaction
- HTTP request testing
- Form validation
- User session management
- Database/persistence checks (unless the pipeline writes to storage)

### Data Flow Template:

```
Input Data → [Stage 1: Parse/Validate] → IR₁ → [Stage 2: Transform] → IR₂ → ... → [Stage N: Emit] → Output
```

Verify at EACH stage boundary:
- Input to stage N+1 is the actual output of stage N (not a manually constructed copy)
- Stage N's contract (types, shapes, invariants) is satisfied by stage N-1's output
- The orchestration layer (not the test) coordinates the stages

### Library-Pipeline Red Flags:

- Tests that import internal helpers instead of the public API surface
- "Integration" tests that manually call individual stages in sequence
- Tests that construct expected data rather than computing it independently
- Spy tests that verify manually-constructed ordering rather than real pipeline ordering
- Tests at the wrong layer (testing a helper when the criterion describes the orchestrator)
- Performance claims without actual N=large verification

## Integration with Evaluator Agents

When project-evaluator or work-evaluator starts:

1. Determine project type from context (README, package.json, file structure)
2. Load this skill
3. Read the appropriate profile reference (or inline profile for library-pipeline)
4. Apply only the validations specified for that profile
5. Check Universal Red Flags and Ambiguity Detection (always)
6. Note skipped validations with reason in output
