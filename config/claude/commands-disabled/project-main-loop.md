Repeat until `.ai_project/<active-project>/TODO.md` is empty:

1. Plan → `/project-plan-next-step` selects highest-priority backlog task.
2. Implement → `/project-implement-item` implements selected task.
3. Test → `/retest` runs tests, identifies and fixes regressions.
4. Refactor → `/project-refactor` simplifies code, improves tests, reduces complexity.
5. Validate UX → `/project-validate-ux` ensures intuitive documented user flows.
6. Track → `/project-status` updates project STATUS.md and repository-level milestones.

Switch to Stabilization Mode if stability KPI falls below threshold:
- Prioritize regression fixes, test failures, and complexity reduction.
