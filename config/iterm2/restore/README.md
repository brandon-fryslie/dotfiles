# iTerm2 session-restore → tmux reconnect (redesign)

On iTerm2 restart, each restored tab recovers its prior working directory and
reconnects to its tmux session, coordinating with tmux-resurrect so a tab never
races the in-flight restore. A manual `cmd+t` is left alone.

This is the redesign of the original `config/iterm2/restore-join.zsh`, which the
audit (`dotfiles-iterm2-restore-pg4`) found broken: it recovered state by
**inference** (regex-scraping scrollback, a process-uptime gate, a boolean flag
with a fatal ordering race). This version replaces every inference with a source
of truth.

## The three seams

- **`carrier.zsh`** — *where a tab's handle survives a restart.* The handle rides
  the iTerm2 session name (verified osascript-readable; doubles as a useful tab
  title). The one part that knows about iTerm2; swap it without touching anything
  else. `[LAW:decomposition]`
- **`coordination.zsh`** — *the race fix.* The old design had the consumer raise a
  flag the resurrect hook cleared (two writers, order-dependent → stuck flag →
  120s hang). Here resurrect's hook is the **sole** writer of a set-once
  `@cwd_restore_done`; the tab only reads it. A set-once signal can't be missed or
  clobbered. `[LAW:no-ambient-temporal-coupling]` `[LAW:one-source-of-truth]`
- **`variant.zsh`** — *the identity model* (symlink → `variant-dir.zsh` or
  `variant-session.zsh`). The only thing that differs between the two designs; see
  `COMPARISON.md`.

`lib.zsh` is pure helpers; `restore.zsh` is the shared orchestration sourced by
the iTerm2 "Send text at start". Pure logic in the middle, effects (osascript,
tmux) only at the edges. `[LAW:effects-at-boundaries]`

## tmux side

    set -g @resurrect-hook-post-restore-all 'tmux set -g @cwd_restore_done 1'

That single set-once write is the positive completion signal the tabs wait on.

## What the design handles, and what still needs you

The carrier handles by design: name derivation, handle round-trip, the race-free
wait (including a late signal still proceeding and a bounded timeout), both
variants' resolution, and an end-to-end run with mocked osascript/tmux (fresh tab
inert; restored tab attaches without hanging).

The **one** thing a test can't cover: that the iTerm2 session name actually
survives an iTerm2 **quit+reopen** (not a reboot — just quit+reopen). The carrier
fails safe — an unrecognised name reads as "no handle" and the tab does nothing.
To confirm: select a variant, install, quit+reopen iTerm2, check
`~/.iterm-restore.log`.

## Selecting and installing

    ln -sf variant-session.zsh variant.zsh   # or variant-dir.zsh

Then wire `restore.zsh` into the iTerm2 Default profile's "Send text at start" via
`apply-initial-text.sh` and dotbot (not yet done — pending variant choice).
