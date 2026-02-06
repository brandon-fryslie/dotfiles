# Dependency Types Deep Dive

bd supports four dependency types. **Only `blocks` affects what work is ready.**

## Overview

| Type | Purpose | Affects `bd ready`? | Direction |
|------|---------|---------------------|-----------|
| `blocks` | Hard prerequisite | **Yes** | prerequisite → blocked |
| `related` | Soft connection | No | Either direction |
| `parent-child` | Epic/subtask | No | parent → child |
| `discovered-from` | Found during work | No | original → discovered |

## The Dependency Inversion Gotcha

**CRITICAL**: Temporal language makes you think backwards!

### Why This Happens

When you think "Phase 1 before Phase 2", your brain processes it as:
- "Phase 1 is first"
- "Phase 1 blocks Phase 2"
- So you write: `bd dep add phase1 phase2`

**BUT THAT'S BACKWARDS!** The command syntax is:
```
bd dep add <thing-that-depends> <thing-it-depends-on>
```

### The Fix: Requirement Language

**WRONG** (temporal):
```bash
# "Setup before implementation"
bd dep add setup impl  # WRONG! Says setup depends on impl
```

**RIGHT** (requirement):
```bash
# "Implementation needs setup"
bd dep add impl setup  # RIGHT! Impl depends on setup
```

### Mnemonic

`bd dep add NEEDS NEEDED`

The thing that **NEEDS** something goes first. The thing that is **NEEDED** goes second.

### Verification

After adding dependencies, run:
```bash
bd blocked --json
```

Tasks should be blocked **BY** their prerequisites, not blocked **BY** their dependents.

## blocks - Hard Prerequisite

**Use when**: Work literally cannot proceed without the other issue being done.

```bash
bd dep add <blocked-issue> <prerequisite-issue>
bd dep add <blocked-issue> <prerequisite-issue> --type blocks
```

### Examples

**Database before API**:
```bash
bd dep add api-endpoint db-schema
# api-endpoint blocked until db-schema closes
```

**Sequential migration**:
```bash
bd dep add migrate-step-2 migrate-step-1
bd dep add migrate-step-3 migrate-step-2
# bd ready shows only step-1; closing it reveals step-2, etc.
```

### When to Use
- Technical prerequisites (schema before endpoints)
- Build order (foundation before features)
- Sequential pipeline (each step needs previous)

### When NOT to Use
- Soft preferences ("should" not "must")
- Work that CAN proceed in parallel
- Just noting relationship

## related - Soft Link

**Use when**: Issues are connected but neither blocks the other.

```bash
bd dep add <issue1> <issue2> --type related
```

Direction doesn't matter for `related` - it's symmetric.

### Examples

**Similar refactoring efforts**:
```bash
bd dep add refactor-validation refactor-errors --type related
# Both show in bd ready; just notes they're connected
```

**Documentation and code**:
```bash
bd dep add feature-oauth docs-oauth --type related
# Can work on either; they go together
```

### When to Use
- Similar work / shared context
- Alternative approaches
- Complementary features

## parent-child - Epic/Subtask

**Use when**: Breaking down large work into smaller pieces.

```bash
bd dep add <parent-epic> <child-task> --type parent-child
```

### Examples

**Feature epic**:
```bash
bd create "OAuth Integration" -t epic -p 1 --json  # bd-oauth
bd create "Setup credentials" -p 1 --json           # bd-oauth.1
bd create "Auth flow" -p 1 --json                   # bd-oauth.2

bd dep add bd-oauth bd-oauth.1 --type parent-child
bd dep add bd-oauth bd-oauth.2 --type parent-child
```

### Combining with blocks

Use parent-child for structure, blocks for ordering:

```bash
# Structure (parent-child)
bd dep add auth-epic setup-task --type parent-child
bd dep add auth-epic flow-task --type parent-child
bd dep add auth-epic test-task --type parent-child

# Ordering (blocks)
bd dep add flow-task setup-task      # flow needs setup
bd dep add test-task flow-task       # tests need flow
```

## discovered-from - Found During Work

**Use when**: You discover new work while implementing something else.

```bash
bd dep add <original-work> <discovered-issue> --type discovered-from
```

Or create and link in one command:
```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:<parent> --json
```

### Why This Matters

- Preserves context: "Where did this issue come from?"
- Auto-inherits parent's `source_repo`
- Creates audit trail of discovery

### Examples

**Bug found during feature work**:
```bash
# Working on user-profiles (bd-42)
# Find auth system needs role-based access

bd create "Auth needs RBAC" \
  --description="Found while implementing bd-42. Current auth doesn't support role checks." \
  -t bug -p 1 --deps discovered-from:bd-42 --json
```

**Research generates findings**:
```bash
# Research task: bd-research
bd create "Redis supports persistence" \
  --description="Finding from caching research" \
  -t task -p 2 --deps discovered-from:bd-research --json
```

### Combining with blocks

Sometimes discovered work is also a blocker:

```bash
# Discover bug during feature work
bd create "Auth bug blocks profiles" -t bug -p 1 \
  --deps discovered-from:bd-profiles --json
# Returns: bd-bug

# Bug actually blocks the feature
bd dep add bd-profiles bd-bug  # profiles blocked by bug
```

## Decision Tree

```
Does A prevent B from starting?
  YES → blocks (bd dep add B A)
  NO ↓

Is B a subtask of A?
  YES → parent-child (bd dep add A B --type parent-child)
  NO ↓

Was B discovered while working on A?
  YES → discovered-from (bd dep add A B --type discovered-from)
  NO ↓

Are A and B just related?
  YES → related (bd dep add A B --type related)
```

## Common Mistakes

### Mistake 1: blocks for Preferences

**Wrong**:
```bash
bd dep add docs feature  # "Should do docs first"
```

**Problem**: Docs don't technically block the feature.

**Right**: Use `related` or don't link. Note preference in descriptions.

### Mistake 2: discovered-from for Planned Work

**Wrong**:
```bash
bd dep add epic subtask --type discovered-from
```

**Problem**: `discovered-from` is for emergent discoveries, not planned decomposition.

**Right**: Use `parent-child` for planned breakdown.

### Mistake 3: Wrong Direction

**Wrong**:
```bash
bd dep add api-endpoint database-schema
# Says api-endpoint blocks database-schema!
```

**Right**:
```bash
bd dep add api-endpoint database-schema
# Wait, that's wrong too if we mean endpoint needs schema!

bd dep add database-schema api-endpoint
# NO! Still wrong - says schema depends on endpoint

# The CORRECT way:
bd dep add api-endpoint database-schema
# IS WRONG because it says endpoint blocks schema

# Actually correct:
bd dep add api-endpoint database-schema
# This says api-endpoint is blocked BY database-schema
# Which is CORRECT if endpoint needs schema first

# Wait, I'm confusing myself. Let me be precise:
# bd dep add FROM TO --type blocks means FROM blocks TO
# So: bd dep add database-schema api-endpoint
# Means: database-schema blocks api-endpoint
# Which is CORRECT!
```

**Clearest way to think about it**:
```
bd dep add <prerequisite> <dependent>
bd dep add <blocker> <blocked>
bd dep add <what-must-finish-first> <what-waits>
```
