<!--
SPLIT PROPOSAL 3 of 3 — "LAWS INTACT, PHILOSOPHY OUT"   (file 1 of 2: base)
Cut axis: ABSTRACTION LAYER. The single cut is between the two giant manifesto
prose blocks (constraint-design, carrying-cost) + the on-conditionals essay —
which move to the skill — and EVERYTHING ELSE, which stays. The universal-laws
block keeps its full inline explanations; operational rules and guidelines stay.
Optimizes for: lowest behavior risk. This is the most conservative reading of your
original complaint ("the manifesto is many times longer than the laws it was meant
to add to") — it removes exactly the eclipsing prose and nothing else.
Trade: the base is still substantial; smallest shareability gain of the three.
Pairs with: 3-layered-skill.md
-->

# Architectural Laws

These laws apply unconditionally to all tasks. Each is a corollary of
**types-are-the-program**: design constraints such that illegal states cannot be
expressed; the implementation is residue.

**Citation:** when a law influences a decision, cite `// [LAW:<token>] reason`;
when you must violate one, mark `// [LAW:<token>] exception: reason`.

## Primary constraints
- **types-are-the-program** — Choose the strongest theorem about your data that is still true: every legal state representable, every illegal state unrepresentable. The implementation is residue — once the constraints are right, the body is forced. If implementation feels hard or branchy, the constraints upstream are wrong; fix the type, do not push through the body. If a comment is needed to explain an invariant, the type did not encode it. If a guard is needed against a state that should not exist, the upstream type permitted it. Every rough bit is a request to redesign a constraint.
- **dataflow-not-control-flow** — Structure mirrors data flow, not control flow. The same operations execute in the same order every invocation; variability lives in the values (nulls, empty collections, discriminated unions), never in whether operations execute. Side effects are unconditional — vary behavior by varying inputs, not by guarding execution. An `if` that skips an operation is variability that belongs in the data.
- **one-source-of-truth** — Every concept has exactly one authoritative representation; all others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken. (Two divergent representations = an under-constrained type; make it one.)
- **single-enforcer** — Any cross-cutting invariant (auth, validation, timing, serialization) is enforced at exactly one boundary. Duplicate checks drift. If enforcement exists elsewhere, remove the duplicate — don't add another.
- **one-way-deps** — Architecture declares dependency direction. Cycles forbidden; upward calls forbidden. A cycle is two modules sharing a hidden third type that should be extracted and named.
- **one-type-per-behavior** — If multiple things have identical behavior, they are instances of one type, not multiple types. Before FooA/FooB/FooC, ask "what differs besides the name?" If "nothing" or "only configuration," make one Foo with instances/config.
- **verifiable-goals** — Every goal must have concrete criteria a deterministic process can check. Asking the user to test is the last resort. An unverifiable goal is one whose "done" state has no type — define that type and verification follows.
- **comments-explain-why-only** — Comments explain WHY, never WHAT, and rarely HOW. A WHAT-comment is a manual divergent copy of what the code already holds; it drifts and is never refreshed. FORBIDDEN: enumerations of callers, counts, references to particular lines/variables/functions. Remove any you find, immediately, without debate.

## Structural constraints
- **locality-or-seam** — Changes to X must not force edits in unrelated Y. Missing seam → create the interface/adapter (the type) first. The seam *is* the type.
- **no-defensive-null-guards** — Null checks only at trust boundaries (external input, user data, network) or where a value explicitly represents optionality. `if (X) { do work }` with no meaningful else is control flow in disguise — it hides bugs by skipping work. If a value should never be null, make it not null; don't add the guard.
- **no-shared-mutable-globals** — Registries/singletons require a single owner, an explicit API, and documented invariants.
- **no-mode-explosion** — New flags/options need a documented cap + exit plan. The default path stays canonical. Prefer variability in values over variability in modes.

## Process constraints
- **behavior-not-structure** — Tests assert behavior (contracts), never implementation (how). A test that can only pass by preserving deprecated code encodes structure — update or delete it, never satisfy it by reintroducing removed code.

---

# Guidelines (judgment calls — never override the laws)
- **Simplicity**: delete over shim (shims become permanent); justify every knob (flexibility is debt with interest).
- **Modules**: small and crisp; split by *why* they'd change, not by file size.
- **Dependencies**: low fan-out on core modules; invariants documented at boundaries; track and reduce cascade hotspots.
- **Boundaries**: anti-corruption layers at legacy/new seams; variability at edges, invariants fixed; capabilities over omniscient context objects.
- **State**: data contracts over object graphs; state machines for workflows; immutable snapshots for cross-boundary coordination; caches are derived with centrally owned invalidation.
- **Events** supplement call graphs, never supplant them.
- **Flags**: owner + default + rollout plan + deletion date; gate at entrypoints.
- **Errors**: enough context to localize responsibility; no silent fallbacks.
- **Abstractions** document what they *forbid*; mechanical enforcement beats policy (compile-time > runtime > docs > hope).

## Context-specific (may override guidelines, never laws)
- **UI/frontend**: state lives near use; components mirror user mental models; one timing authority.
- **APIs**: idempotent by default; errors enable retry; version at the boundary.
- **Data/schema**: migrations have rollback paths; avoid dual-write (else define cutover + deadline).
- **Pipelines/compilers**: staged with explicit I/O; no back-edges; IRs are owned.
- **Distributed**: failure modes documented like success paths; ordering/timing has an explicit owner.
- **CLI**: exit codes are contract; stdout/stderr semantics intentional.

---

# Operational rules (always-on)

## Python deps
Never bypass PEP 668. Prefer, in order: a tool that needs no dep → `uv run --with <pkg>` → throwaway venv → ask before installing globally.

## Scripting & automation
- Never swallow errors (`2>/dev/null`, `|| true`, `|| echo default`).
- Never build silent fallback data sources that change the meaning of the data.
- Never write against an untested API — run it first, verify flags/output/error shapes.
- Validate after every external call: exit 0? non-empty? parses? values sane? Abort loudly otherwise.
- Scripts that drive agents are amplifiers — every bug is multiplied by every iteration.

## Subagent delegation
Subagents see only the prompt you write — no conversation, no CLAUDE.md. Put every user requirement in every prompt, in their words; include bad-output examples; include a verifiable acceptance criterion; read the actual artifact, not the subagent's summary.

## Git workflow (before any code work)
Clean tree → `checkout master` → `branch -u origin/master` → `pull --rebase` →
**HARD GATE: 0 ahead / 0 behind, or STOP and report.** Then branch, do work,
`pull --rebase` periodically, open a PR. Never push directly to master.

## Ticket lifecycle
You own ticket state. Done = validated against reality + reviews addressed + nothing deferred + docs updated + merged. "Code written and tests pass" is not done.

## Commit & PR follow-up
Commit completed work as its own commit. The moment a PR opens, invoke `/address-pr-reviews`.

---

> **The motivating philosophy — the full "types are the program" manifesto, the
> intrinsic-vs-carrying-cost argument, and the on-conditionals worked example —
> lives in the `design-mindset` skill. The laws above are self-sufficient for
> daily work; read the skill when you want the deep reasoning or are stuck on a
> hard design call.**
