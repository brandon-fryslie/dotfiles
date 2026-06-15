---
name: zai-pr-review
description: Install the Z.ai Coding Agent Review GitHub Action into the current repository — writes the .github/workflows/code-review.yml workflow and sets the ZAI_API_KEY repo secret from the macOS keychain. Use when the user says "install the z.ai review action", "add z.ai code review to this repo", "set up the AI code reviewer here", "install the coding agent review action", or wants automated PR review wired into the repo they're currently in.
---

# zai-pr-review

Installs the [Z.ai Coding Agent Review](https://github.com/brandon-fryslie/zai-coding-agent-review) GitHub Action into the repository the user is currently working in: writes the workflow file and provisions the `ZAI_API_KEY` repository secret. After that, the action runs on every pull request.

## When to use

- "Install the z.ai review action in this repo"
- "Add AI / z.ai code review to this project"
- "Set up the coding agent reviewer here"

Operates on the **current directory's** git repo. To target a different repo, `cd` there first.

## How it works

A single embedded script, `install.sh`, performs the whole install as two idempotent effects:

1. Writes `.github/workflows/code-review.yml` referencing the action at its moving major tag `@v1` (auto-tracks the latest non-breaking release).
2. Sets the `ZAI_API_KEY` repo secret by piping the value straight from the macOS keychain into `gh secret set`.

**The secret never touches the agent.** It flows `keychain → gh` over a pipe — never bound to a variable, never in `argv`, never printed, never in this conversation. The agent only invokes the script; it cannot observe the key. The keychain item defaults to `zai-api-key`.

The script validates every precondition first (git repo, `gh` installed + authenticated, a resolvable GitHub remote, keychain item present) and fails loudly with a specific message if any is missing. Re-running is safe: both effects overwrite to the same state.

## Usage

Run the script from the root of the target repository:

```bash
bash ~/.claude/skills/zai-pr-review/install.sh
```

Override the keychain item if the key is stored under a different name:

```bash
ZAI_KEYCHAIN_ITEM=my-zai-key bash ~/.claude/skills/zai-pr-review/install.sh
```

The script does **not** commit. After it succeeds, commit and push the workflow per the user's git workflow (branch + PR — never directly to the default branch). The workflow takes effect once it lands on the default branch.

## Failure modes

The script aborts (nonzero exit) with a clear cause when:

- `gh` or `security` is not installed
- not inside a git repository
- `gh` is not authenticated (`gh auth login`)
- the GitHub repo can't be resolved from the current directory (no GitHub remote / no access)
- the keychain item (`zai-api-key` by default) is not found

If you see one of these, fix the named cause and re-run — nothing partial is left in a bad state, since the workflow write and the secret set are independent and each idempotent.
