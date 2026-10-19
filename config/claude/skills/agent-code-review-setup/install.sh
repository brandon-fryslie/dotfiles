#!/usr/bin/env bash
# Converge the agent code-review GitHub Action in the current repo onto the
# desired config: render the desired state first (pure), diff it against what
# is deployed, and perform only the effects the diff demands. Re-running when
# everything is current is a fast no-op that needs no keychain.
# [LAW:effects-at-boundaries] compute the description, act only at the edge.
#
# Two independent convergence targets:
#   1. .github/workflows/code-review.yml matches the template in template.sh.
#   2. Every secret in SECRETS is set on the repo (re-synced from the macOS
#      keychain whenever the keychain is reachable, so rotation propagates).
#
# The policy, the template and the render live in template.sh, shared with
# reconverge-fleet.sh, which converges target 1 across every repo under a root.
# This script is the ONE-REPO caller: the cwd, plus its secrets. [LAW:decomposition]
#
# Each secret flows keychain -> gh over a pipe. It is never bound to a variable,
# never passed in argv, never printed. [LAW:effects-at-boundaries]
#
# Committing/pushing the workflow is intentionally NOT done here — that is a git
# policy decision (branch vs. default, PR) left to the caller. [LAW:decomposition]
set -euo pipefail

# shellcheck source=template.sh
source "${BASH_SOURCE[0]%/*}/template.sh"

# --- Per-process preconditions. Each fails loudly with a specific cause; the
# keychain is deliberately NOT here — it is an input to exactly one effect and is
# demanded only when that effect must write. [LAW:no-silent-failure]
command -v gh >/dev/null 2>&1 || die "GitHub CLI 'gh' is not installed (https://cli.github.com)."
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

# The per-repo preconditions (repo root, resolvable remote) are resolve_repo's.
REPO="$(resolve_repo)"

# --- Effect 1: converge the workflow file.
WORKFLOW_STATUS="$(converge_workflow "$REPO")"
case "$WORKFLOW_STATUS" in
  unchanged) WORKFLOW_CHANGED=0; echo "✓ $WORKFLOW_PATH is up to date (uses $(action_ref_for "$REPO"))" ;;
  updated)   WORKFLOW_CHANGED=1; echo "✓ wrote $WORKFLOW_PATH (uses $(action_ref_for "$REPO"))" ;;
esac

# --- Effect 2: converge each secret. The keychain is canonical and the repo
# secret is its derived copy [LAW:one-source-of-truth]: reachable keychain →
# re-sync (rotation propagates); unreachable keychain + copy in every store → the
# observable desired state holds, warn that re-sync is impossible from this
# machine; unreachable keychain + a store without it → fail loudly, because the
# reviewer cannot authenticate there and a later "clean review" would be a lie.
# [LAW:no-silent-failure]
keychain_has_item() {
  command -v security >/dev/null 2>&1 \
    && security find-generic-password -s "$1" >/dev/null 2>&1
}
converge_secret() {
  local secret_name="$1" keychain_item="$2" store missing
  # The declared item, and nothing else — no ambient override, no fallback to the
  # secret's own name. A wrong declaration must surface as a missing item, not
  # silently resolve to whatever else is filed nearby. [LAW:no-silent-failure]

  if keychain_has_item "$keychain_item"; then
    # An empty item reads back exit 0 and would set an empty secret. Gate by byte count
    # so the value never touches a variable. [LAW:no-silent-failure]
    [ "$(security find-generic-password -s "$keychain_item" -w | tr -d '\n' | wc -c)" -gt 0 ] \
      || die "keychain item '$keychain_item' has an empty value — refusing to set an empty $secret_name."
    echo "→ syncing secret $secret_name on $REPO ($SECRET_STORES) from keychain item '$keychain_item'…"
    # Every store in SECRET_STORES: Dependabot runs read from a SEPARATE store, so an
    # Actions-only secret leaves every Dependabot review unauthenticated.
    # -R pins the same repo the message names. Without it gh re-resolves from the
    # remotes on its own, which in a fork (origin + upstream) is a different repo
    # than $REPO — secrets would land on upstream, or abort as ambiguous.
    for store in $SECRET_STORES; do
      security find-generic-password -s "$keychain_item" -w | tr -d '\n' | gh secret set "$secret_name" -R "$REPO" --app "$store"
    done
    echo "✓ set secret $secret_name on $REPO ($SECRET_STORES)"
  else
    missing="$(secret_stores_missing "$secret_name" "$REPO")"
    if [ -z "$missing" ]; then
      {
        echo "! secret $secret_name exists on $REPO but keychain item '$keychain_item' is not on this machine,"
        echo "  so it cannot be re-synced from here; the existing repo secret is left as-is."
        echo "  To re-enable syncing: add keychain item '$keychain_item' on this machine."
      } >&2
    else
      # Listed means required: provisioned or the install stops. [LAW:no-silent-failure]
      die "secret $secret_name is not set on $REPO ($missing) and keychain item '$keychain_item' is not available to set it — the reviewer cannot authenticate. Add that keychain item and re-run."
    fi
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
