---
name: agent-code-review-setup
description: Install the agent code-review GitHub Action into the current repository — writes the .github/workflows/code-review.yml workflow and sets the reviewer's repo secrets (DEEPSEEK_API_KEY, CLAUDE_CODE_OAUTH_TOKEN) from the macOS keychain. Use when the user says "set up agent code review in this repo", "install the code review action", "add AI code review to this repo", "set up the AI code reviewer here", or wants automated PR review wired into the repo they're currently in.
---

# agent-code-review-setup

Installs the [coding agent review](https://github.com/brandon-fryslie/coding-agent-review) GitHub Action into the repository the user is currently working in: writes the workflow file and provisions the repository secrets the action reads. After that, the action runs on every pull request.

## When to use

- "Set up agent code review in this repo"
- "Install the code review action / add AI code review to this project"
- "Set up the AI code reviewer here"

Operates on the **current directory's** git repo. To target a different repo, `cd` there first.

## How it works

A single embedded script, `install.sh`, **converges** the repo onto the desired config: it renders the desired state, diffs it against what is deployed, and performs only the effects the diff demands. Two independent targets:

1. `.github/workflows/code-review.yml` matches the embedded template, referencing the action at its moving major tag `@v1` (auto-tracks the latest non-breaking release). Identical content → no write.
2. Every secret in the script's `SECRETS` table is set in **both** the Actions and Dependabot secret stores — re-synced from the macOS keychain whenever the keychain is reachable (so rotation propagates), left as-is with a loud warning when the keychain is unreachable but the secret already exists, and a hard failure only when the secret is missing, cannot be set, *and* the workflow actually references it. Both stores are required because GitHub feeds Dependabot-triggered runs from the separate Dependabot store; an Actions-only secret leaves every Dependabot PR review unauthenticated.

The secrets provisioned today:

| Secret | Keychain item (default) | Override env var |
|---|---|---|
| `DEEPSEEK_API_KEY` | `DEEPSEEK_API_KEY` | `DEEPSEEK_KEYCHAIN_ITEM` |
| `CLAUDE_CODE_OAUTH_TOKEN` | `CLAUDE_CODE_OAUTH_TOKEN` | `CLAUDE_CODE_OAUTH_KEYCHAIN_ITEM` |

`CLAUDE_CODE_OAUTH_TOKEN` is a Claude Pro/Max subscription token from `claude setup-token`, provisioned **ahead of its use** — the action does not read it yet. Distributing it per-repo through this installer is the deliberate alternative to an org-wide secret, which would reach only repos inside that one org. Until the workflow template references it, a missing token is reported and harmless.

**Requiredness is read from the workflow, not declared.** A secret the deployed workflow mentions as `secrets.NAME` must be settable or the script aborts; one it does not mention is skipped with a note. So the day a template starts consuming a secret is the day that secret becomes mandatory — there is no second list to keep in sync.

Re-running when everything is current is a fast no-op that needs no keychain.

**No secret ever touches the agent.** Each flows `keychain → gh` over a pipe — never bound to a variable, never in `argv`, never printed, never in this conversation. The agent only invokes the script; it cannot observe any key. Each keychain item defaults to the same name as the GitHub secret it feeds.

The script validates the shared preconditions first (git repo, `gh` installed + authenticated, a resolvable GitHub remote) and fails loudly with a specific message if any is missing. The keychain is demanded only at the moment the secret must actually be written.

## Usage

Run the script from the root of the target repository:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

Override a keychain item if that key is stored under a different name (see the table above for the variable per secret):

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
- a repo secret is missing, its keychain item is not available to set it, **and** the deployed workflow references that secret — the one state where the reviewer genuinely cannot authenticate

Two nearby states are deliberately *not* fatal, each reported on stderr with exit 0: a missing keychain item when the repo secret already exists (re-syncing is impossible from this machine, the existing secret stands), and a secret that is missing everywhere but which the workflow never references (provisioned ahead of use — nothing can break). If you see an abort, fix the named cause and re-run — nothing partial is left in a bad state, since the workflow write and the secret set are independent and each convergent.
