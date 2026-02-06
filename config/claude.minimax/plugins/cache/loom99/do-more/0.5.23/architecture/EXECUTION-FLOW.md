# Execution Flow

This document provides detailed sequence diagrams for how Do More Now processes commands.

## Complete Command Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE COMMAND LIFECYCLE                          │
└──────────────────────────────────────────────────────────────────────────────┘

User                 Command           Skill            Agents           Files
 │                      │                │                 │                │
 │ /do:it fix auth      │                │                 │                │
 ├─────────────────────►│                │                 │                │
 │                      │                │                 │                │
 │                      │ Load gate config                 │                │
 │                      ├───────────────────────────────────────────────────►│
 │                      │◄───────────────────────────────────────────────────┤
 │                      │                │                 │                │
 │                      │ Detect intent  │                 │                │
 │                      │ "fix" → do:fix │                 │                │
 │                      │                │                 │                │
 │                      │ Invoke skill   │                 │                │
 │                      ├───────────────►│                 │                │
 │                      │                │                 │                │
 │                      │                │ Task(researcher)│                │
 │                      │                ├────────────────►│                │
 │                      │                │                 │ Read files     │
 │                      │                │                 ├───────────────►│
 │                      │                │                 │◄───────────────┤
 │                      │                │                 │ Write summary  │
 │                      │                │                 ├───────────────►│
 │                      │                │◄────────────────┤                │
 │                      │                │                 │                │
 │                      │                │ Task(impl)      │                │
 │                      │                ├────────────────►│                │
 │                      │                │                 │ Implement      │
 │                      │                │                 ├───────────────►│
 │                      │                │                 │ Write summary  │
 │                      │                │                 ├───────────────►│
 │                      │                │◄────────────────┤                │
 │                      │                │                 │                │
 │                      │ Check gates    │                 │                │
 │                      ├───────────────────────────────────────────────────►│
 │                      │◄───────────────────────────────────────────────────┤
 │                      │                │                 │                │
 │                      │                │ Task(evaluator) │                │
 │                      │                ├────────────────►│                │
 │                      │                │                 │ Validate       │
 │                      │                │                 │ Write summary  │
 │                      │                │                 ├───────────────►│
 │                      │                │◄────────────────┤                │
 │                      │                │                 │                │
 │                      │◄───────────────┤                 │                │
 │                      │                │                 │                │
 │                      │ Checkpoint gate│                 │                │
 │ (if BLOCKING)        │                │                 │                │
 │◄─────────────────────┤                │                 │                │
 │ User approves        │                │                 │                │
 ├─────────────────────►│                │                 │                │
 │                      │                │                 │                │
 │ Result               │                │                 │                │
 │◄─────────────────────┤                │                 │                │
```

---

## Intent Detection Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           INTENT DETECTION FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

User Input: "/do:it refactor the database connection pool"

┌────────────────────────────────────────────────────────────────┐
│ Command: it.md                                                  │
│                                                                 │
│ 1. Check for subcommands (/do: patterns)                       │
│    Input: "refactor the database connection pool"              │
│    Result: No subcommands                                      │
│                                                                 │
│ 2. Intent detection patterns:                                  │
│    ┌────────────────────────────────────────────┐             │
│    │ "refactor" ──────► do:refactor    ✓ MATCH  │             │
│    │ "fix"      ──────► do:fix                  │             │
│    │ "debug"    ──────► do:debug                │             │
│    │ "test"     ──────► do:add-tests            │             │
│    │ "tdd"      ──────► do:tdd-workflow         │             │
│    │ (default)  ──────► auto-select             │             │
│    └────────────────────────────────────────────┘             │
│                                                                 │
│ 3. Invoke skill: do:refactor                                   │
│    Context: "the database connection pool"                     │
└────────────────────────────────────────────────────────────────┘
```

---

## TDD Workflow Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            TDD WORKFLOW FLOW                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TestLoop (max 3 iterations)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐        ┌──────────────────┐                           │
│  │ functional-      │        │ project-         │                           │
│  │ tester           │───────►│ evaluator        │                           │
│  │                  │        │                  │                           │
│  │ • Analyze needs  │        │ • Check tests    │                           │
│  │ • Design tests   │        │ • Would fail if  │                           │
│  │ • Write failing  │        │   stubbed?       │                           │
│  │   tests          │        │ • Real workflows?│                           │
│  └──────────────────┘        └────────┬─────────┘                           │
│                                       │                                      │
│                              ┌────────▼─────────┐                           │
│                              │ Tests sufficient? │                           │
│                              │   ├─ Yes → Exit   │                           │
│                              │   └─ No  → Retry  │                           │
│                              └──────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ImplementLoop                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐        ┌──────────────────┐                           │
│  │ test-driven-     │        │ work-evaluator   │                           │
│  │ implementer      │───────►│                  │                           │
│  │                  │        │                  │                           │
│  │ • Read context   │        │ • Run software   │                           │
│  │ • Make tests pass│        │ • Capture output │                           │
│  │ • Real code only │        │ • Check criteria │                           │
│  │ • Never modify   │        │                  │                           │
│  │   tests          │        │                  │                           │
│  └──────────────────┘        └────────┬─────────┘                           │
│                                       │                                      │
│                              ┌────────▼─────────┐                           │
│                              │ Verdict?         │                           │
│                              │ ├─ COMPLETE→Done │                           │
│                              │ ├─ INCOMPLETE→   │                           │
│                              │ │   Continue     │                           │
│                              │ ├─ PAUSE→        │                           │
│                              │ │   Research     │                           │
│                              │ └─ BLOCKED→Stop  │                           │
│                              └──────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gate Processing Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            GATE PROCESSING FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

During Agent Execution:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   Agent makes decision                                                       │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────┐                    │
│   │ Check: Is gating active?                           │                    │
│   │ Read: .../do-command-state/<EXEC_ID>/GATE_CONFIG.txt│                   │
│   └──────────────────┬─────────────────────────────────┘                    │
│                      │                                                       │
│          ┌───────────┴───────────┐                                          │
│          │                       │                                          │
│       No │                    Yes│                                          │
│          ▼                       ▼                                          │
│   ┌──────────────┐      ┌──────────────────────────────┐                   │
│   │ Continue     │      │ Write decision file:         │                   │
│   │ (no logging) │      │ DECISIONS/<SEQ>-<agent>.txt  │                   │
│   └──────────────┘      └──────────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

After Agent Returns:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   Command checks for pending gates                                          │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────┐                    │
│   │ Glob: DECISIONS/*.txt without APPROVAL_STATUS      │                    │
│   └──────────────────┬─────────────────────────────────┘                    │
│                      │                                                       │
│          ┌───────────┴───────────┐                                          │
│          │                       │                                          │
│       None                    Pending                                       │
│          ▼                       ▼                                          │
│   ┌──────────────┐      ┌──────────────────────────────┐                   │
│   │ Continue     │      │ Invoke gating-controller     │                   │
│   └──────────────┘      └──────────────────────────────┘                   │
│                                  │                                          │
│                      ┌───────────┴───────────┐                              │
│                      │                       │                              │
│                 BLOCKING               NONBLOCKING                          │
│                      ▼                       ▼                              │
│            ┌──────────────┐         ┌──────────────┐                       │
│            │AskUserQuestion│         │ Auto-approve │                       │
│            └──────┬───────┘         └──────────────┘                       │
│                   │                                                         │
│          ┌────────┴────────┐                                               │
│          │                 │                                               │
│      Approved          Rejected                                            │
│          ▼                 ▼                                               │
│   ┌──────────────┐  ┌──────────────┐                                       │
│   │ Continue     │  │ STOP command │                                       │
│   └──────────────┘  └──────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Subcommand Routing Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          SUBCOMMAND ROUTING FLOW                             │
└──────────────────────────────────────────────────────────────────────────────┘

Input: "/do:plan feature auth /do:it tdd"

┌─────────────────────────────────────────────────────────────────────────────┐
│ route-subcommands skill                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. Detect /do: patterns:                                                     │
│    - /do:plan (current command)                                             │
│    - /do:it (additional command)                                            │
│                                                                              │
│ 2. Parse structure:                                                          │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │ current_command: plan                                           │      │
│    │ main_instructions: "feature auth"                               │      │
│    │ post_commands: ["/do:it tdd"]                                   │      │
│    └─────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│ 3. Return to command:                                                        │
│    - Execute main workflow with "feature auth"                              │
│    - After completion, execute post_commands                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Execution order:
┌──────────────────┐     ┌──────────────────┐
│ /do:plan         │────►│ /do:it tdd       │
│ feature auth     │     │ (with context)   │
└──────────────────┘     └──────────────────┘
```

---

## Planning Workflow Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PLANNING WORKFLOW FLOW                             │
└──────────────────────────────────────────────────────────────────────────────┘

User: /do:plan

┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Evaluation                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │ project-evaluator                                               │       │
│   │                                                                 │       │
│   │  1. Select evaluation profile (cli, web, api, etc.)            │       │
│   │  2. Run the software like a user                               │       │
│   │  3. Trace data flows                                           │       │
│   │  4. Assess test suite quality                                  │       │
│   │  5. Check LLM blind spots                                      │       │
│   │  6. Hunt for ambiguities                                       │       │
│   │                                                                 │       │
│   │  Output: STATUS-<timestamp>.md                                 │       │
│   │    - Executive summary                                          │       │
│   │    - Runtime assessment                                         │       │
│   │    - Data flow verification                                     │       │
│   │    - Ambiguities found                                          │       │
│   │    - Recommendations                                            │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Backlog Generation                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │ status-planner                                                  │       │
│   │                                                                 │       │
│   │  1. Read STATUS report                                         │       │
│   │  2. Identify gaps and work items                               │       │
│   │  3. Prioritize by impact and dependencies                      │       │
│   │  4. Create beads issues (if available)                         │       │
│   │                                                                 │       │
│   │  Output:                                                        │       │
│   │    - BACKLOG-<timestamp>.md                                    │       │
│   │    - SPRINT-<timestamp>.md                                     │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Audit Workflow Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            AUDIT WORKFLOW FLOW                               │
└──────────────────────────────────────────────────────────────────────────────┘

User: /do:plan audit

┌─────────────────────────────────────────────────────────────────────────────┐
│ Dimension Selection                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input patterns:                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ "audit"            → Code Quality (default)                        │    │
│  │ "audit security"   → Security                                      │    │
│  │ "audit plans"      → Planning Alignment                            │    │
│  │ "audit competitive"→ Competitive Analysis                          │    │
│  │ "audit everything" → All dimensions                                │    │
│  │ (no match)         → Ask user which dimensions                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Dimension Execution (parallel if multiple)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ do:deep-     │ │ do:planning- │ │ do:security- │ │ do:compet-   │       │
│  │ audit        │ │ audit        │ │ audit        │ │ itive-audit  │       │
│  │              │ │              │ │              │ │              │       │
│  │ • Archit.    │ │ • Strategy   │ │ • CVEs       │ │ • Compete    │       │
│  │ • Design     │ │ • Alignment  │ │ • Secrets    │ │ • Features   │       │
│  │ • Efficiency │ │ • Coherence  │ │ • Auth       │ │ • Gaps       │       │
│  │ • Features   │ │              │ │ • OWASP      │ │              │       │
│  │ • Domain     │ │              │ │              │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Results Aggregation                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Combined output:                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ═══════════════════════════════════════                            │    │
│  │ Audit Complete - [dimensions run]                                  │    │
│  │                                                                    │    │
│  │ Code Quality:                                                      │    │
│  │   Architecture: [rating] | Design: [rating] | Efficiency: [rating]│    │
│  │   Findings: P0: n | P1: n | P2: n | P3: n                         │    │
│  │                                                                    │    │
│  │ Planning:                                                          │    │
│  │   Strategy: [rating] | Alignment: [rating]                        │    │
│  │                                                                    │    │
│  │ Security:                                                          │    │
│  │   Risk Level: [Critical/High/Medium/Low]                          │    │
│  │   CVEs: n critical, n high | Secrets: [status]                    │    │
│  │                                                                    │    │
│  │ Competitive:                                                       │    │
│  │   Position: [assessment]                                           │    │
│  │   Gaps: n | Opportunities: n                                       │    │
│  │ ═══════════════════════════════════════                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Architecture Overview](./README.md) - Component structure
- [Commands Reference](../docs/COMMANDS.md) - Command specifications
- [Agents Reference](../docs/AGENTS.md) - Agent specifications
- [Gating Configuration](../docs/GATING.md) - Gate system details
