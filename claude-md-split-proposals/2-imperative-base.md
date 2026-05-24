<!--
SPLIT PROPOSAL 2 of 3 — "IMPERATIVE CORE"   (file 1 of 2: the always-loaded base)
Cut axis: WHAT vs WHY. Base keeps the law tokens AND a distilled block of
behavior-changing imperatives lifted out of the manifesto (subtraction,
hardness-is-information, done=smoother, delete-over-shim, refuse-the-escape).
The *directives* stay always-on; their *justification* moves to the skill.
Optimizes for: keeping the active-ingredient candidates inline so the prized
behaviors fire even when the skill is not loaded.
Bet: imperatives carry force without the full prose frame. If they go inert
without the scaffold, this proposal underperforms and proposal 3 is safer.
Pairs with: 2-imperative-skill.md
-->

# Architectural Laws + Discipline

Each law is a corollary of **types-are-the-program**: design constraints so that
illegal states cannot be expressed; the implementation is residue.

**Citation (required):** `// [LAW:<token>] reason` when a law informs a decision;
`// [LAW:<token>] exception: reason` when you must violate one.

## The discipline (how to hold the laws while you work)
- **Polish until nothing snags.** The code is not done when it works — it is done when there are no rough bits left to catch on. A bespoke one-caller type, an almost-right name, a guard against a state that shouldn't exist: each is rough. Done = the code is smoother than you found it.
- **Polishing is subtraction.** A pass that *adds* a guard/helper/case is patching, not polishing. The smooth version has *less* code. If your iterations grow the code, you are crystallizing — stop.
- **Hardness is information.** When the body feels hard or wants to branch/guard, the upstream type is wrong. Fix the type; refuse the escape into "I'll just handle that case in the body."
- **Delete before you add.** Prefer removing code to shimming around it. Ask first: can this be solved by deletion?
- **A comment that explains an invariant is a missing constraint.** Encode it in the type; don't write the comment.

## Laws — Primary
- **types-are-the-program** — Strongest true theorem about your data: every legal state representable, every illegal state unrepresentable.
- **dataflow-not-control-flow** — Variability lives in values (nulls, empty collections, discriminated unions), not in whether code runs. An `if` that skips an operation belongs in the data.
- **one-source-of-truth** — One authoritative representation per concept; all others derived and synchronized. Divergence-possible = broken.
- **single-enforcer** — Each cross-cutting invariant enforced at exactly one boundary. Remove duplicates; don't add another.
- **one-way-deps** — Declared direction; no cycles, no upward calls. A cycle is a hidden shared type asking to be extracted.
- **one-type-per-behavior** — Identical behavior = one type + config, not FooA/FooB/FooC.
- **verifiable-goals** — Concrete machine-checkable success criteria. Asking the user to test is the last resort.
- **comments-explain-why-only** — WHY, never WHAT. Remove WHAT-comments on sight.

## Laws — Structural
- **locality-or-seam** — Changes to X must not force edits in unrelated Y. Missing seam → make the type first.
- **no-defensive-null-guards** — Null checks only at trust boundaries. `if (X) { work }` with no else is control flow in disguise.
- **no-shared-mutable-globals** — Single owner, explicit API, documented invariants.
- **no-mode-explosion** — New modes need a cap + exit plan; default path stays canonical.

## Laws — Process
- **behavior-not-structure** — Tests assert contracts, never implementation.

---

## Workflow gates (always-on, procedural)
- **git** — clean tree → `checkout master` → `pull --rebase` → **HARD GATE: 0 ahead / 0 behind or STOP** → branch → work → PR. Never push to master.
- **pr-followup** — when a PR opens, invoke `/address-pr-reviews` immediately.
- **commit** — commit completed work as its own commit.
- **ticket** — done = validated + reviews addressed + nothing deferred + docs + merged.
- **python** — never bypass PEP 668; prefer `uv run --with <pkg>`.

---

> **Why these directives work — the full constraint-design argument, the
> intrinsic-vs-carrying-cost economics, the worked examples, and the contextual
> guidelines — lives in the `constraint-design` skill. Read it when a decision is
> non-obvious or you want the reasoning behind a directive above.**
