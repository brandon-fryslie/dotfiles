#!/usr/bin/env bash
# Which reviewer accounts can actually answer right now — measured, never guessed.
#
# The reviewer's credential is one of a POOL of Claude subscription tokens, one
# keychain item per account (CLAUDE_CODE_OAUTH_TOKEN_<ACCOUNT>). Each account has
# its own weekly quota, so "which account has capacity" is a fact about the world
# at this instant. Reading it off a commit message, a table, or a previous
# rotation's reasoning is archaeology; this asks each account directly.
# [LAW:verifiable-goals]
#
# Each token flows keychain -> the child process's environment and nowhere else:
# never into argv, never into a printed line, never into the calling agent's
# context. The only thing that reaches stdout is an account name and a verdict.
# [LAW:effects-at-boundaries]
set -euo pipefail

PROBE_MODEL="${PROBE_MODEL:-sonnet}"
PROBE_TIMEOUT_SECS=90

# The pool is the set of keychain items following the naming convention — the
# keychain IS the registry, so an account added there is probed with no edit
# here. [LAW:one-source-of-truth]
ITEM_PREFIX="CLAUDE_CODE_OAUTH_TOKEN_"

# The installer's SECRETS table is the one map of which account the fleet is
# configured to use; this SOURCES it and reads the table itself rather than
# scraping the file for a literal, so a reshuffle of that file cannot leave this
# silently reading nothing (it did once: the table moved from install.sh to
# template.sh and the scrape fell back to "(unknown)" on every run). A missing
# file or a malformed row fails loudly on the source line. [LAW:one-source-of-truth]
# The path is relative to this script: both skills live side by side in the repo
# and under ~/.claude/skills alike.
# shellcheck source=../agent-code-review-setup/template.sh
source "$(dirname "${BASH_SOURCE[0]}")/../agent-code-review-setup/template.sh"

for binary in security claude; do
  command -v "$binary" >/dev/null 2>&1 || {
    echo "ERROR: '$binary' is not on PATH; cannot probe reviewer accounts." >&2
    exit 1
  }
done

# The first row's keychain item, minus the pool prefix, is the configured account.
configured="${SECRETS[0]#*|}"
configured="${configured#"$ITEM_PREFIX"}"

mapfile -t accounts < <(
  security dump-keychain 2>/dev/null |
    grep -oE "${ITEM_PREFIX}[A-Z0-9_]+" |
    sed "s/^${ITEM_PREFIX}//" |
    sort -u
)
(( ${#accounts[@]} > 0 )) || {
  echo "ERROR: no ${ITEM_PREFIX}* items in the keychain; the account pool is empty." >&2
  exit 1
}

printf 'configured in template.sh: %s\n\n' "$configured"

available=0
for account in "${accounts[@]}"; do
  marker=" "
  [[ "$account" == "$configured" ]] && marker="*"

  token=$(security find-generic-password -a "$USER" -s "${ITEM_PREFIX}${account}" -w 2>/dev/null) || {
    printf '%s %-14s UNREADABLE  keychain item %s%s could not be read\n' \
      "$marker" "$account" "$ITEM_PREFIX" "$account"
    continue
  }

  set +e
  reply=$(
    CLAUDE_CODE_OAUTH_TOKEN="$token" \
      timeout "$PROBE_TIMEOUT_SECS" claude -p --model "$PROBE_MODEL" \
      'Reply with exactly: ok' </dev/null 2>&1
  )
  status=$?
  set -e
  unset token

  # Three outcomes, three verdicts. A quota message is the ONE reason to rotate;
  # anything else that fails is a broken probe and says so in its own words,
  # rather than being folded into "limited" and sending the caller to rotate
  # away from an account that is fine. [LAW:parse-dont-validate]
  if [[ "$reply" == *"hit your"*"limit"* ]]; then
    printf '%s %-14s LIMITED     %s\n' "$marker" "$account" \
      "$(printf '%s' "$reply" | tr -d '\n' | tail -c 120)"
  elif (( status == 0 )); then
    printf '%s %-14s AVAILABLE\n' "$marker" "$account"
    available=$(( available + 1 ))
  else
    printf '%s %-14s ERROR       exit %d: %s\n' "$marker" "$account" "$status" \
      "$(printf '%s' "$reply" | tr -d '\n' | tail -c 120)"
  fi
done

printf '\n(* = the account template.sh currently names)\n'

# [LAW:no-silent-failure] "Every account is out of quota" is a real state with a
# real consequence — it is the one case the caller cannot resolve by rotating —
# so it exits loudly instead of printing a table that reads like a menu.
(( available > 0 )) || {
  echo "ERROR: no account in the pool has capacity right now." >&2
  exit 1
}
