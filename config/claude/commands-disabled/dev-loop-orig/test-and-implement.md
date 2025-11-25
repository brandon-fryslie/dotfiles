---
argument-hint: [area of focus]
description: Write tests and then implement. Pass args to focus on something specific, or Claude will automatically use the most recent planning docs. Designed to work with /evaluate-and-plan. Pass 'plan-first' to tell Claude to run an initial /evaluate-and-plan cycle.
---

IMPORTANT: if "$1" is set to "plan-first" you MUST run this slash command first:
/evaluate-and-plan $ARGUMENTS

If specific areas of focus are defined below, focus entirely on those goals and architectural work to enable those goals.  If 'specific-areas-of-focus' is empty OR only contains 'plan-first', use the latest STATUS and PLAN files 

Specific areas of focus:
<specific-areas-of-focus>
$ARGUMENTS
</specific-areas-of-focus>

This command integrates with the `/evaluate-and-plan` slash command. If there are no existing STATUS and PLAN files in the .agent_planning dir for our current goal, run the slash command `/evaluate-and-plan $ARGUMENTS` first.

This command runs two core loops: TestLoop and ImplementLoop. Each loop is repeated until the condition is satisfied. CRITICAL: ALL LOOPS END WITH AN 'EVALUATE' STEP.

Tests MUST be (TestCriteria):
<TestCriteria>
- useful (no useless tests)
- complete (test all edge cases)
- flexible (they should allow refactoring of implementation details without changing tests, where possible)
- Fully automated
- All tests MUST be AUTOMATED 
  - using either the existing testing framework defined in the project OR
  - using a STANDARD framework for the framework/language/tools under test. 
  - DO NOT implement ad-hoc tests in a non-standard way. 
- If more information is required, ask!
</TestCriteria>

<TestLoop>
**Step 1: Design and write tests**
Use the functional-tester agent to design and write high-level functional tests that validate real user workflows and follow all TestCriteria.  Upon subsequent loops, iterate on the test to ensure they follow our defined TestCriteria.
**Step 2: Evaluate tests**
Use the project-evaluator agent to evaluate ONLY THE RESULT OF STEP 1 (the tests that were just written). Evaluate them in context of the plan we are implementing to ensure they follow our TestCriteria.  If they do not, restart the loop.
<LoopExitCondition>
When TestCriteria are met with NO EXCEPTIONS, exit the loop and proceed
</LoopExitCondition>
</TestLoop>

ONLY proceed after the first loop has been completed and the 'evaluate' step confirms that we have properly implemented the tests according to the TestCriteria.  If this is not the case, restart TestLoop.

<ImplementLoop>
**Step 1**:
Use the test-driven-implementer agent to implement the functionality that makes these tests pass.
**Step 2**:
Use the project-evaluator agent to evaluate ONLY THE RESULT OF STEP 1 (the current implementation).  If there are known outstanding issues and the solution is well defined, restart the ImplementLoop.
<LoopExitCondition>
There are no outstanding issues for which the solution is well defined / little to no ambiguity.
</LoopExitCondition>
</ImplementLoop>

**FINAL STEP*: AFTER we have run BOTH TestLoop and ImplementLoop to completion, run the command `/evaluate-and-plan $ARGUMENTS` to ensure we have up to date planning and status documents.
