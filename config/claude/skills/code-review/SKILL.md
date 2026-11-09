---
name: code-review
description: Review the current diff, or a PR number/branch/path target, for correctness bugs (plus reuse/simplification/efficiency cleanups where the model's review recipe covers them) at the given effort level (low|medium|high|xhigh|max: from few high-confidence findings up to many, some of them uncertain); with no level given, it uses the session's effort level. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review. Pass --max-findings <n> to report up to n findings, or --max-findings all for every finding.
argument-hint: "[low|medium|high|xhigh|max] [--fix] [--comment] [<pr#>|<branch>|<path>] [--max-findings <n>|all]"
context: fork
agent: laws:code
---

The laws in your system prompt are the benchmark by which you judge this work.

Run this command. After `--model`, put the exact id of the model you are running as (for example `claude-opus-5-5`). After `--agent-tool`, put `yes` if the Agent tool is in your tool set, otherwise `no`.

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/review_prompt.py" --model <your model id> --agent-tool <yes|no> <<'CODE_REVIEW_ARGUMENTS'
$ARGUMENTS
CODE_REVIEW_ARGUMENTS
```

The command prints your review instructions. Carry them out exactly as written. They and the accidental-complexity judgment below are the whole task, and the judgment runs at every level, even one whose instructions allow you a single read.

## Accidental complexity

Before you report, judge whether this change's complexity is what its problem needs. Read the change's ticket with `lit show <id>` (the id is in the PR title or the branch name) for the problem it solves. Then read the diff and ask whether its complexity is essential: would any correct solution to that problem need it?

Accidental complexity exists only because of an earlier decision in the same work, and that decision was wrong. Its signs in a diff: a second mechanism beside the first (a second registry, reader, cache or retry path for the same thing); state or code that recovers after an action instead of changing the action; special cases, guards or flags for code the same change added; a fix that needs its own fix.

If the complexity is accidental, your report's first finding is that decision, ranked above every line-level finding. Name the decision and what it forces afterward. Its summary begins `Accidental complexity:` and ends `Run /lets-take-a-step-back before fixing any finding.` The other findings still follow. The caller sees your report and never this page, so that sentence in the finding is the only place the caller learns to step back.
