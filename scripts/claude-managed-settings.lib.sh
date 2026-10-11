# Sourced (bash and zsh) by install-claude-managed-settings.sh and migration 0002:
# where the Claude Code settings split lives, and the one strip of baseline copies
# out of the user file. [LAW:single-enforcer]

CLAUDE_MANAGED_DEST="/Library/Application Support/ClaudeCode/managed-settings.json"
CLAUDE_USER_SETTINGS="$HOME/.claude/settings.json"

# strip_claude_user_settings <baseline>
#
# Once the baseline is live, a copy of it in the user file is a second source that
# drifts: a rule deleted from the baseline would live on there, because lists union
# across tiers. Remove what the baseline already says - a subtree equal to the
# baseline's goes whole, a list loses the elements the baseline holds. A scalar
# inside a record that differs stays: a record's fields belong together, and the
# managed value wins anyway. [LAW:one-source-of-truth]
#
# Until the managed file IS this baseline, the user file's copy is the only live
# one, so it stays - whichever of install and migration runs last does the strip.
# [LAW:no-ambient-temporal-coupling]
strip_claude_user_settings() {
    local baseline="$1" stripped
    if ! cmp -s "$baseline" "$CLAUDE_MANAGED_DEST"; then
        echo "· $CLAUDE_MANAGED_DEST is not this baseline yet; $CLAUDE_USER_SETTINGS keeps its copy"
        return 0
    fi
    [[ -f "$CLAUDE_USER_SETTINGS" ]] || return 0

    stripped=$(jq --slurpfile m "$baseline" '
      def strip($m; $top):
        if type == "array" and ($m | type) == "array" then . - $m
        elif type == "object" and ($m | type) == "object" then
          reduce ($m | keys_unsorted[]) as $k (.;
            if has($k) | not then .
            elif ($top or (.[$k] | type) == "object" or (.[$k] | type) == "array") and .[$k] == $m[$k] then del(.[$k])
            else .[$k] |= strip($m[$k]; false)
              | if .[$k] == {} or .[$k] == [] then del(.[$k]) else . end
            end)
        else . end;
      strip($m[0]; true)
    ' "$CLAUDE_USER_SETTINGS") || return 1
    printf '%s\n' "$stripped" > "$CLAUDE_USER_SETTINGS" || return 1
    echo "✓ Removed baseline copies from $CLAUDE_USER_SETTINGS"
}
