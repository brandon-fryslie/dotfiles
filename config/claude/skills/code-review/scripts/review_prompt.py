#!/usr/bin/env python3
"""Print the prompt Claude Code's built-in /code-review gives its review agent.

A faithful port of the built-in's prompt builder (Claude Code 2.1.299), so the review can be changed
here. The arguments come on stdin, exactly as typed after /code-review. The text blocks below are the
bundle's own, and the prompt templates are catalogued at
https://github.com/Piebald-AI/claude-code-system-prompts (system-prompts/*code-review*).
"""
import argparse
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Callable, Literal

DIFF_GATHERING_PHASE = """\
## Phase 0 — Gather the diff

Run `git diff @{upstream}...HEAD` (or `git diff main...HEAD` / `git diff HEAD~1`
if there's no upstream) to get the unified diff under review. If there are
uncommitted changes, or the range diff is empty, also run `git diff HEAD` and
include the working-tree changes in scope — the review often runs before the
commit. If a PR number, branch name, or file path was passed as an argument,
review that target instead. Treat this diff as the review scope.
"""

CORRECTNESS_ANGLES = """\
### Angle A — line-by-line diff scan

Read every hunk in the diff, line by line. Then Read the enclosing function for
each hunk — bugs in unchanged lines of a touched function are in scope (the PR
re-exposes or fails to fix them). For every line ask: what input, state, timing,
or platform makes this line wrong? Look for inverted/wrong conditions,
off-by-one, null/undefined deref, missing `await`, falsy-zero checks,
wrong-variable copy-paste, error swallowed in catch, unescaped regex metachars.

### Angle B — removed-behavior auditor

For every line the diff DELETES or replaces, name the invariant or behavior it
enforced, then search the new code for where that invariant is re-established.
If you can't find it, that's a candidate: a removed guard, a dropped error
path, a narrowed validation, a deleted test that was covering a real case.

### Angle C — cross-file tracer

For each function the diff changes, find its callers (Grep for the symbol) and
check whether the change breaks any call site: a new precondition, a changed
return shape, a new exception, a timing/ordering dependency. Also check callees:
does a parallel change in the same PR make a call unsafe?
"""

LANGUAGE_PITFALL_ANGLE = """\
### Angle D — language-pitfall specialist

Scan for the classic pitfalls of the diff's language/framework — for example:
JS falsy-zero, `==` coercion, closure-captured loop var; Python mutable default
args, late-binding closures; Go nil-map write, range-var capture; SQL injection;
timezone/DST drift; float equality. Flag any instance the diff introduces.
"""

WRAPPER_PROXY_ANGLE = """\
### Angle E — wrapper/proxy correctness

When the PR adds or modifies a type that wraps another (cache, proxy, decorator,
adapter): check that every method routes to the wrapped instance and not back
through a registry/session/global — e.g. a caching provider holding a
`delegate` field that resolves IDs via `session.get(...)` instead of
`delegate.get(...)` will re-enter the cache or recurse. Also check that the
wrapper forwards all the methods the callers actually use.
"""

REUSE_ANGLE = """\
### Reuse

The angles above hunt for bugs; this one and the next two hunt for cleanup in
the changed code. Flag new code that re-implements something the codebase
already has — Grep shared/utility modules and files adjacent to the change,
and name the existing helper to call instead.
"""

SIMPLIFICATION_ANGLE = """\
### Simplification

Flag unnecessary complexity the diff adds: redundant or derivable state,
copy-paste with slight variation, deep nesting, dead code left behind. Name
the simpler form that does the same job.
"""

EFFICIENCY_ANGLE = """\
### Efficiency

Flag wasted work the diff introduces: redundant computation or repeated I/O,
independent operations run sequentially, blocking work added to startup or
hot paths. Also flag long-lived objects built from closures or captured
environments — they keep the entire enclosing scope alive for the object's
lifetime (a memory leak when that scope holds large values); prefer a
class/struct that copies only the fields it needs. Name the cheaper
alternative.
"""

ALTITUDE_ANGLE = """\
### Altitude

Check that each change fixes the root cause at the right depth rather than
patching a symptom with a fragile bandaid. Special cases layered on shared
infrastructure are a sign the fix isn't deep enough — prefer the simpler, more
general change to the underlying mechanism over adding special cases, and name
that change.
"""

CONVENTIONS_ANGLE = """\
### Conventions (CLAUDE.md)

Find the CLAUDE.md files that govern the changed code: the user-level
~/.claude/CLAUDE.md, the repo-root CLAUDE.md, plus any CLAUDE.md or
CLAUDE.local.md in a directory that is an ancestor of a changed file (a
directory's CLAUDE.md only applies to files at or below it). Read each one
that exists, then check the diff for clear violations of the rules they state.

Only flag a violation when you can quote the exact rule and the exact line
that breaks it — no style preferences, no vague "spirit of the doc"
inferences. In the finding, name the CLAUDE.md path and quote the rule so the
report can cite it. If no CLAUDE.md applies, return nothing for this angle.
"""

CLEANUP_CANDIDATES_NOTE = """\
Cleanup, altitude, and conventions candidates use the same
`file`/`line`/`summary` shape; in `failure_scenario`, state the concrete
cost (what is duplicated, wasted, harder to maintain, or which CLAUDE.md rule
is broken) instead of a crash. Correctness bugs always outrank cleanup,
altitude, and conventions findings when the output cap forces a cut.
"""

AGENT_FALLBACK_SENTENCE = """\
If the Agent tool is not available in your current tool set, do not error — perform each angle (and each verification) yourself, sequentially, in this context."""

NO_AGENT_NOTE = """\
The Agent tool isn't available in this context, so the usual
multi-agent fan-out and subagent verify pass can't run. Work through every
angle below yourself, in this same context, in one pass — do not skip angles
for lack of fan-out. Re-check each candidate against the diff before keeping
it; drop anything you can't back up with a concrete failure scenario.
"""

NO_AGENT_DISCLOSURE = """\

State clearly in your summary that this was a single-pass review done without
the Agent tool, not the full multi-agent fan-out, so whoever reads
it isn't misled about what actually ran.
"""

THREE_STATE_VERIFY_PHASE = """\
## Phase 2 — Verify (1-vote, 3-state)

Dedup candidates that point at the same line/mechanism, keeping the one with
the most concrete failure scenario. For each remaining candidate, run **one
verifier** via the Agent tool: give it the diff, the relevant
file(s), and the candidate, and have it return exactly one of:

- **CONFIRMED** — can name the inputs/state that trigger it and the wrong
  output or crash. Quote the line.
- **PLAUSIBLE** — mechanism is real, trigger is uncertain (timing, env,
  config). State what would confirm it.
- **REFUTED** — factually wrong (code doesn't say that) or guarded elsewhere.
  Quote the line that proves it.

Keep candidates where the vote is CONFIRMED or PLAUSIBLE.
"""

RECALL_BIASED_VERIFY_PHASE = """\
## Phase 2 — Verify (1-vote, recall-biased)

Dedup near-duplicates (same defect, same location, same reason → keep one). For
each remaining candidate, run **one verifier** via the Agent tool:
give it the diff, the relevant file(s), and the candidate; it returns exactly
one of **CONFIRMED / PLAUSIBLE / REFUTED**.

**PLAUSIBLE by default** — do not refute a candidate for being "speculative" or
"depends on runtime state" when the state is realistic: concurrency races,
nil/undefined on a rare-but-reachable path (error handler, cold cache, missing
optional field), falsy-zero treated as missing, off-by-one on a boundary the
code does not exclude, retry storms / partial failures, regex/allowlist that
lost an anchor. These are PLAUSIBLE.

**REFUTED** only when constructible from the code: factually wrong (quote the
actual line); provably impossible (type/constant/invariant — show it); already
handled in this diff (cite the guard); or pure style with no observable effect.

Keep **CONFIRMED and PLAUSIBLE**. Drop REFUTED.
"""

GAP_SWEEP_PHASE = """\
## Phase 3 — Sweep for gaps

Run **one more finder** as a fresh reviewer who has the verified list. Re-read
the diff and enclosing functions looking ONLY for defects not already listed.
Do not re-derive or re-confirm anything already there — the job is gaps. Focus
on what the first pass tends to miss: moved/extracted code that dropped a guard
or anchor; second-tier footguns (dataclass default evaluated once, `hash()`
non-determinism, lock-scope shrink, predicate methods with side effects);
setup/teardown asymmetry in tests; config defaults flipped.

Surface **up to 8 additional candidates**, each naming a defect not already on
the list. If nothing new, return an empty sweep — do not pad.
"""

SWEEP_FOCUS = """\
moved/extracted code that dropped a guard
or anchor; second-tier footguns (dataclass default evaluated once, `hash()`
non-determinism, lock-scope shrink, predicate methods with side effects);
setup/teardown asymmetry in tests; config defaults flipped."""

GITHUB_COMMENT_POSTING = """\


## Posting to GitHub (--comment)

The `--comment` flag was passed. After producing the findings list, if the
review target is a GitHub PR, post each finding as an inline PR comment via
`mcp__github_inline_comment__create_inline_comment` (one call per finding;
include a suggestion block only when it fully fixes the issue). If that tool
is not available in this session, fall back to `gh api` (repos/{owner}/{repo}/pulls/{pr}/comments)
or print the findings instead. If the target is not a PR, print the findings
to the terminal and note that `--comment` was ignored.
"""



# Finder-angle blocks, composed exactly as the bundle composes them.
EXTENDED_CORRECTNESS_ANGLES = "\n".join([CORRECTNESS_ANGLES, LANGUAGE_PITFALL_ANGLE, WRAPPER_PROXY_ANGLE])
BASE_FINDER_ANGLES = "\n".join([CORRECTNESS_ANGLES, REUSE_ANGLE, SIMPLIFICATION_ANGLE, EFFICIENCY_ANGLE, ALTITUDE_ANGLE, CONVENTIONS_ANGLE])
EXTENDED_FINDER_ANGLES = "\n".join([EXTENDED_CORRECTNESS_ANGLES, REUSE_ANGLE, SIMPLIFICATION_ANGLE, EFFICIENCY_ANGLE, ALTITUDE_ANGLE, CONVENTIONS_ANGLE])

LEVELS = ("low", "medium", "high", "xhigh", "max")
REPORT_CAP = 32

Cap = int | Literal["all"]


def plural(n: Cap, one: str, many: str | None = None) -> str:
    return one if n == 1 else (many or one + "s")


def findings_label(cap: Cap) -> str:
    return "all findings" if cap == "all" else f"≤{cap} {plural(cap, 'finding')}"


def findings_phrase(cap: Cap) -> str:
    return "**every finding**" if cap == "all" else f"at most **{cap} {plural(cap, 'finding')}**"


def json_output(cap: Cap) -> str:
    size = "with one object for every finding that survives, no maximum" if cap == "all" else f"of at most {cap} {plural(cap, 'object')}"
    keep = "Keep every finding that survives. There is no maximum." if cap == "all" else f"If more than {cap} survive, keep the {cap} most\nsevere."
    return f"""\
## Output

Return findings as a JSON array {size}:

```json
[
  {{
    "file": "path/to/file.ext",
    "line": 123,
    "summary": "one-sentence statement of the bug",
    "failure_scenario": "concrete inputs/state → wrong output/crash"
  }}
]
```

Ranked most-severe first. {keep} If nothing survives verification, return `[]`. Do not call the
ReportFindings tool even if it is available - this review's
output contract is the JSON block above.
"""


def with_minimum(cap: Cap, ceiling: int) -> str:
    """The JSON output with a floor of half the cap, for the inline dedup-only recipes."""
    floor = max(1, min(cap if cap != "all" else ceiling, ceiling) // 2)
    target = f"## Output\n\nTarget **at least {floor} {plural(floor, 'finding')}**. If fewer genuine findings exist, emit what you have — do not invent to hit the floor.\n"
    return json_output(cap).replace("## Output\n", target, 1).replace("nothing survives verification", "nothing survives")


HUNK_FINDINGS = """\
## Turn 2 — findings

Flag runtime-correctness bugs visible from the hunk alone: inverted/wrong
condition, off-by-one, null/undefined deref where adjacent lines show the value
can be absent, removed guard, falsy-zero check, missing `await`,
wrong-variable copy-paste, error swallowed in a catch that should propagate.
Also flag — still from the hunk alone — new code that duplicates an existing
helper visible in the diff context, and dead code the diff leaves behind.

Do **not** flag style, naming, perf, missing tests, or anything outside the
hunk.
"""

READ_DIFF_SKIPPING_TESTS = """\
## Turn 1 — read

One tool call: read the unified diff (`git diff @{upstream}...HEAD; git diff HEAD`
to cover both committed and uncommitted changes, or `git diff main...HEAD` /
the target passed as an argument). Skip test/fixture
hunks (`test/`, `spec/`, `__tests__/`, `*_test.*`, `*.test.*`,
`fixtures/`, `testdata/`) — test-file changes are not reviewed at this level.
No subagents, no full-file reads.
"""


def low(cap: Cap | None) -> str:
    cap = 4 if cap is None else cap
    return f"""\
`low effort → 1 diff pass → no verify → {findings_label(cap)}`

{READ_DIFF_SKIPPING_TESTS}
{HUNK_FINDINGS}
Output {findings_phrase(cap)}, most-severe first, one line each:
`path/to/file.ext:123 — what's wrong and the concrete failure`. If nothing
qualifies, output exactly `(none)`. Do not call the
ReportFindings tool even if it is available.
"""


def low_minimum_findings() -> str:
    return f"""\
`low effort → 1 diff pass → no verify → ≥min(files,4) findings`

{READ_DIFF_SKIPPING_TESTS}
{HUNK_FINDINGS}
Target **min(files_changed, 4) findings**, most-severe first, one
line each: `path/to/file.ext:123 — what's wrong and the concrete failure`.
If you have fewer, do one more pass focused on the largest changed file
and on any **removed** code blocks. Output `(none)` only if the diff is
trivially correct after that pass.
"""


def low_widening(cap: Cap | None) -> str:
    cap = 8 if cap is None else cap
    floor = 4 if cap == "all" else min(4, cap)
    return f"""\
`low effort → 1 diff pass → no verify → {findings_label(cap)}`

## Turn 1 — read

One tool call: read the unified diff (`git diff @{{upstream}}...HEAD; git diff HEAD`
to cover both committed and uncommitted changes, or `git diff main...HEAD` /
the target passed as an argument). No subagents, no full-file reads.

{HUNK_FINDINGS}
Output {findings_phrase(cap)}, most-severe first, one line each:
`path/to/file.ext:123 — what's wrong and the concrete failure`.
Target at least min(files_changed, {floor}) findings — if you see fewer, widen to other hunks in the same diff before stopping. If fewer than {floor} genuine findings exist, emit what you have.
"""


def inline_eight_angles(summary: str, lead_in: str, default_cap: int) -> Callable[[Cap | None], str]:
    def prompt(cap: Cap | None) -> str:
        cap = default_cap if cap is None else cap
        return f"""\
`{summary} → {findings_label(cap)}`

{lead_in}

{DIFF_GATHERING_PHASE}
## Phase 1 — Find candidates (3 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 6 each)

Run **8 independent finder angles** in sequence yourself, in THIS context — do NOT spawn subagents for them. Each
surfaces **up to 6 candidate findings** with `file`, `line`, a one-line
`summary`, and a concrete `failure_scenario`.

{CORRECTNESS_ANGLES}
{REUSE_ANGLE}
{SIMPLIFICATION_ANGLE}
{EFFICIENCY_ANGLE}
{ALTITUDE_ANGLE}
{CONVENTIONS_ANGLE}
{CLEANUP_CANDIDATES_NOTE}
Pass every candidate with a nameable failure scenario through — finders that
silently drop half-believed candidates are the dominant cause of misses.

## Phase 2 — Dedup only (no verify)

Pool all candidates. Dedup near-duplicates only (same defect, same location, same reason → keep one). Do NOT run verifiers; do NOT re-judge. Sort by severity.

{with_minimum(cap, default_cap)}"""
    return prompt


inline_medium = inline_eight_angles(
    "medium effort → 8 inline angles → dedup (no verify)",
    """You are reviewing for **correctness bugs**: surface every plausible bug. At this
level, catching real bugs matters more than avoiding false positives — err on
the side of surfacing.""",
    8,
)

inline_high = inline_eight_angles(
    "high effort → 8 inline angles → dedup (no verify)",
    """You are reviewing for **recall** at high effort: catch every real bug a careful
reviewer would catch in one sitting. At this level, catching real bugs matters
more than avoiding false positives. Err on the side of surfacing.""",
    10,
)


def inline_xhigh(cap: Cap | None) -> str:
    cap = 15 if cap is None else cap
    return f"""\
`xhigh effort → 10 inline angles → dedup (no verify) → sweep → {findings_label(cap)}`

You are reviewing for **recall** at extra-high effort: catch every real bug. At
this level, catching real bugs matters more than avoiding false positives — a
missed bug ships. Err on the side of surfacing.

{DIFF_GATHERING_PHASE}
## Phase 1 — Find candidates (5 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 8 each)

Run **10 independent finder angles** in sequence yourself, in THIS context — do NOT spawn subagents for them. Each
surfaces **up to 8 candidate findings**. Do NOT let one angle's conclusions
suppress another's — if two angles flag the same line for different reasons,
record both.

{CORRECTNESS_ANGLES}
{LANGUAGE_PITFALL_ANGLE}
{WRAPPER_PROXY_ANGLE}
{REUSE_ANGLE}
{SIMPLIFICATION_ANGLE}
{EFFICIENCY_ANGLE}
{ALTITUDE_ANGLE}
{CONVENTIONS_ANGLE}
{CLEANUP_CANDIDATES_NOTE}
## Phase 2 — Dedup only (no verify)

Pool all candidates. Dedup near-duplicates only (same defect, same location, same reason → keep one). Do NOT run verifiers; do NOT re-judge. Sort by severity. Do NOT drop on uncertainty.

## Phase 3 — Sweep for gaps

Take one more pass (same context — no subagent) as a fresh reviewer who has the deduplicated list. Re-read
the diff and enclosing functions looking ONLY for defects not already listed.
Do not re-derive or re-confirm anything already there — the job is gaps. Focus
on what the first pass tends to miss: moved/extracted code that dropped a guard
or anchor; second-tier footguns (dataclass default evaluated once, `hash()`
non-determinism, lock-scope shrink, predicate methods with side effects);
setup/teardown asymmetry in tests; config defaults flipped.

Surface **up to 8 additional candidates**, each naming a defect not already on
the list. If nothing new, return nothing from this phase — do not pad.

{with_minimum(cap, 15)}"""


def single_pass_without_agent(tag: str, lead_in: str, angle_count: int, angles: str, cap: Cap, sweep: bool) -> str:
    """The fallback every agent recipe takes when the Agent tool is missing: one pass, in this context."""
    sweep_phase = f"""
## Phase 3 — Sweep for gaps

Take one more pass yourself (same context, no subagent) as a fresh reviewer
who has the deduplicated list. Re-read the diff and enclosing functions
looking ONLY for defects not already listed: {SWEEP_FOCUS}
""" if sweep else ""
    return f"""\
`{tag}`

{lead_in}

{NO_AGENT_NOTE}
{DIFF_GATHERING_PHASE}## Phase 1 — Find candidates ({angle_count} angles, single pass)

Work through **{angle_count} angles** yourself, in sequence, in this same
context — do not spawn subagents. Each surfaces candidate findings with
`file`, `line`, a one-line `summary`, and a concrete `failure_scenario`.

{angles}
{CLEANUP_CANDIDATES_NOTE}
## Phase 2 — Dedup and self-check (no subagent verify)

Dedup near-duplicates (same defect, same location, same reason → keep one).
Re-check each remaining candidate yourself against the diff before keeping it.
{sweep_phase}
{json_output(cap)}{NO_AGENT_DISCLOSURE}"""


MEDIUM_LEAD_IN = """You are reviewing for **precision** at medium effort: every finding you surface
should be one a maintainer would act on."""

HIGH_LEAD_IN = """You are reviewing for **recall** at high effort: catch every real bug a careful
reviewer would catch in one sitting. At this level, catching real bugs matters
more than avoiding false positives. Err on the side of surfacing."""


def agent_medium(agent_tool: bool, cap: Cap | None) -> str:
    cap = 8 if cap is None else cap
    if not agent_tool:
        return single_pass_without_agent(f"medium effort → Agent tool unavailable → single-pass inline → {findings_label(cap)}", MEDIUM_LEAD_IN, 8, BASE_FINDER_ANGLES, cap, sweep=False)
    return f"""\
`medium effort → 3+5 angles × 6 candidates → 1-vote verify → {findings_label(cap)}`

{MEDIUM_LEAD_IN}

{DIFF_GATHERING_PHASE}
## Phase 1 — Find candidates (3 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 6 each)

Run **8 independent finder angles** via the Agent tool. Each
surfaces **up to 6 candidate findings** with `file`, `line`, a one-line
`summary`, and a concrete `failure_scenario`. {AGENT_FALLBACK_SENTENCE}

{BASE_FINDER_ANGLES}
{CLEANUP_CANDIDATES_NOTE}
Pass every candidate with a nameable failure scenario through — finders that
silently drop half-believed candidates bypass the verify step and are the
dominant cause of misses.

{THREE_STATE_VERIFY_PHASE}
{json_output(cap)}"""


def agent_high(agent_tool: bool, cap: Cap | None) -> str:
    cap = 10 if cap is None else cap
    if not agent_tool:
        return single_pass_without_agent(f"high effort → Agent tool unavailable → single-pass inline → {findings_label(cap)}", HIGH_LEAD_IN, 8, BASE_FINDER_ANGLES, cap, sweep=False)
    return f"""\
`high effort → 3+5 angles × 6 candidates → 1-vote verify (recall-biased) → {findings_label(cap)}`

{HIGH_LEAD_IN}

{DIFF_GATHERING_PHASE}
## Phase 1 — Find candidates (3 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 6 each)

Run **8 independent finder angles** via the Agent tool. Each
surfaces **up to 6 candidate findings** with `file`, `line`, a one-line
`summary`, and a concrete `failure_scenario`. {AGENT_FALLBACK_SENTENCE}

{BASE_FINDER_ANGLES}
{CLEANUP_CANDIDATES_NOTE}
Pass every candidate with a nameable failure scenario through — finders that
silently drop half-believed candidates bypass the verify step and are the
dominant cause of misses.

{RECALL_BIASED_VERIFY_PHASE}
{json_output(cap)}"""


def agent_recall(level: Literal["xhigh", "max"]) -> Callable[[bool, Cap | None], str]:
    effort = "maximum" if level == "max" else "extra-high"
    lead_in = f"""You are reviewing for **recall** at {effort} effort: catch every real bug. At
this level, catching real bugs matters more than avoiding false positives — a
missed bug ships. Err on the side of surfacing."""

    def prompt(agent_tool: bool, cap: Cap | None) -> str:
        cap = 15 if cap is None else cap
        if not agent_tool:
            return single_pass_without_agent(f"{level} effort → Agent tool unavailable → single-pass inline → {findings_label(cap)}", lead_in, 10, EXTENDED_FINDER_ANGLES, cap, sweep=True)
        return f"""\
`{level} effort → 5+5 angles × 8 candidates → 1-vote verify → sweep → {findings_label(cap)}`

{lead_in}

{DIFF_GATHERING_PHASE}
## Phase 1 — Find candidates (5 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 8 each)

Run **10 independent finder angles** via the Agent tool. Each
surfaces **up to 8 candidate findings**. Do NOT let one angle's conclusions
suppress another's — if two angles flag the same line for different reasons,
record both. {AGENT_FALLBACK_SENTENCE}

{EXTENDED_FINDER_ANGLES}
{CLEANUP_CANDIDATES_NOTE}
{THREE_STATE_VERIFY_PHASE}
This is recall mode — a single non-REFUTED vote carries the finding. Do NOT
drop on uncertainty.

{GAP_SWEEP_PHASE}
{json_output(cap)}"""
    return prompt


agent_xhigh = agent_recall("xhigh")
agent_max = agent_recall("max")


def minimal(cap: Cap | None) -> str:
    cap = 15 if cap is None else cap
    count = "every finding" if cap == "all" else f"at most {cap} {plural(cap, 'finding')}"
    return f"""\
`minimal prompt → single careful diff pass → {findings_label(cap)}`

You are reviewing a pull request for real bugs. Run `git diff @{{upstream}}...HEAD` (or `git diff main...HEAD` / `git diff HEAD~1`
if there's no upstream) to get the unified diff under review. If there are
uncommitted changes, or the range diff is empty, also run `git diff HEAD` and
include the working-tree changes in scope — the review often runs before the
commit. If a PR number, branch name, or file path was passed as an argument,
review that target instead. Treat this diff as the review scope.

Review the diff as a careful senior engineer would: read every hunk, open the surrounding files for context as needed (Read, Grep, git log/blame/show), and hunt for correctness issues — wrong or inverted conditions, off-by-one, null/undefined dereference, missing `await`, dropped error handling, removed guards or validations, broken callers of changed functions, races. Prefer real failure modes over style; every finding needs a concrete scenario in which the code misbehaves.

When you are done, submit {count} via the ReportFindings tool, filling its fields as defined — for each: the file path and start line, a severity, and a comment that states the issue and the concrete scenario in which the code misbehaves. Quality over quantity: include everything you genuinely believe is a real issue, and nothing you don't.

After the tool call, also restate the findings in your final reply — one line each, `file:line — summary` — so they stay visible in sessions that do not render tool output.
"""


# [LAW:types-are-the-program] A recipe is one prompt shape; the table below picks one per model family and level.
RECIPES: dict[str, Callable[[bool, Cap | None], str]] = {
    "low": lambda agent_tool, cap: low(cap),
    "low-sonnet5": lambda agent_tool, cap: low_minimum_findings(),
    "medium": agent_medium,
    "high": agent_high,
    "xhigh": agent_xhigh,
    "max": agent_max,
    "o48-low-v1": lambda agent_tool, cap: low_widening(cap),
    "o48-med-v1": lambda agent_tool, cap: inline_medium(cap),
    "o48-high-v1": lambda agent_tool, cap: inline_high(cap),
    "o48-xhigh-v1": lambda agent_tool, cap: inline_xhigh(cap),
    "o5-bmin": lambda agent_tool, cap: minimal(cap),
}


@dataclass(frozen=True)
class Cell:
    recipe: str
    finder_budget_hint: bool = False


_DEFAULT = {"low": Cell("low"), "medium": Cell("o48-high-v1"), "high": Cell("o48-high-v1"), "xhigh": Cell("o48-xhigh-v1"), "max": Cell("max")}
CELLS: dict[str, dict[str, Cell]] = {
    "default": _DEFAULT,
    "claude-sonnet-5": {"low": Cell("low-sonnet5"), "medium": Cell("medium"), "high": Cell("high", True), "xhigh": Cell("xhigh", True), "max": Cell("max", True)},
    "claude-opus-4-8": {"low": Cell("o48-low-v1"), "medium": Cell("o48-med-v1"), "high": Cell("o48-high-v1"), "xhigh": Cell("o48-xhigh-v1"), "max": Cell("max")},
    "claude-opus-5": {**_DEFAULT, "medium": Cell("o5-bmin"), "high": Cell("o5-bmin")},
}

# Claude Code canonicalizes a model id by the first rule it contains, in this order. Only the rules up to the
# last table key can change which family a model lands in.
_CANONICAL = ["claude-fable-5-1", "claude-fable-5", "claude-mythos-5-1", "claude-mythos-5", "claude-opus-5-5", "claude-opus-5",
              "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-opus-4-5", "claude-opus-4-1",
              "claude-sonnet-5-5", "claude-sonnet-5"]


def family(model: str) -> str:
    """The table row a model reviews with: its canonical name when the table has one, otherwise "default"."""
    name = re.sub(r"\[1m\]$", "", model, flags=re.IGNORECASE).lower()
    canonical = next((rule for rule in _CANONICAL if rule in name), name)
    return canonical if canonical in CELLS else "default"


@dataclass(frozen=True)
class Request:
    level: str | None
    target: str
    comment: bool
    fix: bool
    post: bool
    ultra: bool
    unrecognized_level: str | None
    max_findings: Cap | Literal["default"] | None
    max_findings_ignored: bool


_MAX_FINDINGS = re.compile(r"(^|\s)--max-findings(?:(?:\s*=\s*|\s+)(?!--)(\S+)|\s*=\S*)?(?=\s|$)")
_LEVEL_LIKE = re.compile(r"^(low|med|hig|xhi|max)[a-z]*$", re.IGNORECASE)


def _strip_flags(text: str, flags: list[str]) -> tuple[str, set[str], str]:
    rest = text.strip()
    first = rest.split(None, 1)[0] if rest else ""
    found = set()
    for flag in flags:
        stripped = re.sub(rf"(?:^|\s)--{re.escape(flag)}(?=\s|$)", "", rest)
        if stripped != rest:
            found.add(flag)
            rest = stripped.strip()
    return first, found, rest


def _target(words: list[str]) -> str:
    if not words:
        return ""
    first = words[0].replace("`", "")
    first = first[1:] if first.startswith("#") else first
    return " ".join(w for w in [first, *words[1:]] if w)


def parse(raw: str) -> Request:
    first, _, _ = _strip_flags(raw, [])
    _, flags, rest = _strip_flags(_MAX_FINDINGS.sub(r"\1", raw), ["comment", "fix", "post", "no-post"])
    match = [m for m in _MAX_FINDINGS.finditer(raw)]
    token = (match[-1].group(2) or "").lower() if match else None
    number = int(token) if token is not None and token.isdigit() and token.isascii() else 0
    max_findings = token if token in ("all", "default") else (number if 0 < number <= 2**53 - 1 else None)
    words = rest.split()
    head = words[0] if words else ""
    common = dict(comment="comment" in flags, fix="fix" in flags, post="post" in flags,
                  max_findings=max_findings, max_findings_ignored=token is not None and max_findings is None)
    if first.lower() == "ultra":
        return Request(level=None, target=_target(words[1:]), ultra=True, unrecognized_level=None, **common)
    level = None if head.lower() == "ultra" else {"med": "medium"}.get(head.strip().lower(), head.strip().lower())
    if level in LEVELS:
        return Request(level=level, target=_target(words[1:]), ultra=False, unrecognized_level=None, **common)
    return Request(level=None, target=_target(words), ultra=False,
                   unrecognized_level=head if _LEVEL_LIKE.match(head) else None, **common)


def session_level() -> str:
    """The level a review runs at when none was typed: the session's effort, else medium; unknown values read as high."""
    effort = os.environ.get("CLAUDE_EFFORT")
    if effort is None:
        return "medium"
    return effort if effort in LEVELS else "high"


@dataclass(frozen=True)
class Limit:
    asked: Cap | None
    stated: Cap | None


def limit(request: Request, recipe: str) -> Limit:
    asked = None if request.max_findings == "default" else request.max_findings
    if recipe == "low-sonnet5":
        return Limit(asked, None)
    capped = recipe == "o5-bmin" and (asked == "all" or (asked is not None and asked > REPORT_CAP))
    return Limit(asked, REPORT_CAP if capped else asked)


def limit_notice(request: Request, lim: Limit) -> str:
    parts = []
    if request.max_findings_ignored:
        parts.append("`--max-findings` was ignored: type a whole number above zero, `all`, or `default` after it. Using the usual limit.")
    if lim.asked is not None and lim.stated is None:
        parts.append("`--max-findings` does not change this review: low effort here has no maximum.")
    elif lim.stated != lim.asked:
        parts.append(f"This review reports at most {REPORT_CAP} findings, so the limit is {REPORT_CAP} here.")
    notice = " ".join(parts)
    return f"({notice} Open your report with one short line telling the user this; that opening line reaches them with the findings.)\n\n" if notice else ""


def level_notice(request: Request, level: str, gitlab: bool) -> str:
    if request.comment:
        comment = ("when the target is a GitLab merge request, your `--comment` is what posts the findings as one general MR note via glab" if gitlab
                   else "when the target is a GitHub PR, your `--comment` is what posts the findings as inline PR comments")
    else:
        comment = ("this local review will not post to GitLab; `--comment` is the flag that posts local findings as a general MR note" if gitlab
                   else "this local review will not post to GitHub; `--comment` is the flag that posts local findings as inline PR comments")
    post = f"(The typed `--post` applies only to the `/code-review ultra` cloud review and was ignored — {comment}. Tell the user this in one short line.)\n\n" if request.post else ""
    if request.ultra:
        # A skill can't launch the cloud review, so this is the branch for a session where /ultrareview isn't launchable.
        if request.fix:
            return f"(Running a local {level}-effort review and applying its findings.)\n\n" + post
        return f"(Claude can't launch the cloud review directly — the user can run `claude ultrareview` from a terminal to start it. Falling back to a local {level}-effort review for now.)\n\n" + post
    if request.unrecognized_level is not None:
        return f'(Ignoring unrecognized effort "{request.unrecognized_level}"; valid: {", ".join(LEVELS)}. Using {level}.)\n\n' + post
    return post


def finder_budget(target: str) -> str:
    """How many finder subagents to spawn, scaled to the committed diff's size."""
    if not target:
        revisions = "@{upstream}...HEAD"
    elif len(target) <= 256 and re.fullmatch(r"[@\w][@\w./~^-]*\.\.\.?[@\w][@\w./~^-]*", target):
        revisions = target
    else:
        return ""
    run = subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=", "-c", "core.askPass=", "diff",
                          "--no-ext-diff", "--no-textconv", "--numstat", "--end-of-options", revisions, "--"],
                         capture_output=True, text=True, timeout=5)
    if run.returncode != 0:
        return ""
    lines = sum(int(m[1]) + int(m[2]) for m in re.finditer(r"^(\d+)\t(\d+)\t", run.stdout, re.MULTILINE))
    if lines == 0:
        return ""
    finders = max(2, min(8, math.ceil(lines / 150)))
    if not target:
        return f"The committed diff (@{{upstream}}...HEAD) is about {lines} lines. Uncommitted changes aren't counted here, so treat this as a floor — start with about {finders} finder subagents (min 2, max 8) and scale up if Phase 0 finds additional working-tree scope.\n\n"
    return f"This diff is about {lines} lines. Spawn about {finders} finder subagents (min 2, max 8) — scale your investigation depth to the diff size rather than using a fixed large fleet.\n\n"


_MERGE_REQUEST_URL = re.compile(r"^(https?://[^/\s:]+(?::\d{1,5})?/(?:[^/\s]+/)+[^/\s]+)/-/merge_requests/\d")


def gitlab_target(first_word: str) -> bool:
    if _MERGE_REQUEST_URL.match(first_word) or re.fullmatch(r"!\d+", first_word):
        return True
    if re.match(r"https?://", first_word, re.IGNORECASE):
        return False
    origin = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True)
    return origin.returncode == 0 and "gitlab" in origin.stdout.lower()


def gitlab_comment_posting(first_word: str) -> str:
    iid = m.group(1) if (m := re.search(r"/-/merge_requests/(\d+)", first_word)) else re.sub(r"^!(\d+)$", r"\1", first_word)
    iid = iid if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", iid) else ""
    project = m.group(1) if (m := _MERGE_REQUEST_URL.match(first_word)) else None
    command = f"glab mr note{f' {iid}' if iid else ''}{f' -R {project}' if project else ''} -m \"<body>\""
    return f"""

## Posting to GitLab (--comment)

The `--comment` flag was passed. After producing the findings list, if the
review target is a GitLab merge request, post the findings as one general MR
note via `{command}`{'' if project else " from inside that project's checkout"}
(every finding with its file:line, the issue, and the suggested fix). glab has no single verb for line-anchored
comments; those require `glab api projects/:id/merge_requests/:iid/discussions`,
so post the general note unless the user asks for inline threads. If glab is
not available in this session, print the findings instead. If the target is
not an MR, print the findings to the terminal and note that `--comment` was
ignored.
"""


APPLYING_FIXES = """

## Applying fixes (--fix)

The `--fix` flag was passed. After producing the findings list, apply the
findings to the working tree instead of stopping at the report: fix each one
directly — correctness bugs and reuse/simplification/efficiency cleanups alike.
Skip any finding whose fix would change intended behavior, require changes well
outside the reviewed diff, or that you judge to be a false positive — note the
skip rather than arguing with it. Finish with a brief summary of what was fixed
and what was skipped.
"""


def review_prompt(raw: str, model: str, agent_tool: bool) -> str:
    """The prompt the built-in /code-review forks for these arguments, model and tool set."""
    request = parse(raw)
    level = "max" if request.ultra else (request.level or session_level())
    cell = CELLS[family(model)][level]
    lim = limit(request, cell.recipe)
    first_word = request.target.split(" ", 1)[0]
    gitlab = gitlab_target(first_word) if first_word else False
    target = f"Review target: `{request.target}`\n\n" if request.target else ""
    budget = finder_budget(request.target) if agent_tool and cell.finder_budget_hint else ""
    comment = (gitlab_comment_posting(first_word) if gitlab else GITHUB_COMMENT_POSTING) if request.comment else ""
    fix = APPLYING_FIXES if request.fix else ""
    return (level_notice(request, level, gitlab) + limit_notice(request, lim) + target + budget
            + RECIPES[cell.recipe](agent_tool, lim.stated) + comment + fix)


def main() -> None:
    parser = argparse.ArgumentParser(description="Print the /code-review prompt for the arguments on stdin.")
    parser.add_argument("--model", required=True, help="the reviewing model's id, e.g. claude-opus-5-5")
    parser.add_argument("--agent-tool", required=True, choices=["yes", "no"], help="whether the Agent tool is available")
    args = parser.parse_args()
    sys.stdout.write(review_prompt(sys.stdin.read().strip(), args.model, args.agent_tool == "yes"))


if __name__ == "__main__":
    main()
