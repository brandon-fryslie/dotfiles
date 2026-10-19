---
name: agent-code-review-setup
description: Install the agent code-review GitHub Action into the current repository — writes the .github/workflows/code-review.yml workflow and sets the reviewer's repo secret (CLAUDE_CODE_OAUTH_TOKEN) from the macOS keychain — and keep it working across the fleet. Use when the user says "set up agent code review in this repo", "install the code review action", "add AI code review to this repo", "set up the AI code reviewer here", "reconverge the fleet", "bring every repo's code-review workflow up to date", "did the reviewer actually review this PR", or wants automated PR review wired into the repo they're currently in or checked after the fact.
---

# agent-code-review-setup

Installs the [coding agent review](https://github.com/brandon-fryslie/coding-agent-review) GitHub Action into the repository the user is currently working in: writes the workflow file and provisions the repository secrets the action reads. After that, the action runs on every pull request. Two companions keep it true afterwards: a fleet pass that brings every installed repo's workflow back onto the current template, and an outcome reader that says whether a given PR was actually reviewed.

## When to use

- "Set up agent code review in this repo"
- "Install the code review action / add AI code review to this project"
- "Set up the AI code reviewer here"
- "Reconverge the fleet" / "bring every repo's code-review workflow up to date"
- "Did the reviewer actually review this PR?"

The installer operates on the git repo whose **root** is the current directory. To target a different repo, `cd` to its root first.

## How it works

Three scripts share one library. `template.sh` is the single home of the fleet policy (the action ref `ACTION_REF`, the `SECRETS` table, `BASELINE_EXCLUDES`, `DEFAULT_MAX_REVIEW_ROUNDS`), the reader for a repo's optional `.github/code-review.conf`, and the workflow template with the render that joins them. It is sourced, never run. `install.sh` and `reconverge-fleet.sh` both render through it, so there is exactly one template however many repos carry a copy.

`install.sh` **converges** the current repo onto the desired config: it renders the desired state, diffs it against what is deployed, and performs only the effects the diff demands. Two independent targets:

1. `.github/workflows/code-review.yml` matches the template, referencing the action at its moving major tag `@v1` (auto-tracks the latest non-breaking release). Identical content → no write.
2. Every secret in the `SECRETS` table exists in **both** the Actions and Dependabot secret stores — re-synced from the macOS keychain whenever the keychain is reachable (so rotation propagates), left as-is with a loud warning when the keychain is unreachable but both stores already hold it, and a hard failure naming the store that lacks it when the keychain is unreachable and a store is missing it. Both stores are required because GitHub feeds Dependabot-triggered runs from the separate Dependabot store; an Actions-only secret leaves every Dependabot PR review unauthenticated.

One secret is provisioned: `CLAUDE_CODE_OAUTH_TOKEN`, a Claude Pro/Max subscription token from `claude setup-token`. Which account's token it holds is named by the `SECRETS` table in `template.sh` and nowhere else — read that table, and do not restate the account name here: a second copy of it goes stale the first time a rotation updates one file, and a page naming an account the installer no longer uses is worse than a page that sends you to the table. Which account has the job varies by which one has capacity; the swap procedure is **Rotating the reviewer account**, below. The installer never chooses and never prompts.

The keychain item is **only** ever what that table says. No environment variable overrides it: an override is a second answer to "which credential does this repo get" that fires invisibly, from whichever process happened to export it, across every repo that process installs into — while the table still names the account you would read there. One map, no override.

**Every listed secret is required.** There is no lenient arm for a secret the workflow does not consume yet — an install that cannot provision a listed secret stops, rather than finishing and leaving you believing it was provisioned. To stop provisioning a secret, remove it from the table.

Re-running when everything is current is a fast no-op that needs no keychain.

**No secret ever touches the agent.** Each flows `keychain → gh` over a pipe — never bound to a variable, never in `argv`, never printed, never in this conversation. The agent only invokes the script; it cannot observe any key.

The script validates the shared preconditions first (`gh` installed + authenticated, cwd is the root of a git work tree, a resolvable GitHub remote) and fails loudly with a specific message if any is missing. The keychain is demanded only at the moment the secret must actually be written.

## Usage

Run the script from the **root** of the target repository — it refuses to run anywhere else, because every path it writes is relative and a run from a subdirectory would put `.github/` there:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

That is the only invocation. If a key is stored under a different keychain item name, change the item in the `SECRETS` table in `template.sh` — do not reach for an environment variable, and do not add one back.

The script does **not** commit. After it succeeds, commit and push the workflow per the user's git workflow (branch + PR — never directly to the default branch). The workflow takes effect once it lands on the default branch.

## Reconverging the fleet

Every repo was installed at a different generation of the template, and a repo on a stale generation breaks at the moment someone opens a PR — reporting zero findings exactly as a clean review does. The fleet pass closes that drift in one command:

```bash
bash ~/.claude/skills/agent-code-review-setup/reconverge-fleet.sh ~/code
```

The population is read from disk on every run, never from a list: every git repo directly under `<root>` whose `.github/workflows/code-review.yml` carries this skill's `GENERATED by` header. A repo the installer has never touched is not in it, and neither is a repo whose file at that path another tool wrote (the action's own repo generates its own). An empty population aborts with exit 1: it is a wrong root, never a converged fleet. Each repo is rendered through the same `template.sh` the installer uses, with that repo's own `.github/code-review.conf` applied, and the file is written into its working tree on whatever branch is checked out there. One line per repo, then a total:

```
<dir>  unchanged|updated|failed: <cause>  branch=<b>  workflow=<state>  secrets=<ok|missing NAME(stores)>

N repos: U unchanged, V updated, F failed
```

Exit 1 if any repo failed. `workflow=` is GitHub's registered state of the file, verbatim (`active`, `disabled_manually`, `disabled_inactivity`, `disabled_fork`, `deleted`), or `unregistered` (the file is not on the default branch yet). A failed repo's file is left untouched; the re-run after the fix writes it and reports `updated`. `secrets=` lists each required secret absent from a store, with the store named.

**It never commits, never pushes, never writes a secret, never enables a workflow.** It writes one file per repo and reports; everything else is yours to do, per repo, after reading the line:

- `updated` → commit that repo's diff under that repo's own git workflow (branch + PR, as above).
- `secrets=missing …` → `cd` to that repo's root and run `install.sh` there; the fleet pass only lists the stores, it does not fill them.
- `workflow=disabled_*` → `gh workflow enable code-review.yml -R <owner/repo>`.
- `workflow=unregistered` → the file has not landed on the default branch; merge it.
- `failed: <cause>` → fix the named cause and re-run; the pass is re-runnable and converged repos stay converged.

The thought that arrives with thirty `updated` lines in front of you is *"I'll loop over them and commit — it's the same one-line change everywhere."* That is the pass reaching past its boundary: each repo has its own branch policy, its own review cycle, and possibly a dirty tree you have not looked at, and a mass commit from outside walks through all of it. The pass wrote the file; the commit is a decision made inside each repo.

A converged file is not a working reviewer. It is a switch wired correctly that nobody has confirmed is on: a secret missing from one store, or a workflow GitHub disabled for inactivity, reviews nothing and shows nothing. The `workflow=` and `secrets=` columns are what say whether it will run — read them, not the `updated`/`unchanged` word.

## Checking that a reviewer actually reviewed

The `Review` check's colour does not answer "was this head reviewed". A failed run shows zero findings. A run that skipped (fork PR, spent round cap) shows zero findings. A disabled workflow shows no check at all. An automation whose exit condition is "no unresolved findings" reads all three as approval. Ask what the action left on the PR instead:

```bash
bash ~/.claude/skills/agent-code-review-setup/review-outcome.sh <owner/repo> <pr-number>
```

It reads the markers the action appends to the PR review bodies it posts, keeps only reviews a Bot account posted, selects those whose commit is the PR's **current** head, and prints one of:

- `reviewed` — a review was posted for this head **and** a run of the workflow on this head, for this PR, concluded success. Exit 0; the only exit 0. The second half is load-bearing: when the head moves mid-review, the action re-posts the old head's review without a commit id and GitHub stamps it with the new head, so the stamp alone can name a head the action never read.
- `not-reviewed:<reason>` — the action ran and declined, and says why (a fork PR, or the round cap).
- `unfinished` — the action started on this head and did not complete.
- `none` — no run on this head concluded success and no notice speaks for it: the run failed (before posting, or after — the ledger append and the block release run after the review is posted, and the Actions log names which), never ran, or the workflow is disabled. Older heads may carry markers; they do not speak for this one.

Everything but `reviewed` means the current head has not been reviewed, whatever the check says. `none` is the one to chase through the `workflow=` and `secrets=` columns above and the Actions log; a round-cap `not-reviewed` is the cap in `template.sh` (or the repo's `.github/code-review.conf`) doing its job, and is a halt, not a pass.

- WRONG: "The Review check is green and there are no open threads — merging."
- RIGHT: `review-outcome.sh` prints `reviewed` for the head being merged. If it prints anything else, find out why before merging.

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

It reads the configured account out of `template.sh`'s `SECRETS` table rather than restating it, then asks every account in the pool whether it can answer right now — tokens go keychain → child process environment, never into `argv`, never printed; only a name and a verdict reach stdout. One run's output, as a sample of the format and not as a map of the current config:

```
configured in template.sh: SSSSSMOKEY

  BRANDROID      LIMITED     You've hit your weekly limit · resets Sep 13 at 1pm (America/Denver)
  QWR            AVAILABLE
  SIGNUP         AVAILABLE
* SSSSSMOKEY     AVAILABLE

(* = the account template.sh currently names)
```

Take an `AVAILABLE` account that is not the one you use interactively, so CI stops eating the quota you spend from the terminal. **A red `Review` check outranks an `AVAILABLE` verdict on the account already configured.** The probe's prompt is one line; a review is not — so `AVAILABLE` proves an account can answer, never that it has a review's worth of capacity left. If the configured account is failing runs, rotate off it even though the probe calls it available.

**2. Repoint the table.** In `template.sh` — this directory; `~/.claude/skills` is a symlink into `~/code/dotfiles`, so it's a dotfiles edit — set the keychain-item field of the `CLAUDE_CODE_OAUTH_TOKEN` row to the target account's item: `"CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT>"`. Commit in dotfiles.

**3. Sync the repo you are about to review in.** A rotation reaches nothing on its own. The review path's `setup_check` asks GitHub exactly one question — is `code-review.yml` active — and never runs the installer and never reads the keychain, so a repo keeps reviewing on the previous account, with green runs, until the installer is run in it again. So run `install.sh` from its root before reviewing there:

```bash
bash ~/.claude/skills/agent-code-review-setup/install.sh
```

One repo, at the moment it needs the credential. Do not fan a rotation out across repos ahead of time: that writes a copy of the credential into every repo to go stale on its own schedule, and then needs a second pass to hunt the stale ones down. The fleet pass does not do it for you either — it reports which stores are missing the secret and writes nothing into them. Syncing at the point of use leaves the `SECRETS` table the only copy there is.

### Adding an account to the pool

Mint a token with `claude setup-token` while logged into the new account, then store it under the naming convention:

```bash
security add-generic-password -a "$USER" -s CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT> -w
```

Leave `-w` bare: `security` prompts for the value, keeping the token out of shell history. The item is inert until the `SECRETS` table names it.

## Failure modes

`install.sh` aborts (nonzero exit) with a clear cause when:

- `gh` is not installed
- `gh` is not authenticated (`gh auth login`)
- the current directory is not the root of a git work tree
- the GitHub repo can't be resolved from the current directory (no GitHub remote / no access)
- `.github/workflows/code-review.yml` exists and its header names another generator — the file is another tool's and is not overwritten
- `.github/code-review.conf` is present and malformed (unknown key, duplicate key, empty value, or `|`, `&`, `\`, `"` in a value) — the message names the file and line
- a listed repo secret is missing from a store **and** its keychain item is not available to set it — the one state where the reviewer genuinely cannot authenticate; the message names the store

A missing keychain item on its own is *not* fatal when both stores already hold the secret: the script warns on stderr that re-syncing is impossible from this machine and exits 0. If you see an abort, fix the named cause and re-run — nothing partial is left in a bad state, since the workflow write and the secret set are independent and each convergent.

`reconverge-fleet.sh` aborts before touching any repo when `gh` is missing or unauthenticated, or `<root>` is not a directory. Per repo, a remote `gh` cannot resolve, a malformed `.github/code-review.conf`, or a secret or workflow listing `gh` cannot read lands on that repo's line as `failed: <cause>` and the pass continues; exit 1 at the end if any line failed.

`review-outcome.sh` aborts when it cannot read the PR's head, list its reviews, or list the repo's runs; it never guesses `none` on a failed read.

## Testing

`just test-code-review-fleet` (`config/claude/tests/code-review-fleet.sh` in dotfiles) exercises the installer, the fleet pass and the outcome reader against a throwaway fleet with no network. Run it after any edit to `template.sh` or the three scripts.
