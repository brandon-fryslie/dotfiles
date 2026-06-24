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

@test "e2e: fresh tab (no sidecar row for this UUID) does NOTHING (criterion F)" {
    e2e_setup
    # No sidecar file for this UUID -> carrier_read returns empty -> fresh tab.
    run env PATH="$E2E/bin:$PATH" HOME="$E2E" ITERM_RESTORE_STATE_DIR="$E2E/state" \
        ITERM_SESSION_ID="w0t0p0:ABC" \
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
    # Seed THIS tab's sidecar row (key = UUID after the colon = ABC) with a real handle.
    mkdir -p "$E2E/state"
    printf 'v1\tdir\t\t/Users/bmf/code/promptctl' > "$E2E/state/ABC"
    run env PATH="$E2E/bin:$PATH" HOME="$E2E" ITERM_RESTORE_STATE_DIR="$E2E/state" \
        ITERM_SESSION_ID="w0t0p0:ABC" \
        zsh -c "source '$E2E/restore.zsh'; restore_run"
    [ "$status" -eq 0 ]
    grep -q 'target=promptctl' "$E2E/.iterm-restore.log"
    grep -q 'save=1' "$E2E/.iterm-restore.log"
    grep -q 'wait=proceed-done' "$E2E/.iterm-restore.log"   # race fix: signalled, no timeout
    grep -q 'new-session -s promptctl' "$E2E/tmux.calls"     # created (has-session stubbed missing)
    ! grep -q 'WARNING' "$E2E/.iterm-restore.log"            # no timeout warning
}

# ---------- UUID-stability gate probe (dotfiles-iterm2-restore-5k5.1) ----------
# The probe decides the carrier's load-bearing assumption: does a session UUID
# survive an iTerm2 restart? `record` needs live iTerm2 (not unit-testable), but
# `check` is pure over an accumulated log -> proven here. A UUID seen under two
# distinct iTerm2 launch epochs == survived a restart == YES.

PROBE="$DOTFILES_ROOT/config/iterm2/restore/uuid-probe.sh"
prun() { run env ITERM_UUID_PROBE_LOG="$PLOG" bash "$PROBE" "$@"; }

setup_probe() { PLOG="$(mktemp)"; }
teardown() { [ -n "${PLOG:-}" ] && rm -f "$PLOG"; [ -n "${CSTATE:-}" ] && rm -rf "$CSTATE"; return 0; }

@test "probe check: one launch is INCONCLUSIVE (cannot conclude without a restart)" {
    setup_probe
    printf 'ts\t1000\tAAAA\nts\t1000\tBBBB\n' > "$PLOG"
    prun check
    [ "$status" -eq 2 ]
    [[ "$output" == *INCONCLUSIVE* ]]
}

@test "probe check: a UUID under two launches is YES (survived restart)" {
    setup_probe
    printf 'ts\t1000\tAAAA\nts\t1000\tOLD1\nts\t2000\tAAAA\nts\t2000\tNEW9\n' > "$PLOG"
    prun check
    [ "$status" -eq 0 ]
    [[ "$output" == *YES* ]]
    [[ "$output" == *AAAA* ]]      # the survivor is named
    [[ "$output" != *OLD1* ]]      # not-restored session is not a survivor
    [[ "$output" != *NEW9* ]]      # fresh post-restart session is not a survivor
}

@test "probe check: two launches with no overlap is NO (carrier must not key on UUID)" {
    setup_probe
    printf 'ts\t1000\tAAAA\nts\t2000\tZZZZ\n' > "$PLOG"
    prun check
    [ "$status" -eq 1 ]
    [[ "$output" == *NO* ]]
}

@test "probe check: missing log fails loudly, never silently passes" {
    setup_probe
    rm -f "$PLOG"
    prun check
    [ "$status" -ne 0 ]
    [[ "$output" == *"no probe log"* ]]
}

# ---------- UUID-keyed sidecar carrier (dotfiles-iterm2-restore-5k5.3) ----------
# The carrier persists a tab's handle keyed by the iTerm2 session UUID. It is an
# isolated seam: lib/coordination/restore/variants are unchanged. These prove the
# (uuid -> handle) contract: round-trip, no cross-tab bleed, fresh reads empty,
# fail-safe without a UUID. The old osascript/session-name read path must be gone.

setup_carrier() { CSTATE="$(mktemp -d)"; CAR="source '$R/lib.zsh'; source '$R/carrier.zsh';"; }
# The handle to write is passed via env ($H), never threaded through nested quotes,
# so a tab-containing handle survives the bash->zsh hand-off intact.
crun() { run env ITERM_RESTORE_STATE_DIR="$CSTATE" ITERM_SESSION_ID="$1" H="${3:-}" zsh -c "$CAR $2"; }

@test "carrier: write then read round-trips the exact handle for a UUID" {
    setup_carrier
    local H; H=$(printf 'v1\tdir\t\t/Users/bmf/code/promptctl')
    crun 'w0t0p0:UUID-AAA' 'carrier_write "$H"' "$H"
    [ "$status" -eq 0 ]
    crun 'w0t0p0:UUID-AAA' 'carrier_read'
    [ "$status" -eq 0 ]
    [ "$output" = "$H" ]
}

@test "carrier: a DIFFERENT UUID reads empty (no cross-tab bleed)" {
    setup_carrier
    local H; H=$(printf 'v1\tdir\t\t/x')
    crun 'w0t0p0:UUID-AAA' 'carrier_write "$H"' "$H"
    crun 'w9t9p9:UUID-BBB' 'carrier_read'
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "carrier: a fresh UUID with nothing written reads empty" {
    setup_carrier
    crun 'w0t0p0:UUID-NEW' 'carrier_read'
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "carrier: no ITERM_SESSION_ID -> read empty and write is a safe no-op" {
    setup_carrier
    run env ITERM_RESTORE_STATE_DIR="$CSTATE" zsh -c "$CAR unset ITERM_SESSION_ID; carrier_write x; carrier_read"
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "carrier: re-write replaces the prior handle (last write wins)" {
    setup_carrier
    crun 'w0t0p0:UUID-AAA' 'carrier_write old'
    crun 'w0t0p0:UUID-AAA' 'carrier_write new'
    crun 'w0t0p0:UUID-AAA' 'carrier_read'
    [ "$output" = new ]
}

@test "carrier: the osascript / session-name read path is gone" {
    run grep -c 'osascript\|name of session' "$R/carrier.zsh"
    [ "$output" = 0 ]
}
