# Workflows Guide

This guide explains when to use which workflow and how to get the most out of Do More Now.

## Choosing the Right Workflow

### Decision Tree

```
What are you trying to do?
│
├─► Build something new
│   └─► Is it well-defined?
│       ├─► Yes → TDD Workflow
│       └─► No → Iterative Workflow
│
├─► Fix something broken
│   └─► /do:it fix
│
├─► Improve existing code
│   └─► /do:it refactor
│
├─► Understand something
│   └─► Internal (codebase) → /do:explore
│   └─► External (web/docs) → /do:external-research
│
├─► Plan work
│   └─► /do:plan
│
└─► Maintain codebase
    └─► /do:chores
```

---

## Implementation Workflows

### TDD Workflow

**Command**: `/do:it tdd [description]`

**Flow**:
```
┌──────────────────────────────────────────────────────────┐
│  TestLoop (max 3 iterations)                             │
│  ┌────────────────┐    ┌──────────────────┐             │
│  │ functional-    │───►│ project-         │             │
│  │ tester         │    │ evaluator        │             │
│  │ (write tests)  │    │ (verify useful)  │             │
│  └────────────────┘    └──────────────────┘             │
│            ▲                    │                        │
│            └────────────────────┘                        │
│                  (loop until sufficient)                 │
├──────────────────────────────────────────────────────────┤
│  ImplementLoop                                           │
│  ┌────────────────┐    ┌──────────────────┐             │
│  │ test-driven-   │───►│ work-evaluator   │             │
│  │ implementer    │    │ (validate)       │             │
│  │ (make pass)    │    │                  │             │
│  └────────────────┘    └──────────────────┘             │
│            ▲                    │                        │
│            └────────────────────┘                        │
│                  (loop until complete)                   │
└──────────────────────────────────────────────────────────┘
```

**Best For**:
- Backend APIs and services
- Library functions
- Data processing logic
- Anything with clear inputs and outputs
- Well-defined requirements

**Example**:
```bash
/do:it tdd add payment processing endpoint
/do:it tdd implement user validation service
/do:it tdd create data export functionality
```

**What Makes TDD Tests Good**:
- Would fail if functionality is stubbed
- Test real user workflows end-to-end
- Catch obvious bugs when introduced
- Can't be gamed by fake implementations

---

### Iterative Workflow

**Command**: `/do:it iterate [description]` or just `/do:it [description]`

**Flow**:
```
┌──────────────────────────────────────────────────────────┐
│  Loop                                                    │
│  ┌────────────────────┐    ┌──────────────────┐         │
│  │ iterative-         │───►│ work-evaluator   │         │
│  │ implementer        │    │ (runtime check)  │         │
│  │ (build increment)  │    │                  │         │
│  └────────────────────┘    └──────────────────┘         │
│            ▲                        │                    │
│            │                        ▼                    │
│            │               ┌──────────────────┐         │
│            │               │ COMPLETE?        │         │
│            │               │ INCOMPLETE?      │         │
│            │               │ PAUSE?           │         │
│            │               │ BLOCKED?         │         │
│            │               └──────────────────┘         │
│            │                        │                    │
│            └────────────────────────┘                    │
│                 (continue if INCOMPLETE)                 │
└──────────────────────────────────────────────────────────┘
```

**Best For**:
- UI and frontend work
- Exploratory features
- Visual functionality
- When you need to see it to know if it's right
- Uncertain requirements

**Example**:
```bash
/do:it iterate build dashboard UI
/do:it add settings page
/do:it create onboarding flow
```

**Verdict Meanings**:
| Verdict | Meaning | What Happens |
|---------|---------|--------------|
| COMPLETE | Work meets criteria | Exit workflow |
| INCOMPLETE | Clear path forward | Continue implementing |
| PAUSE | Needs research | Research, then continue |
| BLOCKED | Can't proceed | Surface to user |

---

### Auto-Selection

**Command**: `/do:it [description]` (without specifying workflow)

Claude auto-selects based on:
1. Does a test framework exist?
2. Is this API/logic work or UI work?
3. What does the codebase suggest?

**Logic**:
```
Test framework exists?
│
├─► Yes
│   └─► API/logic work? → TDD
│   └─► UI work? → Iterative
│
└─► No → Iterative
```

---

## Bug Fix Workflow

**Command**: `/do:it fix [description]`

**Flow**:
```
┌──────────────────────────────────────────────────────────┐
│  1. Investigate                                          │
│     ┌────────────────┐                                  │
│     │ researcher     │ ─► Understand root cause         │
│     └────────────────┘                                  │
├──────────────────────────────────────────────────────────┤
│  2. Fix                                                  │
│     ┌────────────────────┐                              │
│     │ iterative-         │ ─► Implement fix             │
│     │ implementer        │                              │
│     └────────────────────┘                              │
├──────────────────────────────────────────────────────────┤
│  3. Verify                                               │
│     ┌────────────────┐                                  │
│     │ work-evaluator │ ─► Confirm fix works             │
│     └────────────────┘    ─► Check for regressions      │
└──────────────────────────────────────────────────────────┘
```

**Example**:
```bash
/do:it fix the null pointer in user.ts
/do:it fix login not working after password reset
/do:it fix memory leak in connection pool
```

---

## Refactoring Workflow

**Command**: `/do:it refactor [description]`

**Principles**:
- No behavior changes
- Incremental steps
- Frequent verification
- Clean commits

**Flow**:
```
1. Understand current behavior
2. Plan restructuring steps
3. For each step:
   a. Make change
   b. Verify behavior unchanged
   c. Commit
4. Final verification
```

**Example**:
```bash
/do:it refactor extract user service from controller
/do:it refactor simplify error handling
/do:it refactor split monolithic file
```

---

## Planning Workflow

**Command**: `/do:plan [area]`

**Flow**:
```
┌──────────────────────────────────────────────────────────┐
│  1. Evaluate                                             │
│     ┌────────────────────┐                              │
│     │ project-evaluator  │ ─► Assess current state      │
│     └────────────────────┘    ─► Create STATUS report   │
├──────────────────────────────────────────────────────────┤
│  2. Plan                                                 │
│     ┌────────────────────┐                              │
│     │ status-planner     │ ─► Generate BACKLOG          │
│     └────────────────────┘    ─► Create SPRINT          │
└──────────────────────────────────────────────────────────┘
```

**Example**:
```bash
/do:plan                         # Full evaluation
/do:plan user authentication     # Plan specific feature
/do:plan status                  # Quick status check
```

---

## Research Workflow

### Internal Research (Codebase)

**Command**: `/do:explore [question]`

**Characteristics**:
- Fast (30s-2min)
- Codebase-only
- Read-only

**Example**:
```bash
/do:explore where is auth handled
/do:explore how does the cache work
/do:explore what middleware runs before routes
```

### External Research (Web)

**Command**: `/do:external-research [topic]`

**Flow**:
```
1. Clarify the question
2. Gather context (codebase + external)
3. Identify all options
4. Analyze tradeoffs
5. Form recommendation
```

**Example**:
```bash
/do:external-research JWT vs session authentication
/do:external-research database options for time-series
/do:external-research competitors to Stripe
```

---

## Audit Workflow

**Command**: `/do:plan audit [dimension]`

**Dimensions**:
| Dimension | Command | What It Checks |
|-----------|---------|----------------|
| Code Quality | `/do:plan audit` | Architecture, design, efficiency |
| Planning | `/do:plan audit plans` | Strategy alignment |
| Security | `/do:plan audit security` | CVEs, secrets, auth |
| Competitive | `/do:plan audit competitive` | Market comparison |
| All | `/do:plan audit everything` | All dimensions |

**Output**: STATUS report with prioritized findings (P0-P3).

---

## Common Patterns

### Plan Then Execute

```bash
/do:plan payment processing    # Evaluate, create plan
/do:it                         # Execute the plan
```

The second command picks up context from the plan.

### Scoped Work

Use parentheses to constrain scope:

```bash
/do:it fix login (only email validation, leave UI alone)
/do:it add caching (redis only, not memcached)
/do:it refactor auth (preserve API, change internals)
```

### Command Chaining

Execute multiple commands in sequence:

```bash
/do:plan feature auth /do:it tdd
/do:plan /do:it /do:chores
```

### Gate Control

Control how much Claude asks:

```bash
# Ask before every decision
/do:it carefully refactor auth

# Only verify at the end
/do:it verify when done fix the bug

# Full autonomy
/do:it autonomous fix everything

# Custom rule
/do:it ask about security changes add user registration
```

### Research Before Planning

```bash
/do:external-research auth best practices
/do:plan feature user authentication
/do:it tdd
```

### Iterative Refinement

```bash
# First pass
/do:it add basic dashboard

# Refine based on feedback
/do:it iterate improve dashboard layout

# Add features
/do:it add dashboard filters
```

---

## Anti-Patterns

### Don't: Skip Planning for Complex Features

**Bad**:
```bash
/do:it add complete user management system
```

**Good**:
```bash
/do:plan user management system
/do:it tdd add user registration
/do:it tdd add user login
/do:it add user profile page
```

### Don't: Use TDD for Visual Work

**Bad**:
```bash
/do:it tdd build responsive dashboard UI
```

**Good**:
```bash
/do:it iterate build responsive dashboard UI
```

### Don't: Use Iterative for Strict Logic

**Bad**:
```bash
/do:it iterate implement payment processing
```

**Good**:
```bash
/do:it tdd implement payment processing
```

### Don't: Be Too Vague

**Bad**:
```bash
/do:it fix stuff
```

**Good**:
```bash
/do:it fix the login validation bug that allows empty passwords
```

### Don't: Ignore Scope Constraints

**Bad**:
```bash
/do:it fix the whole auth system
```

**Good**:
```bash
/do:it fix auth token expiration (leave login flow alone)
```

---

## Workflow Selection Matrix

| Scenario | Recommended Workflow |
|----------|---------------------|
| New API endpoint | TDD |
| Bug in existing code | Fix |
| UI component | Iterative |
| Code cleanup | Refactor |
| Understanding codebase | Explore |
| Technology decision | Research |
| Feature design | Plan feature |
| Project health check | Plan audit |
| Dependency updates | Chores deps |
| Documentation gaps | Docs |

---

## Related Documentation

- [Commands Reference](./COMMANDS.md) - All commands in detail
- [Agents Reference](./AGENTS.md) - What agents do the work
- [Skills Reference](./SKILLS.md) - Workflow definitions
- [Gating Configuration](./GATING.md) - Decision checkpoints
