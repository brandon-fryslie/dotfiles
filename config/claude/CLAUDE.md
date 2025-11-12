- Always follow best practices
- Focus on simplicity, reliability, and principle of least surprise
- Always use the symlink at ~/icode to read files in /Users/bmf/Library/Mobile Documents/com~apple~CloudDocs/_mine/icode
- There are no time constraints.  Doing it right the first time is far more efficient than redoing it later.  Focus on efficiency and correctness
- Be creative when exploring ideas!  Think of things no one else has considered before.
- Be boring in your implementation!  An expert should be able to read the implementation and think "obviously this is how it's done"
- Do NOT guess!  Search the web if you're unsure, or ASK
- Do NOT skip steps or ignore work so you can move to the next task!  It's better to stop completely than to continue doing work that is incorrect.

CRITICAL:
- If you have doubts, ask me for input (plain text, NO tools until I
  respond)
- AskUserQuestion tool: If response is empty/only punctuation → re-ask in
  plain text immediately, NO tools until I respond
- Ask questions when:
    - Unsure about goal or desired outcome
    - Important tradeoffs to consider
    - Input could dramatically change outcome
    - Expensive/time-consuming to change later
- MORE QUESTIONS ARE GOOD! DOING USELESS WORK IS BAD!

Language specific rules:
- Python
  - Always use 'uv' for package management
  - Favor designing a robust CLI over calling ad-hoc scripts
  - CRITICAL: NEVER MODIFY SYS.PATH IN ANY .py FILE EVER!  EVER!
  - CRITICAL: DO NOT SET PYTHONPATH ENV VAR, DO NOT IMPORT FILES FROM SEPARATE PROJECTS!
- Shell

MCPs
- Use MCP tools when available.  Find and recommend relevant MCP servers if it feels inefficient to do a task.  Suggest building our own if something that would be useful does not exist!

Code Style
- Testable code is highly valued
- Solid, useful tests that test real functionality without inhibiting extensibility are even more valued
- Tautological, pointless tests are anti-value
- Writing tests FIRST and designing an implementation around tests is a GREAT idea!
  - But don't do that until you have some idea of an implementation that's going to work, or that's just tech debt
- Stick to the plan & architecture documents!
  - But only if they are feasible
  - If they're not, you MUST update the docs to explain WHY we are changing course.  ALWAYS keep plan/arch docs and code aligned

Dev Workflow
- Run the tests after every change
- Update the tests BEFORE every change
- Evaluate everything from fresh eyes every once in a while
  - Are we still aligned on the plan?
  - Is there a lot of dead code / tech debt / useless cruft laying around?  Clean it up!
- Are the docs aligned?  What needs to change?
- evaluate and plan, then test and implement
- run this loop until the project is completely functional
- Your first impression is the most important!  Make it count.
  - If the first bite taste like shit, you've spoiled the meal

Planning Structure
- All planning docs should use the .agent_planning directory in the repo root
- use the "bd" tool for tracking specific work items
- Create initiatives for large pieces of work
- please use pnpm rather than npm