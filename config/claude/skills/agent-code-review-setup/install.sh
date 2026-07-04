#!/usr/bin/env bash
# Converge the agent code-review GitHub Action in the current repo onto the
# desired config: render the desired state first (pure), diff it against what
# is deployed, and perform only the effects the diff demands. Re-running when
# everything is current is a fast no-op that needs no keychain.
# [LAW:effects-at-boundaries] compute the description, act only at the edge.
#
# Two independent convergence targets:
#   1. .github/workflows/code-review.yml matches the embedded template.
#   2. The DEEPSEEK_API_KEY repo secret is set (re-synced from the macOS
#      keychain whenever the keychain is reachable, so rotation propagates).
#
# The secret flows keychain -> gh over a pipe. It is never bound to a variable,
# never passed in argv, never printed. [LAW:effects-at-boundaries]
#
# Committing/pushing the workflow is intentionally NOT done here — that is a git
# policy decision (branch vs. default, PR) left to the caller. [LAW:decomposition]
set -euo pipefail

# Moving major tag: resolves to the latest v1.x release. The action repo's `v1`
# tag is the single source of truth for "what is current" — this skill never
# needs bumping. [LAW:one-source-of-truth]
ACTION_REF="brandon-fryslie/coding-agent-review@v1"
KEYCHAIN_ITEM="${DEEPSEEK_KEYCHAIN_ITEM:-DEEPSEEK_API_TOKEN}"
SECRET_NAME="DEEPSEEK_API_KEY"
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

# --- Desired state: render the workflow. Pure — no writes into the repo yet. ---
# Quoted heredoc: GitHub Actions \${{ ... }} expressions pass through literally.
DESIRED="$(mktemp)"
trap 'rm -f "$DESIRED"' EXIT
cat > "$DESIRED" <<'YAML'
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  review:
    name: Review
    runs-on: ubuntu-latest
    steps:
      - name: Checkout pull request
        uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Code Review
        uses: __ACTION_REF__
        with:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
YAML
# Insert the pinned ref without escaping every GH expression in the heredoc.
grep -q '__ACTION_REF__' "$DESIRED" || die "workflow template lost its action-ref marker."
TMP="$(mktemp)"
sed "s|__ACTION_REF__|${ACTION_REF}|" "$DESIRED" > "$TMP" && mv "$TMP" "$DESIRED"

# --- Effect 1: converge the workflow file. An absent deployed file is a real
# domain value (fresh install), handled explicitly, not an error to suppress.
if [ -f "$WORKFLOW_PATH" ] && cmp -s "$DESIRED" "$WORKFLOW_PATH"; then
  WORKFLOW_CHANGED=0
  echo "✓ $WORKFLOW_PATH is up to date (uses $ACTION_REF)"
else
  WORKFLOW_CHANGED=1
  mkdir -p "$(dirname "$WORKFLOW_PATH")"
  cp "$DESIRED" "$WORKFLOW_PATH"
  echo "✓ wrote $WORKFLOW_PATH (uses $ACTION_REF)"
fi

# --- Effect 2: converge the secret. The keychain is canonical and the repo
# secret is its derived copy [LAW:one-source-of-truth]: reachable keychain →
# re-sync (rotation propagates); unreachable keychain + existing copy → the
# observable desired state holds, warn that re-sync is impossible from this
# machine; unreachable keychain + no copy → fail loudly, because the reviewer
# cannot authenticate and a later "clean review" would be a lie.
# [LAW:no-silent-failure]
keychain_has_item() {
  command -v security >/dev/null 2>&1 \
    && security find-generic-password -s "$KEYCHAIN_ITEM" >/dev/null 2>&1
}
secret_on_repo() {
  gh secret list --json name -q '.[].name' | grep -qx "$SECRET_NAME"
}

if keychain_has_item; then
  echo "→ syncing secret $SECRET_NAME on $REPO from keychain item '$KEYCHAIN_ITEM'…"
  # pipefail makes a failed 'security' abort the whole pipeline rather than
  # letting an empty value reach gh. tr strips security's trailing newline.
  security find-generic-password -s "$KEYCHAIN_ITEM" -w | tr -d '\n' | gh secret set "$SECRET_NAME"
  echo "✓ set secret $SECRET_NAME on $REPO"
elif secret_on_repo; then
  {
    echo "! secret $SECRET_NAME exists on $REPO but keychain item '$KEYCHAIN_ITEM' is not on this machine,"
    echo "  so it cannot be re-synced from here; the existing repo secret is left as-is."
    echo "  To re-enable syncing: add the keychain item, or point DEEPSEEK_KEYCHAIN_ITEM at the right one."
  } >&2
else
  die "secret $SECRET_NAME is not set on $REPO and keychain item '$KEYCHAIN_ITEM' is not available to set it — the reviewer cannot authenticate. Add the keychain item (or set DEEPSEEK_KEYCHAIN_ITEM) and re-run."
fi

if [ "$WORKFLOW_CHANGED" -eq 1 ]; then
  cat <<EOF

Workflow file changed. Next step (left to you, per your git workflow):
  git add $WORKFLOW_PATH
  git commit -m "Install agent code review action"
  git push    # the workflow runs on PRs once it lands on the default branch
EOF
fi
