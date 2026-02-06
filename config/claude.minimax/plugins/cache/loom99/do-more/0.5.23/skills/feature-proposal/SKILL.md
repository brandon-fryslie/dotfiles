---
name: "do-feature-proposal"
description: "Generate high-level feature proposals focused on user value. Creates raw material for the planning workflow - run /plan afterward to create implementation plans. Entry point for /do-more:feature-proposal command."
context: fork
---

Generate a feature proposal focused on user value and product vision.

If specific areas of focus are defined below, explore ideas within that domain. If empty, identify opportunities based on the current project state.

<areas-of-focus>
$ARGUMENTS
</areas-of-focus>

Use the do:product-visionary agent to create a feature proposal.

**Important**: This agent generates the "what" and "why" - user problems, feature concepts, and success criteria. It does NOT create implementation plans. After reviewing the proposal, run `/do:plan` to turn selected ideas into actionable work items.

After the agent completes, display its summary and show:
```
=======================================
Feature Proposal Complete
  Proposal: .agent_planning/<TYPE>_PROPOSAL_<name>.md
  Ideas: n brainstormed -> m selected
Workflow:
  1. Review the proposal
  2. Discuss/refine with user if needed
  3. Run /do:plan to create implementation plan
=======================================
```
