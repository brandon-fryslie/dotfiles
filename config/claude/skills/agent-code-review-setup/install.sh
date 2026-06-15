#!/usr/bin/env bash
# Install the agent code-review GitHub Action into the current repo.
#
# Two deterministic, idempotent effects:
#   1. Write .github/workflows/code-review.yml (overwrites — safe to re-run).
#   2. Set the ZAI_API_KEY GitHub repo secret from the macOS keychain.
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
ACTION_REF="brandon-fryslie/zai-coding-agent-review@v1"
KEYCHAIN_ITEM="${ZAI_KEYCHAIN_ITEM:-zai-api-key}"
SECRET_NAME="ZAI_API_KEY"
WORKFLOW_PATH=".github/workflows/code-review.yml"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- Preconditions: each fails loudly with a specific cause. [LAW:no-silent-failure] ---

command -v gh       >/dev/null 2>&1 || die "GitHub CLI 'gh' is not installed (https://cli.github.com)."
command -v security >/dev/null 2>&1 || die "'security' not found — this skill targets macOS keychain."

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a git repository (cwd=$PWD)."

gh auth status >/dev/null 2>&1 \
  || die "gh is not authenticated. Run: gh auth login"

# Resolves the repo from the current dir's remote AND confirms gh can reach it.
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
  || die "gh could not resolve a GitHub repo for $PWD (no GitHub remote, or no access)."

security find-generic-password -s "$KEYCHAIN_ITEM" >/dev/null 2>&1 \
  || die "keychain item '$KEYCHAIN_ITEM' not found in your login keychain. (override with ZAI_KEYCHAIN_ITEM=...)"

# --- Effect 1: write the workflow. Always overwrites — convergent, no mode. ---
# Quoted heredoc: GitHub Actions \${{ ... }} expressions pass through literally.
mkdir -p "$(dirname "$WORKFLOW_PATH")"
cat > "$WORKFLOW_PATH" <<'YAML'
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
          ZAI_API_KEY: ${{ secrets.ZAI_API_KEY }}
YAML
# Insert the pinned ref without escaping every GH expression in the heredoc.
# LC_ALL=C + literal match keeps this exact; fail loudly if the marker is gone.
grep -q '__ACTION_REF__' "$WORKFLOW_PATH" || die "workflow template lost its action-ref marker."
TMP="$(mktemp)"
sed "s|__ACTION_REF__|${ACTION_REF}|" "$WORKFLOW_PATH" > "$TMP" && mv "$TMP" "$WORKFLOW_PATH"

echo "✓ wrote $WORKFLOW_PATH (uses $ACTION_REF)"

# --- Effect 2: set the secret. Value never leaves the pipe. ---
# pipefail makes a failed 'security' abort the whole pipeline rather than
# letting an empty value reach gh. tr strips security's trailing newline.
echo "→ setting secret $SECRET_NAME on $REPO from keychain item '$KEYCHAIN_ITEM'…"
security find-generic-password -s "$KEYCHAIN_ITEM" -w | tr -d '\n' | gh secret set "$SECRET_NAME"
echo "✓ set secret $SECRET_NAME on $REPO"

cat <<EOF

Installed. Next step (left to you, per your git workflow):
  git add $WORKFLOW_PATH
  git commit -m "Install agent code review action"
  git push    # the workflow runs on PRs once it lands on the default branch
EOF
