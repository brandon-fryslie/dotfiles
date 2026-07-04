---
name: agent-code-review-setup
description: Install the agent code-review GitHub Action into the current repository — writes the .github/workflows/code-review.yml workflow and sets the DEEPSEEK_API_KEY repo secret from the macOS keychain. Use when the user says "set up agent code review in this repo", "install the code review action", "add AI code review to this repo", "set up the AI code reviewer here", or wants automated PR review wired into the repo they're currently in.
---

# agent-code-review-setup

Installs the [coding agent review](https://github.com/brandon-fryslie/coding-agent-review) GitHub Action into the repository the user is currently working in: writes the workflow file and provisions the `DEEPSEEK_API_KEY` repository secret that the action reads. After that, the action runs on every pull request.

## When to use

- "Set up agent code review in this repo"
- "Install the code review action / add AI code review to this project"
- "Set up the AI code reviewer here"

Operates on the **current directory's** git repo. To target a different repo, `cd` there first.

## How it works

A single embedded script, `install.sh`, **converges** the repo onto the desired config: it renders the desired state, diffs it against what is deployed, and performs only the effects the diff demands. Two independent targets:

1. `.github/workflows/code-review.yml` matches the embedded template, referencing the action at its moving major tag `@v1` (auto-tracks the latest non-breaking release). Identical content → no write.
2. The `DEEPSEEK_API_KEY` repo secret is set — re-synced from the macOS keychain whenever the keychain is reachable (so rotation propagates), left as-is with a loud warning when the keychain is unreachable but the secret already exists, and a hard failure only when the secret is missing *and* cannot be set.

Re-running when everything is current is a fast no-op that needs no keychain.

**The secret never touches the agent.** It flows `keychain → gh` over a pipe — never bound to a variable, never in `argv`, never printed, never in this conversation. The agent only invokes the script; it cannot observe the key. The keychain item defaults to `DEEPSEEK_API_TOKEN`.

The script validates the shared preconditions first (git repo, `gh` installed + authenticated, a resolvable GitHub remote) and fails loudly with a specific message if any is missing. The keychain is demanded only at the moment the secret must actually be written.

## Usage

Run the script from the root of the target repository:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

Override the keychain item if the key is stored under a different name:

```bash
DEEPSEEK_KEYCHAIN_ITEM=my-key bash ~/.claude/skills/agent-code-review-setup/install.sh
```

The script does **not** commit. After it succeeds, commit and push the workflow per the user's git workflow (branch + PR — never directly to the default branch). The workflow takes effect once it lands on the default branch.

## Failure modes

The script aborts (nonzero exit) with a clear cause when:

- `gh` is not installed
- not inside a git repository
- `gh` is not authenticated (`gh auth login`)
- the GitHub repo can't be resolved from the current directory (no GitHub remote / no access)
- the repo secret is missing **and** the keychain item (`DEEPSEEK_API_TOKEN` by default) is not available to set it — the one state where the reviewer genuinely cannot authenticate

A missing keychain item on its own is *not* fatal when the repo secret already exists: the script warns on stderr that re-syncing is impossible from this machine and exits 0. If you see an abort, fix the named cause and re-run — nothing partial is left in a bad state, since the workflow write and the secret set are independent and each convergent.
