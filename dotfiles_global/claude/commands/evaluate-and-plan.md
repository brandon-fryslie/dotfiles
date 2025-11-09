---
argument-hint: [area of focus]
description: Evaluate the project and make an implementation plan.  Pass args to focus on something specific, or let Claude decide.  Designed to work with /test-and-implement
---

If specific areas of focus are defined below, focus entirely on those goals and architectural work to enable those goals.  If 'specific-areas-of-focus' is empty, use the PROJECT_SPEC.md file to evaluate the project as a whole.

Specific areas of focus:
<specific-areas-of-focus>
$ARGUMENTS
</specific-areas-of-focus>

Step 1: Use the project-evaluator agent to evaluate the current status of the project.

Step 2: Only after project-evaluator has completed, use the status-planner agent to plan the remaining work for the project based on the output of Step 1.

