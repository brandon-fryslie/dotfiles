# Do More Now

**What you already know you should be doing - only better.**

A Claude Code plugin that adds structured workflow commands for development. Seven commands. Ten specialized agents. Zero opinions about your stack.

```bash
/do:it
```

That's it. That kicks off a structured workflow that finds the most important work and does it.

---

## Why Bother?

Plain Claude Code is powerful. You can ask it to do anything. But "anything" is a lot of rope.

**Do More Now adds guardrails without adding friction:**

| Plain Claude | Do More Now |
|--------------|-------------|
| "Fix the bug" → might fix it, might refactor everything, might add 3 features | `/do:it fix the bug` → investigates, fixes, validates, commits |
| "What should I work on?" → gives opinions | `/do:plan` → evaluates actual codebase state, generates prioritized backlog |
| "Add authentication" → starts coding immediately | `/do:it auth` → auto-selects TDD or iterative based on context, validates as it goes |

The difference: **consistent, repeatable workflows** that don't depend on how you phrase your prompt.

Think of it as mise en place for software engineering. Everything in its place, ready to use, no hunting around.

---

## Installation

```bash
# Add the marketplace (one time)
claude plugin marketplace add loom99-public/loom99-claude-marketplace

# Install the plugin
claude plugin install do
```

Or from within Claude Code:
```bash
/plugin marketplace add loom99-public/loom99-claude-marketplace
/plugin install do
```

**Requirements:**
- Claude Code (latest)
- git (for commit functionality)

**Optional but recommended:**
- [Beads](https://github.com/loom99-public/beads) - lightweight issue tracking that integrates with `/do:plan`

---

## Quick Start

### Just Do Something

```bash
/do:it
```

Claude evaluates the codebase, finds the most pressing work, and does it. Auto-selects TDD or iterative mode based on context.

### Do Something Specific

```bash
/do:it fix the login validation bug
/do:it add user preferences API
/do:it refactor the database connection pool
```

### Plan First, Then Do

```bash
/do:plan user authentication    # Evaluate state, create plan
/do:it                          # Execute the plan
```

### Force a Workflow Mode

```bash
/do:it tdd add payment processing    # Tests first, then implement
/do:it iterate build dashboard UI    # Build incrementally, validate visually
```

---

## The Seven Commands

All commands follow the pattern: `/do:<command> [intent] [area]`

Both `[intent]` and `[area]` are optional. Claude figures it out.

### `/do:it` - Implement

The workhorse. Build, fix, refactor, debug, test, review.

```bash
/do:it                          # Auto-select based on context
/do:it fix auth bug             # Bug fix workflow
/do:it refactor database layer  # Safe restructuring
/do:it debug slow queries       # Root cause investigation
/do:it test user service        # Add test coverage
/do:it review                   # Code review recent changes
/do:it tdd new API endpoint     # Force TDD workflow
/do:it iterate dashboard        # Force iterative workflow
```

### `/do:plan` - Plan & Track

Evaluate current state, create plans, manage backlog.

```bash
/do:plan                        # Evaluate + generate backlog
/do:plan status                 # Quick status check
/do:plan audit security         # Deep forensic analysis
/do:plan init my-project        # Initialize new project
/do:plan feature payments       # Design feature proposal
/do:plan track fix login bug    # Add to backlog (requires Beads)
```

### `/do:explore` - Internal Questions

Ask questions about the codebase. Claude reads code, not docs.

```bash
/do:explore where is auth handled
/do:explore how does caching work
/do:explore compare REST vs GraphQL approaches in this codebase
```

### `/do:external-research` - External Research

Learn from outside sources. Web search, docs, competitors.

```bash
/do:external-research JWT best practices 2024
/do:external-research competitors to Stripe
/do:external-research React Server Components patterns
```

### `/do:chores` - Maintenance

Housekeeping, cleanup, tech debt.

```bash
/do:chores                      # Quick cleanup
/do:chores thorough             # Deep cleanup
/do:chores git                  # Git hygiene (stale branches, etc)
/do:chores deps                 # Update dependencies
/do:chores debt                 # Tech debt inventory
```

### `/do:docs` - Documentation

Create and update documentation.

```bash
/do:docs                        # Assess and suggest
/do:docs readme                 # Update README
/do:docs api                    # Generate API documentation
/do:docs architecture           # Update architecture docs
```

### `/do:release` - Release (Stub)

```bash
/do:release                     # Shows stub message (not yet implemented)
```

---

## When to Use Which Mode

### TDD Mode (`/do:it tdd`)

Tests first, then implement. Best for:
- APIs and backend services
- Libraries and frameworks
- Clear, well-defined requirements
- Anything that should work the same way every time

### Iterative Mode (`/do:it iterate`)

Build incrementally, validate as you go. Best for:
- UI and frontend work
- Exploratory features
- Visual or interactive functionality
- When you need to see it to know if it's right

### Auto Mode (`/do:it`)

Let Claude decide. It checks:
- Does a test framework exist?
- Is this API/logic or UI work?
- What does the codebase suggest?

Usually the right call. Override when you know better.

---

## How It Works

Do More Now uses a three-tier architecture:

```
Command → Skill → Agent(s)
```

**Commands** (7 total) detect your intent from natural language.

**Skills** (17 total) define workflows for specific tasks.

**Agents** (10 total) execute the actual work.

Example: `/do:it fix auth bug`
1. Command `it.md` detects "fix" intent
2. Invokes `do:fix` skill
3. Skill spawns `researcher` agent (investigation)
4. Then `iterative-implementer` agent (fix)

---

## Decision Handling (Gate Modes)

Some commands ask how much autonomy Claude should have:

**BLOCKING**: Ask before every significant choice. Maximum control.

**HYBRID** (recommended): Ask about major/risky decisions, auto-approve obvious ones.

**NONBLOCKING**: Full autonomy. Documents decisions for review.

You can signal intent in your prompt:
- "carefully", "approve each" → BLOCKING
- "guided", "review major" → HYBRID
- "autonomous", "just do it" → NONBLOCKING

---

## Beads Integration

[Beads](https://github.com/loom99-public/beads) is a lightweight issue tracker that lives in your repo. When installed:

- `/do:plan track` creates issues
- `/do:plan` syncs with open issues
- `/do:it` updates issue status as work progresses

Everything works without Beads. It just works *better* with it.

---

## Troubleshooting

### "Nothing is happening"

Check `.agent_planning/` for debug logs and planning files.

### "Claude is stuck in a loop"

Add "stop" or "that's enough" to your message. Or use a more specific prompt:
```bash
/do:it fix login bug (just the validation, don't touch the UI)
```

### "Tests keep failing"

If TDD mode isn't working for your codebase:
```bash
/do:it iterate     # Switch to iterative mode
```

### "Too many questions"

Use NONBLOCKING mode:
```bash
/do:it autonomous fix all the bugs
```

### "Not enough questions"

Use BLOCKING mode:
```bash
/do:it carefully refactor the database
```

---

## Advanced Patterns

### Command Chaining

Put multiple commands in one prompt:
```bash
/do:plan then /do:it then /do:chores
```

Claude executes them in sequence, intelligently rewriting context for each.

### Scoped Work

Be specific to avoid scope creep:
```bash
/do:it fix the validation bug in auth.py (only the email regex, leave everything else alone)
```

### Planning Files

Agents coordinate via `.agent_planning/`:
- `EVALUATION-*.md` - Current project state
- `PLAN-*.md` - Implementation plans
- `BACKLOG-*.md` - Prioritized work items
- `SPRINT-*.md` - Current sprint items
- `TODO-*.md` - Immediate tasks

These are created automatically. You can read them, but agents manage them.

### Custom Workflows

Commands detect intent via natural language. Invent your own patterns:
```bash
/do:it spike on websocket implementation  # Exploratory code
/do:it prototype the new dashboard        # Quick iteration
/do:it harden the payment flow            # Security-focused implementation
```

---

## Resources

### Claude Code
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)

### Related Tools
- [Beads](https://github.com/loom99-public/beads) - Issue tracking for Do More Now
- [Loom99 Marketplace](https://github.com/loom99-public/loom99-claude-marketplace) - More plugins

### This Plugin
- `CLAUDE.md` - Technical reference for Claude instances
- `skills/` - Workflow definitions
- `agents/` - Agent specifications

---

## License

**PolyForm Internal Use License 1.0.0**

Free to use by individuals and organizations for internal purposes. Don't redistribute or repackage without permission.

Questions? Reach out.

---

**Version**: 0.5.0
**Author**: Brandon Fryslie
