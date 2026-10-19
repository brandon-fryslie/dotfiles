#!/usr/bin/env bash
# The managed settings baseline decides Claude's Bash-tool shell. Asserts the
# fact end to end against the live install: the managed drop-in is this repo's
# file, the shell it names exists here, and a claude started with SHELL
# pointing at zsh, and no --settings, picks that shell for its Bash tool — read
# from Claude Code's own debug log ("Using shell override: <path>"), which is
# deterministic where a model's reply is not. Claude Code falls back to SHELL
# detection with only a debug line when the override is not executable, so the
# executable check here is the loud version of that silence.
#
# Run: config/claude/tests/tool-shell.sh   (needs a working claude login)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
managed="$here/../settings.managed.json"
link="/Library/Application Support/ClaudeCode/managed-settings.d/10-dotfiles.json"

[[ "$(realpath "$link")" == "$(realpath "$managed")" ]] || {
  echo "FAIL - $link does not resolve to $managed; the managed baseline is not this checkout" >&2; exit 1; }
expected=$(jq -er '.env.CLAUDE_CODE_SHELL' "$managed") || {
  echo "FAIL - settings.managed.json has no env.CLAUDE_CODE_SHELL" >&2; exit 1; }
[[ -x "$expected" ]] || { echo "FAIL - $expected is not executable on this machine" >&2; exit 1; }

log=$(mktemp) && trap 'rm -f "$log"' EXIT
(cd /tmp && SHELL=/bin/zsh claude -p --debug-file "$log" --allowedTools Bash --permission-mode dontAsk </dev/null \
  'Run the bash tool command: true. Then reply ok.' >/dev/null)

if grep -qF "Using shell override: $expected" "$log"; then
  echo "ok   - Bash tool uses $expected with SHELL=/bin/zsh in the environment"
else
  echo "FAIL - no 'Using shell override: $expected' in the debug log; shell lines were:" >&2
  grep -i 'shell' "$log" >&2 || true
  exit 1
fi
