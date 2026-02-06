# Getting Started with Do More Now

Welcome! This guide will get you productive with Do More Now in about 5 minutes.

## What You're Getting

Do More Now is a Claude Code plugin that makes Claude more predictable. Instead of Claude doing whatever it thinks is best, you get structured workflows that work the same way every time.

**Before**: "Fix the bug" → Claude might fix it, might refactor everything, might add features

**After**: `/do:it fix the bug` → Claude investigates, fixes, validates, commits

That's the whole idea. Guardrails without friction.

---

## Installation

```bash
# Add the plugin marketplace (one time)
claude plugin marketplace add loom99-public/loom99-claude-marketplace

# Install Do More Now
claude plugin install do
```

That's it. You now have seven new commands starting with `/do:`.

---

## Your First Commands

### 1. Just Do Something

Don't know what to work on? Let Claude figure it out:

```bash
/do:it
```

Claude will:
1. Evaluate your codebase
2. Find the most pressing work
3. Do it
4. Show you what it did

### 2. Do Something Specific

Have something in mind? Say it naturally:

```bash
/do:it fix the login validation
/do:it add dark mode
/do:it refactor the database queries
```

Claude detects your intent and runs the appropriate workflow.

### 3. Get a Status Check

Not sure where the project stands?

```bash
/do:plan status
```

Claude will assess what's done, what's broken, and what needs work.

---

## The Seven Commands

You only need to remember these:

| Command | What It's For | Example |
|---------|---------------|---------|
| `/do:it` | Build, fix, refactor, test | `/do:it fix auth bug` |
| `/do:plan` | Evaluate and plan work | `/do:plan` |
| `/do:explore` | Ask about your code | `/do:explore where is auth handled` |
| `/do:external-research` | Learn from the web | `/do:external-research JWT best practices` |
| `/do:chores` | Cleanup and maintenance | `/do:chores` |
| `/do:docs` | Documentation | `/do:docs readme` |
| `/do:release` | Versioning (stub) | `/do:release` |

**Pro tip**: `/do:it` handles 80% of what you'll do. Start there.

---

## Two Ways to Build Things

### TDD Mode (Tests First)

Best for backend/API work with clear requirements:

```bash
/do:it tdd add user registration API
```

Claude will:
1. Write failing tests
2. Make them pass with real code
3. Verify everything works

### Iterative Mode (Build First)

Best for UI work or when you need to see it to know it's right:

```bash
/do:it iterate build settings page
```

Claude will:
1. Build something
2. Run it to check
3. Refine until it works

### Auto Mode (Claude Picks)

Not sure which? Just say what you want:

```bash
/do:it add payment processing
```

Claude checks if you have tests, what kind of work it is, and picks the right approach.

---

## Controlling Claude's Autonomy

Sometimes you want Claude to ask before making decisions. Sometimes you want it to just go.

### "Ask me about everything"

```bash
/do:it carefully refactor the auth system
```

Claude will stop and ask before each significant decision.

### "Just do it, I'll review later"

```bash
/do:it autonomous fix all the linting errors
```

Claude works independently and documents what it did.

### "Check in when you're done"

```bash
/do:it fix the bug
```

Default behavior. Claude works, then shows you results for approval.

---

## Common Patterns

### Plan, Then Execute

```bash
/do:plan payment system     # See what needs to be done
/do:it                      # Do the work
```

### Investigate, Then Fix

```bash
/do:explore how does auth work here    # Understand the code
/do:it fix the auth token expiration   # Fix with context
```

### Research, Then Build

```bash
/do:external-research best practices for rate limiting    # Learn
/do:it add rate limiting to API                  # Build with knowledge
```

### Scope Your Work

Use parentheses to constrain what Claude touches:

```bash
/do:it fix login (only the email validation, don't touch passwords)
/do:it refactor (just this file, not the whole module)
```

---

## Quick Wins

### Check Project Health

```bash
/do:plan audit
```

Get a comprehensive assessment of your codebase.

### Clean Up

```bash
/do:chores
```

Quick cleanup: unused imports, formatting, obvious fixes.

### Update Docs

```bash
/do:docs readme
```

Sync your README with current reality.

---

## What's Happening Behind the Scenes

When you run a command, here's what happens:

```
You: /do:it fix auth bug
 ↓
Command detects "fix" intent
 ↓
Invokes the fix workflow
 ↓
Spawns researcher agent (investigate)
 ↓
Spawns implementer agent (fix)
 ↓
Spawns evaluator agent (verify)
 ↓
You: See results
```

All the orchestration happens automatically. You just say what you want.

---

## Files Do More Now Creates

The plugin creates a `.agent_planning/` folder in your project:

```
.agent_planning/
├── EVALUATION-*.md        # Project state snapshots
├── PLAN-*.md          # Implementation plans
├── BACKLOG-*.md       # Work to be done
├── RESEARCH-*.md      # Research findings
└── do-command-logs/   # Execution history
```

These files help Claude maintain context across sessions. You can read them, but Claude manages them.

---

## Troubleshooting

### Claude seems stuck

Add constraints to focus the work:

```bash
/do:it fix the bug (just this one function, nothing else)
```

### Claude is asking too many questions

Use autonomous mode:

```bash
/do:it autonomous [task]
```

### Claude isn't asking enough questions

Use careful mode:

```bash
/do:it carefully [task]
```

### I want to see what Claude did

Check the execution logs:

```bash
cat .agent_planning/SUMMARY-*.txt
```

### Something went wrong

Debug logs are in:

```bash
cat .agent_planning/ for debug information
```

---

## What's Next?

Once you're comfortable with basics:

- **[Workflows Guide](./WORKFLOWS.md)** - Deep dive into when to use which workflow
- **[Commands Reference](./COMMANDS.md)** - All commands with full options
- **[Examples](./EXAMPLES.md)** - Real-world scenarios and patterns

---

## Quick Reference Card

```
/do:it                      # Auto-select and execute
/do:it fix <thing>          # Bug fix workflow
/do:it tdd <thing>          # Test-driven development
/do:it iterate <thing>      # Iterative development
/do:it refactor <thing>     # Safe restructuring
/do:it carefully <thing>    # Ask before decisions
/do:it autonomous <thing>   # Work independently

/do:plan                    # Evaluate + generate backlog
/do:plan status             # Quick status check
/do:plan audit              # Comprehensive assessment

/do:explore <question>      # Ask about codebase
/do:external-research <topic>        # Web research

/do:chores                  # Quick cleanup
/do:docs readme             # Update README
```

That's it! You're ready to go. Start with `/do:it` and see what happens.
