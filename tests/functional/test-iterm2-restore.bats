#!/usr/bin/env bats
# test-iterm2-restore.bats - Functional tests for the redesigned iTerm2 restore
# feature (config/iterm2/restore/). Part of epic dotfiles-iterm2-restore-fvr:
# every audit criterion that CAN be checked offline, checked offline — no reboot.
#
# Three things are proven here:
#   1. the pure logic (name derivation, handle round-trip)        — criterion A
#   2. the race-free coordination, incl. that the OLD bug can't    — criterion B
#      recur (a late "done" still proceeds; no full-window hang)
#   3. variants A and B agree everywhere EXCEPT the two edge cases — the actual
#      answer to "how different are they"

load '../helpers/test-helpers'

setup() {
    command -v zsh >/dev/null 2>&1 || skip "zsh not available"
    R="$DOTFILES_ROOT/config/iterm2/restore"
    PURE="source '$R/lib.zsh'; source '$R/coordination.zsh';"
}

zrun() { run zsh -c "$PURE $1"; }

# ---------- pure logic (criterion A mechanism) ----------

@test "derive_name: \$HOME maps to default" {
    zrun "restore_derive_name \"\$HOME\""
    [ "$output" = default ]
}

@test "derive_name: project dir maps to its basename" {
    zrun 'restore_derive_name /Users/bmf/code/promptctl'
    [ "$output" = promptctl ]
}

@test "derive_name: tmux-illegal chars . and : are sanitized" {
    zrun 'restore_derive_name /tmp/my.proj:1'
    [ "$output" = 'my_proj_1' ]
}

@test "derive_name: empty cwd maps to default (never errors)" {
    zrun 'restore_derive_name ""'
    [ "$output" = default ]
}

@test "handle: make/parse round-trips kind, session, cwd" {
    zrun 'h=$(restore_make_handle session work /x/y); restore_parse_handle "$h"; print -r -- "${reply[1]}|${reply[2]}|${reply[3]}"'
    [ "$output" = 'session|work|/x/y' ]
}

@test "handle: a fresh tab name (not a v1 handle) is rejected" {
    zrun 'restore_parse_handle "shader-playground" && echo ACCEPTED || echo REJECTED'
    [ "$output" = REJECTED ]
}

@test "handle: empty string is rejected (fresh tab does nothing)" {
    zrun 'restore_parse_handle "" && echo ACCEPTED || echo REJECTED'
    [ "$output" = REJECTED ]
}

# ---------- coordination / the race fix (criterion B) ----------

@test "wait_decision: no save -> proceed immediately" {
    zrun 'restore_wait_decision 0 ""'
    [ "$output" = proceed-no-save ]
}

@test "wait_decision: save present and done flag set -> proceed" {
    zrun 'restore_wait_decision 1 1'
    [ "$output" = proceed-done ]
}

@test "wait_decision: save present, not done yet -> wait" {
    zrun 'restore_wait_decision 1 ""'
    [ "$output" = wait ]
}

@test "wait loop: no save -> instant, returns 0 (criterion E, no 120s hang)" {
    zrun 'n(){ echo 0 }; rd(){ echo "" }; nap(){ : }; restore_wait_for_restore 0 120 rd n nap; echo "rc=$?"'
    [[ "$output" == *proceed-no-save* ]]
    [[ "$output" == *rc=0* ]]
}

@test "wait loop: done flag already set -> proceeds without waiting" {
    zrun 'n(){ echo 100 }; rd(){ echo 1 }; nap(){ : }; restore_wait_for_restore 1 120 rd n nap; echo "rc=$?"'
    [[ "$output" == *proceed-done* ]]
    [[ "$output" == *rc=0* ]]
}

@test "wait loop: done flag arrives LATE -> still proceeds (the old race is dead)" {
    # The killer test. In the old design a late signal could clobber the consumer's
    # raise and hang forever. Here 'done' flips to 1 on the 3rd poll and the loop
    # proceeds — proving the set-once positive signal cannot be missed. State lives
    # in a file because each $(...) reader runs in a subshell.
    zrun '
      cf=$(mktemp); print 0 > $cf
      n(){ echo 0 }
      rd(){ local c=$(( $(cat $cf) + 1 )); print $c > $cf; (( c >= 3 )) && echo 1 || echo "" }
      nap(){ : }
      restore_wait_for_restore 1 120 rd n nap; echo "rc=$?"; rm -f $cf'
    [[ "$output" == *proceed-done* ]]
    [[ "$output" == *rc=0* ]]
}

@test "wait loop: signal never arrives -> bounded timeout, returns 1 (loud, not silent)" {
    # Clock advances via a file so it crosses the subshell boundary; done never sets.
    zrun '
      tf=$(mktemp); print 0 > $tf
      n(){ local t=$(( $(cat $tf) + 1 )); print $t > $tf; echo $t }
      rd(){ echo "" }
      nap(){ : }
      restore_wait_for_restore 1 5 rd n nap; echo "rc=$?"; rm -f $tf'
    [[ "$output" == *timeout* ]]
    [[ "$output" == *rc=1* ]]
}

# ---------- the A vs B comparison (the actual question) ----------
# Each scenario builds the handle each variant would RECORD, then resolves it.
# Output format: primary<TAB>fallback<TAB>cwd

resolve() {  # $1=variant file  $2=handle  -> echoes resolved target
    run zsh -c "source '$R/lib.zsh'; source '$R/$1'; restore_resolve_target \"\$(printf '%s' '$2')\""
}

@test "AGREE: session named after its dir -> both pick the same target" {
    # dir variant records cwd only; session variant records session=promptctl.
    local hdir='v1	dir		/Users/bmf/code/promptctl'
    local hsess='v1	session	promptctl	/Users/bmf/code/promptctl'
    resolve variant-dir.zsh "$hdir";    local A="$output"
    resolve variant-session.zsh "$hsess"; local B="$output"
    [ "$A" = "$B" ]
    [[ "$A" == promptctl$'\t'promptctl$'\t'* ]]
}

@test "AGREE: \$HOME plain-shell tab -> both resolve to default" {
    local hdir="v1	dir		$HOME"
    local hsess="v1	session		$HOME"
    resolve variant-dir.zsh "$hdir";    local A="$output"
    resolve variant-session.zsh "$hsess"; local B="$output"
    [ "$A" = "$B" ]
    [[ "$A" == default$'\t'default$'\t'* ]]
}

@test "DIVERGE: a session renamed away from its dir (work in code/promptctl)" {
    # THE difference. Dir variant ignores the custom name and targets the dir;
    # session variant preserves 'work'. Fallback is identical (dir-derived).
    local hdir='v1	dir		/Users/bmf/code/promptctl'
    local hsess='v1	session	work	/Users/bmf/code/promptctl'
    resolve variant-dir.zsh "$hdir";    local A="$output"
    resolve variant-session.zsh "$hsess"; local B="$output"
    [ "$A" != "$B" ]
    [[ "$A" == promptctl$'\t'promptctl$'\t'* ]]   # A: dir-keyed, custom name lost
    [[ "$B" == work$'\t'promptctl$'\t'* ]]        # B: exact session kept, dir-name as fallback
}

# ---------- end-to-end with mocked seams (criterion F + integration) ----------

e2e_setup() {
    E2E="$(mktemp -d "${TMPDIR:-/tmp}/iterm-restore-e2e.XXXXXX")"
    cp "$R"/*.zsh "$E2E/"
    ln -sf variant-dir.zsh "$E2E/variant.zsh"
    BIN="$E2E/bin"; mkdir -p "$BIN"
    cat > "$BIN/tmux" <<EOF
#!/usr/bin/env bash
printf '%s ' tmux "\$@" >> "$E2E/tmux.calls"; echo >> "$E2E/tmux.calls"
case "\$1 \$2" in
  "show -gv") echo 1 ;;                 # @cwd_restore_done already set
  "has-session"*) exit 1 ;;            # no live session -> create path
esac
exit 0
EOF
    chmod +x "$BIN/tmux"
    export HOME_BAK="$HOME"
}

@test "e2e: fresh tab (carrier returns no handle) does NOTHING (criterion F)" {
    e2e_setup
    cat > "$E2E/bin/osascript" <<'EOF'
#!/usr/bin/env bash
echo ""        # no name / no handle -> fresh tab
EOF
    chmod +x "$E2E/bin/osascript"
    run env PATH="$E2E/bin:$PATH" HOME="$E2E" ITERM_SESSION_ID="w0t0p0:ABC" \
        zsh -c "source '$E2E/restore.zsh'; restore_run"
    [ "$status" -eq 0 ]
    [ ! -f "$E2E/tmux.calls" ]                       # never touched tmux
    [ ! -f "$E2E/.iterm-restore.log" ]               # no log line
}

@test "e2e: restored tab attaches the resolved session, never hangs" {
    e2e_setup
    # A resurrect save exists -> the tab MUST wait for the done signal (exercises
    # the race-fix path, not the trivial no-save shortcut).
    mkdir -p "$E2E/.local/share/tmux/resurrect"
    echo "pane	x	1	1	:*	1	h	:/x	1	zsh	:" > "$E2E/.local/share/tmux/resurrect/last"
    cat > "$E2E/bin/osascript" <<'EOF'
#!/usr/bin/env bash
printf 'v1\tdir\t\t/Users/bmf/code/promptctl'      # a real handle
EOF
    chmod +x "$E2E/bin/osascript"
    run env PATH="$E2E/bin:$PATH" HOME="$E2E" ITERM_SESSION_ID="w0t0p0:ABC" \
        zsh -c "source '$E2E/restore.zsh'; restore_run"
    [ "$status" -eq 0 ]
    grep -q 'target=promptctl' "$E2E/.iterm-restore.log"
    grep -q 'save=1' "$E2E/.iterm-restore.log"
    grep -q 'wait=proceed-done' "$E2E/.iterm-restore.log"   # race fix: signalled, no timeout
    grep -q 'new-session -s promptctl' "$E2E/tmux.calls"     # created (has-session stubbed missing)
    ! grep -q 'WARNING' "$E2E/.iterm-restore.log"            # no timeout warning
}
