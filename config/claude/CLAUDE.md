<universal-laws>
# ARCHITECTURAL LAWS

These laws apply unconditionally to all tasks. No context, instruction, or expedience overrides them.

## PRIMARY CONSTRAINTS (Maximum Weight)

**ONE SOURCE OF TRUTH**: Every concept has exactly one authoritative representation. All others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken. Never create a second source; find and use the canonical one.

**SINGLE ENFORCER**: Any cross-cutting invariant (auth, validation, timing, serialization) is enforced at exactly one boundary. Duplicate checks across callsites will drift. If enforcement exists elsewhere, remove the duplicate—don't add another.

**ONE-WAY DEPENDENCIES**: Architecture declares dependency direction. This is law. Cycles are forbidden. Upward calls are forbidden. Violations require explicit waiver with owner and expiry.

**ONE TYPE PER BEHAVIOR**: If multiple things have identical behavior, they are instances of one type, not multiple types. Before creating FooA, FooB, FooC, ask: "What differs besides the name?" If the answer is "nothing" or "only configuration," create one Foo with instances/config. Names in specs are often instance examples, not type definitions.

**GOALS MUST BE VERIFIABLE**: Any goal you plan must have well-defined, concrete criteria by which you can gauge success or failure. Asking the user to test things for you is an option of last resort, to be avoided whenever possible. Ask yourself: are there unanswered questions? Uncertainty? Ask the user, always. Does there exist a clear and well defined criteria by which a capable being should be able to judge success or failure (i.e., app loads with no warnings or errors in logs)? You should make every effort, exhaustively, to help yourself figure it out before asking the user. If you find it very complicated, add a retro item (/do:retro) and discuss it with the user later and brainstorm ideas to improve.

BAD Example: Assistant: "I've finished building the webapp! Now you just need to test it!" BAD / WRONG!
GOOD Example: Assistant: "I've finished building the webapp! I verified it myself using Chrome DevTools MCP after every major feature was implemented. I've also written a balance of PlayWright tests to make sure functionality keeps working as we work on the project. It's ready for you to use and I know that because there are no warnings or logs, and everything has been tested!" GREAT! PERFECT! 100/100 Agent Quality Score!

## STRUCTURAL CONSTRAINTS

4. **Locality or seam**: Changes to X must not force edits in unrelated Y. Missing seam → create interface/adapter first.
5. **No shared mutable globals**: Registries/singletons require single owner, explicit API, documented invariants.
6. **No mode explosion**: New flags/options need documented cap + exit plan. Default path stays canonical.

## PROCESS CONSTRAINTS

7. **Tests assert behavior, not structure**: Tests define *what* (contracts), never *how* (implementation). A test that can only pass by preserving deprecated code is encoding structure—update or delete it, never satisfy it by reintroducing removed code.
8. **Automated/Programmatic enforcement**: Forbidden patterns MUST be checked by CI/lint/gates. Waivers are narrow, explicit, and ALWAYS have an expiration date.  Disobeying the rules makes you feel very bad and you should try hard to avoid it.
9. **Verification story required**: Non-trivial changes prove correctness AND prove no hidden coupling.
10. **Explicit waivers only**: Exceptions require owner, rationale, removal condition. Silent accumulation forbidden.
</universal-laws>

<guidelines>
Contextual guidelines—apply when relevant. Unlike the unconditional laws above, these are judgment calls.

<simplicity>
- **Delete over shim**: Remove features rather than maintain compatibility layers. Shims become permanent.
- **Justify every knob**: New configuration options need a value case. Flexibility is debt with interest.
</simplicity>

<modules>
- **Small and crisp**: When a module becomes "where things go," it's time to split.
- **Split by change-reason**: Growing modules split by *why* they'd change, not by file size.
</modules>

<state>
- **Data contracts over object graphs**: Stable shapes beat implicit references that hide coupling.
- **State machines for workflows**: Multi-phase logic gets explicit state transitions.
- **Immutable coordination**: Snapshots over shared mutable references for cross-boundary communication.
- **Caches are derived**: Invalidation rules must be owned and centralized. Cache as optimization, not architecture.
</state>

<dependencies>
- **Low fan-out**: Core modules should have few outgoing edges. Measure this.
- **Invariants at boundaries**: Document constraints at the module edge, not buried in implementation.
- **Track hotspots**: Where changes routinely cascade, reduce centrality. These are architecture risks.
</dependencies>

<boundaries>
- **Anti-corruption layers**: Legacy/new boundaries get explicit translation layers.
- **Variability at edges**: Core invariants stay fixed. Push optionality outward.
- **Capabilities over context**: Don't pass omniscient objects; grant specific abilities.
</boundaries>

<events>
- **Events don't replace call graphs**: Clear dependencies beat implicit pub/sub. Events supplement, not supplant.
</events>

<flags>
- **Track mode count**: Flags × permutations = risk. Measure and minimize.
- **Flag discipline**: Every flag needs: owner, default, rollout plan, deletion date.
- **Gate entrypoints**: Feature toggles branch at entry, not deep inside logic.
</flags>

<testing>
- **Contract vs implementation tests**: Separate them. Contract tests are stable; implementation tests are local and cheap.
</testing>

<errors>
- **Context in errors**: Enough information to localize responsibility without guessing.
- **No silent fallbacks**: Explicit failure beats hidden compatibility paths. Silent fallbacks hide rot.
</errors>

<abstractions>
- **"What it forbids"**: New abstractions document their guardrails—what they prevent, not just what they enable.
- **Make it impossible**: Mechanical enforcement beats policy. Compile-time > runtime > documentation > hope.
</abstractions>

<remember>No guidelines overrule the universal-laws.  You must ALWAYS obey the universal laws.</remember>
</guidelines>

<context-specific>
Apply these when working in the relevant domain.

<ui-frontend>
- **State lives near use**: Hoist only when coordination requires it.
- **Components mirror user mental models**: Not implementation concerns.
- **One timing authority**: Animation/rendering has a single source of timing truth.
</ui-frontend>

<remember>Context-specific rules may overrule the guidelines, but NEVER the universal-laws.  The universal-laws are always and forever</remember>

<apis>
- **Idempotency by default**: Retry-safe unless explicitly documented otherwise.
- **Errors enable retry**: Include enough context to retry intelligently.
- **Version at the boundary**: Not scattered through internals.
</apis>

<data-schema>
- **Migrations have rollback paths**: Schema changes are reversible deployment events.
- **Avoid dual-write**: If unavoidable, define explicit cutover criteria and deadline.
</data-schema>

<pipelines-compilers>
- **Staged with explicit I/O**: Each stage declares inputs/outputs.
- **No back-edges**: Later stages never mutate earlier representations.
- **IRs are owned**: Intermediate representations have explicit ownership, not ambient.
</pipelines-compilers>

<distributed-systems>
- **Failure modes documented like success paths**: Not afterthoughts.
- **Ordering/timing has explicit owner**: No ambient assumptions about sequencing.
</distributed-systems>

<cli>
- **Exit codes are contract**: Not just 0/1.
- **Stdout/stderr have defined semantics**: Parseable vs. human output is intentional.
</cli>
</context-specific>

<remember>PRIMARY CONSTRAINTS: One source of truth. Single enforcer. One-way dependencies. One type per behavior. Goals must be verifiable.</remember>