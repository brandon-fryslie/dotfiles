#!/usr/bin/env bash
# Converge the agent code-review GitHub Action in the current repo onto the
# desired config: render the desired state first (pure), diff it against what
# is deployed, and perform only the effects the diff demands. Re-running when
# everything is current is a fast no-op that needs no keychain.
# [LAW:effects-at-boundaries] compute the description, act only at the edge.
#
# Two independent convergence targets:
#   1. .github/workflows/code-review.yml matches the embedded template.
#   2. Every secret in SECRETS is set on the repo (re-synced from the macOS
#      keychain whenever the keychain is reachable, so rotation propagates).
#
# Each secret flows keychain -> gh over a pipe. It is never bound to a variable,
# never passed in argv, never printed. [LAW:effects-at-boundaries]
#
# Committing/pushing the workflow is intentionally NOT done here — that is a git
# policy decision (branch vs. default, PR) left to the caller. [LAW:decomposition]
set -euo pipefail

# The moving `v1` tag, deliberately — NOT a commit SHA. This is a value, not a version
# number: every repo this installs into tracks the action's latest release for free, and
# an upstream fix reaches all of them the moment it is tagged.
#
# The SHA pin this replaces was wrong about who pays. A SHA cannot be moved, which sounds
# like safety until you count the cost: every release would require re-bumping EVERY
# consuming repo — a PR each, forever, growing with the fleet — and a fleet that expensive
# to update is a fleet that does not get updated. Repos would sit on stale builds carrying
# known bugs, which is not the safe state the pin was bought for. The upstream is a repo we
# control and review; `@v1` is the single moving tag it maintains for exactly this purpose.
#
# [LAW:one-source-of-truth] There is now ONE fact here and nothing to keep in sync. There is
# deliberately no version LABEL rendered beside the ref: under a moving tag a label is a map
# that begins lying at the next release, and a comment claiming `1.43.0` beside a step
# running `1.51.0` is worse than no comment. What is running is `@v1` — read the releases
# page for what that currently means. [FRAMING:representation]
ACTION_REF="promptctl/copirate-code-review-agent@v1"
# The action's own source repo — the ONE fact "am I installing into myself?" is decided
# from. Not read off the deployed file (a file this very script writes, and therefore a
# fact this script would be asking about its own prior output — circular, and the exact
# staleness trap that let the deployed workflow drift for months while the installer
# quietly no-op'd on it, believing that WAS dogfooding). Compared against the resolved
# $REPO below instead: a fact about the repo the installer is running in right now, from
# a source ($ACTION_REF, one line above) this script already treats as canonical.
# [LAW:one-source-of-truth]
ACTION_OWNER_REPO="${ACTION_REF%@*}"
# Each entry: "<secret name>|<keychain item>". Every listed secret is required; a
# third secret is one more line and no new code.
#
# The keychain item is declared, not derived from the secret name. The action can only
# read CLAUDE_CODE_OAUTH_TOKEN, but which account's token that holds varies by which
# has capacity. Swapping accounts is editing the second field below.
#
# There is deliberately NO environment-variable override of these items. An override
# would be a second, invisible answer to "which credential does this repo get" —
# unset in every dotfile and every shell here, so the only way it can ever fire is a
# process that exports it for itself, silently re-pointing the credential for every
# repo that process touches while this table still reads _SIGNUP. Two maps of one
# fact, and no way to ask which is lying. The table is the only map.
# [LAW:one-source-of-truth] [LAW:no-shared-mutable-globals]
SECRETS=(
  "DEEPSEEK_API_KEY|DEEPSEEK_API_KEY"
  "CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_SIGNUP"
)
WORKFLOW_PATH=".github/workflows/code-review.yml"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- Preconditions both targets need. Each fails loudly with a specific
# cause; the keychain is deliberately NOT here — it is an input to exactly one
# effect and is demanded only when that effect must write. [LAW:no-silent-failure]

command -v gh >/dev/null 2>&1 || die "GitHub CLI 'gh' is not installed (https://cli.github.com)."

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a git repository (cwd=$PWD)."

gh auth status >/dev/null 2>&1 \
  || die "gh is not authenticated. Run: gh auth login"

# Resolves the repo from the current dir's remote AND confirms gh can reach it.
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
  || die "gh could not resolve a GitHub repo for $PWD (no GitHub remote, or no access)."

# The action's own source repo installing into itself is still an install — it runs
# through the SAME render-diff-converge path as every consumer, every time, which is
# what actually makes the deployed workflow live coverage instead of a hand-maintained
# fork nobody re-syncs. It differs from a consumer install in exactly two rendered
# facts, both resolved here and nowhere else: which action ref to point `uses:` at, and
# whether the dogfood-only overlay (below) fills the template's two extension points or
# is deleted from it. [LAW:dataflow-not-control-flow] no other branch in this script
# reads IS_SELF_REPO — the two markers are it.
IS_SELF_REPO=0
[ "$REPO" = "$ACTION_OWNER_REPO" ] && IS_SELF_REPO=1
if [ "$IS_SELF_REPO" -eq 1 ]; then
  RENDER_ACTION_REF="./"
else
  RENDER_ACTION_REF="$ACTION_REF"
fi

# --- Desired state: render the workflow. Pure — no writes into the repo yet. ---
# Quoted heredoc: GitHub Actions \${{ ... }} expressions pass through literally.
DESIRED="$(mktemp)"
TMP="$(mktemp)"
trap 'rm -f "$DESIRED" "$TMP"' EXIT
cat > "$DESIRED" <<'YAML'
# GENERATED by the `agent-code-review-setup` skill — do not edit by hand.
#
# The template is NOT in this repository. It is embedded in the skill's
# installer, which lives here:
#
#   https://github.com/brandon-fryslie/dotfiles
#   config/claude/skills/agent-code-review-setup/install.sh
#
# To change the workflow: edit the template in that repo, then re-run the
# installer from this repo's root. This file is a derived copy — the installer
# reconverges it on every run and overwrites local edits silently, so editing
# here appears to work and is undone the next time anyone installs.
# [LAW:one-source-of-truth]
name: AI Code Review

# pull_request (unprivileged), NOT pull_request_target: this job checks out the
# PR head. Under pull_request_target that checkout runs privileged, with secrets
# in scope — the untrusted-checkout pattern CodeQL flags as high and that nothing
# structurally disproves (a later step could execute the checked-out tree).
# pull_request keeps the run unprivileged, so that risk cannot arise.
#
# Dependabot PRs and the secret store — LOAD-BEARING: GitHub withholds *Actions*
# secrets from Dependabot-triggered runs and instead populates the `secrets.*`
# context from a SEPARATE store (repo Settings → Secrets → Dependabot). So
# `${{ secrets.DEEPSEEK_API_KEY }}` below resolves from the Actions store for a
# human PR and from the Dependabot store for dependabot[bot]. The key MUST exist
# in BOTH stores or Dependabot reviews silently get an empty key — install.sh
# sets both. The GITHUB_TOKEN is read-only by default on Dependabot runs; the
# permissions block below elevates it so the reviewer can post its comments.
# External fork PRs get no secrets and are gated out by the action's own
# prIsFromFork check.
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  issues: write
  pull-requests: write

# One review at a time per PR: a new push supersedes the in-flight review of
# the old SHA rather than racing it to post comments.
concurrency:
  group: code-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    name: Review
    runs-on: ubuntu-latest
    # Cap a hung review (network stall, API retry loop) instead of letting it hold
    # a runner for GitHub's 6-hour default. Reviews finish in ~2-4 min typically,
    # but API congestion has stretched successful runs to 11-15 min (observed
    # 2026-08: two runs were killed at a 15-min cap and passed on rerun), so the
    # cap sits well above that tail.
    timeout-minutes: 30
    steps:
      - name: Checkout pull request
        # Moving major tag, for the same reason as the review action pin below: a SHA
        # here puts every consuming repo back on the re-bump treadmill, for a first-party
        # GitHub action where the major tag is the standard reference.
        #
        # The rule is "track the moving major" — whichever major is current *now*, not one
        # frozen at authoring time. Re-point this ref when checkout ships a new major.
        # Nothing breaks if you don't: checkout still publishes patches for older majors,
        # so a stale pin keeps passing green. That silence is exactly how this drifts —
        # the previous pin was already a major behind on the day it was written, and green
        # runs hid it until a reviewer misread the ref as nonexistent.
        #
        # The version lives on the `uses:` line and nowhere else — not in this comment,
        # not as a trailing `# vN`. Either is a second copy of what the line already
        # states, and it rots the day the ref moves. [LAW:one-source-of-truth]
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          # This is an UNTRUSTED checkout — the PR head, from any fork. The default
          # (persist-credentials: true) writes GITHUB_TOKEN into .git/config inside that
          # tree, where anything later executing out of the checkout can read a credential
          # it was never handed. The token's scope here is issues+PR write, not the
          # contents:read the checkout itself needs, so what leaks is broader than what
          # the step does. Nothing in this job pushes or fetches over authenticated git —
          # the review reads the diff through the API with the GITHUB_TOKEN input, and
          # DEPENDENCY_DIFF uses the compare API — so persisting it buys nothing and is
          # off. The review action still gets a token explicitly, via its own
          # `default: ${{ github.token }}` input; this only stops the copy on disk.
          persist-credentials: false

      # Pinned to the action's moving major tag on purpose: this repo tracks its latest
      # release with no edit here, ever. Pinning a SHA instead would mean a PR against
      # every consuming repo for every release, which in practice means none of them get
      # updated. The ref is chosen by the installer (`./` in the action's own source repo,
      # dogfooding whatever is on the checked-out branch; `ACTION_REF` everywhere else) —
      # and, like the checkout pin above, the version appears on the `uses:` line and
      # nowhere else.
      #
      # id: review — read by the dogfood-only transcript-archive step below (a no-op
      # output for consumer repos that don't reference it).
      #
      # BOTH credentials are passed on purpose. PROVIDER defaults to `auto`, which the
      # action retargets centrally — it moved from deepseek to claude-subscription in
      # 1.42.0 — and a workflow carrying only the then-current target's secret breaks the
      # day it moves. Passing both means a retarget needs no edit here: PROVIDER alone
      # selects the provider and credential presence never steers it, so the unused input
      # is simply never read. The action fails loudly, before spending anything, if the
      # credential for the CURRENT target is the one missing.
      - name: Code Review
        id: review
        uses: __ACTION_REF__
        with:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # DEPENDENCY_DIFF is on for EVERY repo this installs into — a deliberate
          # universal default baked into the template, NOT a per-repo divergence that
          # leaked in. On a PR that bumps a dependency the reviewer fetches the bumped
          # module's upstream commits and changed files instead of reviewing a bare
          # version string; that context helps in any repo and costs only a little
          # review time. Because it lives in the template, this IS the baseline: a
          # re-run of the installer preserves it. Do not "reconverge to a barer
          # default" by removing it — there is no barer default, and stripping it
          # silently degrades every dependency-bump review.
          DEPENDENCY_DIFF: "true"
          # __SELF_REPO_EXTRA_INPUTS__
      # __SELF_REPO_EXTRA_STEPS__
YAML
# Insert the rendered values without escaping every GH expression in the heredoc.
# [LAW:one-type-per-behavior] One marker today, but still a marker|value LIST: a second
# rendered value is one more entry here and no new code. Each marker is checked before it
# is replaced — a template that lost one would otherwise ship a literal __ACTION_REF__
# into a consuming repo's workflow [LAW:no-silent-failure].
for rendered in "__ACTION_REF__|${RENDER_ACTION_REF}"; do
  marker="${rendered%%|*}"
  value="${rendered#*|}"
  grep -q "$marker" "$DESIRED" || die "workflow template lost its ${marker} marker."
  sed "s|${marker}|${value}|" "$DESIRED" > "$TMP" && mv "$TMP" "$DESIRED"
done

# The dogfood-only overlay: this repo IS the action's source, so its workflow carries a
# few additions no consumer template needs — PROVIDER: auto documents the shipped
# default, EXCLUDE_PATTERNS keeps workers off the committed dist/** bundle,
# ZAI_REVIEWER_NAME stays wired to an unset repo var so the blank-input path gets live
# coverage, and the transcript-archive step aids debugging the action's own development.
# Two named extension points in the base template carry this: filled in for the self
# repo, deleted (their line, nothing else) for every other repo. One template, one
# explicit overlay this script owns — not a hand-maintained fork nobody re-syncs.
# [LAW:one-source-of-truth] [LAW:decomposition]
if [ "$IS_SELF_REPO" -eq 1 ]; then
  EXTRA_INPUTS="$(mktemp)"
  cat > "$EXTRA_INPUTS" <<'EOF'
          # Dogfood-only additions (this repo IS the action's source; not part of the
          # consumer template — see install.sh's self-repo overlay). PROVIDER: auto
          # exercises the shipped default resolution path live on every PR here.
          PROVIDER: auto
          # Deliberately left wired to a repo variable that is NOT set, so every PR here is
          # live coverage of the blank-input path: this interpolates to "", which the action
          # resolves to its own default reviewer name (parseReviewerName). Setting the
          # variable renames the reviewer without editing this file; leaving it unset must
          # stay indistinguishable from omitting the input.
          ZAI_REVIEWER_NAME: ${{ vars.ZAI_REVIEWER_NAME }}
          # dist/** is committed BUNDLED output (ncc): every feature PR changes it, and
          # reviewing the 1.5 MB bundle in full costs ~700K input tokens for zero signal —
          # CI already verifies dist matches a fresh build of src/. EXCLUDE_PATTERNS
          # REPLACES action.yml's default (it does not append), so the lock-file patterns
          # are copied from it — keep them in sync if that default changes.
          EXCLUDE_PATTERNS: "dist/**,*.lock,package-lock.json,yarn.lock,pnpm-lock.yaml"
EOF
  EXTRA_STEPS="$(mktemp)"
  cat > "$EXTRA_STEPS" <<'EOF'

      # Dogfood-only: archive the full session transcript (prompt + raw engine output
      # incl. thinking/tool calls + stderr) on every run, success or failure — not part
      # of the consumer template. if: always() captures it even when the review step
      # fails; if-no-files-found: ignore tolerates a run that spawned no engine (e.g. a
      # fork-PR skip), where the directory is legitimately empty.
      - name: Archive review transcript
        if: always() && steps.review.outputs.transcript-dir != ''
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: review-session-transcript
          path: ${{ steps.review.outputs.transcript-dir }}
          if-no-files-found: ignore
EOF
  trap 'rm -f "$DESIRED" "$TMP" "$EXTRA_INPUTS" "$EXTRA_STEPS"' EXIT
  # The portable "insert file at marker, then drop the marker" idiom: `r` queues the
  # file's content to be appended after the matched line is emitted; a SEPARATE `d`
  # address on the same pattern then drops the marker line itself. Brace-grouped
  # `{r file` + `d}` across two -e flags is GNU-only — BSD/macOS sed rejects it.
  sed -e "/__SELF_REPO_EXTRA_INPUTS__/r $EXTRA_INPUTS" -e "/__SELF_REPO_EXTRA_INPUTS__/d" \
      -e "/__SELF_REPO_EXTRA_STEPS__/r $EXTRA_STEPS" -e "/__SELF_REPO_EXTRA_STEPS__/d" \
      "$DESIRED" > "$TMP" && mv "$TMP" "$DESIRED"
else
  sed -e '/__SELF_REPO_EXTRA_INPUTS__/d' -e '/__SELF_REPO_EXTRA_STEPS__/d' \
      "$DESIRED" > "$TMP" && mv "$TMP" "$DESIRED"
fi

# --- Effect 1: converge the workflow file. An absent deployed file is a real domain
# value (fresh install), handled explicitly, not an error to suppress. Every repo,
# including the action's own source repo, converges through this SAME comparison —
# there is no longer a repo this step declines to touch. [LAW:one-source-of-truth]
if [ -f "$WORKFLOW_PATH" ] && cmp -s "$DESIRED" "$WORKFLOW_PATH"; then
  WORKFLOW_CHANGED=0
  echo "✓ $WORKFLOW_PATH is up to date (uses $RENDER_ACTION_REF)"
else
  WORKFLOW_CHANGED=1
  mkdir -p "$(dirname "$WORKFLOW_PATH")"
  cp "$DESIRED" "$WORKFLOW_PATH"
  echo "✓ wrote $WORKFLOW_PATH (uses $RENDER_ACTION_REF)"
fi

# --- Effect 2: converge each secret. The keychain is canonical and the repo
# secret is its derived copy [LAW:one-source-of-truth]: reachable keychain →
# re-sync (rotation propagates); unreachable keychain + existing copy → the
# observable desired state holds, warn that re-sync is impossible from this
# machine; unreachable keychain + no copy → fail loudly, because the reviewer
# cannot authenticate and a later "clean review" would be a lie.
# [LAW:no-silent-failure]
keychain_has_item() {
  command -v security >/dev/null 2>&1 \
    && security find-generic-password -s "$1" >/dev/null 2>&1
}
secret_on_repo() {
  # A failed listing must not read as "secret absent" — that would route a gh
  # outage into the fatal missing-secret verdict with a message naming the
  # wrong cause. List first, fail distinctly. [LAW:no-silent-failure]
  local names
  names="$(gh secret list --json name -q '.[].name')" \
    || die "could not list repo secrets on $REPO — cannot tell whether $1 is set; fix gh access and re-run."
  grep -qxF "$1" <<<"$names"
}
converge_secret() {
  local secret_name="$1" keychain_item="$2"
  # The declared item, and nothing else — no ambient override, no fallback to the
  # secret's own name. A wrong declaration must surface as a missing item, not
  # silently resolve to whatever else is filed nearby. [LAW:no-silent-failure]

  if keychain_has_item "$keychain_item"; then
    # An empty item reads back exit 0 and would set an empty secret. Gate by byte count
    # so the value never touches a variable. [LAW:no-silent-failure]
    [ "$(security find-generic-password -s "$keychain_item" -w | tr -d '\n' | wc -c)" -gt 0 ] \
      || die "keychain item '$keychain_item' has an empty value — refusing to set an empty $secret_name."
    echo "→ syncing secret $secret_name on $REPO (Actions + Dependabot) from keychain item '$keychain_item'…"
    # Both stores required: Dependabot runs read from a SEPARATE store, so an
    # Actions-only secret leaves every Dependabot review unauthenticated.
    security find-generic-password -s "$keychain_item" -w | tr -d '\n' | gh secret set "$secret_name"
    security find-generic-password -s "$keychain_item" -w | tr -d '\n' | gh secret set "$secret_name" --app dependabot
    echo "✓ set secret $secret_name on $REPO (Actions + Dependabot)"
  elif secret_on_repo "$secret_name"; then
    {
      echo "! secret $secret_name exists on $REPO but keychain item '$keychain_item' is not on this machine,"
      echo "  so it cannot be re-synced from here; the existing repo secret is left as-is."
      echo "  To re-enable syncing: add keychain item '$keychain_item' on this machine."
    } >&2
  else
    # Listed means required: provisioned or the install stops. [LAW:no-silent-failure]
    die "secret $secret_name is not set on $REPO and keychain item '$keychain_item' is not available to set it — the reviewer cannot authenticate. Add that keychain item and re-run."
  fi
}

# Split by the delimiter, not by prefix/suffix trimming: %%|* and ##*| silently read
# the wrong columns the moment a row grows. [LAW:no-silent-failure]
for secret_entry in "${SECRETS[@]}"; do
  IFS='|' read -r secret_name declared_item extra <<<"$secret_entry"
  # `extra` catches a row that still carries the removed override column: read -r would
  # otherwise fold the third field into the second and provision from an item named
  # "ITEM|junk". Reject the shape instead of resolving it. [LAW:no-silent-failure]
  [ -n "$secret_name" ] && [ -n "$declared_item" ] && [ -z "$extra" ] \
    || die "malformed SECRETS entry '$secret_entry' — expected '<secret>|<keychain item>'."
  converge_secret "$secret_name" "$declared_item"
done

if [ "$WORKFLOW_CHANGED" -eq 1 ]; then
  cat <<EOF

Workflow file changed. Next step (left to you, per your git workflow):
  git add $WORKFLOW_PATH
  git commit -m "Install agent code review action"
  git push    # the workflow runs on PRs once it lands on the default branch
EOF
fi
