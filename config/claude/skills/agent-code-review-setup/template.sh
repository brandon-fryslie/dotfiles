#!/usr/bin/env bash
# The ONE home of the code-review workflow: the fleet policy, the per-repo configuration
# reader, the template, and the render that joins them. Sourced — never run — by the two
# callers that converge a repo onto it: install.sh (the cwd repo, plus its secrets) and
# reconverge-fleet.sh (every repo under a root, workflow file only), and by
# review-outcome.sh, which reads the workflow's path and nothing else. The two writers
# render through the functions here, so there is exactly one template and two effects,
# never two templates. [LAW:one-source-of-truth] [LAW:decomposition]
#
# Every function here is scoped to the CURRENT DIRECTORY, which must be the root of the
# repo being converged. Nothing here commits, pushes, or touches a secret store beyond
# listing it — those are the callers' effects. [LAW:effects-at-boundaries]
#
# Every captured step carries its own failure arm (`|| return 1`, `|| die`): bash drops
# errexit inside `$(...)` and inside an `if` condition, so a function that relied on it
# would run on past a failed read with empty values and report success. The failure is
# a value each caller must handle, not a setting. [LAW:no-silent-failure]

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
# repo that process touches while this table still names the account you would
# read here. Two maps of one fact, and no way to ask which is lying. The table is
# the only map.
# [LAW:one-source-of-truth] [LAW:no-shared-mutable-globals]
SECRETS=(
  "CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_SIGNUP"
)
WORKFLOW_PATH=".github/workflows/code-review.yml"

die() { echo "ERROR: $*" >&2; exit 1; }

# The table's shape is proved HERE, once, as it is declared — so every caller reads a row
# with a bare `IFS='|' read -r name item` and re-checks nothing. A row carrying a third
# column (the removed override) would otherwise fold into the item name and provision from
# "ITEM|junk"; a row missing one would provision an empty name. Both die at source time,
# before any caller runs a step. [LAW:parse-dont-validate] [LAW:single-enforcer]
for secret_entry in "${SECRETS[@]}"; do
  IFS='|' read -r secret_name declared_item extra <<<"$secret_entry"
  [ -n "$secret_name" ] && [ -n "$declared_item" ] && [ -z "$extra" ] \
    || die "malformed SECRETS entry '$secret_entry' in template.sh — expected '<secret>|<keychain item>'."
done
unset secret_entry secret_name declared_item extra
# The two stores a secret must exist in. GitHub feeds Dependabot-triggered runs from a
# SEPARATE store, so a secret present in one and absent from the other leaves half the
# PRs unauthenticated — see the template's own Dependabot note. A store is a value here:
# the listing and the set below iterate this, not a hand-written pair of calls.
# [LAW:one-type-per-behavior]
SECRET_STORES="actions dependabot"

# The exclude patterns EVERY repo gets. EXCLUDE_PATTERNS REPLACES action.yml's default
# rather than appending to it, so the lock-file patterns are carried explicitly here;
# dropping one from this line silently un-excludes it. [LAW:one-source-of-truth]
#
# Generated, committed build output is reviewed by NO repo. A bundle is mechanically
# derived from sources the reviewer is already reading, so a finding against it is
# either a restatement of one already made upstream or a comment on machine output
# nobody edits — and the repo's own CI proves the bundle matches a fresh build far more
# exactly than a reader can. Measured here: a review that read a 1.5 MB ncc bundle spent
# an entire scope concluding it was a "faithful, byte-consistent rebuild", at ~700K input
# tokens for that zero-signal confirmation.
#
# The directory patterns are DOUBLED on purpose — `dist/**` and `**/dist/**` are two
# different patterns, not one written twice. src/diff.js compiles each pattern to an
# anchored regex and tests it against the full path AND the basename. That basename
# fallback rescues every FILE pattern for free (`*.lock` catches
# `packages/app/src-tauri/Cargo.lock` with no `**/`), and can never rescue a DIRECTORY
# pattern, because a directory pattern's match spans separators the basename has already
# discarded. So the two anchorings cover disjoint sets: `dist/**` -> `dist/.*` matches
# only at the root, and `**/dist/**` -> `.*/dist/.*` requires a leading segment and
# matches only below it. Carrying one alone silently un-excludes the other half — a
# monorepo leaks every `packages/*/dist/**` bundle into the review, which is exactly the
# ~700K-token no-signal read described above. Do not "simplify" this to `**/dist/**`;
# that is the regression, not the cleanup.
#
# The workflow file excludes ITSELF: it is a derived copy of this template, so findings
# against it would target the copy, not the source — any fix would be silently reverted
# on the next install run. The exclusion lives here, not in a trigger-level paths-ignore:
# skipping the whole run would leave a head SHA with no review, which downstream tooling
# reads as a broken reviewer.
BASELINE_EXCLUDES="${WORKFLOW_PATH},dist/**,**/dist/**,build/**,**/build/**,*.lock,package-lock.json,yarn.lock,pnpm-lock.yaml"

# The review-round cap EVERY repo gets unless it declares its own. The action stops
# reviewing a PR after this many rounds and posts a marked not-reviewed notice instead,
# which the address-pr-reviews loop reads as a halt, never as a clean pass — so a spent
# cap does not merge unread code, it stops the line. The rendered value is always
# explicit, so this line is the fleet's default and the action's own never applies to a
# repo this installer governs. [LAW:one-source-of-truth]
#
# WHY per-repo and not fleet-wide: the cost is per PR, and PRs are not the same size
# everywhere. A stack of PRs re-reviews each member on every rebase of the one below
# it, spending rounds on diffs already read; a repo that works in stacks declares more
# headroom in .github/code-review.conf, and a repo that never stacks keeps the default.
# 0 lifts the cap; nothing here defends against a loop that spends without bound, so a
# repo declaring 0 has chosen that.
DEFAULT_MAX_REVIEW_ROUNDS="5"

# --- The per-repo half of the workflow's configuration ------------------------
#
# WHY a file in the target repo, and not a repo->patterns table here: "which files are
# worth reviewing" is a fact about ONE repo, so it belongs where that repo lives —
# reviewable in that repo's own PR, travelling with a clone, and answerable without
# reading a fleet-wide table that rots as repos are renamed or retired.
# [LAW:decomposition] cut at the joint between fleet policy and repo policy.
#
# WHY declared and not derived: there is no honest signal to infer it from. Measured
# across this fleet, promptctl/laws is 48% markdown and dotfiles is 39% — no threshold
# separates "markdown IS the product" from "markdown is docs beside code" — and GitHub's
# linguist reports 400KB of real code in laws, so by bytes it reads as an ordinary code
# repo. A heuristic here would be a guess, and a wrong guess silently disables code
# review, which is indistinguishable from a clean pass. [LAW:no-silent-failure]
#
# An absent file is the empty list — a VALUE, not a branch — so every repo that declares
# nothing renders byte-identically to before this existed. [LAW:dataflow-not-control-flow]
REPO_CONFIG_PATH=".github/code-review.conf"

# The keys this installer understands, as a CLOSED set. An unrecognized key is a typo,
# and a typo that is silently ignored leaves a repo paying for reviews it meant to stop
# paying for, with nothing in any run to say so. So an unknown key is fatal, not skipped.
# A second setting is one more entry here plus its own reader. [LAW:no-silent-failure]
CONFIG_KEYS="EXCLUDE_PATTERNS_EXTRA MAX_REVIEW_ROUNDS"

# Whether the current directory is the ROOT of a git work tree. The one predicate behind
# both "which directories are repos" (reconverge-fleet.sh's discovery) and "may this
# converge here" (resolve_repo's gate), so the population and the gate cannot disagree.
# [LAW:single-enforcer] The root, not merely inside: every path here is relative, so a
# run from a subdirectory would write .github/ into that subdirectory.
at_work_tree_root() {
  [ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ]
}

# Who wrote the cwd's workflow file, as a value: `absent`, `ours` — its GENERATED header
# names this skill, as every generation of the template has — or `foreign`, another
# generator's file at the same path (the action's own repo writes its own). The one parse
# behind "which repos are the fleet" (reconverge-fleet.sh selects `ours`) and "may this
# write proceed" (converge_workflow refuses `foreign`). [LAW:parse-dont-validate]
workflow_origin() {
  if   [ ! -f "$WORKFLOW_PATH" ];                                            then printf 'absent'
  elif grep -q '^# GENERATED by .*agent-code-review-setup' "$WORKFLOW_PATH"; then printf 'ours'
  else                                                                            printf 'foreign'
  fi
}

# The per-repo preconditions, and nothing else: the cwd is a repo root, and gh can resolve
# and reach its GitHub remote. Echoes the repo as owner/name. Per-process preconditions
# (gh installed, gh authenticated) are the callers' prologue, run once, not once per repo.
# [LAW:parse-dont-validate] What leaves here is a resolved repo, so no later step asks again.
resolve_repo() {
  at_work_tree_root || die "not at the root of a git repository (cwd=$PWD)."
  gh repo view --json nameWithOwner -q .nameWithOwner \
    || die "gh could not resolve a GitHub repo for $PWD (its own message is above)."
}

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
#
# NOT YET the whole accommodation: since its #181 the source repo reviews on a `/review`
# comment through a gate job, a trigger model this template does not carry, and its
# workflow file now names its own generator — so workflow_origin reads it as `foreign`
# and neither caller writes it. Carrying the trigger model as a rendered value is
# dotfiles-unfiled-25bc.4px; until it lands, this value is rendered for no repo.
action_ref_for() {
  local repo="$1"
  if [ "$repo" = "${ACTION_REF%@*}" ]; then printf './'; else printf '%s' "$ACTION_REF"; fi
}

# Read the repo's declaration and echo ONE key's value — empty when the file has no such
# key, and empty when there is no file at all, which is the ordinary case.
#
# The WHOLE file is validated on every call, not merely the key being asked for: a typo in
# a key nobody reads yet is still a typo, and discovering it only when a second setting
# ships is discovering it a release too late. Every rejection names file:line, because the
# operator's next act is to open that line. [LAW:no-silent-failure]
#
# [LAW:parse-dont-validate] The value leaves here already checked — non-empty, a known key,
# declared once, and free of the metacharacters that would corrupt the render — so the
# render site takes a string it can substitute without inspecting it again.
read_repo_config() {
  local want="$1"
  [ -f "$REPO_CONFIG_PATH" ] || return 0

  local lineno=0 line key value found="" seen=" "
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    # A comment starts at a `#` that opens the line or follows whitespace, as in a shell —
    # never at a `#` inside a value, which `%%#*` would cut off silently. The leading space
    # makes an opening `#` the same case as an inline one. [LAW:no-silent-failure]
    line=" $line"
    line="${line%%[[:space:]]#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -n "$line" ] || continue

    case "$line" in
      *=*) ;;
      *) die "$REPO_CONFIG_PATH:$lineno: expected KEY=value, got '$line'." ;;
    esac

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"

    case " $CONFIG_KEYS " in
      *" $key "*) ;;
      *) die "$REPO_CONFIG_PATH:$lineno: unknown key '$key'. Known keys: $CONFIG_KEYS." ;;
    esac
    case "$seen" in
      *" $key "*) die "$REPO_CONFIG_PATH:$lineno: '$key' is declared twice; it has one value." ;;
    esac
    seen="$seen$key "

    [ -n "$value" ] || die "$REPO_CONFIG_PATH:$lineno: '$key' has an empty value. Delete the line instead."
    # The value is substituted into the template by sed, which reads | as the delimiter and
    # & and \ as replacement metacharacters, and lands inside a double-quoted YAML scalar,
    # which a " would close early. A pattern carrying one would silently corrupt the
    # rendered workflow rather than fail, so it is refused here at the boundary.
    case "$value" in
      *'|'*|*'&'*|*'\'*|*'"'*) die "$REPO_CONFIG_PATH:$lineno: '$key' may not contain | & \\ or \"." ;;
    esac

    if [ "$key" = "$want" ]; then found="$value"; fi
  done < "$REPO_CONFIG_PATH"

  printf '%s' "$found"
}

# The cap this repo runs under: its own declaration, else the fleet default. Echoes a
# non-negative integer or dies naming the file and the value — the workflow input is a
# count, and a count that is not a number would be a YAML string the action rejects at
# run time, one round of billing later than here. [LAW:parse-dont-validate]
read_max_review_rounds() {
  local declared
  declared="$(read_repo_config MAX_REVIEW_ROUNDS)" || return 1
  local rounds="${declared:-$DEFAULT_MAX_REVIEW_ROUNDS}"
  case "$rounds" in
    *[!0-9]*) die "$REPO_CONFIG_PATH: MAX_REVIEW_ROUNDS must be a non-negative integer (0 = unlimited), got '$rounds'." ;;
  esac
  printf '%s' "$rounds"
}

# The template, verbatim, with its three markers unrendered. Quoted heredoc: GitHub
# Actions \${{ ... }} expressions pass through literally.
workflow_template() {
cat <<'YAML'
# GENERATED by the `agent-code-review-setup` skill — do not edit by hand.
#
# The template is NOT in this repository. It is embedded in the skill's
# installer, which lives here:
#
#   https://github.com/brandon-fryslie/dotfiles
#   config/claude/skills/agent-code-review-setup/template.sh
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
          # RENDERED, not literal. The value is the universal baseline joined with
          # whatever this repo declared in .github/code-review.conf, composed in one
          # place — see BASELINE_EXCLUDES at the top of template.sh, where the rationale
          # for each baseline pattern lives beside the patterns themselves, and
          # read_repo_config, which parses the per-repo half. [LAW:one-source-of-truth]
          EXCLUDE_PATTERNS: "__EXCLUDE_PATTERNS__"
          # RENDERED, not literal. This repo's MAX_REVIEW_ROUNDS from .github/code-review.conf,
          # else the fleet default — see DEFAULT_MAX_REVIEW_ROUNDS in template.sh for what a
          # spent cap does and why the number is a per-repo declaration.
          MAX_REVIEW_ROUNDS: "__MAX_REVIEW_ROUNDS__"

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
}

# The desired workflow for the cwd repo, on stdout. Pure given the cwd's config file:
# no write into the repo, no network. [LAW:effects-at-boundaries]
#
# The workflow's pattern list is composed HERE and only here: the fleet baseline joined
# with this repo's declaration, so the rendered value has one origin and the two halves
# stay separately owned — the baseline by this file, the addition by the repo it governs.
# An absent or silent config file yields the baseline unchanged. [LAW:one-source-of-truth]
render_workflow() {
  local repo="$1"
  local action_ref extra_excludes excludes max_review_rounds
  action_ref="$(action_ref_for "$repo")"
  extra_excludes="$(read_repo_config EXCLUDE_PATTERNS_EXTRA)" || return 1
  excludes="${BASELINE_EXCLUDES}${extra_excludes:+,${extra_excludes}}"
  if [ -n "$extra_excludes" ]; then
    echo "→ ${REPO_CONFIG_PATH} adds exclude pattern(s): ${extra_excludes}" >&2
  fi
  max_review_rounds="$(read_max_review_rounds)" || return 1
  if [ "$max_review_rounds" != "$DEFAULT_MAX_REVIEW_ROUNDS" ]; then
    echo "→ ${REPO_CONFIG_PATH} sets MAX_REVIEW_ROUNDS: ${max_review_rounds}" >&2
  fi

  # Insert the rendered values without escaping every GH expression in the heredoc.
  # [LAW:one-type-per-behavior] A marker|value LIST: a further rendered value is one more
  # entry here and no new code. Each marker is checked before it is replaced — a template
  # that lost one would otherwise ship a literal __ACTION_REF__ into a consuming repo's
  # workflow [LAW:no-silent-failure].
  local rendered="" pair marker value
  rendered="$(workflow_template)"
  for pair in "__ACTION_REF__|${action_ref}" "__EXCLUDE_PATTERNS__|${excludes}" "__MAX_REVIEW_ROUNDS__|${max_review_rounds}"; do
    marker="${pair%%|*}"
    value="${pair#*|}"
    grep -q "$marker" <<<"$rendered" || die "workflow template lost its ${marker} marker."
    rendered="$(sed "s|${marker}|${value}|" <<<"$rendered")"
  done
  printf '%s\n' "$rendered"
}

# Converge the cwd repo's workflow file onto the render and echo what happened:
# `unchanged` or `updated`. An absent deployed file is a real domain value (fresh
# install) that lands in `updated`, not an error to suppress.
#
# EVERY repo converges, with no exemption for the action's own source repo. An
# exempted repo stops receiving template changes the moment the exemption lands,
# so its workflow and this template become two representations of one thing, free
# to drift — and the exemption guarantees they do. [LAW:one-source-of-truth] The
# source repo's need is to review a PR with THAT PR's code rather than a released
# tag, and that is a difference of ONE VALUE, the action ref, rendered through the
# marker list above exactly as any other rendered value. It is not a reason to
# skip convergence. [LAW:dataflow-not-control-flow]
#
# The write carries its own failure arm: the caller captures this in `$(...)`, where errexit
# is off, so a refused write (read-only file, root-owned .github) would otherwise still echo
# `updated` and the stale file would keep running in CI, reported converged on every pass.
# [LAW:no-silent-failure]
#
# A file another generator wrote is never overwritten, by either caller: the one-repo
# installer dies naming it, and the fleet pass never selects it (workflow_origin, below, is
# the one predicate behind both). [LAW:single-enforcer]
converge_workflow() {
  local repo="$1" desired
  [ "$(workflow_origin)" != foreign ] \
    || die "$WORKFLOW_PATH in $PWD was generated by another tool (its header names it); not overwriting it."
  desired="$(render_workflow "$repo")" || return 1
  if [ -f "$WORKFLOW_PATH" ] && cmp -s <(printf '%s\n' "$desired") "$WORKFLOW_PATH"; then
    printf 'unchanged'
  else
    mkdir -p "$(dirname "$WORKFLOW_PATH")" && printf '%s\n' "$desired" > "$WORKFLOW_PATH" \
      || die "could not write $WORKFLOW_PATH in $PWD."
    printf 'updated'
  fi
}

# The stores in SECRET_STORES that lack secret $1 on repo $2, space-separated; empty
# when every store has it. A failed listing must not read as "secret absent" — that
# would route a gh outage into a missing-secret verdict with a message naming the wrong
# cause. List first, fail distinctly. [LAW:no-silent-failure]
secret_stores_missing() {
  local secret_name="$1" repo="$2" store names missing=""
  for store in $SECRET_STORES; do
    names="$(gh secret list -R "$repo" --app "$store" --json name -q '.[].name')" \
      || die "could not list $store secrets on $repo — cannot tell whether $secret_name is set; fix gh access and re-run."
    grep -qxF "$secret_name" <<<"$names" || missing="${missing:+$missing }$store"
  done
  printf '%s' "$missing"
}

# GitHub's registered state of the cwd repo's workflow, passed through verbatim (`active`,
# `disabled_manually`, `disabled_inactivity`, `disabled_fork`, `deleted` — whatever the API
# reports, not a closed set checked here), or `unregistered` when the default branch does
# not carry the file yet. Selected by path from the full listing — a parse, not a text
# match on an error message. A disabled workflow is a reviewer that reviews nothing and shows no
# check at all, invisible to a converged file. [LAW:no-silent-failure]
workflow_state() {
  local repo="$1" listing state
  # gh's --jq takes no --arg, so the listing is projected to `path<TAB>state` lines and the
  # path is selected here, by exact field equality.
  listing="$(gh api "repos/$repo/actions/workflows" --paginate --jq '.workflows[] | "\(.path)\t\(.state)"')" \
    || die "could not list workflows on $repo."
  state="$(awk -F '\t' -v path="$WORKFLOW_PATH" '$1 == path { print $2 }' <<<"$listing")"
  printf '%s' "${state:-unregistered}"
}
