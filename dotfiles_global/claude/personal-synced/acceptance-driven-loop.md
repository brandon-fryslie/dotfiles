Below is a complete, acceptance-spec/TDD–driven rearchitecture of your system. It includes:
1.	A new AGENT.md (single source of truth for the autonomous process).
2.	A full rewrite of Commands (now acceptance-centric).
3.	A full rewrite of Agents (specialized for acceptance indexing, planning, red→green, verification, and traceability).

Everything assumes .agent_planning/ACCEPTANCE_SPEC.md is authoritative. All work is forbidden unless it maps to a concrete Acceptance Criterion (AC).

⸻

AGENT.md — Acceptance-Spec–Driven Autonomous Workflow

Principles
•	Single Source of Truth: .agent_planning/ACCEPTANCE_SPEC.md defines all required behavior.
•	Traceable TDD: Every code change is justified by a specific AC and accompanied by at least one failing test that turns green.
•	Eventually Correct: Iterate until every AC passes and traceability coverage = 100%.
•	No Orphans: No commits without an AC ID; no tests without AC linkage; no features not demanded by the spec.

Repository Contracts
•	.agent_planning/ACCEPTANCE_SPEC.md — human-readable spec (ACs with IDs: AC-<num>).
•	.agent_planning/ACCEPTANCE_INDEX.json — machine index (derived; do not hand-edit).
•	.agent_planning/TRACEABILITY.csv — AC_ID,test_path,test_name,code_refs,commit (maintained automatically).
•	.agent_planning/TODO.md — tasks generated only from AC gaps/failures.
•	Tests live under tests/acceptance/AC-<id>_<slug>_test.py (1+:1 mapping AC→tests).

Gating & Quality Bars
•	Coverage (impacted code): ≥ 80% lines for files touched this iteration.
•	Flake Guard: Each acceptance test is re-run N=3 times; flake rate must be 0%.
•	Pass Rate: 100% of acceptance tests passing; no xfail/xfreeze for ACs.
•	Traceability: 100% ACs mapped to ≥1 passing test; 0 unknown tests; 0 orphan commits.

Core Loop (Acceptance-First)

Run until all ACs pass & TODO is empty:
0.	/acceptance-sync: Parse/validate ACCEPTANCE_SPEC.md → generate/refresh ACCEPTANCE_INDEX.json; open gaps → TODO.md.
1.	/acceptance-plan-next-step: Choose the highest-value failing/missing AC (or sub-step) and output a single actionable task.
2.	/acceptance-red-green (atomic):
•	Write failing test(s) for the chosen AC (RED).
•	Implement minimal code to satisfy the AC (GREEN).
•	Commit both, tied to the AC ID.
3.	/acceptance-verify:
•	Run targeted acceptance subset, then full suite.
•	Run flake detector (N=3).
•	If any failure/flake → Stabilization Mode.
4.	/acceptance-trace: Update TRACEABILITY.csv mapping AC↔tests↔code.
5.	/project-status: Update STATUS.md, milestones, remaining ACs.

Stabilization Mode triggers if: any AC failing, or flake > 0%, or coverage < 80% (impacted).
Priorities: fix AC regressions → deflake → raise coverage → simplify.

Conflict Resolution
•	Spec Wins: If code/docs disagree with the spec, follow the spec.
•	Ambiguity: Create TODO: spec-clarification(<AC-ID>) and block that AC; continue with next AC.
•	No Scope Creep: Reject tasks without an AC; convert feature requests into ACs first.

Pre-Completion Checklist
•	All ACs in ACCEPTANCE_INDEX.json have status=pass.
•	TRACEABILITY.csv complete & consistent.
•	Acceptance suite green; zero flakes (N=3).
•	Impacted coverage ≥ 80%.
•	STATUS.md updated; TODO.md empty.

⸻

COMMANDS — Acceptance-Centric

Backward compatibility: legacy initiative-* commands are retained as thin wrappers that call the new acceptance commands where applicable.

acceptance-sync.md

Purpose: Rebuild the machine view of the spec and derive actionable gaps.

Actions:
1.	Parse .agent_planning/ACCEPTANCE_SPEC.md into .agent_planning/ACCEPTANCE_INDEX.json
Schema (per AC):

{
"id": "AC-12",
"title": "Right-click triggers contextual menu",
"procedure": "...",
"pass_criteria": "...",
"tags": ["acceptance"],
"status": "unknown|pass|fail|missing_tests"
}


	2.	Compare index to tests/acceptance/** and TRACEABILITY.csv.
	3.	Emit/refresh .agent_planning/TODO.md with concrete items:
	•	write-tests(AC-##) when no mapped tests exist
	•	fix-failing(AC-##) when tests exist but fail
	•	raise-coverage(AC-##, files=[...]) when impacted files < 80%
	•	deflake(AC-##) if flake > 0%

Output: Updated ACCEPTANCE_INDEX.json, TODO.md.

⸻

acceptance-plan-next-step.md

Purpose: Choose the next acceptance task.

Policy (priority):
1.	fix-failing(AC-##)
2.	write-tests(AC-##)
3.	deflake(AC-##)
4.	raise-coverage(AC-##)

Output: Echo the single selected task line (and leave TODO.md with remaining items).

⸻

acceptance-red-green.md

Purpose: Perform a single RED→GREEN cycle for the selected AC.

Steps:
1.	Create/extend tests/acceptance/AC-<id>_<slug>_test.py with failing test(s) that directly encode the AC’s pass criteria (link with AC ID in test names/markers).
2.	Run pytest → assert RED (fails specifically on new tests).
3.	Implement minimal code to satisfy the AC; prefer smallest surface change.
4.	Run pytest (targeted → full) → assert GREEN.
5.	Commit:
•	feat(AC-<id>): make acceptance test pass
•	Include a trailer in the commit message:

AC: AC-<id>
Tests: tests/acceptance/AC-<id>_*.py::<test_name>



Output (JSON):

{"ac":"AC-<id>","commit":"<hash>","tests":["tests/acceptance/..."],"red_then_green":true}


⸻

acceptance-verify.md

Purpose: Confidence pass.

Steps:
•	Run targeted acceptance for the chosen AC, then full acceptance and full test suite.
•	Flake detection: re-run acceptance suite N=3 with randomized seeds/env noise.
•	If failures or flakes → emit deflake(AC-##) or fix-failing(AC-##) into TODO.md.

Output (JSON):

{"suite_pass":true,"flakes":0,"pfailed":[],"coverage_impacted":">=80%"}


⸻

acceptance-trace.md

Purpose: Maintain bi-directional traceability.

Actions:
•	Resolve AC↔test mapping from markers/docstrings.
•	Infer code refs via simple static scan (changed files in commit; symbol xrefs if available).
•	Update .agent_planning/TRACEABILITY.csv.

Output: Updated TRACEABILITY.csv.

⸻

acceptance-refactor.md

Purpose: Safe simplification under green tests.

Rules:
•	Only touch code that’s covered by acceptance tests.
•	After changes, run /acceptance-verify.
•	Commit: refactor(AC-<id>|infra): <summary>.

Output (JSON):

{"changed_files":[...],"tests_green":true}


⸻

project-status.md  (unchanged name; acceptance-aware)

Purpose: Human-readable progress.

Actions: Write .agent_planning/<initiative>/STATUS.md:
•	AC pass/fail table (from ACCEPTANCE_INDEX.json)
•	Flake report
•	Coverage summary (impacted vs overall)
•	Remaining TODO lines

Output: Updated STATUS.md.

⸻

Legacy wrappers (compat)
•	initiative-main-loop.md → calls: /acceptance-sync → /acceptance-plan-next-step → /acceptance-red-green → /acceptance-verify → /acceptance-trace → /project-status (repeat).
•	initiative-implement-item.md → delegates to /acceptance-red-green.
•	initiative-retest.md → delegates to /acceptance-verify.
•	initiative-plan-next-step.md → delegates to /acceptance-plan-next-step.
•	initiative-refactor.md → delegates to /acceptance-refactor.
•	initiative-status.md → delegates to /project-status.
•	initiative-validate-ux.md → removed (UX out of scope unless expressed as ACs).
•	loop.md → unchanged (commit & continue).

⸻

AGENTS — Acceptance-Spec Specialization

Tools: assume a standard toolbelt Read, Write, MultiEdit, Bash, GitAdd, GitCommit, Grep, Glob. Add PyTest as a convenience alias for Bash: pytest -q if desired.

loop-spec-indexer.md

name: loop-spec-indexer
purpose: Convert the human spec to a machine index & derive TODOs.
behavior:
•	Parse .agent_planning/ACCEPTANCE_SPEC.md for AC-<num> headings and structured blocks: Procedure, Pass Criteria.
•	Validate formatting; if malformed, create TODO: spec-clarification(AC-##) and skip that AC.
•	Produce ACCEPTANCE_INDEX.json; compute status per AC:
•	missing_tests (no test mapped)
•	fail (mapped tests failing)
•	pass (all mapped tests green)
•	unknown (no runs yet)
•	Generate .agent_planning/TODO.md lines per the Commands policy.

output: updated index & TODO.

⸻

loop-acceptance-planner.md

name: loop-acceptance-planner
purpose: Pick exactly one actionable acceptance task.
behavior: Apply priority policy; echo chosen line (and keep others in TODO).
output: selected task (single line).

⸻

loop-coder.md (overhauled)

name: loop-coder
purpose: Execute a single RED→GREEN cycle for the selected AC.
behavior:
•	Locate AC in ACCEPTANCE_INDEX.json.
•	Write/extend tests under tests/acceptance/AC-<id>_*_test.py, tagging each test with @pytest.mark.acceptance("AC-<id>") and embedding the AC’s Pass Criteria as assertions.
•	Run pytest → confirm RED due to new tests.
•	Implement minimal code to satisfy assertions.
•	Run pytest (targeted first, then full) → confirm GREEN.
•	Commit with AC trailer.
•	Emit JSON summary (commit, files, tests).

guardrails: refuse to proceed if the selected task has no AC ID.

⸻

loop-tester.md (overhauled)

name: loop-tester
purpose: Verify health & deflake.
behavior:
•	Run targeted acceptance for last AC.
•	Run full acceptance, then re-run N=3 for flake detection.
•	If flakes or failures:
•	Create/append deflake(AC-##) or fix-failing(AC-##) to TODO (with failing test names).
•	Do not downgrade tests to xfail.
•	Compute impacted coverage (files in last commit + neighbors). Enforce ≥ 80%; otherwise add raise-coverage(AC-##).

output (JSON): pass/fail, flakes, coverage.

⸻

loop-traceability.md

name: loop-traceability
purpose: Maintain AC↔test↔code audit trail.
behavior:
•	Discover mappings via markers, docstrings, and recent diffs.
•	Write/append rows to TRACEABILITY.csv.
•	Verify that every AC in index has ≥ 1 mapped passing test; if not, write TODO.

output: updated trace matrix.

⸻

loop-refactor.md (acceptance-aware)

name: loop-refactor
purpose: Simplify without breaking guarantees.
behavior:
•	Only refactor code proven by acceptance tests.
•	Add missing unit tests when they improve explainability (optional; acceptance still primary).
•	Keep deltas small; preserve behavior.
•	Verify with loop-tester; commit if green.

output (JSON): summary + tests green.

⸻

loop-status-writer.md

name: loop-status-writer
purpose: Human progress report.
behavior: Render STATUS.md from ACCEPTANCE_INDEX.json, tester results, and TODO.
output: STATUS.md.

⸻

Removed / Re-scoped Agents
•	loop-validator.md (UX) → removed or reintroduced only if UX flows appear as ACs.
•	All “initiative-*” agents remain as wrappers but are no longer the source of logic; they call the acceptance agents.

⸻

Directory & Naming Conventions (enforced)
•	AC IDs: AC-<number> unique, stable.
•	Test files: tests/acceptance/AC-<id>_<slug>_test.py.
•	Test markers: @pytest.mark.acceptance("AC-<id>").
•	Commit messages: feat(AC-<id>): ... or fix(AC-<id>): ... or refactor(AC-<id>): ....
•	Trace rows: include AC ID, absolute test path, ::<test_name>, primary code symbols (module:function/class), and commit SHA.

⸻

Main Autonomous Loop (pseudocode)

while True:
/acceptance-sync
if all ACs pass and TODO empty: break
task = /acceptance-plan-next-step
/acceptance-red-green (task)
/acceptance-verify
if fail or flake: enter Stabilization Mode until green
/acceptance-trace
/project-status

This redesign makes the acceptance spec the engine of planning, coding, verification, and reporting.

Yes—designing this for Claude Code changes a few things, and you can improve it materially.

What changes
•	Turn your “commands” into Claude Code slash commands. Move them into .claude/commands/*.md with front-matter (allowed tools, descriptions) so they’re first-class / commands inside the terminal and IDE.  ￼
•	Use subagents for each role (planner, coder, tester, tracer). Define them in .claude/agents/ so each runs with its own prompt/tools/context, reducing contamination across steps.  ￼
•	Enforce the acceptance-first invariant with Hooks. Configure .claude/settings.json hooks to gate writes and auto-run tests at the right times (e.g., PostToolUse on Write|Edit). Hooks can block actions (exit code 2) and feed errors back to Claude automatically.  ￼
•	Run the loop in CI with headless mode. Use claude -p ... --output-format stream-json in GitHub Actions or similar to execute the acceptance loop non-interactively.  ￼ ￼
•	Codify the rules in CLAUDE.md. Keep your acceptance/TDD guardrails and repo etiquette in CLAUDE.md (project and/or user scope) so Claude loads them at session start.  ￼ ￼
•	Exploit IDE integration. If you use VS Code/JetBrains, enable the Claude Code plugin or /ide so diffs and selection context flow into the agent automatically.  ￼

Targeted improvements (acceptance-spec/TDD)
•	Rename and rehome commands as slash commands (examples):
•	/acceptance-sync → parses ACCEPTANCE_SPEC.md into ACCEPTANCE_INDEX.json & updates TODO.md. Include front-matter allowed-tools: Bash(pytest:*), Bash(git:*), Bash(jq:*), Bash(sed:*), Read, Write.  ￼
•	/acceptance-plan-next-step → chooses the top failing/missing AC.
•	/acceptance-red-green <AC-ID> → writes failing tests, proves RED, implements, proves GREEN, commits.
•	/acceptance-verify and /acceptance-trace → run full suite & update TRACEABILITY.csv.
(Slash commands support arguments, file refs @path, and pre-bash captures via ! for diffs/status.)  ￼
•	Wire hooks to your loop:
•	PreToolUse (matcher: UserPromptSubmit or *) → add spec context or block prompts that lack an AC-ID.
•	PostToolUse (matcher: Write|Edit) → run pytest -q tests/acceptance and block on failures (exit 2), surfacing errors to the model.
•	SessionStart → auto-run /acceptance-sync so TODOs and AC index are always fresh.  ￼
•	Isolate roles with subagents:
•	planner (reads spec/index only), coder (edits src), tester (runs pytest), tracer (updates TRACEABILITY.csv). Claude’s best-practice guidance also recommends multi-Claude patterns (e.g., one writes tests, another implements).  ￼ ￼
•	Headless CI gate:
•	Job runs claude -p "/acceptance-sync && /acceptance-plan-next-step && /acceptance-red-green $AC && /acceptance-verify && /acceptance-trace" --output-format stream-json. Fail the pipeline unless all ACs pass.  ￼ ￼
•	MCP (optional): If you want PRs/issues updated, connect GitHub/Jira via MCP and expose them as additional slash commands (e.g., /mcp__github__pr_review).  ￼

These adjustments align your workflow with Claude Code’s native primitives—slash commands, subagents, hooks, headless mode, and CLAUDE.md memory—while preserving your acceptance-spec/TDD core. They’re also consistent with Anthropic’s own TDD-first best-practices for agentic coding.  ￼
