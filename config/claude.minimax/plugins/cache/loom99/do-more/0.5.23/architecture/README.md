# Architecture Overview

This document explains how Do More Now is structured internally and how its components interact.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER COMMAND                                    │
│                            /do:it fix auth                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMMANDS LAYER                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   it    │ │  plan   │ │ explore │ │research │ │ chores  │ │  docs   │   │
│  └────┬────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│       │                                                                      │
│       │ Intent Detection: "fix" → do:fix                                     │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               SKILLS LAYER                                   │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │   do:fix     │ │ do:tdd-workflow│ │do:iterative-   │ │  do:audit      │  │
│  │              │ │                │ │workflow        │ │                │  │
│  └──────┬───────┘ └────────────────┘ └────────────────┘ └────────────────┘  │
│         │                                                                    │
│         │ Orchestrates agents in sequence                                    │
└─────────┼───────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               AGENTS LAYER                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                   │
│  │   researcher   │ │   iterative-   │ │ work-evaluator │                   │
│  │                │─┼►  implementer  │─┼►               │                   │
│  │  (investigate) │ │  (implement)   │ │   (validate)   │                   │
│  └────────────────┘ └────────────────┘ └────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FILE SYSTEM                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ .agent_planning/                                                     │    │
│  │   ├── STATUS-*.md        (project state)                            │    │
│  │   ├── PLAN-*.md          (implementation plans)                     │    │
│  │   ├── BACKLOG-*.md       (work items)                               │    │
│  │   └── RESEARCH-*.md      (research findings)                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Source Code Files                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Layers

### Commands Layer

Commands are the entry point. Each command:
1. Receives user input
2. Detects intent from natural language
3. Routes to appropriate skill
4. Manages gate configuration
5. Handles subcommand chaining

**Location**: `commands/*.md`

**Files**:
| File | Command |
|------|---------|
| `it.md` | `/do:it` |
| `plan.md` | `/do:plan` |
| `explore.md` | `/do:explore` |
| `research.md` | `/do:external-research` |
| `chores.md` | `/do:chores` |
| `docs.md` | `/do:docs` |
| `release.md` | `/do:release` |

### Skills Layer

Skills define workflows. Each skill:
1. Orchestrates agent invocations
2. Defines the process steps
3. Handles workflow logic
4. Manages iteration loops

**Location**: `skills/*/SKILL.md`

**Categories**:
- Implementation: tdd-workflow, iterative-workflow, fix, refactor, etc.
- Planning: init-project, status-check, feature-proposal
- Audit: audit, deep-audit, security-audit, planning-audit
- System: gating-controller, route-subcommands, evaluation-profiles

### Agents Layer

Agents execute specific work. Each agent:
1. Has focused purpose
2. Has specific tool access
3. Writes to designated files
4. Returns structured output

**Location**: `agents/*.md`

**Agents**:
| Agent | Purpose |
|-------|---------|
| project-architect | Project initialization |
| project-evaluator | Gap analysis |
| status-planner | Backlog generation |
| functional-tester | Test design |
| test-driven-implementer | TDD implementation |
| iterative-implementer | Iterative implementation |
| work-evaluator | Runtime validation |
| researcher | Investigation |
| product-visionary | Feature proposals |
| execution-summarizer | Execution logging |

---

## File System Structure

### Plugin Structure

```
do-more-now/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── agents/                   # Agent definitions
│   ├── project-evaluator.md
│   ├── iterative-implementer.md
│   └── ...
├── commands/                 # Command definitions
│   ├── it.md
│   ├── plan.md
│   └── ...
├── skills/                   # Skill definitions
│   ├── tdd-workflow/
│   │   └── SKILL.md
│   ├── audit/
│   │   └── SKILL.md
│   └── ...
├── hooks/                    # Lifecycle hooks
│   └── hooks.json
├── docs/                     # Documentation
├── architecture/             # Architecture docs
├── CLAUDE.md                 # Claude instructions
└── README.md                 # User README
```

### Runtime Files (`.agent_planning/`)

```
.agent_planning/
├── STATUS-*.md              # Project state reports
├── PLAN-*.md                # Implementation plans
├── BACKLOG-*.md             # Prioritized work items
├── SPRINT-*.md              # Current sprint items
├── TODO-*.md                # Immediate tasks
├── RESEARCH-*.md            # Research findings
├── FEATURE-*.md             # Feature proposals
└── SUMMARY-*.txt            # Agent summaries
```

### File Access Patterns

| File Pattern | Who Creates | Who Reads | Who Writes |
|--------------|-------------|-----------|------------|
| STATUS-*.md | project-evaluator | All agents | project-evaluator only |
| PLAN-*.md | status-planner | All agents | status-planner only |
| BACKLOG-*.md | status-planner | All agents | status-planner only |
| SPRINT-*.md | status-planner | All agents | Implementers |
| TODO-*.md | status-planner | All agents | Implementers |
| RESEARCH-*.md | researcher | All agents | researcher only |

---

## Execution Flow

### Command Execution

```
1. User enters: /do:it fix auth bug

2. Command (it.md) processes:
   a. Load/create gate config
   b. Detect intent: "fix" → do:fix
   c. Check for subcommands
   d. Invoke skill

3. Skill (do:fix) orchestrates:
   a. Spawn researcher (investigate)
   b. Spawn iterative-implementer (fix)
   c. Spawn work-evaluator (validate)
   d. Process gates between agents

4. Each agent:
   a. Read execution state
   b. Perform work
   c. Write summary
   d. Return result

5. Command finishes:
   a. Process checkpoint gate
   b. Return result to user
```

### Gate Processing Flow

```
1. Agent logs decision to:
   .agent_planning/do-command-state/<EXEC_ID>/DECISIONS/

2. After agent returns, command checks for pending decisions

3. If pending decisions exist:
   a. Invoke gating-controller
   b. Controller reads gate config
   c. If BLOCKING: Ask user
   d. If NONBLOCKING: Auto-approve
   e. If CUSTOM: Evaluate against rule

4. If rejected: Stop execution
   If approved: Continue to next step
```

---

## Communication Patterns

### Agent → Agent (via Files)

Agents don't communicate directly. They communicate through files:

```
project-evaluator                    status-planner
      │                                   │
      │ writes STATUS-*.md                │
      └─────────────────────────────►     │
                                          │ reads STATUS-*.md
                                          │ writes BACKLOG-*.md
```

### Skill → Agent (via Task Tool)

Skills invoke agents as subprocesses:

```
Skill                               Agent
  │                                   │
  │ Task(subagent_type="...")         │
  ├──────────────────────────────────►│
  │                                   │ executes
  │◄──────────────────────────────────┤
  │ returns result                    │
```

### Command → User (via Gates)

Commands can pause for user input via the gating system:

```
Command                             User
  │                                   │
  │ AskUserQuestion (via gate)        │
  ├──────────────────────────────────►│
  │                                   │ responds
  │◄──────────────────────────────────┤
  │ continues or stops                │
```

---

## State Management

### Execution State

Each command execution has:
- **EXECUTION_ID**: UUID for this execution
- **SEQUENCE**: Counter for agent invocations
- **GATE_CONFIG**: Decision checkpoint configuration

### Planning State

Project state is maintained in `.agent_planning/`:
- STATUS files capture current state
- PLAN files capture intended direction
- BACKLOG files capture prioritized work
- SPRINT/TODO files capture immediate work

### Gate State

Gate decisions are tracked per-execution:
```
.agent_planning/do-command-state/<EXEC_ID>/
├── GATE_CONFIG.txt              # Configuration for this execution
├── DECISIONS/
│   └── <SEQ>-<agent>-<id>.txt   # Decision records
└── SECURITY/
    └── <SEQ>-<agent>-<id>.txt   # Security event records
```

---

## Extension Points

### Adding a New Command

1. Create `commands/<name>.md`
2. Define intent detection patterns
3. Map intents to skills
4. Add gate integration

### Adding a New Skill

1. Create `skills/<name>/SKILL.md`
2. Define the workflow process
3. Specify which agents to invoke
4. Define output format

### Adding a New Agent

1. Create `agents/<name>.md`
2. Define purpose and principles
3. Specify tool access
4. Define file access patterns
5. Define output format

---

## Related Documentation

- [Execution Flow](./EXECUTION-FLOW.md) - Detailed execution diagrams
- [Commands Reference](../docs/COMMANDS.md) - Command layer details
- [Agents Reference](../docs/AGENTS.md) - Agent specifications
- [Skills Reference](../docs/SKILLS.md) - Skill definitions
- [Gating Configuration](../docs/GATING.md) - Decision checkpoint system
