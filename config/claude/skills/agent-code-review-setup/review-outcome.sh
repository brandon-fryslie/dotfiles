#!/usr/bin/env bash
# What the code-review action actually did to a PR's CURRENT head, read from what it
# left on the PR — never from the Review check's colour alone. A failed run and a run that
# skipped both show zero findings; a disabled workflow shows nothing at all; and an
# automation whose exit condition is "no unresolved findings" reads every one of those
# as approval. [LAW:no-silent-failure]
#
# The action posts exactly one of three disjoint markers at the end of a PR review body
# (copirate-code-review-agent, src/transport.js: REVIEW_MARKER, NOT_REVIEWED_MARKER_PREFIX,
# UNFINISHED_MARKER), every one a PR review created against the commit it concerns.
# [LAW:one-source-of-truth] exception: the marker strings are restated here because they
# are the action's published contract for consumers, and this script is one; transport.js
# is the source, and a change there is a change here.
#
# Only a Bot's reviews are read — the same coarse author gate the action applies to its own
# prior reviews (transport.js: IDENTITY_MATCHERS, `bot`). A marker is a string anyone with
# write access could paste at the end of a COMMENT review; the account is stamped by the
# host and cannot be. [LAW:single-enforcer] the gate the action already chose, not a second.
#
# Bound to the head SHA on purpose: the newest marker on the PR may belong to a previous
# head that WAS reviewed, while the current head's run failed and posted nothing. Only a
# marker whose commit_id is the current head speaks for it; the newest of those is the
# highest review id, as the action itself reads them.
#
# The `reviewed` stamp alone is NOT proof, so it is crossed with the head's own run. When
# the head moves while a review is in flight, the host answers the review's inline anchors
# with 422 and the action re-posts it with no commit_id (transport.js: submitReview, "THE
# RETRY CARRIES NO commit_id"), so the host stamps a review of the OLD head with the NEW
# one. That review carries REVIEW_MARKER on a head the action never read. The one fact that
# separates it from a real review of this head is whether a run on this head concluded
# success — a successful run always posts its own, newer marker, so when one exists the
# newest marker is the run's. The not-reviewed and unfinished notices are posted with the
# commit_id and never retried, so their stamp needs no cross-check. [LAW:no-silent-failure]
#
# Usage: review-outcome.sh <owner/repo> <pr-number>
# Prints one of: reviewed | not-reviewed:<reason> | unfinished | none
# Exit 0 only for `reviewed`.
set -euo pipefail

# shellcheck source=template.sh
source "$(dirname "${BASH_SOURCE[0]}")/template.sh"

[ "$#" -eq 2 ] || die "usage: review-outcome.sh <owner/repo> <pr-number>"
REPO="$1" PR="$2"

HEAD="$(gh pr view "$PR" -R "$REPO" --json headRefOid -q .headRefOid)" \
  || die "could not read the head of $REPO#$PR."
[ -n "$HEAD" ] || die "gh returned no head SHA for $REPO#$PR."

# gh applies --jq per page and takes no --arg, so every review is projected to
# `<id>\t<commit>\t<kind>` lines, the head is selected here by exact field equality, and
# the newest-by-id selection happens once, across pages.
lines="$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate --jq '
  .[]
  | select(.user.type == "Bot")
  | (.body // "") as $b
  | (if   ($b | test("<!-- copirate-code-review-agent -->\\s*$"))                       then "reviewed"
     elif ($b | test("<!-- copirate-code-review-agent:unfinished -->\\s*$"))            then "unfinished"
     elif ($b | test("<!-- copirate-code-review-agent:not-reviewed:[a-z-]+ -->\\s*$"))  then
          "not-reviewed:" + ($b | capture("not-reviewed:(?<r>[a-z-]+) -->\\s*$").r)
     else empty end) as $kind
  | "\(.id)\t\(.commit_id)\t\($kind)"')" \
  || die "could not list reviews on $REPO#$PR."

# The ids of this workflow's runs on this head that concluded success; empty when none has.
succeeded="$(gh api "repos/$REPO/actions/workflows/${WORKFLOW_PATH##*/}/runs?head_sha=$HEAD" --paginate \
  --jq '.workflow_runs[] | select(.conclusion == "success") | .id')" \
  || die "could not list runs of $WORKFLOW_PATH on $REPO for $HEAD."

outcome="$(awk -F '\t' -v head="$HEAD" -v succeeded="${succeeded:+1}" \
  '$2 == head && ($3 != "reviewed" || succeeded)' <<<"$lines" | sort -n | tail -n 1 | cut -f3)"
echo "${outcome:-none}"
[ "$outcome" = "reviewed" ]
