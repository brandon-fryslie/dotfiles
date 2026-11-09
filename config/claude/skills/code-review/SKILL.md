---
name: code-review
description: Review the current diff, or a PR number/branch/path target, for correctness bugs (plus reuse/simplification/efficiency cleanups where the model's review recipe covers them) at the given effort level (low|medium|high|xhigh|max: from few high-confidence findings up to many, some of them uncertain); with no level given, it uses the session's effort level. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review. Pass --max-findings <n> to report up to n findings, or --max-findings all for every finding.
argument-hint: "[low|medium|high|xhigh|max] [--fix] [--comment] [<pr#>|<branch>|<path>] [--max-findings <n>|all]"
context: fork
---

Load the /laws:code skill. This is the benchmark by which you should judge this work.

Then run this command. After `--model`, put the exact id of the model you are running as (for example `claude-opus-5-5`). After `--agent-tool`, put `yes` if the Agent tool is in your tool set, otherwise `no`.

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/review_prompt.py" --model <your model id> --agent-tool <yes|no> <<'CODE_REVIEW_ARGUMENTS'
$ARGUMENTS
CODE_REVIEW_ARGUMENTS
```

The command prints your review instructions. Carry them out exactly as written; they are the whole task.
