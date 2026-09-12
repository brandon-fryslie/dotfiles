---
name: agent-code-review-setup
description: Install the agent code-review GitHub Action into the current repository — writes the .github/workflows/code-review.yml workflow and sets the reviewer's repo secret (CLAUDE_CODE_OAUTH_TOKEN) from the macOS keychain. Use when the user says "set up agent code review in this repo", "install the code review action", "add AI code review to this repo", "set up the AI code reviewer here", or wants automated PR review wired into the repo they're currently in.
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
2. Every secret in the script's `SECRETS` table is set in **both** the Actions and Dependabot secret stores — re-synced from the macOS keychain whenever the keychain is reachable (so rotation propagates), left as-is with a loud warning when the keychain is unreachable but the secret already exists, and a hard failure when the secret is missing *and* cannot be set. Both stores are required because GitHub feeds Dependabot-triggered runs from the separate Dependabot store; an Actions-only secret leaves every Dependabot PR review unauthenticated.

One secret is provisioned: `CLAUDE_CODE_OAUTH_TOKEN`, a Claude Pro/Max subscription token from `claude setup-token`. Which account's token it holds is named by the `SECRETS` table in `install.sh` and nowhere else — read that table, and do not restate the account name here: a second copy of it goes stale the first time a rotation updates one file, and a page naming an account the installer no longer uses is worse than a page that sends you to the installer. Which account has the job varies by which one has capacity; the swap procedure is **Rotating the reviewer account**, below. The installer never chooses and never prompts.

The keychain item is **only** ever what that table says. No environment variable overrides it: an override is a second answer to "which credential does this repo get" that fires invisibly, from whichever process happened to export it, across every repo that process installs into — while the table still names the account you would read there. One map, no override.

**Every listed secret is required.** There is no lenient arm for a secret the workflow does not consume yet — an install that cannot provision a listed secret stops, rather than finishing and leaving you believing it was provisioned. To stop provisioning a secret, remove it from the table.

Re-running when everything is current is a fast no-op that needs no keychain.

**No secret ever touches the agent.** Each flows `keychain → gh` over a pipe — never bound to a variable, never in `argv`, never printed, never in this conversation. The agent only invokes the script; it cannot observe any key.

The script validates the shared preconditions first (git repo, `gh` installed + authenticated, a resolvable GitHub remote) and fails loudly with a specific message if any is missing. The keychain is demanded only at the moment the secret must actually be written.

## Usage

Run the script from the root of the target repository:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

That is the only invocation. If a key is stored under a different keychain item name, change the item in the `SECRETS` table in `install.sh` — do not reach for an environment variable, and do not add one back.

The script does **not** commit. After it succeeds, commit and push the workflow per the user's git workflow (branch + PR — never directly to the default branch). The workflow takes effect once it lands on the default branch.

## Rotating the reviewer account

The reviewer runs as whichever Claude account the `SECRETS` table names. Tokens from `claude setup-token` never expire, but each account has its own usage quota — and an exhausted quota surfaces as a red `Review` check, a provider reporting `reviewed: false` with `not_reviewed_reason: no-review-for-head`, and this in the Actions log:

```
rate-limited: claude-code exited with status 1
Transient error on 'auto→claude-subscription' (claude-code/claude-sonnet-5) — all 3 attempts exhausted: rate-limited: claude-code exited with status 1.
```

**`Transient` there is a lie about the cause.** The account's quota is what is exhausted, `all 3 attempts exhausted` is the run having already taken your retry for you, and quota does not refill because you waited. The thought will be *"infrastructure hiccup — re-run the check"*; it costs forty minutes, returns the same red check, and ends with you asking the user to merge unreviewed. Rotate the account. That is the fix, and waiting is not a fix.

The pool is one keychain item per account, named `CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT>`. List it:

```bash
security dump-keychain | grep -oE 'CLAUDE_CODE_OAUTH_TOKEN_[A-Z0-9_]+' | sort -u
```

**1. Pick an account that can actually serve.** The listing above says which accounts exist, not which have capacity left. Ask them:

```bash
bash ~/.claude/skills/code-review-unblock/probe-accounts.sh
```

It reads the configured account out of `install.sh`'s `SECRETS` table rather than restating it, then asks every account in the pool whether it can answer right now — tokens go keychain → child process environment, never into `argv`, never printed; only a name and a verdict reach stdout. One run's output, as a sample of the format and not as a map of the current config:

```
configured in install.sh: SSSSSMOKEY

  BRANDROID      LIMITED     You've hit your weekly limit · resets Sep 13 at 1pm (America/Denver)
  QWR            AVAILABLE
  SIGNUP         AVAILABLE
* SSSSSMOKEY     AVAILABLE

(* = the account install.sh currently names)
```

Take an `AVAILABLE` account that is not the one you use interactively, so CI stops eating the quota you spend from the terminal. **A red `Review` check outranks an `AVAILABLE` verdict on the account already configured.** The probe's prompt is one line; a review is not — so `AVAILABLE` proves an account can answer, never that it has a review's worth of capacity left. If the configured account is failing runs, rotate off it even though the probe calls it available.

**2. Repoint the table.** In `install.sh` — this directory; `~/.claude/skills` is a symlink into `~/code/dotfiles`, so it's a dotfiles edit — set the keychain-item field of the `CLAUDE_CODE_OAUTH_TOKEN` row to the target account's item: `"CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT>"`. Commit in dotfiles.

**3. Sync the repo you are about to review in.** A rotation reaches nothing on its own. The review path's `setup_check` asks GitHub exactly one question — is `code-review.yml` active — and never runs the installer and never reads the keychain, so a repo keeps reviewing on the previous account, with green runs, until the installer is run in it again. So run `install.sh` from its root before reviewing there:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

One repo, at the moment it needs the credential. Do not fan a rotation out across repos ahead of time: that writes a copy of the credential into every repo to go stale on its own schedule, and then needs a second pass to hunt the stale ones down. Syncing at the point of use leaves the `SECRETS` table the only copy there is.

### Adding an account to the pool

Mint a token with `claude setup-token` while logged into the new account, then store it under the naming convention:

```bash
security add-generic-password -a "$USER" -s CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT> -w
```

Leave `-w` bare: `security` prompts for the value, keeping the token out of shell history. The item is inert until the `SECRETS` table names it.

## Failure modes

The script aborts (nonzero exit) with a clear cause when:

- `gh` is not installed
- not inside a git repository
- `gh` is not authenticated (`gh auth login`)
- the GitHub repo can't be resolved from the current directory (no GitHub remote / no access)
- a listed repo secret is missing **and** its keychain item is not available to set it — the one state where the reviewer genuinely cannot authenticate

A missing keychain item on its own is *not* fatal when the repo secret already exists: the script warns on stderr that re-syncing is impossible from this machine and exits 0. If you see an abort, fix the named cause and re-run — nothing partial is left in a bad state, since the workflow write and the secret set are independent and each convergent.
