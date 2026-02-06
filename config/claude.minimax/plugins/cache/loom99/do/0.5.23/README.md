# dev-loop

An agentic coding assistant that operates as a continuous feedback loop. Each stage generates artifacts consumed by downstream stages, with intelligent caching to avoid redundant work.

## Quick Start

```bash
# Implement a feature (chains automatically to plan/evaluate if needed)
/do:it add user authentication

# Just plan (if you want to review before implementing)
/do:plan add user authentication

# Quick status check
/do:status
```

## The Development Loop

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              OUTER LOOP (Planning)                              │
│                                                                                 │
│    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│    │  IDEATE  │ ───▶ │ EVALUATE │ ◀──▶ │ RESEARCH │ ───▶ │   PLAN   │          │
│    └──────────┘      └──────────┘      └──────────┘      └──────────┘          │
│                            │                                   │               │
│                      Updates cache                       ONE SPRINT            │
│                      + TASK-EVAL                           only                │
│                            │                                   │               │
│                            │                                   ▼               │
│         ┌──────────────────────────────────────────────────────────────────┐   │
│         │                    INNER LOOP (Implementation)                   │   │
│         │                                                                  │   │
│         │  ┌────────────────┐    ┌───────────┐    ┌──────────┐            │   │
│         │  │ DEFINITION OF  │───▶│ IMPLEMENT │───▶│  VERIFY  │            │   │
│         │  │     DONE       │    │ (2-3 max) │    │          │            │   │
│         │  └────────────────┘    └───────────┘    └──────────┘            │   │
│         │         │                    │               │                  │   │
│         │         │                    │    ┌──────────┘                  │   │
│         │         │                    │    │                             │   │
│         │         │                    ▼    ▼                             │   │
│         │         │              ┌──────────────┐                         │   │
│         │         │              │ USER REVIEW  │◀── After every task     │   │
│         │         │              └──────────────┘                         │   │
│         │         │                    │                                  │   │
│         │         └────────────────────┘                                  │   │
│         │              Feedback loop                                      │   │
│         └──────────────────────────────────────────────────────────────────┘   │
│                                        │                                       │
│                                        ▼                                       │
│                              ┌──────────────────┐                              │
│                              │   Next Sprint    │                              │
│                              └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Command Chaining

Commands automatically chain to their dependencies:

```
/do:it "add feature X"
    │
    ├── No plan exists? ──▶ /do:plan "add feature X"
    │                           │
    │                           └── (evaluates internally)
    │                                   │
    │                                   ├── Ambiguity? ──▶ /do:research
    │                                   │                       │
    │                                   │◀──────────────────────┘
    │                                   │     (iterate until resolved)
    │                                   │
    │                                   └── Writes: TASK-EVAL-*.md
    │                                              (planner reads this)
    │                           │
    │◀──────────────────────────┘
    │
    ├── Definition of Done (acceptance criteria)
    │
    └── Implementation Loop
        ├── Implement task 1 → User review → Feedback
        ├── Implement task 2 → User review → Feedback
        ├── Implement task 3 → User review → Feedback
        │
        └── Validation phase → User approval → Complete
```

## Stages

### Outer Loop: Planning

| Stage | Command | Input | Output |
|-------|---------|-------|--------|
| **Ideate** | `/feature-proposal` | User needs | Feature proposals |
| **Evaluate + Plan** | `/plan` | Codebase, cache | EVALUATION-*.md, PLAN-*.md (ONE sprint) |
| **Research** | `/research` | Questions | RESEARCH-*.md |
| **Status Check** | `/status` | N/A | Quick status display |

### Inner Loop: Implementation

| Stage | Part of `/implement` | Input | Output |
|-------|----------------------|-------|--------|
| **Definition of Done** | Phase 1 | PLAN | Acceptance criteria |
| **Implement** | Phase 2 | Criteria | Code (2-3 tasks max) |
| **Verify** | Phase 3 | Code, criteria | Validated implementation |

## Key Design Decisions

### 1. Evaluation Cache

**Problem**: Re-evaluating everything every cycle is wasteful.

**Solution**: Two-tier output from evaluator:

| Output | Purpose | Who Reads It |
|--------|---------|--------------|
| `EVALUATION-*.md`, `EVAL-*.md` | Shared cache | Only evaluator |
| `TASK-EVAL-*.md` | Task-specific summary | Planner |

**Confidence levels** for cached findings:

| Level | Meaning | Action |
|-------|---------|--------|
| **FRESH** | Just evaluated | Trust fully |
| **RECENT** | <7 days, no changes | Light verification |
| **RISKY** | Dependencies changed | Spot-check |
| **STALE** | Files changed | Re-evaluate |

### 2. One Sprint at a Time

**Problem**: Plans become stale, scope creeps, work gets lost.

**Solution**: Planner produces ONE sprint (2-3 deliverables max):

```
Sprint Scope:
  IN:  [Deliverable 1], [Deliverable 2], [Deliverable 3]
  OUT: [Everything else - explicitly deferred]
```

### 3. Frequent User Feedback

**Problem**: LLMs build the wrong thing without course correction.

**Solution**: User review after EVERY significant task:

```
┌─ Task Complete: Review Required ───────────────────┐
│ Completed: [description]                           │
│ Progress: [n/total] criteria                       │
│                                                    │
│ Options:                                           │
│ 1. Approve - commit and continue                   │
│ 2. Feedback - describe issues                      │
│ 3. Revise - specific changes needed                │
│ 4. Pause - stop for discussion                     │
└────────────────────────────────────────────────────┘
```

### 4. Definition of Done First

**Problem**: Implementation without clear success criteria leads to ambiguity.

**Solution**: Before ANY coding, establish:

```markdown
## Definition of Done: [Task Name]

### Acceptance Criteria
- [ ] [Specific, testable criterion 1]
- [ ] [Specific, testable criterion 2]

### Verification Method
For each criterion: [human | machine | both]
```

### 5. Bidirectional Evaluate ↔ Research

**Problem**: Evaluation may reveal questions needing research. Research may reveal codebase questions.

**Solution**: They iterate until resolved:

```
evaluate → finds ambiguity → research
                                │
research → finds code question ─┘
                                │
evaluate → resolves question ───┘ (max 3 iterations)
```

## File Organization

```
.agent_planning/
├── PROJECT_SPEC.md              # Requirements (authoritative)
│
├── EVALUATION-*.md                  # Project-wide evaluation cache
├── EVAL-<scope>-*.md            # Component evaluation cache
│
├── TASK-EVAL-<task>-*.md        # Task-specific eval (planner reads)
├── PLAN-<task>-*.md             # Sprint plan
│
├── RESEARCH-*.md                # Research findings
├── WORK-EVALUATION-*.md         # Implementation verification
│
└── archive/                     # Superseded documents
```

## Example Workflow

### User runs: `/do:it add OAuth login`

**Phase 0: Resolve Dependencies**
```
No plan found for "add OAuth login"
Chaining to /do:plan...
```

**Evaluate** (via `/plan` chaining to `/evaluate`):
- Checks cache: finds EVAL-auth-*.md from 3 days ago (RECENT)
- Carries forward auth findings, fresh-evaluates OAuth-specific gaps
- Asks user: "Which OAuth providers should we support?"
- User answers: "Google and GitHub"
- Writes: `TASK-EVAL-add-oauth-login-<timestamp>.md`

**Plan**:
- Reads TASK-EVAL
- Generates sprint plan (2 deliverables):
  1. Google OAuth integration
  2. GitHub OAuth integration
- Deferred: Microsoft OAuth, Apple Sign-In
- Work-evaluator validates plan
- User approves

**Definition of Done**:
```markdown
- [ ] User can click "Sign in with Google"
- [ ] User can click "Sign in with GitHub"
- [ ] OAuth callback creates/links user account
- [ ] Session persists after OAuth login
```
User approves criteria.

**Implementation Loop**:
1. Implement Google OAuth → User tests → Approves
2. Implement GitHub OAuth → User tests → "Callback URL wrong" → Fix → Approves
3. Checkpoint: "2 tasks done, continue?" → Move to validation

**Validation**:
- Machine: Tests pass, lint clean
- Human: User tests both flows, approves

**Complete**:
```
Implementation Complete
  Task: add OAuth login
  Criteria: 4/4 met
  Deferred: Microsoft OAuth, Apple Sign-In
Next: /do:it add Microsoft OAuth
```

## Philosophy

**Efficiency**: Don't redo work. Cache evaluations, skip optional steps, verify only what changed.

**Small batches**: One sprint. 2-3 deliverables. Feedback after each task.

**Human in the loop**: User reviews every significant change. User approves every plan.

**Explicit deferral**: Out-of-scope items are documented, not forgotten.

**Working software**: The loop produces code, not just documents. Validation is mandatory.
