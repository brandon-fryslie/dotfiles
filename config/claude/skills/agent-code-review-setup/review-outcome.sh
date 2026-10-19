#!/usr/bin/env bash
# What the code-review action actually did to a PR's CURRENT head, read from what it
# left on the PR — never from the Review check's colour. A failed run and a run that
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
# Bound to the head SHA on purpose: the newest marker on the PR may belong to a previous
# head that WAS reviewed, while the current head's run failed and posted nothing. Only a
# marker whose commit_id is the current head speaks for it; the newest of those is the
# highest review id, as the action itself reads them.
#
# Usage: review-outcome.sh <owner/repo> <pr-number>
# Prints one of: reviewed | not-reviewed:<reason> | unfinished | none
# Exit 0 only for `reviewed`.
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
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
  | (.body // "") as $b
  | (if   ($b | test("<!-- copirate-code-review-agent -->\\s*$"))                       then "reviewed"
     elif ($b | test("<!-- copirate-code-review-agent:unfinished -->\\s*$"))            then "unfinished"
     elif ($b | test("<!-- copirate-code-review-agent:not-reviewed:[a-z-]+ -->\\s*$"))  then
          "not-reviewed:" + ($b | capture("not-reviewed:(?<r>[a-z-]+) -->\\s*$").r)
     else empty end) as $kind
  | "\(.id)\t\(.commit_id)\t\($kind)"')" \
  || die "could not list reviews on $REPO#$PR."

outcome="$(awk -F '\t' -v head="$HEAD" '$2 == head' <<<"$lines" | sort -n | tail -n 1 | cut -f3)"
echo "${outcome:-none}"
[ "$outcome" = "reviewed" ]
