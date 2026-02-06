# Gating System

The gating system provides configurable review checkpoints throughout the do-more-now workflow. It lets users control when Claude pauses for approval versus working autonomously.

## Overview

Gates are review points where Claude can pause to ask for user approval. There are three types:

| Gate | When | Purpose |
|------|------|---------|
| **decision-gate** | During work | Review architecture/technology choices before implementation |
| **security-gate** | During work | Review security-sensitive changes immediately |
| **checkpoint-gate** | End of command | Verify completed work before moving on |

Each gate can be configured independently to:
- **BLOCKING** - Always pause and ask
- **NONBLOCKING** - Never pause, auto-approve
- **CUSTOM** - Pause based on a rule you define

## Quick Start

### Option 1: Configure in CLAUDE.md (Recommended)

Add a "Gating" section to your project or user CLAUDE.md:

```markdown
## Gating

- decision-gate: Ask only about major architectural decisions
- security-gate: Always ask immediately
- checkpoint-gate: Always verify when done
```

Or in natural language:

```markdown
## Gating Preferences

When using /do: commands:
- Always verify my work before moving on
- Ask me immediately about any security-related changes
- Only ask about major architectural decisions
```

### Option 2: Per-Command

Include gate hints in your command:

```
/do:it carefully implement auth      # All gates BLOCKING
/do:it verify when done             # checkpoint-gate BLOCKING
/do:it autonomous fix the bug       # All gates NONBLOCKING
/do:it ask about auth changes       # CUSTOM rule for that prompt
```

### Option 3: Prompt When Asked

If no configuration is found, Claude will ask:

```
This plugin can pause for your review at three points:
- Decision gate: When making architecture/technology choices
- Security gate: When touching auth, credentials, external APIs, or adding dependencies
- Checkpoint gate: When a command finishes, before moving on

You can preconfigure these in CLAUDE.md with a "Gating" section, or choose now.

When should I stop for your review?
[ ] When done    [ ] Each decision    [ ] Keep going    [ ] Custom rule
```

## Gate Types in Detail

### Decision Gate

**Triggers when**: An agent makes an architecture or technology choice.

**Examples**:
- Choosing between implementation approaches
- Selecting a design pattern
- Adding new abstractions or components
- Algorithm selection

**Logged to**: `.agent_planning/do-command-state/<EXEC_ID>/DECISIONS/`

**Typical configuration**:
- Conservative users: BLOCKING (review every choice)
- Most users: CUSTOM ("ask about major decisions")
- Trusting users: NONBLOCKING

### Security Gate

**Triggers when**: An agent makes a security-sensitive change.

**Examples**:
- Adding new dependencies (npm install, pip install)
- Modifying authentication/authorization code
- Adding external API integrations
- Changing credential handling
- Modifying security-related configuration

**Logged to**: `.agent_planning/do-command-state/<EXEC_ID>/SECURITY/`

**Typical configuration**:
- Most users: BLOCKING (always review security changes)
- Experienced users: CUSTOM ("ask about auth and credentials")
- Solo prototyping: NONBLOCKING

### Checkpoint Gate

**Triggers when**: A command completes, before moving on.

**Purpose**: Review completed work, provide feedback, decide next steps.

**Presents**:
- Summary of work completed
- Files changed
- How to verify each item
- Questions for feedback and next action

**Typical configuration**:
- Most users: BLOCKING (verify before continuing)
- Batch processing: NONBLOCKING

## Configuration Reference

### CLAUDE.md Format

Gates can be configured with specific modes:

```markdown
## Gating

- decision-gate: BLOCKING
- security-gate: BLOCKING
- checkpoint-gate: NONBLOCKING
```

Or with CUSTOM rules:

```markdown
## Gating

- decision-gate: Ask only if it affects the public API
- security-gate: Ask about auth, but auto-approve dependency updates
- checkpoint-gate: Always verify
```

### Runtime State

Gate configuration is written to:
```
.agent_planning/do-command-state/<EXEC_ID>/GATE_CONFIG.txt
```

Format:
```
EXEC_ID: <uuid>
COMMAND: /do:it
CREATED: <timestamp>
SOURCE: command | session | claude-md | prompted

DECISION_GATE: BLOCKING | NONBLOCKING | CUSTOM
DECISION_PROMPT: <if CUSTOM>

SECURITY_GATE: BLOCKING | NONBLOCKING | CUSTOM
SECURITY_PROMPT: <if CUSTOM>

CHECKPOINT_GATE: BLOCKING | NONBLOCKING | CUSTOM
CHECKPOINT_PROMPT: <if CUSTOM>
```

## How It Works

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Command Starts                                           │
│    └─ Load gate config (CLAUDE.md → session → prompt)       │
├─────────────────────────────────────────────────────────────┤
│ 2. Agent Executes                                           │
│    └─ Logs decisions to DECISIONS/*.txt                     │
│    └─ Logs security events to SECURITY/*.txt                │
├─────────────────────────────────────────────────────────────┤
│ 3. Agent Returns                                            │
│    └─ Process decision-gate (if DECISIONS/ has pending)     │
│    └─ Process security-gate (if SECURITY/ has pending)      │
│    └─ If triggered → AskUserQuestion                        │
│    └─ If rejected → STOP                                    │
├─────────────────────────────────────────────────────────────┤
│ 4. Command Completes                                        │
│    └─ Process checkpoint-gate                               │
│    └─ Present work for verification                         │
│    └─ Collect feedback, determine next action               │
└─────────────────────────────────────────────────────────────┘
```

### Agents and Gates

Agents are subagents and cannot ask questions directly. Instead, they:

1. Check if gating is active (read GATE_CONFIG.txt)
2. Log decisions/security events to files
3. Return control to the command
4. The command invokes `gating-controller` to process logged items

| Agent | Decision Gate | Security Gate |
|-------|---------------|---------------|
| project-architect | Architecture, technology choices | Auth strategy, credential storage |
| iterative-implementer | Component structure, algorithms | Dependencies, auth, external APIs |
| test-driven-implementer | Test approach, coverage | Test fixtures, mocked credentials |
| researcher | Technology recommendations | N/A (no implementation) |

### Commands and Gates

| Command | Decision Gate | Security Gate | Checkpoint Gate |
|---------|---------------|---------------|-----------------|
| `/do:it` | ✅ | ✅ | ✅ |
| `/do:plan` | - | - | ✅ |
| `/do:external-research` | ✅ | - | ✅ |
| `/do:chores` | ✅ | ✅ | ✅ |
| `/do:docs` | ✅ | - | ✅ |
| `/do:explore` | - | - | - |

## CUSTOM Mode

CUSTOM mode lets you define rules for when gates should trigger.

### How It Works

1. You provide a rule: "Ask if auth or security is touched"
2. When a gate event occurs, Claude evaluates your rule against the context
3. If the rule matches → gate triggers (asks you)
4. If the rule doesn't match → auto-approve

### Example Rules

**Decision gate rules**:
- "Ask about major architectural decisions"
- "Only stop for database or API design choices"
- "Ask if changing more than 3 files"
- "Ask if it affects the public interface"

**Security gate rules**:
- "Ask about auth, but auto-approve dev dependencies"
- "Only ask about production credentials"
- "Ask if touching user data handling"

**Checkpoint gate rules**:
- "Verify if tests were modified"
- "Ask if implementation differs from plan"

### Evaluation

The `gate-evaluator` skill evaluates CUSTOM rules:
- Parses your rule to understand intent
- Compares against the logged decision/event
- Returns TRIGGER or SKIP with rationale
- Logs evaluation to `gate-evaluations.log`

## Example Configurations

### Conservative (Review Everything)

```markdown
## Gating
- decision-gate: BLOCKING
- security-gate: BLOCKING
- checkpoint-gate: BLOCKING
```

### Security-Focused

```markdown
## Gating
- decision-gate: Ask only about major architectural decisions
- security-gate: Always ask immediately
- checkpoint-gate: Always verify
```

### Verify Results Only

```markdown
## Gating
- decision-gate: NONBLOCKING
- security-gate: NONBLOCKING
- checkpoint-gate: BLOCKING
```

### Fully Autonomous

```markdown
## Gating
- decision-gate: NONBLOCKING
- security-gate: NONBLOCKING
- checkpoint-gate: NONBLOCKING
```

### Project-Specific

```markdown
## Gating

For this payment processing project:
- decision-gate: Ask about anything touching money flow
- security-gate: Always ask (PCI compliance)
- checkpoint-gate: Verify with test evidence
```

## Troubleshooting

### Gates Not Triggering

1. Check if GATE_CONFIG.txt exists in `.agent_planning/do-command-state/<EXEC_ID>/`
2. Verify the gate mode is BLOCKING or CUSTOM (not NONBLOCKING)
3. Check if agent actually logged decisions (look in DECISIONS/ or SECURITY/)

### Too Many Prompts

1. Switch decision-gate to CUSTOM with a more selective rule
2. Use NONBLOCKING for gates you don't need
3. Configure in CLAUDE.md to avoid per-command prompts

### CUSTOM Rule Not Working

1. Check gate-evaluations.log for the evaluation rationale
2. Make your rule more specific
3. Test with BLOCKING first to see what events are logged

## Related Documentation

- [Commands](./COMMANDS.md) - How commands integrate with gating
- [Agents](./AGENTS.md) - How agents log gate events
- [Skills](./SKILLS.md) - gating-controller and gate-evaluator skills
