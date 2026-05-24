<!--
SPLIT PROPOSAL 1 of 3 — "SKELETON BASE"   (file 1 of 2: the always-loaded base)
Cut axis: MAXIMAL RELOCATION. Base keeps only law tokens + one-line definitions
+ the citation mechanic + the irreducible workflow gates. Every paragraph of
reasoning, every example, every guideline moves to the companion skill.
Optimizes for: shareability — this reads as a clean, copyable "laws" card.
Biggest risk: if the behaviors you prize (delete-to-fix, fix-the-type-not-the-body)
depend on the prose scaffold, they weaken when the skill is not loaded.
Pairs with: 1-skeleton-skill.md
-->

# Architectural Laws

These laws apply unconditionally. Each is a corollary of **types-are-the-program**:
design constraints such that illegal states cannot be expressed; the implementation
is residue.

**Citation (required):** when a law influences a decision, cite it
`// [LAW:<token>] reason`. When you must violate one, mark it
`// [LAW:<token>] exception: reason`.

## Primary
- **types-are-the-program** — Choose the strongest theorem about your data that is still true: every legal state representable, every illegal state unrepresentable. The implementation is residue. If the body feels hard or branchy, the type is wrong — fix the type, don't push through the body.
- **dataflow-not-control-flow** — The same operations run in the same order every invocation; variability lives in values (nulls, empty collections, discriminated unions), never in whether code runs. An `if` that *skips* an operation is variability that belongs in the data.
- **one-source-of-truth** — Every concept has exactly one authoritative representation; all others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken.
- **single-enforcer** — Any cross-cutting invariant (auth, validation, timing, serialization) is enforced at exactly one boundary. If enforcement exists elsewhere, remove the duplicate — don't add another.
- **one-way-deps** — Dependency direction is declared. Cycles and upward calls are forbidden. A cycle is a hidden shared type asking to be extracted.
- **one-type-per-behavior** — Identical behavior means one type with config/instances, not FooA/FooB/FooC. Ask "what differs besides the name?"
- **verifiable-goals** — Every goal needs concrete criteria a deterministic process can check. Asking the user to test is the last resort.
- **comments-explain-why-only** — Comments explain WHY, never WHAT. A WHAT-comment is a divergent copy of what the code already says — remove it on sight.

## Structural
- **locality-or-seam** — Changes to X must not force edits in unrelated Y. Missing seam → create the interface/type first. The seam *is* the type.
- **no-defensive-null-guards** — Null checks only at trust boundaries or where optionality is explicit. `if (X) { work }` with no else is control flow in disguise — fix why X can be null.
- **no-shared-mutable-globals** — Registries/singletons need a single owner, an explicit API, and documented invariants.
- **no-mode-explosion** — New flags/modes need a documented cap + exit plan. The default path stays canonical.

## Process
- **behavior-not-structure** — Tests assert contracts (what), never implementation (how). A test that only passes by preserving deprecated code encodes structure — fix or delete it.

---

## Workflow gates (always-on, procedural)
- **git** — clean tree → `checkout master` → `pull --rebase` → **HARD GATE: 0 ahead / 0 behind or STOP** → branch → work → PR. Never push to master.
- **pr-followup** — the moment a PR opens, invoke `/address-pr-reviews`.
- **commit** — commit completed work as its own commit.
- **ticket** — own ticket state. Done = validated + reviews addressed + nothing deferred + docs + merged.
- **python** — never bypass PEP 668; prefer `uv run --with <pkg>`.

---

> **The reasoning behind these laws — the constraint-design philosophy, the
> intrinsic-vs-carrying-cost argument, worked examples, and the contextual
> guidelines — lives in the `architecture-philosophy` skill. Read it when a
> design decision is non-obvious or an implementation starts to feel hard.**
