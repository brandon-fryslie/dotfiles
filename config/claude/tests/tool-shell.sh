#!/usr/bin/env bash
# The managed settings baseline decides Claude's Bash-tool shell. This asserts
# the fact end to end against the live install: a claude started with SHELL
# pointing at zsh, and no --settings, still runs its tool commands in the bash
# named by settings.managed.json env.CLAUDE_CODE_SHELL.
#
# Run: config/claude/tests/tool-shell.sh   (needs a working claude login)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
expected=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["env"]["CLAUDE_CODE_SHELL"])' "$here/../settings.managed.json")

actual=$(cd /tmp && SHELL=/bin/zsh claude -p </dev/null --allowedTools Bash --permission-mode dontAsk \
  'Run exactly this bash tool command and reply with only its raw output, nothing else: ps -o comm= -p $$')
actual=${actual//[$'\r\n ']/}

if [[ "$actual" == "$expected" ]]; then
  echo "ok   - Bash tool runs $expected with SHELL=/bin/zsh in the environment"
else
  echo "FAIL - Bash tool shell: expected $expected, got '$actual'" >&2
  exit 1
fi
