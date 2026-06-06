---
name: sheriff-is-in-town
description: Audit a repository against the universal architectural laws and report where the code breaks them — read-only findings, no fixes. Each finding cites the exact [LAW:<token>] it violates, with file:line, the behavior that breaks it, its blast radius, and the constraint that would make it unrepresentable. Use when the user says "sheriff is in town", "audit against the laws", "law audit", "where are we breaking the laws", "check for law violations", or wants a lawfulness pass before a refactor or merge. Optionally scope to a path, subsystem, or the current diff.
---

# Sheriff Is In Town

The sheriff enforces the law — doesn't write it, doesn't fix the town. This skill walks the
code and reports where it breaks the **universal architectural laws**. Read-only.

## The rubric is already loaded

The laws live in your global CLAUDE.md (`universal-laws`). That is the single source of truth
for what counts as a violation. **Do not restate or paraphrase them here** — read them there
and cite them by token. [LAW:one-source-of-truth]

## Scope

Default: the whole repo. If the user named a path, a subsystem, or "the diff", audit only
that. State the scope at the top of the report so it's unambiguous what was *not* checked.

## Process

1. **Read the code in scope** — actually read it, don't skim. A law violation is a property
   of behavior and shape, invisible to grep.
2. **Map each violation to the one law it most breaks** — the canonical token, not a list.
   If it seems to break three, find the upstream one the other two descend from. [LAW:one-type-per-behavior]
3. **Verify law-marker claims before trusting them.** A `// [LAW:<token>] reason` comment is
   evidence, not authority: confirm the marked code actually satisfies the cited law. False
   law markers are findings because future agents treat them as architectural ground truth.
4. **Treat meaningful comments as claims.** Comments that say "only", "single", "derived",
   "must", "never", "source of truth", or cite another file/system are testable. When such a
   claim is false and it changes architectural judgment, report the lying claim with the same
   blast-radius framing as code-shaped violations.
5. **Use candidate patterns to aim the audit.** The patterns below are heuristics, not laws.
   They help find likely violations, but a finding is valid only when it maps to exactly one
   universal law from `CLAUDE.md`. [LAW:one-source-of-truth]
6. **Do not edit anything.** The sheriff reports; the town fixes. [LAW:single-enforcer]

## Candidate Patterns

These are starting points for reading, not a substitute for reading. A candidate that does not
violate a universal law is not a finding.

- **Boundary and type absorption:** scattered discriminator checks, repeated guards on the same
  field, mode flags threaded through signatures, raw `unknown` / `interface{}` / map-shaped
  consumers, type switches over raw shapes, validate-don't-parse boundaries that return the same
  untrusted shape after "validation", comments that say callers must ensure an invariant, and
  downstream defensive checks after a supposed validation boundary.
- **Enumeration gaps:** predicates, classifiers, validators, canonical checks, equality checks, or
  resource filters that recognize the happy shape instead of rejecting each wrong shape. Look for
  substring/prefix matching against exact producer formats, fingerprint checks that verify tokens
  instead of invariants, tests duplicating produced literals, and shared sinks with multiple producers
  but no producer discriminator.
- **Type escape hatches:** `any`, `unknown`, laundering casts, non-null assertions, optional
  chaining/defaults added to placate a type error, output unions caused by missing input context,
  and signatures that force every caller to narrow the same way. Treat the escape hatch as evidence
  of the missing upstream constraint.
- **Temporal coupling:** empty-render/measure/rerender loops, framework ordering assumptions,
  sleeps/ticks/animation frames used to let state settle, manual scheduler or re-entry flags, cleanup
  order dependencies, and lifecycle assumptions owned by no explicit state machine or boundary.
- **State and observability loops:** ref mirrors, write-then-read-self loops, components or modules
  that publish to a store they immediately consume from, observability used as internal plumbing, and
  event buses between code that already shares a direct owner.
- **Boundary erosion:** god modules, diffuse public surfaces, deep imports into private paths,
  bidirectional dependencies, parameter threading through many layers, capability leaks via giant
  context objects, and features that force otherwise unrelated subsystems to know about each other.
- **Source-of-truth drift:** duplicated state, parallel schema/type/DTO/cache/spec representations,
  dual implementations, stale compatibility paths, silent fallbacks with different semantics, and
  docs/tickets/prompts/comments that copy implementation detail below their proper abstraction level.
- **Verification drift:** tests that assert structure instead of behavior, tests that construct
  impossible states, acceptance criteria that are not machine-checkable, and audit/remediation work
  that collapses distinct phases into one artifact.

## Finding shape

Each finding, terse:

- `path:line` — `[LAW:<token>]`
- **Breaks it by:** what the code *does* that violates the law (behavior, one line — not "this is ugly")
- **Blast radius:** who pays, and what future change it taxes (this is the severity signal)
- **Fix direction:** the constraint that would make the violation unrepresentable — the type/seam
  that absorbs it, not a spot-patch. Point at the cure, don't apply it.

For boundary/type absorption findings, the fix direction must name the handoff data `form-a-posse`
will need: the raw shape or discriminator, the owning boundary, the absorbing constraint
(parsed type, state machine, canonical source, or single enforcer), and the old residue expected
to disappear. [LAW:verifiable-goals]

## Rank

By **blast radius** — how much future work the violation taxes — never by count or by how easy
it is to fix. The loudest findings are where roughness compounds, not where it's most visible.

## The sheriff does not shoot

Read-only by default. If the user wants the violations actioned, that's a separate
deputization — hand the report to `form-a-posse`, which plans the *how* and writes the lit
tickets. Auditing, planning, and remediating have different blast radius and trust; keep them
separate jobs. [LAW:locality-or-seam]
