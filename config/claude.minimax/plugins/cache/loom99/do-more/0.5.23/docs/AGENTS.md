# Agents Reference

Do More Now uses ten specialized agents, each with a focused purpose. Agents are subprocesses that execute specific types of work.

## Agent Overview

| Agent | Purpose | Invoked By |
|-------|---------|------------|
| [project-architect](#project-architect) | Project initialization | `/do:plan init` |
| [project-evaluator](#project-evaluator) | Gap analysis and assessment | `/do:plan`, `/do:plan audit` |
| [status-planner](#status-planner) | Backlog generation | `/do:plan` |
| [functional-tester](#functional-tester) | Test design | `/do:it tdd`, `/do:it test` |
| [test-driven-implementer](#test-driven-implementer) | TDD implementation | `/do:it tdd` |
| [iterative-implementer](#iterative-implementer) | Iterative implementation | `/do:it`, `/do:chores`, `/do:docs` |
| [work-evaluator](#work-evaluator) | Runtime validation | `/do:it`, `/do:plan status` |
| [researcher](#researcher) | Investigation | `/do:explore`, `/do:external-research` |
| [product-visionary](#product-visionary) | Feature proposals | `/do:plan feature` |
| [execution-summarizer](#execution-summarizer) | Execution logging | All commands |

---

## project-architect

**Purpose**: Transform user intent into a concrete project foundation.

**Invoked By**: `/do:plan init`

**What It Does**:
- Guides through project type and requirements
- Makes architecture decisions
- Creates initial project structure
- Sets up foundational configurations

**File Access**:
- READ-ONLY: All project files
- READ-WRITE: PROJECT_SPEC.md, PROJECT.md, new project files

**Output**: Project skeleton with architecture decisions documented.

**Gate Integration**:
| Gate | Triggers |
|------|----------|
| Decision Gate | Architecture choices, technology selection |
| Security Gate | Auth strategy, credential storage approach |

---

## project-evaluator

**Purpose**: Ruthlessly honest assessment of project state against specifications.

**Invoked By**: `/do:plan`, `/do:plan audit`

**What It Does**:
1. Runs the software like a user would
2. Traces data through complete lifecycle
3. Evaluates test suite quality
4. Checks for known LLM blind spots
5. Surfaces ambiguities that cause bugs
6. Produces STATUS report

**File Access**:
- READ-ONLY: PROJECT_SPEC.md, PROJECT.md, all code files
- READ-WRITE: EVALUATION-*.md files only

**Core Principle**: Runtime evidence first. If runtime fails, tests mean nothing.

**Assessment Areas**:
- Does it actually work? (manual testing)
- Data flow verification
- Test suite quality
- LLM blind spots (empty lists, second runs, cleanup)
- Ambiguity detection
- Implementation red flags

**Deep Audit Mode**: When triggered by "audit", "comprehensive", or "thorough", runs additional checks:
- Architecture assessment (fractal analysis at multiple scales)
- Design quality assessment
- Efficiency analysis (dead code, dead deps)
- Feature cohesion
- Domain-specific analysis

**Output**: `EVALUATION-<timestamp>.md` with:
- Executive summary
- Runtime assessment with evidence
- Data flow verification
- Test suite assessment
- LLM blind spot findings
- Ambiguities found
- Implementation assessment
- Recommendations
- Workflow recommendation (CONTINUE or PAUSE)

**Gate Integration**:
| Gate | Triggers |
|------|----------|
| Decision Gate | Architecture recommendations |
| Security Gate | N/A (evaluation only) |

---

## status-planner

**Purpose**: Generate prioritized backlog from STATUS reports.

**Invoked By**: `/do:plan` (after project-evaluator)

**What It Does**:
1. Reads latest STATUS report
2. Identifies gaps and work items
3. Prioritizes by impact and dependencies
4. Generates BACKLOG and SPRINT files

**File Access**:
- READ-ONLY: EVALUATION-*.md, PLAN-*.md
- READ-WRITE: BACKLOG-*.md, SPRINT-*.md

**Beads Integration**:
- Creates beads issues for ALL backlog items
- Links dependencies between issues
- Creates epics for large features

**Output**: `BACKLOG-<timestamp>.md` and `SPRINT-<timestamp>.md`

---

## functional-tester

**Purpose**: Design high-level functional tests that validate real user workflows.

**Invoked By**: `/do:it tdd`, `/do:it test`

**What It Does**:
1. Analyzes what users actually need to accomplish
2. Designs tests that verify real behavior
3. Makes tests immune to AI gaming (can't pass by faking)
4. Writes tests that fail when functionality is missing

**File Access**:
- READ-ONLY: EVALUATION-*.md, PLAN-*.md, existing code
- READ-WRITE: Test files

**Test Quality Criteria**:
- Would fail if functionality is completely stubbed
- Tests real user workflows end-to-end
- Catches obvious bugs when introduced
- Exercises actual behavior, not implementation details

**Output**: Failing tests ready for implementation

---

## test-driven-implementer

**Purpose**: Implement functionality using test-driven development.

**Invoked By**: `/do:it tdd`

**What It Does**:
1. Reads context from STATUS/PLAN
2. Makes failing tests pass
3. Implements real functionality (no shortcuts)
4. Never modifies tests to make them pass
5. Commits frequently

**File Access**:
- READ-ONLY: EVALUATION-*.md, PLAN-*.md
- READ-WRITE: Code files, SPRINT-*.md, TODO-*.md

**Principles**:
- Working software first
- No TODO comments in "completed" code
- No silent error handling
- No hardcoded test-specific branches
- Clean, maintainable code

**Gate Integration**:
| Gate | Triggers |
|------|----------|
| Decision Gate | Architecture, implementation choices |
| Security Gate | Dependencies, auth, external APIs |

**Output**: Passing tests with real implementation

---

## iterative-implementer

**Purpose**: Implement functionality through incremental development.

**Invoked By**: `/do:it`, `/do:chores`, `/do:docs`

**What It Does**:
1. Reads context from STATUS/PLAN
2. Breaks work into small chunks
3. Implements incrementally with frequent commits
4. Validates manually as it goes
5. Updates planning docs

**File Access**:
- READ-ONLY: EVALUATION-*.md, PLAN-*.md, BACKLOG-*.md
- READ-WRITE: Code files, SPRINT-*.md, TODO-*.md

**Principles**:
- Working software first
- Incremental progress with frequent commits
- Quality standards (clean code, error handling)
- Honest implementation (no fake functionality)

**Beads Integration**:
- Claims issues at start (`in_progress`)
- Creates discovered issues with `discovered-from` links
- Closes issues on completion
- Syncs at session end

**Gate Integration**:
| Gate | Triggers |
|------|----------|
| Decision Gate | Component structure, design patterns, algorithms |
| Security Gate | Dependencies, auth, external APIs, credentials |

**Output**: Working functionality with commits

---

## work-evaluator

**Purpose**: Evaluate implementation against immediate goals using runtime evidence.

**Invoked By**: `/do:it` (after implementation), `/do:plan status`

**What It Does**:
1. Runs the implemented software
2. Captures evidence (screenshots, logs, output)
3. Compares against acceptance criteria
4. Catches LLM shortcuts
5. Surfaces ambiguities that caused issues

**File Access**:
- READ-ONLY: All files
- Tools: Read, Bash, chrome-devtools MCP

**Verdicts**:
| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| COMPLETE | Work meets criteria | Exit workflow |
| INCOMPLETE | Clear path forward | Continue implementing |
| PAUSE | Needs research | Research, then continue |
| BLOCKED | Can't proceed | Surface to user |

**Output**: Assessment with evidence and verdict

---

## researcher

**Purpose**: Deep exploration of problems, unknowns, and design decisions.

**Invoked By**: `/do:explore`, `/do:external-research`

**What It Does**:
1. Clarifies what's actually being asked
2. Gathers context from codebase and external sources
3. Identifies ALL viable options
4. Documents tradeoffs honestly
5. Produces clear recommendation

**File Access**:
- READ-ONLY: All project files, EVALUATION-*.md, PLAN-*.md
- READ-WRITE: RESEARCH-*.md

**Tools**: Read, Glob, Grep, WebSearch, WebFetch

**Quick Mode** (for `/do:explore`):
- Single-pass search
- Codebase-only (no web)
- Fast exit (30s-2min)
- Minimal output

**Full Mode** (for `/do:external-research`):
- Thorough exploration
- External sources included
- Structured research document
- Complete tradeoff analysis

**Output**:
- Quick mode: Inline answer or `PEEK-<topic>-<timestamp>.md`
- Full mode: `RESEARCH-<topic>-<timestamp>.md`

**Gate Integration**:
| Gate | Triggers |
|------|----------|
| Decision Gate | Technology recommendations, architecture recommendations |
| Security Gate | N/A (research only) |

---

## product-visionary

**Purpose**: Generate feature proposals focused on user value.

**Invoked By**: `/do:plan feature`

**What It Does**:
1. Explores user needs and pain points
2. Designs feature around user value
3. Considers technical feasibility
4. Creates structured proposal

**File Access**:
- READ-ONLY: All project files
- READ-WRITE: FEATURE-*.md

**Output**: Feature proposal with:
- Problem statement
- User stories
- Proposed solution
- Technical considerations
- Success criteria

---

## execution-summarizer

**Purpose**: Aggregate partial execution logs into coherent reports.

**Invoked By**: All commands (via Stop hook)

**What It Does**:
1. Reads partial logs from all agents
2. Aggregates into single execution report
3. Summarizes work performed
4. Tracks artifacts created

**File Access**:
- READ: `do-command-logs/partials/*.txt`
- WRITE: `do-command-logs/EXEC-<cmd>-<timestamp>.md`

**Output**: `EXEC-<command>-<timestamp>.md` with:
- Execution summary
- Work performed by each agent
- Artifacts created
- Issues encountered
- Final status

---

## Agent Workflow Patterns

### TDD Workflow (test-driven-implementer)

```
functional-tester → project-evaluator → test-driven-implementer → work-evaluator
     ↓                    ↓                     ↓                      ↓
 Write tests       Verify tests          Make tests pass        Validate runtime
                   are useful
```

### Iterative Workflow (iterative-implementer)

```
iterative-implementer → work-evaluator → (loop)
        ↓                     ↓
   Implement              Validate
```

### Planning Workflow

```
project-evaluator → status-planner
       ↓                 ↓
   Assess state     Generate backlog
```

### Research Workflow

```
researcher → project-evaluator
    ↓              ↓
 Research    Verify sufficient
```

---

## Agent Communication

Agents communicate through:

1. **Planning files**: STATUS, PLAN, BACKLOG, SPRINT, TODO
2. **Execution logs**: Partial logs in `do-command-logs/partials/`
3. **Gate files**: Decisions and security events in `do-command-state/`

Agents cannot directly call each other. Commands orchestrate agent invocation.

---

## Related Documentation

- [Commands Reference](./COMMANDS.md) - The commands that invoke agents
- [Skills Reference](./SKILLS.md) - The workflow skills
- [Architecture Overview](../architecture/README.md) - How it all fits together
