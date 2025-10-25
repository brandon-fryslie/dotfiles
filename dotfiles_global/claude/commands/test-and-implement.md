If specific areas of focus are defined below, focus entirely on those goals and architectural work to enable those goals.  If 'specific-areas-of-focus' is empty, use the latest STATUS and PLAN files 

Specific areas of focus:
<specific-areas-of-focus>
$ARGUMENTS
</specific-areas-of-focus>

This command integrates with `/evaluate-and-plan`. If there are no existing STATUS and PLAN files in the .agent_planning dir, run `/evaluate-and-plan $ARGUMENTS` first.

**Step 1**: Use the functional-tester agent to design and write high-level functional tests that validate real user workflows.  IMPORTANT: All tests should be automated using either the existing testing framework defined in the project, or using the standard framework for the framework/language/tools under test.

**Step 2**: Only after functional-tester has completed, use the test-driven-implementer agent to implement the functionality that makes these tests pass.


**Step 2**: Run `/evaluate-and-plan $ARGUMENTS` to ensure we have up to date planning and status documents.
