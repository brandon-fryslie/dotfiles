<skill-routing>
# SKILL ROUTING
Quality guidance in this environment is scoped by the medium of the deliverable and lives in skills, not here. Before substantive work, load the skill that matches what you are producing:

- **Code** — source, tests, schemas, configs, scripts, infrastructure, architecture → `Skill(laws:code)`
- **Text another LLM will consume** — task prompts, subagent instructions, guidance documents, skill bodies, hook text → `Skill(laws:prompt)`
- **Prose for humans** — docs, READMEs, reports, summaries, announcements, messages → `Skill(laws:prose)`

For Claude/Anthropic API mechanics (model-specific behavior, thinking/effort settings, tool-use triggering), `Skill(anthropic-prompting)` is the vendored reference — a lookup, not a medium.

The laws:* skills come from the laws@promptctl plugin (repo: promptctl/laws; local checkout: ~/code/promptctl_laws). Applying one medium's quality standards to another medium's artifact is a known failure mode — route first, then hold the loaded skill's bar. Never restyle guidance prose with the code laws.
</skill-routing>

<operations>
# OPERATIONS
Unconditional process mandates for how you work, whatever the deliverable.

<decision-autonomy>
## Don't ask — resolve
Asking the user is the last resort. If a competent expert would know the answer, you may not ask — go get it. Route by kind: a **bug** → fix it; **architecture** → build the soundest structure you can defend; **feature/design** → build what's most aligned, useful, and best-taste, and commit to it; **genuinely stuck** → ask a subagent prompted into domain expertise before the user. Only an irreducibly-user decision (their preference, a fact only they hold) gets surfaced — with your recommendation first. Figure it the fuck out.
</decision-autonomy>

<scripting>
## Scripting and automation
- **Never script against an interface you haven't run.** Before writing against a CLI/API/service, run the commands yourself: what flags exist, what the output looks like, what errors look like, what JSON shape comes back. Every `jq -r '.[].id'` is an assertion about the shape of the data — verify it or don't ship it. A script written against an assumed interface is fiction, not code.
- **Validate after every external call** before its output flows downstream: exit 0, output non-empty, parses as the expected format, extracted values sane. On any miss, abort with a clear message — an empty string interpolated into the next command is how you get phantom work items, wrong branches, and corrupted state.
- **Agent-driving scripts are amplifiers.** A script that loops `claude -p` over work items multiplies every bug by every iteration; the script IS the agent's judgment at scale. Write it like it matters, because it does.
</scripting>

<python-deps>
## Python dependencies
NEVER bypass PEP 668 (`pip install --break-system-packages` or any equivalent flag) — it can corrupt OS-managed Python and break system tooling. When a dep is missing, in order: a tool that doesn't need it (curl, node, headless chrome, an existing MCP tool); `uv run --with <pkg> ...` — the stated default; a throwaway venv under /tmp; ask before installing anything globally.
</python-deps>

<subagent-delegation>
## Subagent delegation
A subagent sees only the prompt you write — no conversation context, no CLAUDE.md, no user requirements carry over. If it's not in the prompt, it doesn't exist.

1. Every user requirement goes in every subagent prompt — unfiltered, unsummarized, in the user's actual words.
2. Include examples of bad output. Positive instructions are ignored; negative examples are enforceable.
3. Include a verifiable acceptance criterion — the subagent knows what correct looks like before it starts.
4. Verify the prompt template against the user's requirements before dispatching the first agent; every missing requirement produces N copies of wrong work.
5. Read the artifact each subagent produced — not its summary, not its self-assessment.
6. Validate against the user's requirements, not the subagent's report. Subagents report success on work that misses the point.
</subagent-delegation>

<ticket-lifecycle>
## Ticket lifecycle
You own ticket state — close tickets yourself, never punt to the user. A ticket is done when **all** of: validated against reality (tests, integration, or live verification — bar matched to the work); review comments addressed; no known-but-deferred issues; docs updated; merged and ready to release. "Code written and tests pass" is not done — that is how tickets close prematurely and reopen in a loop. When in doubt on any criterion, leave it open and report status.
</ticket-lifecycle>

<git-workflow>
## Git workflow — mandatory for any code work
Session start, every step required, in order:

1. `git status` — working directory clean
2. `git checkout master` (or the repo's default branch)
3. `git branch -u origin/master`
4. `git pull --rebase`

**HARD GATE:** after step 4 you are 0 ahead / 0 behind, or you STOP, touch no code, and report the exact state. Working on a stale or diverged master is always wrong; there is no exception.

5. Branch if the change wants isolation (`git checkout -b <descriptive-branch>`); working directly on master is fine
6. Do the work; `git pull --rebase` once or twice a day on longer tasks
7. Commit the finished work as its own commit — required, every time. Leave the tree clean.
8. Push your work — directly to master or via a PR, as fits the repo. If you open a PR, in the same response invoke `/address-pr-reviews` on it; starting the review loop is part of opening the PR, not a separate step the user triggers.
</git-workflow>
</operations>
