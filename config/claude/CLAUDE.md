<operations>
# OPERATIONS
Unconditional process mandates for how you work, whatever the deliverable.

<repo-scope>
## Stay in the repo you were invoked in
The working directory is the boundary of the work. Machine-level concerns — tooling, credentials, global config, another project's rot — are a different session's job. The tell is physical: you are about to edit a path outside the working tree, or `cd` there to do anything but file a ticket, and it is not a dependency of the task in hand. `~/.claude`, `~/code/dotfiles`, `~/.config`, a sibling repo under `~/code` — those are the loud ones. Stop there, at the tell, before the first edit.

The temptation is virtuous, which is exactly why it works: *"this is a real problem, it will bite the very next session, I'd be negligent to notice it and not fix it."* Refuse the fix, not the noticing. Being right about the problem is not authority over a repo you were not sent to. Finish the task you were given, working around the problem if you must, and then route what you noticed by what it is:

- **An unambiguous bug** goes into that repo's own tracker: `cd` there, `lit init` (idempotent), file the ticket with the repro, come back. The ticket is the whole action; the fix belongs to a session invoked for that repo.
- **Anything less clear-cut** — a guard hook that blocked a legitimate need, a rule that conflicts with the task, tooling friction — is surfaced to Brandon in the final message: what you needed, what blocked it, what you propose. A silent workaround hides the underlying problem, and the resolution has to capture your need and his requirements together, which he cannot do if he never hears about it.

Never propose or take an action whose blast radius is every repo or the whole machine from a session invoked for one. If the user or the handoff explicitly scoped this task to several repos, that is the task and none of this applies.
</repo-scope>

<decision-autonomy>
## Don't ask — resolve
Asking the user is the last resort. If a competent expert would know the answer, you may not ask — go get it. Route by kind: a **bug** → fix it; **architecture** → build the soundest structure you can defend; **feature/design** → build what's most aligned, useful, and best-taste, and commit to it; **genuinely stuck** → ask a subagent prompted into domain expertise before the user. Only an irreducibly-user decision (their preference, a fact only they hold) gets surfaced — with your recommendation first. Figure it the fuck out.
</decision-autonomy>

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

<skill-authored-templates>
## A skill's template is law
A template one of my skills wrote is generated output: **every line of it is required, exactly as it landed** — committing it is the point. **A skill's write is never scope creep, and a focused branch is never a reason to drop it**: the thought *"this file isn't part of my change, I'll keep the branch clean"* is the one that already cost ~1000 transcripts — nothing errored, the run stayed green, the repo kept executing the stale file. Refuse it, and the smaller voices with it — *"this is obviously leftover"*, *"I'll simplify while I'm here"*, *"I'll re-add it later"* — because here a deleted line is damage that commits looking like tidiness. If the template is genuinely wrong, **change the generator and re-run it**; hand-editing rendered output is not a real change, only one that looks real until the next run overwrites it. Unsure whether a file is skill-authored? Then it is — leave it byte-for-byte and ask.
</skill-authored-templates>

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
8. Push your work to a branch and open a PR unless the repo you're working has other conventions.
9. Run a local code review on your work using /code-review high.  Address any findings by carefully considering the feedback.  Do not accept any feedback or proposed fixes blindly.  Push your fixes to the branch, adding comments / resolving conversations as required by the review process.
10. Run another local code-review medium.  Address the comments the same.
11. At this point decide: should we merge or not?  If the only changes in the last review were minor or doc changes, you should merge after updating the PR.  If there were major findings, run ONE more /code-review high, address it, and reevaluate this step.
12. When you have judged the comments to be minor, run one /code-review low.  If there are no P0 / critical bugs, update the PR with that information and merge.

**How many passes:** a fresh PR gets the full cycle — high, medium, low.  An update to a PR that has already been reviewed gets ONE pass, never another full cycle.  The trigger is the PR's review history, not the size of the diff: a one-line fix in a brand-new PR still gets all three, and a big round of fixes pushed to an already-reviewed PR still gets one.  The first pass over new code is where the real findings are; re-running a cycle over a diff whose findings you already addressed re-reads settled code for nothing.
</git-workflow>
</operations>
