---
name: form-a-posse
description: Implement an existing law-remediation ticket produced from sheriff-is-in-town findings. Reads the ticket's findings and desired end state, chooses the remediation shape during implementation, applies the fix, deletes old residue, verifies the law now holds, and commits. Use when the user says "form a posse", "implement this law ticket", "fix this sheriff finding", "action this law violation", "work this remediation ticket", or has a sheriff-derived ticket ready to implement.
---

# Form A Posse

The sheriff names the work. The posse implements it.

The ticket says what is wrong and what end state must become true. It should not prescribe the
remediation shape. Choosing the shape is implementation judgment, done here after reading the code.

## Input

An existing law-remediation ticket derived from `sheriff-is-in-town` findings. It should contain:
file:line, `[LAW:<token>]`, how the law is broken, blast radius, and the desired end state. If no
ticket or finding exists, run sheriff and stop with ticket-ready findings; do not invent the work.
[LAW:verifiable-goals]

## Don't restate what's already owned

- The **laws** live in CLAUDE.md (`universal-laws`) — cite by token, never paraphrase.
- The **ticket** is the source of truth for what work is in scope. Do not expand scope because a
  related smell is nearby; file a follow-up instead. [LAW:one-source-of-truth]

## Process — one pipeline: ticket → shape → implementation → verification

1. **Read the ticket and cited code.** Confirm the finding still reproduces. If it does not,
   report the ticket as stale and stop rather than "fixing" a different problem.
2. **Name the missing constraint.** In your scratch reasoning, state the constraint that would make
   the violation unrepresentable and the owner that should carry it.
3. **Choose the remediation shape.** Pick the shape from the catalog below that fits the finding
   and the code you just read. This is implementation judgment; do not edit the ticket to add this
   shape unless the user explicitly asks.
4. **Implement in shape order.** Install the owner/boundary first, migrate one proof slice, migrate
   remaining in-scope consumers, delete residue, and reframe verification. Drop steps that do not
   apply, but keep the order. [LAW:types-are-the-program]
5. **Verify against the ticket's end state.** Run the smallest deterministic checks that prove the
   law now holds, plus targeted searches for residue the shape says should disappear.
6. **Commit.** Commit the implementation as one coherent remediation. If new independent work was
   discovered, create follow-up tickets; do not smuggle it into this fix. [LAW:verifiable-goals]

## Remediation Shapes

Use these shapes while implementing. They are not ticket templates, and they should not be pasted
into tickets. The ticket says what work exists; the shape tells the implementer how to make the fix
smooth.

### Absorb Variance Into A Boundary Type

Use when findings show scattered discriminators, repeated null guards, mode flags, raw shapes,
validate-don't-parse boundaries, or defensive checks that would vanish if the input had the right
shape.

Implementation guidance:
- Identify the raw value and the boundary where it first becomes trusted.
- Define the parsed type, state machine, newtype, resolved config, or typed capability that makes
  the illegal variants unrepresentable.
- Move enforcement to that owner. Downstream code consumes the trusted shape, not the raw value.
- Migrate one consumer as a proof slice, then the remaining consumers.
- Delete downstream guards, mode branches, casts, and tests that asserted defensive behavior.
- Done means the old bad state cannot be expressed past the boundary and the interior reads as a
  straight pipe or typed dispatch. [LAW:types-are-the-program]

### Restore One Source Of Truth

Use when findings show duplicate state, parallel schemas/types/specs/caches, dual implementations,
or stale copied implementation detail.

Implementation guidance:
- Name the canonical representation and why it owns the concept.
- Convert every other representation into a derived view, generated artifact, adapter, or deletion.
- Define how synchronization happens, or remove synchronization by making derivation direct.
- Delete stale copies and fallback paths that can diverge from the canonical source.
- Done means two divergent answers for the same concept cannot be produced. [LAW:one-source-of-truth]

### Install One Enforcer

Use when findings show duplicate validation, auth, serialization, timing, schema, lifecycle, or
policy checks across callsites.

Implementation guidance:
- Name the invariant and the one boundary that owns it.
- Route all callers through that owner instead of re-checking locally.
- Make the owner return a trusted value, capability, or explicit rejection.
- Delete duplicate checks and comments that shift responsibility back to callers.
- Done means enforcement can change in one place without auditing callsites. [LAW:single-enforcer]

### Introduce A Seam Or Dependency Boundary

Use when findings show god modules, deep imports, bidirectional dependencies, feature tendrils,
capability leaks, or changes to one concern forcing edits in unrelated concerns.

Implementation guidance:
- Name the dependency direction and the boundary type/capability that should cross it.
- Move private details behind the boundary; consumers depend on the seam, not internals.
- Replace omniscient context objects with narrow capabilities where that is the missing seam.
- Delete imports, back-edges, and leaked private types that made the boundary porous.
- Done means the future change named in the finding touches its owner without editing unrelated
  code. [LAW:locality-or-seam]

### Convert Control Flow Into Dataflow

Use when findings show conditional side effects, feature-specific branches in shared code, mode
flags, per-case render paths, or operation order varying by branch.

Implementation guidance:
- Name the value that should carry the variation.
- Make the operation sequence unconditional; variation changes arguments/data, not whether the
  operation runs.
- Represent real domain forks as variants whose arms are typed dispatch, not incidental guards.
- Delete branches whose only job was compensating for underspecified input.
- Done means adding the next case is a data edit or typed variant, not another control path.
  [LAW:dataflow-not-control-flow]

### Own Temporal Or Lifecycle Order

Use when findings show sleeps, ticks, re-entry flags, render-measure-rerender loops, cleanup order
assumptions, framework-order folklore, or init-before-use assumptions.

Implementation guidance:
- Name the lifecycle/scheduler owner and the phases it controls.
- Encode phase transitions as state, data, or capabilities; illegal call orders should not be
  expressible.
- Route ordering-sensitive work through the owner instead of relying on incidental timing.
- Delete waits, settle delays, in-flight flags, and cleanup guards that launder order assumptions.
- Done means correctness does not depend on ambient execution order. [LAW:no-ambient-temporal-coupling]

### Repair Verification Contract

Use when findings show structure-asserting tests, tests constructing impossible states,
unverifiable goals, stale audit/remediation artifacts, or acceptance criteria that cannot decide
done.

Implementation guidance:
- State the behavior or contract the system must guarantee.
- Move impossible-state tests to the enforcing boundary or delete them if the type now forbids them.
- Replace implementation-shape assertions with observable behavior checks.
- Make every done criterion deterministic enough for a machine or script to judge.
- Done means the verification artifact proves the contract without preserving obsolete structure.
  [LAW:behavior-not-structure]

## Output

A committed implementation, verification summary, and any follow-up ticket ids for independent
work discovered during the fix.

## The posse fixes; it does not find

Finding violations is sheriff's job. Grooming ticket order is backlog's job. The posse implements
the ticket in front of it. [LAW:single-enforcer]
