# Do More Now Documentation

Welcome to the comprehensive documentation for **Do More Now** (`do`), a Claude Code plugin that provides structured development workflows.

## What This Is

Do More Now adds guardrails to Claude Code without adding friction. Instead of open-ended prompts that might go anywhere, you get consistent, repeatable workflows that work the same way every time.

```
User Command → Command (intent detection) → Skill (workflow) → Agent(s) (execution)
```

Seven commands. Ten specialized agents. Seventeen skills. Zero opinions about your stack.

## Quick Links

### Start Here
| Guide | Description |
|-------|-------------|
| [Getting Started](./GETTING-STARTED.md) | New user? Start here. 5-minute introduction |
| [Examples](./EXAMPLES.md) | Real-world scenarios and how to handle them |

### Reference
| Topic | Description |
|-------|-------------|
| [Commands](./COMMANDS.md) | The seven `/do:` commands and how to use them |
| [Workflows](./WORKFLOWS.md) | Common patterns and when to use them |
| [Agents](./AGENTS.md) | The ten specialized agents and what they do |
| [Skills](./SKILLS.md) | The seventeen workflow skills |
| [Gating](./GATING.md) | Configuring review checkpoints |
| [Architecture](../architecture/README.md) | How the plugin works internally |

## Getting Started

### Installation

```bash
# Add the marketplace
claude plugin marketplace add loom99-public/loom99-claude-marketplace

# Install the plugin
claude plugin install do
```

### Your First Command

```bash
/do:it
```

That's it. Claude evaluates the codebase, finds the most pressing work, and does it.

### Commands At a Glance

| Command | What It Does |
|---------|--------------|
| `/do:it` | Implement: build, fix, refactor, debug, test, review |
| `/do:plan` | Plan: evaluate status, create plans, track backlog |
| `/do:explore` | Explore: codebase questions, internal investigation |
| `/do:external-research` | Research: external sources, web search, market analysis |
| `/do:chores` | Chores: maintenance, cleanup, housekeeping |
| `/do:docs` | Docs: README, API, architecture documentation |
| `/do:release` | Release: versioning, changelog (stub) |

## Key Concepts

### Intent Detection

You don't need to remember skill names. Just say what you want:

```bash
/do:it fix the login bug          # → triggers fix workflow
/do:it add user authentication    # → triggers tdd-workflow or iterative-workflow
/do:plan audit security           # → triggers security audit
```

The command detects your intent and routes to the appropriate skill.

### Two Implementation Modes

**TDD Mode** (`/do:it tdd`): Tests first, then implement. Best for APIs, backend services, and well-defined requirements.

**Iterative Mode** (`/do:it iterate`): Build incrementally, validate as you go. Best for UI work, exploratory features, and visual functionality.

When you don't specify, Claude auto-selects based on context.

### Gate Modes (Decision Handling)

Control how much autonomy Claude has:

| Mode | When Claude Asks |
|------|------------------|
| BLOCKING | Before every significant decision |
| HYBRID | Only for major/risky decisions |
| NONBLOCKING | Never (documents decisions for review) |

Signal your preference in the command:
- "carefully", "approve each" → BLOCKING
- "guided", "review major" → HYBRID
- "autonomous", "just do it" → NONBLOCKING

See [GATING.md](./GATING.md) for full configuration options.

### Planning Files

Agents coordinate through `.agent_planning/`:

| File | Purpose |
|------|---------|
| `EVALUATION-*.md` | Current project state (read-only by agents) |
| `PLAN-*.md` | Implementation plans (read-only by agents) |
| `BACKLOG-*.md` | Prioritized work items |
| `SPRINT-*.md` | Current sprint items (read-write) |
| `TODO-*.md` | Immediate tasks (read-write) |
| `RESEARCH-*.md` | Research findings |
| `SUMMARY-*.txt` | Agent execution summaries |

## Common Patterns

### Plan Then Execute

```bash
/do:plan payment processing    # Evaluate, create plan
/do:it                         # Execute the plan
```

### Scoped Work

```bash
/do:it fix login (only email validation, leave UI alone)
```

Parenthetical constraints are respected.

### Command Chaining

```bash
/do:plan then /do:it then /do:chores
```

Commands execute in sequence, passing context between them.

### Full Autonomous Run

```bash
/do:it autonomous refactor everything
```

NONBLOCKING mode - Claude documents decisions for review instead of asking.

## Integration with Beads

[Beads](https://github.com/loom99-public/beads) is an optional lightweight issue tracker. When installed:

- `/do:plan track` creates issues
- `/do:plan` syncs with open issues
- `/do:it` updates issue status as work progresses

Everything works without Beads. It just works *better* with it.

## Troubleshooting

### Nothing is happening

Check `.agent_planning/` for planning files and agent summaries.

### Claude is stuck in a loop

Add "stop" or be more specific:
```bash
/do:it fix login bug (just the validation, don't touch the UI)
```

### Too many questions

Use NONBLOCKING mode:
```bash
/do:it autonomous fix all the bugs
```

### Not enough questions

Use BLOCKING mode:
```bash
/do:it carefully refactor the database
```

### Where did my work go?

Agent summaries are written to `.agent_planning/SUMMARY-*.txt` files.

## Next Steps

**New users**: Start with [Getting Started](./GETTING-STARTED.md) for a quick introduction.

**Looking for examples**: See [Examples](./EXAMPLES.md) for real-world scenarios.

**Deep dive**:
- [Commands Reference](./COMMANDS.md) - Learn all seven commands in detail
- [Workflows Guide](./WORKFLOWS.md) - Understand when to use which workflow
- [Architecture Overview](../architecture/README.md) - See how it all fits together
