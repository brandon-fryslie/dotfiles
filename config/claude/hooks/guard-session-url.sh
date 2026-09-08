#!/usr/bin/env bash
# PreToolUse(Bash) guard. Two refusals, both about publishing:
#   1. a command that would PUBLISH a Claude session URL
#   2. a command that would SKIP the git hooks which catch #1
#
# Deliberately scoped to publishing verbs. Denying every command that merely
# mentions claude.ai/code/ would block reading, grepping and auditing for the
# leak -- which is the work of cleaning it up.
set -uo pipefail

cmd="$(jq -r '.tool_input.command // empty')"
[ -n "$cmd" ] || exit 0

deny() {
  jq -n --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# A publishing verb counts only in COMMAND position -- the start of the command or
# just after a separator. Matching it anywhere in the string denied commands whose
# ARGUMENTS merely discussed publishing; that false positive blocked two handoff
# messages which quoted this guard's own documentation. grep is line-oriented, so ^
# anchors each line of a script or heredoc too -- which is correct, not a leak: a
# line that begins with `git commit` beside a session URL is a script that would
# publish one. [LAW:types-are-the-program] the position is the discriminator the
# raw-string match was missing.
in_cmd_position='(^|[;&|({`]|[[:space:]](then|do|else)[[:space:]])[[:space:]]*'
publishes="${in_cmd_position}(git[[:space:]]+(commit|tag)|gh[[:space:]]+(pr|issue|release|gist)[[:space:]]+(create|edit))"

if printf '%s' "$cmd" | grep -qiE "$publishes" \
   && printf '%s' "$cmd" | grep -qiE '(https?://)?claude\.ai/code/'; then
  deny "BLOCKED: this command would publish a claude.ai/code/ session URL. That link resolves to the entire private conversation for anyone holding it, and publishing it is not reversible -- a force-push unlinks the commit but the object stays served by its SHA. Write the commit, PR or issue without the session line. Nothing replaces it: no shortened link, no id prefix, no 'session available on request'."
fi

# -n means --no-verify on commit, but --dry-run on push; only --no-verify is a
# bypass there. Chained && / || groups in a way that silently drops a case, so
# each verb gets its own branch.
bypasses_hooks=no
if printf '%s' "$cmd" | grep -qiE "${in_cmd_position}git[[:space:]]+commit([[:space:]]|\$)"; then
  printf '%s' "$cmd" | grep -qE '(--no-verify|[[:space:]]-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|$))' && bypasses_hooks=yes
elif printf '%s' "$cmd" | grep -qiE "${in_cmd_position}git[[:space:]]+push([[:space:]]|\$)"; then
  printf '%s' "$cmd" | grep -qE -- '--no-verify' && bypasses_hooks=yes
fi

if [ "$bypasses_hooks" = yes ]; then
  deny "BLOCKED: --no-verify skips the commit-msg hook that refuses Claude session URLs. That hook is the mechanical backstop for a leak that reached public repos ~1,700 times. Run the command without --no-verify; if the hook fires, remove the session link rather than bypassing the check."
fi

exit 0
