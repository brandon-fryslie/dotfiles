#!/usr/bin/env bash
# Put every repo that has the reviewer onto the account the SECRETS table in
# install.sh names. Run this after repointing that table — a rotation reaches
# nothing on its own.
#
# WHY this exists: nothing in the review path re-syncs a secret. The action
# provider's setup_check asks GitHub one question — is code-review.yml active —
# and never runs this installer and never reads the keychain. So a repo keeps
# reviewing on the previous account, with full green runs, until the installer
# is run in it again. A rotation that silently reaches one repo is the failure
# this script exists to close. [LAW:no-silent-failure]
#
# WHY it restores the workflow file: this script has ONE job, and that job is the
# secret. install.sh converges two independent targets, so running it fleet-wide
# would also rewrite .github/workflows/code-review.yml in every repo — leaving
# dozens of uncommitted diffs nobody asked for, in repos with unrelated work in
# flight. Drift is REPORTED instead, and converging it is a deliberate per-repo
# act: run install.sh there and commit the result. [LAW:decomposition]
#
# The secret write itself is never reimplemented here. This composes install.sh,
# which stays the only thing that moves a credential. [LAW:single-enforcer]
set -uo pipefail

(( BASH_VERSINFO[0] >= 4 )) || { echo "ERROR: needs bash 4+ (associative arrays); this is ${BASH_VERSION}" >&2; exit 1; }

INSTALLER="${BASH_SOURCE[0]%/*}/install.sh"
[ -f "$INSTALLER" ] || { echo "ERROR: installer not found beside this script at $INSTALLER" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh is not authenticated — run 'gh auth login'" >&2; exit 1; }

ROOT="${1:-$HOME/code}"
[ -d "$ROOT" ] || { echo "ERROR: '$ROOT' is not a directory" >&2; exit 1; }

declare -a SYNCED=() DRIFTED=() FAILED=()
declare -A SEEN=()

for d in "$ROOT"/*/; do
  wf="$d.github/workflows/code-review.yml"
  [ -f "$wf" ] || continue
  name=${d%/}; name=${name##*/}

  remote=$(cd "$d" && git remote get-url origin 2>/dev/null) || remote=""
  [ -n "$remote" ] || { FAILED+=("$name :: no origin remote"); continue; }
  slug=$(printf '%s' "$remote" | sed 's#.*[:/]\([^/]*/[^/]*\)$#\1#; s#\.git$##')
  [ -n "$slug" ] || { FAILED+=("$name :: could not parse remote '$remote'"); continue; }
  # Worktrees and second clones share a remote; the secret is a property of the
  # remote, so one visit per slug is the whole job.
  [ -z "${SEEN[$slug]:-}" ] || continue
  SEEN[$slug]=1

  snap=$(mktemp) || { echo "ERROR: mktemp failed" >&2; exit 1; }
  cp "$wf" "$snap" || { echo "ERROR: could not snapshot $wf" >&2; exit 1; }

  out=$(cd "$d" && bash "$INSTALLER" 2>&1); rc=$?

  cmp -s "$snap" "$wf" || { DRIFTED+=("$slug"); cp "$snap" "$wf" \
    || { echo "ERROR: could not restore $wf from $snap — that repo's workflow is left converged" >&2; exit 1; }; }
  rm -f "$snap"

  tail=$(printf '%s' "$out" | tr '\n' ' ' | tail -c 200)
  if [ $rc -ne 0 ]; then
    FAILED+=("$slug :: install.sh exit $rc :: $tail")
  elif printf '%s' "$out" | grep -q "✓ set secret CLAUDE_CODE_OAUTH_TOKEN"; then
    # install.sh prints this only when it actually wrote the secret from the
    # keychain. Its absence is the warn-and-keep path: the repo still carries the
    # OLD account, so it is a failure of THIS script's job, not a success.
    SYNCED+=("$slug")
  else
    FAILED+=("$slug :: exited 0 without setting the secret — still on the previous account :: $tail")
  fi
done

printf '\n===== SYNCED (%d) =====\n' "${#SYNCED[@]}";  printf '  %s\n' "${SYNCED[@]:-<none>}"
printf '\n===== WORKFLOW DRIFT — reported, restored, NOT applied (%d) =====\n' "${#DRIFTED[@]}"
printf '  %s\n' "${DRIFTED[@]:-<none>}"
printf '  Converge one deliberately: cd to it, run install.sh, commit the workflow.\n'
printf '\n===== FAILED (%d) =====\n' "${#FAILED[@]}"; printf '  %s\n' "${FAILED[@]:-<none>}"

[ ${#FAILED[@]} -eq 0 ] || exit 1
