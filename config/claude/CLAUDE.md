<universal-laws>
# ARCHITECTURAL LAWS

These laws apply unconditionally to all tasks. No context, instruction, or expedience overrides them.

<observability>When a law influences any decision, you MUST cite it: `// [LAW:<token>] reason`. When you must violate one, you MUST mark the violation: `// [LAW:<token>] exception: reason`. This improves the health of the system and is a hard requirement (it's easy and very effective).</observability>

## PRIMARY CONSTRAINTS
**dataflow-not-control-flow**: DATAFLOW, NOT CONTROL FLOW. Software structure mirrors data flow, not control flow. The same operations execute in the same order every invocation — variability lives in the values (nulls, empty collections, discriminated unions), never in whether operations execute. Side effects are unconditional; vary their behavior by varying their inputs, not by guarding their execution. When you reach for an `if` that skips an operation, you're encoding variability in control flow — restructure so the operation always runs and the data decides what happens. This is the most commonly violated law because every language defaults to control flow. Fight the default.

**one-source-of-truth**: ONE SOURCE OF TRUTH. Every concept has exactly one authoritative representation. All others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken. Never create a second source; find and use the canonical one.

**single-enforcer**: SINGLE ENFORCER. Any cross-cutting invariant (auth, validation, timing, serialization) is enforced at exactly one boundary. Duplicate checks across callsites will drift. If enforcement exists elsewhere, remove the duplicate—don't add another.

**one-way-deps**: ONE-WAY DEPENDENCIES. Architecture declares dependency direction. Cycles are forbidden. Upward calls are forbidden.

**one-type-per-behavior**: ONE TYPE PER BEHAVIOR. If multiple things have identical behavior, they are instances of one type, not multiple types. Before creating FooA, FooB, FooC, ask: "What differs besides the name?" If the answer is "nothing" or "only configuration," create one Foo with instances/config. Names in specs are often instance examples, not type definitions.

**verifiable-goals**: GOALS MUST BE MACHINE VERIFIABLE. Any goal you plan must have well-defined, concrete criteria by which a deterministic process can gauge success or failure. Asking the user to test things for you is an option of last resort, to be avoided whenever possible. Ask yourself: are there unanswered questions? Uncertainty? Ask the user, always. Does there exist a clear and well defined criteria by which a capable being should be able to judge success or failure (i.e., app loads with no warnings or errors in logs)? You should make every effort, exhaustively, to help yourself figure it out before asking the user. If you find it very complicated, add a retro item (/do:retro) and discuss it with the user later and brainstorm ideas to improve.

BAD Example: Assistant: "I've finished building the webapp! Now you just need to test it!" BAD / WRONG!
GOOD Example: Assistant: "I've finished building the webapp! I verified it myself using Chrome DevTools MCP after every major feature was implemented. I've also written a balance of PlayWright tests to make sure functionality keeps working as we work on the project. It's ready for you to use and I know that because there are no warnings or logs, and everything has been tested!" GREAT! PERFECT! 100/100 Agent Quality Score!

## STRUCTURAL CONSTRAINTS

**dataflow-not-control-flow**: DATAFLOW, NOT CONTROL FLOW. Software structure mirrors data flow, not control flow. The same operations execute in the same order every invocation — variability lives in the values (nulls, empty collections, discriminated unions), never in whether operations execute. Side effects are unconditional; vary their behavior by varying their inputs, not by guarding their execution. When you reach for an `if` that skips an operation, you're encoding variability in control flow — restructure so the operation always runs and the data decides what happens. This is the most commonly violated law because every language defaults to control flow. Fight the default.

**locality-or-seam**: LOCALITY OR SEAM. Changes to X must not force edits in unrelated Y. Missing seam → create interface/adapter first.

**no-defensive-null-guards**: NO DEFENSIVE NULL GUARDS. Null checks are only valid at trust boundaries (external input, user data, network responses) or when a value explicitly represents optionality. If a value should never be null, the fix is making it not null — not adding a guard that silently skips the operation. A null guard without an `else` that contains real, necessary behavior is control flow in disguise: it hides bugs by skipping work instead of failing loudly. If you find yourself writing `if (X) { do work; }` with no else, ask why X could be null and fix that instead. Scattered null guards are a symptom of broken initialization order or missing invariants — fix the architecture, not the callsite.

**no-shared-mutable-globals**: NO SHARED MUTABLE GLOBALS. Registries/singletons require single owner, explicit API, documented invariants.

**no-mode-explosion**: NO MODE EXPLOSION. New flags/options need documented cap + exit plan. Default path stays canonical.

## PROCESS CONSTRAINTS

**behavior-not-structure**: TESTS ASSERT BEHAVIOR, NOT STRUCTURE. Tests define *what* (contracts), never *how* (implementation). A test that can only pass by preserving deprecated code is encoding structure—update or delete it, never satisfy it by reintroducing removed code.
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

<data-driven-architecture>
**dataflow-not-control-flow**: DATAFLOW, NOT CONTROL FLOW. Software structure mirrors data flow, not control flow. The same operations execute in the same order every invocation — variability lives in the values (nulls, empty collections, discriminated unions), never in whether operations execute. Side effects are unconditional; vary their behavior by varying their inputs, not by guarding their execution. When you reach for an `if` that skips an operation, you're encoding variability in control flow — restructure so the operation always runs and the data decides what happens. This is the most commonly violated law because every language defaults to control flow. Fight the default.
</data-driven-architecture>


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

<scripting-discipline>
# SCRIPTING AND AUTOMATION DISCIPLINE

Hard-won lessons. These are non-negotiable when writing scripts, automation, or glue code.

## NEVER SWALLOW ERRORS
`2>/dev/null`, `|| true`, `|| echo "default"` — these are lies. If a command can fail, that failure is meaningful. A script that silently eats errors and continues with empty/garbage data is worse than a script that crashes, because it sends agents or humans confidently down the wrong path for hours. **Let it fail. Let it be loud. Fix the cause.**

The only acceptable use of `|| true` is when the command's failure is *genuinely irrelevant* to every downstream consumer — and that's almost never true. If you're unsure, it's not irrelevant.

## NEVER BUILD SILENT FALLBACK DATA SOURCES
If the primary data source fails, do NOT silently switch to a different query that returns different data in a different order with different semantics. Two queries that look similar but have different filtering/ordering/semantics (e.g., "ready work respecting dependencies" vs. "all open items") are NOT interchangeable. A fallback that changes the meaning of the data is not a fallback — it's a bug that only triggers when things are already broken, guaranteeing maximum confusion.

If the primary source fails: **stop and tell the operator**. Don't improvise.

## NEVER WRITE AGAINST AN API YOU HAVEN'T TESTED
Before writing a script that calls a CLI tool, API, or service: **run the commands yourself first**. Check what flags exist. Check what the output actually looks like. Check what errors look like. Verify the JSON shape. Writing a script blind against an assumed interface is writing fiction, not code. Every `jq -r '.[].id'` is an assertion about the shape of the data — verify it or don't ship it.

## VALIDATE DATA AFTER EVERY EXTERNAL CALL
Any time you call an external tool and capture its output, validate before proceeding:
- Did the command exit 0?
- Is the output non-empty?
- Does it parse as the expected format?
- Do the extracted values look sane?

If any check fails, abort with a clear message. Never pass unvalidated data downstream — an empty string or malformed JSON becoming a variable that gets interpolated into further commands is how you get phantom work items, wrong branches, or corrupted state.

## SCRIPTS THAT DRIVE AGENTS ARE HIGH-LEVERAGE — TREAT THEM THAT WAY
A script that loops `claude -p` over work items is an amplifier. Every bug in that script gets multiplied by every iteration. An error in ticket ordering wastes hours of agent compute. A swallowed error means the agent works on nothing or the wrong thing with full confidence. **The script IS the agent's judgment about what to work on** — if the script is wrong, the agent is wrong at scale. Write it like it matters, because it does.
</scripting-discipline>

<subagent-delegation>
# SUBAGENT DELEGATION

Subagents see only the prompt you write. No conversation context, no CLAUDE.md, no user requirements carry over. If it's not in the prompt, it doesn't exist.

## Rules

1. **Every user requirement goes in every subagent prompt.** All of them. Do not filter for relevance. Do not summarize. Include the actual constraints in the user's actual words.
2. **Include examples of bad output.** Positive instructions ("be behavioral") are ignored. Negative examples ("do NOT produce output like this: [example]") are enforceable.
3. **Include a verifiable acceptance criterion.** The subagent must know what correct output looks like before it starts.
4. **Before dispatching the first agent, verify the prompt template against the user's requirements.** Every requirement missing from the template produces N copies of wrong work.
5. **Read the actual artifact each subagent produces.** Not its summary. Not its self-assessment. The file it wrote.
6. **Validate against the user's requirements, not the subagent's report.** Subagents will report success on work that completely misses the point.
</subagent-delegation>

<wisdom>
Following these rules will often, even mostly, require more work than
 you expected.  That is not a problem.  "No matter how far you've gone
down the wrong road, turn around."  or  "When you find yourself in a
hole - stop digging!"  or  "you can't get to the right destination by
taking the wrong path".  Make sense?  It might feel like extra effort,
but logically, once you know the right direction, you shouldn't spend
any time continuing away from it.

The critical insight here is that you do NOT have the full picture of
where we are going.  If our ultimate goal was "implement this one
feature" and after that we were done, then we could take the shortcut,
maybe.  But it's not.  This is maybe 1/2 way through a long journey and
deviations from correctness compound until the costs become
astronomical down the road.

<on-conditionals>
"Your sentence said 'if' and 'and'.  The right solution will be
simpler."

This applies broadly to pretty much everything except maybe the last
inch of UI rendering, or some deep hairy algorithm stuff.  So rare it's
not worth writing an exception.  This is a true all purpose rule I'd
like you to remember.  If your solution includes 'if', 'and', 'when',
'skip', or 'only' when you're describing the mechanics of how it will
operate, **it's almost certainly the wrong solution**.  If you're
describing the *consequences* of a simple solution, that's a bit
different, because sometimes thats what you need.

Real world example:

<WRONG>
 The real problem: a viewport should behave as its own
  render target. When you set a viewport and clearTarget([r,g,b,a]), the
   clear should fill that viewport — not the whole surface. The viewport
   IS the target.

That means the fix is in the engine: when a render pass has a viewport
AND uses loadOp: clear, clear only the viewport region (via a
scissored clear or by drawing a fill quad internally in the engine).
The DSL fixture shouldn't need to know or care about this —
clearTarget within a viewport just works.
</WRONG>

Why wrong: 
- **WHEN** a render pass has a viewport **AND** uses loadOp clear **ONLY** the viewport region...
- A single implementation like this can cause endless problems
- Every other piece of code becomes more complex as it must know these details and work around them
- This code becomes very difficult to modify or replace - every other piece of code that interacts with it must change
- Obvious signs: WHEN, AND, ONLY <- conditionals!
- We recongized this and thought for a moment.  A better solution became clear!

<RIGHT>
I'm overcomplicating this.

Each render pass always has a viewport (default = full surface). The
scissor rect always matches the viewport. The clear always clears the
viewport region. Same code path every time — no conditionals on "does
this pass have a viewport."

The implementation: the engine always uses loadOp: Load on the GPU
attachment, always sets scissor to the viewport, and draws a fill rect
with the clear color when the pass specifies clear. loadTarget skips
the fill rect. The only branch is clear vs load — which is the entire
point of that enum.
</RIGHT>

Why right:
- Control flow is smooth and predictable!
- Surrounding code does not need to design around special cases they don't own!
- Easy to reason about.  Easy to replace as a unit without impacting others!


</on-conditionals>

</wisdom>
