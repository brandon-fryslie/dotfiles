---
name: parallel-review
description: Aggregate feedback from agents, review code for obvious issues, and create commits as needed.
tags:
  - review
  - agent
  - lint
  - test
---

Task overview (review focus):

1. Review the repository changes produced by the previous command (the “five-agent work split”) and look only for obvious red flags or glaring issues—do not certify total quality, just highlight anything obviously wrong or broken. Think in terms of regressions, build-breaking errors, failing key behaviors, or clearly poor code.
  
2. Aggregate any notes, concerns, or open questions captured in the agents’ log files (they have the same basename as their task file with a `.log` extension). Summarize the key takeaways/flags from those logs. If no logs exist, note that as well.
  
3. Provide any additional helpful observations (e.g., missing tests, lint regressions, build warnings). Mention relevant files and line references when available.
  
4. If fixes are needed, make one or more commits capturing the follow-up work. If the repo is already clean and no immediate fixes are necessary, state that clearly in your re   ponse.

Output expectations:
- A high-level summary of what you reviewed, including files or areas you focused on.
- Any obvious concerns or blockers you spotted (with file references when possible).
- A list of agent log files processed and their key messages/flags.
- A note on whether you committed any follow-up work (and what those commits contain).
  
Include all responses in this single output.
