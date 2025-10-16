**Prerequisites**: This command integrates with `/evaluate-and-plan`. For best results, run `/evaluate-and-plan` first to generate STATUS and PLAN files that will guide test design and implementation.

**Step 1**: Use the functional-tester agent to design and write high-level functional tests that validate real user workflows.

The functional-tester will:
- Read the latest `STATUS-*.md` file to identify components marked as INCOMPLETE, PARTIAL, or STUB_ONLY
- Read the latest `PLAN-*.md` file to extract P0/P1 work items and their acceptance criteria
- Design 3-5 critical tests that validate the most important user workflows
- Write un-gameable tests that mirror real usage and resist shortcuts
- Map tests to STATUS gaps and PLAN items for traceability

**Step 2**: Only after functional-tester has completed, use the test-driven-implementer agent to implement the functionality that makes these tests pass.

The test-driven-implementer will:
- Read the latest `STATUS-*.md` to understand existing architecture and components
- Read the latest `PLAN-*.md` to follow technical guidance and design decisions
- Run the functional tests to identify failures
- Implement real functionality (no shortcuts, no workarounds)
- Iteratively implement and validate until all tests pass
- Follow PLAN dependencies and maintain architectural consistency

Specific functionality or workflows to test (if defined, otherwise focus on critical user journeys):
###
$ARGUMENTS
###

**Integration with evaluate-and-plan workflow**:

```
Recommended Sequence:
1. /evaluate-and-plan          → Generates STATUS-*.md and PLAN-*.md
2. /test-and-implement         → Creates tests based on gaps, implements functionality
3. /evaluate-and-plan          → Verifies tests pass, updates STATUS with progress
4. Repeat as needed
```

**How the agents integrate**:
- `functional-tester` consumes STATUS gaps → designs tests that would catch those gaps
- `functional-tester` consumes PLAN acceptance criteria → converts to test assertions
- `test-driven-implementer` consumes STATUS architecture → maintains consistency
- `test-driven-implementer` consumes PLAN technical notes → follows design guidance
- Both agents output traceability to STATUS gaps and PLAN items
- `project-evaluator` can verify tests pass as evidence of completion
- `status-planner` references test coverage in future gap analysis

**Feedback loop**:
- Tests that pass → STATUS report marks components as COMPLETE
- Tests that fail → STATUS report identifies remaining gaps
- New gaps in STATUS → PLAN generates new work items
- New work items → Drives next /test-and-implement cycle

## Step 3: Run /evaluate-and-plan one last time ##

Always end by running /evaluate-and-plan one last time so we have an updated status.
