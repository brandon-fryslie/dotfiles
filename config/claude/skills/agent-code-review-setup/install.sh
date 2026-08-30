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
  "CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_BRANDROID"
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

# The action's own source repo reviews each PR with THAT PR's code, which is the one
# thing a consumer's released `@v1` cannot do for it: a change to the reviewer must be
# exercised by the review of the PR that makes it, or the repo ships an engine no run
# ever executed.
#
# This is the WHOLE accommodation, and its shape is the point. It selects the rendered
# ACTION_REF and nothing else — the same template converges here as everywhere, on every
# PR, so every future template change reaches this repo like any other consumer. The
# predecessor put this difference in control flow instead, as a branch that declined to
# converge the source repo at all, and that is precisely how the deployed workflow and
# this template drifted into two representations of one thing: an operation that does not
# run cannot receive a change. Variability belongs in the value.
# [LAW:dataflow-not-control-flow]
#
# The discriminator derives from ACTION_REF, so "which repo is the action" is not a second
# copy free to drift from it — retarget ACTION_REF and this follows in the same edit. That
# drift is not hypothetical: the removed branch's own comment recorded the repo name having
# already diverged from ACTION_REF's owner/name. [LAW:one-source-of-truth]
[ "$REPO" = "${ACTION_REF%@*}" ] && ACTION_REF="./"

# --- Desired state: render the workflow. Pure — no writes into the repo yet. ---
# Quoted heredoc: GitHub Actions \${{ ... }} expressions pass through literally.
DESIRED="$(mktemp)"
trap 'rm -f "$DESIRED"' EXIT
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
# `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` below resolves from the Actions store for a
# human PR and from the Dependabot store for dependabot[bot]. The key MUST exist
# in BOTH stores or Dependabot reviews silently get an empty key — install.sh
# sets both. The GITHUB_TOKEN is read-only by default on Dependabot runs; the
# permissions block below elevates it so the reviewer can post its comments.
# External fork PRs get no secrets and are gated out by the action's own
# prIsFromFork check.
on:
  pull_request:
    # `ready_for_review` is deliberately ABSENT. GitHub does NOT suppress `opened`
    # for a PR created as a draft, so a draft is already reviewed at creation; and
    # nothing in this template guards on `draft == false`. Marking that PR ready
    # carries no new commit, so `head.sha` is byte-identical to the SHA just
    # reviewed — the event could only ever buy a second, fully-billed review of a
    # diff already reviewed. Adding it back requires first adding the draft guard
    # that would make the first review not happen. [LAW:no-mode-explosion]
    types: [opened, synchronize, reopened]

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
        # SHA-pinned, unlike the review action below — a deliberately DIFFERENT posture for
        # a DIFFERENT risk, not an inconsistency to tidy up. checkout is THIRD-PARTY code
        # fetched over the network on every run, including on untrusted fork PRs, and it
        # runs BEFORE the review action's own fork gating (which lives inside that action's
        # process, not in this workflow). Under a moving tag, a future compromised release
        # would execute automatically, unreviewed, on every incoming PR.
        #
        # The moving-tag argument that governs the review action does not transfer here: it
        # rests on the ref pointing at a repo we author, review, and release — a
        # relationship no third party has with us. So this pin accepts exactly the re-bump
        # cost that argument avoids, because the code being fetched is not ours.
        # [LAW:one-type-per-behavior] Two different trust relationships, two rules.
        #
        # Bump by editing this template and re-running the installer everywhere.
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
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
      # updated. The ref is chosen in the template, which owns this file — and, like the
      # checkout pin above, the version appears on the `uses:` line and nowhere else.
      #
      # ONE credential is passed. PROVIDER defaults to `auto`, which the action retargets
      # centrally, and a workflow carrying only the then-current target's secret breaks
      # the day it moves — so a retarget away from claude-subscription needs an edit here
      # plus a new keychain item. There is no second credential to absorb it. The action
      # fails loudly, before spending anything, if that credential is missing.
      - name: Code Review
        id: review
        uses: __ACTION_REF__
        with:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          # DEPENDENCY_DIFF is on for EVERY repo this installs into — a deliberate
          # universal default baked into the template, NOT a per-repo divergence that
          # leaked in. On a PR that bumps a dependency the reviewer fetches the bumped
          # module's upstream commits and changed files instead of reviewing a bare
          # version string. Scope, stated honestly: the action recognizes `go.mod`
          # require-line bumps and nothing else, so in a repo with no `go.mod` this
          # input is INERT — it costs nothing and can never fire. It is on everywhere
          # because a universally-safe default beats a per-repo question, not because
          # it helps every repo. Do not "reconverge to a barer default" by removing
          # it — there is no barer default, and stripping it silently degrades every
          # go.mod dependency-bump review.
          DEPENDENCY_DIFF: "true"
          # Generated, committed build output is reviewed by NO repo. A bundle is
          # mechanically derived from sources the reviewer is already reading, so a
          # finding against it is either a restatement of one already made upstream or
          # a comment on machine output nobody edits — and the repo's own CI proves
          # the bundle matches a fresh build far more exactly than a reader can.
          # Measured here: a review that read a 1.5 MB ncc bundle spent an entire
          # scope concluding it was a "faithful, byte-consistent rebuild", at ~700K
          # input tokens for that zero-signal confirmation.
          #
          # EXCLUDE_PATTERNS REPLACES action.yml's default rather than appending to
          # it, so the lock-file patterns are carried explicitly here. Dropping one
          # from this line silently un-excludes it. [LAW:one-source-of-truth]
          #
          # The directory patterns are DOUBLED on purpose — `dist/**` and `**/dist/**`
          # are two different patterns, not one written twice. src/diff.js compiles
          # each pattern to an anchored regex and tests it against the full path AND
          # the basename. That basename fallback rescues every FILE pattern for free
          # (`*.lock` catches `packages/app/src-tauri/Cargo.lock` with no `**/`), and
          # can never rescue a DIRECTORY pattern, because a directory pattern's match
          # spans separators the basename has already discarded. So the two anchorings
          # cover disjoint sets: `dist/**` -> `dist/.*` matches only at the root, and
          # `**/dist/**` -> `.*/dist/.*` requires a leading segment and matches only
          # below it. Carrying one alone silently un-excludes the other half — a
          # monorepo leaks every `packages/*/dist/**` bundle into the review, which is
          # exactly the ~700K-token no-signal read described above. Do not "simplify"
          # this to `**/dist/**`; that is the regression, not the cleanup.
          EXCLUDE_PATTERNS: "dist/**,**/dist/**,build/**,**/build/**,*.lock,package-lock.json,yarn.lock,pnpm-lock.yaml"

      # The transcript is the only artifact that can explain a review that failed,
      # hung, or misbehaved — the exact prompt, the raw engine output including
      # thinking and tool calls, and stderr, for every attempt. action.yml produces
      # it on EVERY termination path and documents this exact consumption; a
      # template that never consumed it left every consumer with a failed run and
      # nothing to read. [LAW:no-silent-failure]
      #
      # `if: always()` because the run that most needs a transcript is the one that
      # failed. The output guard covers the paths that legitimately spawn no engine
      # (a fork-PR skip), where the directory is empty rather than missing.
      #
      # `continue-on-error` because this job's CONCLUSION is the signal a consumer reads
      # to tell "the review found nothing" from "the review never ran" — those two are
      # otherwise identical downstream, since both surface as zero findings. An artifact
      # outage, a quota trip, or a transcript too large would otherwise flip a review that
      # succeeded and posted its comments into a reported failure, which reads as the
      # second case and sends a maintainer hunting a review that already worked. The
      # archival failure stays loud in this step's own log; it just stops speaking for the
      # review. [LAW:no-silent-failure] applies to the archival error, not to the status
      # check it would otherwise corrupt.
      - name: Archive review transcript
        if: always() && steps.review.outputs.transcript-dir != ''
        continue-on-error: true
        # SHA-pinned for the same reason as the checkout above: third-party code fetched
        # over the network on every run, so it does not inherit the moving-tag argument
        # that governs our own action.
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: review-session-transcript
          path: ${{ steps.review.outputs.transcript-dir }}
          if-no-files-found: ignore
YAML
# Insert the rendered values without escaping every GH expression in the heredoc.
# [LAW:one-type-per-behavior] One marker today, but still a marker|value LIST: a second
# rendered value is one more entry here and no new code. Each marker is checked before it
# is replaced — a template that lost one would otherwise ship a literal __ACTION_REF__
# into a consuming repo's workflow [LAW:no-silent-failure].
TMP="$(mktemp)"
trap 'rm -f "$DESIRED" "$TMP"' EXIT
for rendered in "__ACTION_REF__|${ACTION_REF}"; do
  marker="${rendered%%|*}"
  value="${rendered#*|}"
  grep -q "$marker" "$DESIRED" || die "workflow template lost its ${marker} marker."
  sed "s|${marker}|${value}|" "$DESIRED" > "$TMP" && mv "$TMP" "$DESIRED"
done

# --- Effect 1: converge the workflow file. An absent deployed file is a real
# domain value (fresh install), handled explicitly, not an error to suppress.
#
# EVERY repo converges, with no exemption for the action's own source repo. An
# exempted repo stops receiving template changes the moment the exemption lands,
# so its workflow and this template become two representations of one thing, free
# to drift — and the exemption guarantees they do. [LAW:one-source-of-truth] The
# source repo's need is to review a PR with THAT PR's code rather than a released
# tag, and that is a difference of ONE VALUE, ACTION_REF, rendered through the
# marker list above exactly as any other rendered value. It is not a reason to
# skip convergence. [LAW:dataflow-not-control-flow]
if [ -f "$WORKFLOW_PATH" ] && cmp -s "$DESIRED" "$WORKFLOW_PATH"; then
  WORKFLOW_CHANGED=0
  echo "✓ $WORKFLOW_PATH is up to date (uses $ACTION_REF)"
else
  WORKFLOW_CHANGED=1
  mkdir -p "$(dirname "$WORKFLOW_PATH")"
  cp "$DESIRED" "$WORKFLOW_PATH"
  echo "✓ wrote $WORKFLOW_PATH (uses $ACTION_REF)"
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
  names="$(gh secret list -R "$REPO" --json name -q '.[].name')" \
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
    # -R pins the same repo the message names. Without it gh re-resolves from the
    # remotes on its own, which in a fork (origin + upstream) is a different repo
    # than $REPO — secrets would land on upstream, or abort as ambiguous.
    security find-generic-password -s "$keychain_item" -w | tr -d '\n' | gh secret set "$secret_name" -R "$REPO"
    security find-generic-password -s "$keychain_item" -w | tr -d '\n' | gh secret set "$secret_name" -R "$REPO" --app dependabot
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
