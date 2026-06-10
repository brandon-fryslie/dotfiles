# CLAUDE.md audit — 2026-06-09

Companion to the second-half rewrite. Three parts:
1. **Proposed improvements to the first half** (universal-laws) — not applied; for your review.
2. **Parked adjacent content** removed from the second half — each item quoted with a disposition recommendation.
3. **Deletion ledger** — everything deleted outright as already incorporated, with where it lives now.

Delete this file once reviewed.

---

## Part 1 — First-half proposals

### P1. Cut the author meta-commentary (highest-confidence cut)
The two `*(face real; under-specified — revisit)*` annotations and the paragraph "Decomposition and representation are fully worked below. Time and world are real and named so the structure is honest about them, but deliberately left brief…" are notes from the author to the author, not guidance to the model. Inside a document that opens with "These apply unconditionally," telling the model two laws are half-baked licenses weaker compliance on exactly those laws. ~70 tokens back. The revisit-TODOs move here (see Part 2, items A4/A11, which are the natural feedstock for those faces).

### P2. Trim the summary header
`## Summary (recap at recency — verbatim tokens, relationships, no new definitions)` → `## Summary`. The parenthetical is prompt-engineering rationale, not content; the recap's discipline shows in its text.

### P3. Add a compressed WRONG/RIGHT example to `[LAW:dataflow-not-control-flow]` (highest-value addition)
It is the self-declared most-violated law, and for sonnet-class models one concrete example outperforms another abstract sentence. Compressed from the old `<on-conditionals>` block (~80 tokens):

> Wrong: "**when** a render pass has a viewport **and** uses clear, **only** clear the viewport region" — three conditionals, every caller must know the special case. Right: "every pass has a viewport (default: full surface); the scissor always matches it; clear always fills it" — same code path every invocation, the viewport is a value.

### P4. Resolve the ask-policy contradiction
`[LAW:verifiable-goals]` says "Where uncertainty remains, ask before proceeding rather than guessing." `<decision-autonomy>` says asking is the last resort and routes almost everything away from the user. Two representations of the same policy that disagree — a `[LAW:one-source-of-truth]` violation across the halves. Proposed rewording in the law: "Where uncertainty remains that you cannot resolve yourself, surface it rather than guess" — letting decision-autonomy own the routing.

### P5. Fold the flag checklist into `[LAW:no-mode-explosion]`
The law is the thinnest of the nineteen ("documented cap and an exit plan") while its concrete form lived in the second half. Proposed addition: "Every flag has an owner, a default, and a deletion date; toggles branch at the entrypoint, never deep inside logic." Then the old `<flags>` guideline deletes cleanly (done in this rewrite, contingent on this fold).

### P6. Extend `[LAW:no-silent-failure]` with error context
Loudness alone isn't enough; the error must localize. Proposed addition: "When failure surfaces, it carries enough context to localize responsibility without guessing." Absorbs the old "Context in errors" guideline.

### P7. Extend `[LAW:carrying-cost]` with the deletion default
Proposed addition: "Dead code, disabled paths, and compatibility shims are pure carrying cost; deletion is the default, a shim the marked exception." Absorbs "Delete over shim."

### P8. Broaden `[LAW:no-shared-mutable-globals]`
The law covers registries and singletons but not shared mutable state generally (threads, async closures, module-level caches). Proposed: open with "Shared mutable state of any kind — registries, singletons, module-level caches, cross-task closures — requires a single owner, an explicit API, and documented invariants."

### P9. (Optional) Give `[LAW:decomposition]` the module smell
One clause: "A module that has become 'where things go' is a missing cut; split by why the code changes, not by size." Absorbs the old `<modules>` guidelines.

### P10. (Minor) Compress the citation protocol
"The string you emit at the callsite is the same string that names the law below — one key, deliberately, so every use reinforces the concept." → "One key per law, used everywhere, so every use reinforces it." ~20 tokens.

### Verified covered — no change needed
- Naming: enumerated in `[FRAMING:representation]` and the no-"and" test in `[LAW:decomposition]`.
- Caches: `[LAW:one-source-of-truth]` ("derived, never authoritative").
- Mechanical enforcement ladder: verbatim in `[FRAMING:representation]`.
- Section ordering (the consequence section interrupting the four faces): rhetorically deliberate, recap restores the map — recommend keeping.

---

## Part 2 — Parked adjacent content (removed from CLAUDE.md, awaiting your call)

### A1. Delete over shim *(simplicity)*
> Remove features rather than maintain compatibility layers. Shims become permanent.

**Disposition:** fold into `[LAW:carrying-cost]` via P7, then discard.

### A2. Module split heuristics *(modules)*
> **Small and crisp**: When a module becomes "where things go," it's time to split.
> **Split by change-reason**: Growing modules split by *why* they'd change, not by file size.

**Disposition:** fold into `[LAW:decomposition]` via P9, then discard.

### A3. Data contracts over object graphs *(state)*
> Stable shapes beat implicit references that hide coupling.

**Disposition:** candidate clause for `[LAW:locality-or-seam]` or `[LAW:types-are-the-program]` (a passed object graph is an undeclared seam). Worth one sentence somewhere; currently nowhere.

### A4. Immutable coordination *(state)*
> Snapshots over shared mutable references for cross-boundary communication.

**Disposition:** feedstock for the under-specified **time/world faces** — immutability is the mechanism that makes `[LAW:effects-at-boundaries]` and `[LAW:no-shared-mutable-globals]` cheap. Park until those faces get their rewrite.

### A5. Dependency metrics *(dependencies)*
> **Low fan-out**: Core modules should have few outgoing edges. Measure this.
> **Track hotspots**: Where changes routinely cascade, reduce centrality. These are architecture risks.

**Disposition:** the laws are qualitative; these add *measurement*. Either a one-line "measure it" clause on `[LAW:one-way-deps]`/`[LAW:locality-or-seam]`, or discard as process detail.

### A6. Invariants at boundaries *(dependencies)*
> Document constraints at the module edge, not buried in implementation.

**Disposition:** mostly covered by `[LAW:single-enforcer]` + `[LAW:types-are-the-program]` (encode, don't document). Recommend discard.

### A7. Capabilities over context *(boundaries)*
> Don't pass omniscient objects; grant specific abilities.

**Disposition:** candidate clause for `[LAW:composability]` — a god-object parameter is the "asking nothing" failure inverted (the part asks for everything). Good fit, one sentence.

### A8. Anti-corruption layers *(boundaries)*
> Legacy/new boundaries get explicit translation layers.

**Disposition:** the legacy-boundary binding of `[LAW:locality-or-seam]`. Either a domain binding (it's situational, not universal) or discard.

### A9. Events don't replace call graphs *(events)*
> Clear dependencies beat implicit pub/sub. Events supplement, not supplant.

**Disposition:** candidate clause for `[LAW:one-way-deps]` — pub/sub is an undeclared dependency edge. One sentence.

### A10. Contract vs implementation tests *(testing)* — ⚠ tension
> Separate them. Contract tests are stable; implementation tests are local and cheap.

**Disposition:** in tension with `[LAW:behavior-not-structure]`, which forbids structure-asserting tests outright while this permits them if segregated. Decide which is true: if implementation tests are ever legitimate, the law needs the exception; if not, discard this. Cannot keep both as written.

### A11. Context in errors *(errors)*
> Enough information to localize responsibility without guessing.

**Disposition:** fold into `[LAW:no-silent-failure]` via P6, then discard.

### A12. Abstractions document what they forbid *(abstractions)*
> New abstractions document their guardrails — what they prevent, not just what they enable.

**Disposition:** the documentation-level echo of "illegal states unrepresentable." Candidate one-liner for `[LAW:types-are-the-program]` or discard as covered in spirit.

### A13. The full on-conditionals worked example *(wisdom)*
The complete WRONG/RIGHT viewport/clearTarget example (~450 tokens). The diagnostic sentence it taught is already verbatim in `[LAW:dataflow-not-control-flow]`; the compressed example is proposed as P3. Full original preserved in git history at `config/claude/CLAUDE.md` before this commit. **Disposition:** discard after accepting P3.

### A14. "You don't have the full picture" *(wisdom)*
> You do NOT have the full picture of where we are going… We must plan as if we will be implementing for years to come.

The one sentence of the wisdom prose not already absorbed by `[LAW:carrying-cost]`. **Disposition:** candidate closing clause for `[LAW:carrying-cost]`: "You never have the full picture of where the project goes; build as if implementing for years."

### A15. The `|| true` exception nuance *(scripting-discipline)*
> The *only* acceptable use of `|| true` is when the failure is genuinely irrelevant to every downstream consumer.

**Disposition:** the citation protocol already covers exceptions (`[LAW:no-silent-failure] exception: reason` forces the justification inline). Recommend discard.

---

## Part 3 — Deletion ledger (incorporated; deleted outright)

| Deleted | Now lives in |
|---|---|
| "Justify every knob" | `[LAW:no-mode-explosion]` |
| "State machines for workflows" | `[LAW:no-ambient-temporal-coupling]` ("typed state machine") |
| "Caches are derived" | `[LAW:one-source-of-truth]` (verbatim) |
| `<data-driven-architecture>` pointer | `[LAW:dataflow-not-control-flow]` (pointer was also stale — referenced a removed "PRIMARY CONSTRAINTS" section) |
| "Variability at edges" | `[LAW:dataflow-not-control-flow]` + `[LAW:no-mode-explosion]` |
| "Track mode count" | `[LAW:no-mode-explosion]` ("documented cap") |
| "Flag discipline" checklist + "Gate entrypoints" | proposed fold via P5 |
| "No silent fallbacks" *(errors)* | `[LAW:no-silent-failure]` |
| "Make it impossible" ladder | `[FRAMING:representation]` (verbatim) |
| `<remember>` precedence blocks ×2 | single precedence line atop DOMAIN BINDINGS |
| `<remember>PRIMARY CONSTRAINTS` recap | first-half Summary (this copy used non-canonical names — pure drift) |
| scripting "Never swallow errors" bullets | `[LAW:no-silent-failure]` (names the exact patterns) |
| scripting "Never build silent fallback data sources" | `[LAW:no-silent-failure]` (lifted its "maximum confusion" sentence) |
| wisdom long-term/short-term prose | `[LAW:carrying-cost]` ("turn around" is in the law verbatim) |
| on-conditionals diagnostic sentence | `[LAW:dataflow-not-control-flow]` ("if, and, when, skip, only" verbatim) |
| `# TODO: rewrite the rest` | this rewrite |

**Structural fixes in the rewrite:** `ticket-lifecycle`, `commit-requirement`, `git-workflow`, `pr-followup` were accidentally nested inside `<wisdom>`; they are now top-level under `<operations>`, with the three git mandates consolidated into one `git-workflow` section (`[LAW:single-enforcer]` — one owner for the whole git protocol). Precedence is stated once instead of twice (`[LAW:one-source-of-truth]`).
