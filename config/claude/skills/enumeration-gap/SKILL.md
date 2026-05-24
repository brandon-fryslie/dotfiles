---
name: enumeration-gap
description: Write the accept/reject shape table BEFORE writing any predicate, classifier, fingerprint, matcher, validator, or shared-resource operation — so the type rejects every illegal input by construction instead of leaking the gaps to a reviewer (or production). Use proactively whenever about to write an is-X / has-X / validate-X / match-X / canonical-X function, a "are these two things equal/equivalent" check, a name/format parser that mirrors a producer, or any operation that touches a resource with more than one producer. Also use when a reviewer keeps finding "you didn't handle the case where..." comments, when a predicate uses strings.Contains / substring / loose matching against a value that has an exact produced shape, or when a bool parameter silently selects between two behaviors. The failure mode is the "enumeration gap": code that matches the happy shape but fails to reject the wrong ones.
---

# Shape Table: Enumerate Before You Match

## The problem, framed

A predicate is a theorem about data. `isMigrationSnapshot(name) bool` claims "I can tell migration snapshots from everything else." `hasCanonicalConstraint(c) bool` claims "I can tell the canonical shape from every drift." A classifier, validator, fingerprint, equality check, or format-parser is the same: each one is a function whose **entire job is to draw a line** between the inputs it accepts and the inputs it rejects.

The failure mode — call it the **enumeration gap** — is writing the body so it *recognizes the happy shape* instead of so it *rejects every wrong shape*. These look identical when you only test the happy path. They diverge the moment a wrong input that the author never pictured arrives. The code returns the wrong answer, confidently, and nothing crashes.

This is the single most common class of issue a careful reviewer finds, because it is invisible from the inside. The author wrote `strings.Contains(name, "pre-migrate")` thinking about the names the producer makes — and never thought about a *user* snapshot labeled `pre-migrate`. The author wrote a constraint fingerprint checking three tokens — and never enumerated the fourth invariant the constraint actually encodes. Every one of these is the same shape: **a partial type masquerading as a total one.**

Under the laws this is `types-are-the-program` stated operationally. The type is supposed to make illegal states unrepresentable. A predicate with an enumeration gap is an under-constrained type: it admits illegal inputs into the "accept" set. The fix is never "add a guard for the case the reviewer found" — that is patching one leak in a colander. The fix is to **enumerate the full accept-set and reject-set first**, then write the body that satisfies that table. When you do that, the gaps are impossible because you decided every case before the body existed.

The discipline costs 30-60 seconds per function and it *front-loads* the thinking the reviewer would otherwise do for you, one round-trip at a time, over days.

## When this applies (recognize the situation)

You are about to write one of these — stop and build the table first:

- **Classifiers / predicates**: `isX`, `hasX`, `shouldX`, anything returning `bool` from a non-trivial input.
- **Validators**: "is this input acceptable?" at any trust boundary.
- **Fingerprints / canonical checks**: "is this value in the canonical/expected shape?" — especially when comparing against a value some other system rewrote (DB engines, formatters, serializers all rewrite).
- **Format parsers that mirror a producer**: any `parseX` whose correctness depends on matching what some `formatX` emitted. The producer's format string is the spec; the parser is its inverse.
- **Equality / equivalence checks**: "are these two things the same?" where "same" is fuzzier than `==`.
- **Shared-resource operations**: any read/prune/delete/scan over a sink that has **more than one producer** (a directory, table, queue, registry written by two code paths).

## Indications you have *already* fallen in (evidence in existing code)

- A predicate uses `strings.Contains`, prefix/suffix checks, or "looks roughly like" matching against a value that has an **exact produced shape**. Loose matcher + exact producer = gap.
- A "canonical / valid / equal" check enumerates *some* of the invariants the canonical form encodes but you can't immediately point to the line enforcing each one.
- A `bool` (or enum) parameter silently selects between two behaviors and the function name describes only one of them (`fooWithSwallow(..., invert bool)`).
- A test hard-codes the same literal/format that production code produces, instead of importing the producer's constant or calling its inverse.
- An operation deletes/prunes/overwrites entries in a resource without filtering by *which producer made them* — and you can name a second producer of that resource.
- Review history shows a recurring "you didn't handle the case where X" / "this also matches Y" pattern. That is the enumeration gap leaking one case per round.

## The technique

Before writing the body, write the table. It has exactly two columns:

| MUST ACCEPT | MUST REJECT |
|---|---|

Fill it by **deriving the cases from the spec, not from the happy path**:

1. **Accept column**: every legal input, *including every alternate rendering*. If a DB/formatter/serializer rewrites your value, the rewritten form goes here too (you usually have to go observe the actual rewrite, not guess it).
2. **Reject column**: enumerate by **perturbing each invariant independently**. If the canonical form encodes N invariants, there are at least N reject rows — one per invariant violated while the others hold. These near-misses are exactly the cases a happy-path body lets through.
3. **Boundary rows**: empty input, missing component, the value that *contains* the right token but isn't the right shape, the adjacent producer's output.

If you cannot fill a row — you do not know what the right answer is — that is the signal to **ask or go look**, not to guess in the body. An unfillable table means the type is underspecified; writing the body anyway just hides the question.

Then write the body to satisfy the table, and turn the table into the test cases verbatim. The table *is* the test.

## Before / after

### 1. Loose matcher vs. exact producer

A producer stamps names as `<unix-ns>-pre-migrate-<unix-ns>`.

**Wrong** — recognizes the happy shape:
```go
func IsMigrationSnapshot(name string) bool {
    return strings.Contains(name, "pre-migrate")
}
```
Gap: a *user* snapshot labeled `pre-migrate`, or `pre-migrateofy`, or `foo-pre-migrate-1` all return true. The matcher is looser than the producer is exact.

**Right** — reject-set drives the body; mirror the producer's structure:
```go
// MUST ACCEPT: 123-pre-migrate-456
// MUST REJECT: 123 (no label) | 123-pre-migrate (no ts) | 123-pre-migrateofy
//              | foo-pre-migrate-456 (head not unix-ns) | -pre-migrate-456
func IsMigrationSnapshot(name string) bool {
    head, label, ok := strings.Cut(name, "-")
    if !ok || !allDigits(head) { return false }      // head is a real unix-ns
    rest, ok := strings.CutPrefix(label, "pre-migrate-")
    return ok && allDigits(rest)                      // exact stamped shape
}
```
Each reject row corresponds to a guard. The body is the table made executable.

### 2. Partial fingerprint vs. full invariant set

A canonical CHECK constraint encodes: (a) epics have NULL status, (b) non-epics have NON-NULL status, (c) non-epics use the allowed value set, (d) the leaf arm is scoped to non-epics. The engine rewrites the SQL text on round-trip.

**Wrong** — checks the vocabulary, not the invariants:
```go
return has(c, "issue_type in ('epic')") &&
       has(c, "status in ('open','in_progress','closed')") &&
       has(c, "status is not null")
```
Gap: `(epic AND status IS NOT NULL) OR (status IN (...))` passes — it has all the *tokens* but inverts invariant (a) and drops invariant (d). Epics can now carry a status.

**Right** — one check per invariant, enumerated from the reject table:
```go
// MUST REJECT (one row per inverted invariant, others held):
//   epic arm allows non-null status   (a violated)
//   leaf arm missing non-epic guard   (d violated)
//   leaf arm missing not-null gate     (b violated)
//   wrong status set                   (c violated)
return hasEpicNullArm(c) &&        // (a)
       hasNonEpicNotNullArm(c) &&  // (b)
       hasAllowedStatusSet(c) &&   // (c)
       hasNonEpicGuard(c)          // (d), tolerant of engine paren-rewrites
```
N invariants → N reject rows → N checks. The author who writes the reject table first cannot ship with only 3 of 4.

### 3. Bool parameter hiding two semantics

**Wrong** — one helper, two contracts, selected by a flag the name doesn't mention:
```go
// swallows "already exists"; fine for CREATE, silently hides real
// failures for RENAME/DROP
func execGated(probe, stmt string, invert bool) (bool, error) { ... swallow ... }
```
Gap: the next caller passing `invert=false` for a non-CREATE statement silently gets error-swallowing it never wanted.

**Right** — the name carries the semantic; no flag:
```go
func execGatedCreate(probe, stmt string) (bool, error)   // swallows benign races
func execGatedMutation(probe, stmt string) (bool, error) // propagates all errors
```
The shape table here is "which inputs should swallow vs propagate" — and it has two disjoint answers, so it is two functions.

### 4. Shared resource, no producer discriminator

A snapshots directory written by both `migrate()` and `user snapshots new`.

**Wrong** — prune by age over the whole directory:
```go
Prune(dir, keep)  // deletes oldest, regardless of who made them
```
Gap: a migrating open prunes to its budget of 10 and evicts the user's snapshots; a user snapshot prunes to its budget and evicts migration recovery points. Two producers, one undifferentiated sink.

**Right** — the kind discriminator threads into the operation, not just creation:
```go
PruneMatching(dir, keep, IsMigrationSnapshot)   // migrate bounds its own kind
PruneMatching(dir, keep, isUserSnapshot)        // user bounds its own kind
```
The table for a shared-resource op always includes the row "an entry made by the *other* producer" → MUST NOT TOUCH.

## The one-line version

Before writing any line-drawing function, write the two-column table of what it must accept and what it must reject — derive the reject rows by perturbing each invariant independently — then make the body satisfy the table and the test echo it. The reviewer's "but what about X?" is just a reject row you didn't write down.
