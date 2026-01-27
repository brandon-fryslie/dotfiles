---
description: Guide for creating new slash commands
argument-hint: [command-name] [description]
---

Your exclusive job right now is to provide a recap of the most important unfinished / in-progress work.  It's critical that you provide this recap from what you know now, without using additional tools or reading additional files to generate the recap (you can use the Write tool to write it, if necessary).

The user may have intered more specific instructions.  If they did, go more in depth on that subject and include fine grained detail.  For each of the topics of your recap, include references to any specific files you're aware of that are relevant (but do NOT search).

Please recap each of these topics:
- Any remaining work on current task
- Any remaining work on larger goal
- Any remaining deferred work you're aware of
- Any architectural or system level problems that caused bugs, interfered with your ability to implement work, or interfered with your ability to solve a problem
- Whether there are expected failing tests, and at a high level, whether there are any known tests that are invalid and need to be updated due to recent changes
- Anything else you think it's critical for the next agent to know

You MUST WRITE IT to a file and provide the path to the file.  This file can be in a temp dir and doesn't need to be preserved.

User instructions, if any: $ARGUMENTS