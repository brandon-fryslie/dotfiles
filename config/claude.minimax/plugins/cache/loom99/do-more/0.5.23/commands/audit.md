---
name: "do:audit"
argument-hint: [code|planning|security|competitive|tests|everything]
description: Comprehensive audit across code quality, planning, security, competitive, and test coverage dimensions. Invoke audit-master skill.
---

Comprehensive audit command. Routes to `audit-master` skill.

<user-input>$ARGUMENTS</user-input>

**Use the Skill tool** to invoke `do:audit-master` skill with `$ARGUMENTS` as context.

The skill will:
1. Detect which dimensions to audit based on arguments
2. Prompt user if no dimensions specified
3. Run selected audit dimensions
4. Output combined audit report
