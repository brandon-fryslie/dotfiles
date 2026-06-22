# iTerm2 session-restore → cwd + tmux join

Restores each iTerm2 tab to its previous working directory after an app
restart (reboot, quit+reopen, crash) and re-joins its tmux session — without
racing tmux-resurrect's restore. A manually-created tab (`cmd+t`) is left alone.

This is **one feature spread across three systems**. They are listed here so the
whole thing is legible from one place; each part below names the others.

## Setup / reproduce on a new machine

Prerequisites: iTerm2 installed and **launched once** (so its Default profile exists
in the prefs plist); tmux with tmux-resurrect + tmux-continuum (vendored under
`config/tmux/plugins`).

1. **Quit iTerm2** (it rewrites its prefs on quit and would clobber a live edit).
2. From the dotfiles repo: `./install home`  (or `just install home`). This:
   - symlinks `~/.config/iterm2 → config/iterm2` (the script) and
     `~/.config/tmux → config/tmux` (the hook), and
   - runs `apply-initial-text.sh`, setting the Default profile's "Send text at
     start" to `source ~/.config/iterm2/restore-join.zsh` (idempotent).
3. **Relaunch iTerm2.**

Verify: reboot, or quit+reopen iTerm2. Each restored tab should land in its prior
cwd on its tmux session; `~/.iterm-restore.log` records one line per restored tab
(uptime, cwd, session, attach/create, wait). A manual `cmd+t` does nothing special.

## The three parts

1. **Trigger — iTerm2 Default profile "Send text at start"** = exactly:

   ```
   source ~/.config/iterm2/restore-join.zsh
   ```

   (Resolves through the dotbot symlink `~/.config/iterm2 → config/iterm2`.) It must
   be on the **Default** profile, because iTerm2 re-runs *its own profile's* Initial
   Text on restore and restored tabs carry the Default profile — a separate/dynamic
   profile would not apply to them. iTerm2 keeps profiles in a binary plist (can't be
   symlinked), so dotbot applies this idempotently via the `shell:` step
   `apply-initial-text.sh` (python3 + plistlib, stock tools, no external deps). Run
   it with iTerm2 quit — iTerm2 rewrites prefs on quit and would clobber a live edit.

2. **Logic — `restore-join.zsh`** (this directory; the script that line sources).
   On launch it:
   - **Gates on iTerm2 process uptime** (`RESTORE_WINDOW_S`, default 120s). Only
     sessions created within the launch window are treated as restoration; a later
     `cmd+t` returns immediately and leaves the shell alone. (The profile uses
     "Recycle" working-directory, so scrollback content can't distinguish the two —
     uptime can.)
   - Reads this tab's restored scrollback via `osascript` (stock tool), extracts the
     prior cwd, `cd`s there, and derives the tmux session name from the dir basename.
   - Coordinates with resurrect via the `@cwd_restoring` contract (part 3), then
     `attach`es the dir-named session (or creates it).

3. **Hook — `config/tmux/tmux.conf`** (the `@cwd_restoring` contract):

   ```
   set -g @resurrect-hook-post-restore-all 'tmux set -g @cwd_restoring 0'
   ```

## The `@cwd_restoring` contract (why parts 2 and 3 need each other)

A single server-scoped tmux option signals "a resurrect restore is in flight":

- The **first** tab of a server-life (`restore-join.zsh`, elected via an atomic
  `if-shell` on `@cwd_booted`) sets `@cwd_restoring = 1` **only if a save exists**
  (`~/.local/share/tmux/resurrect/last`), right when it starts the server.
- Each tab then **waits while `@cwd_restoring == 1`** (capped at 120s) before
  joining, so no tab races the in-flight background restore.
- The **post-restore-all hook** (part 3) sets `@cwd_restoring = 0` when resurrect
  finishes — releasing every waiter.
- A non-restoring server (alive reopen, or cold boot with no save) leaves the flag
  at 0, so tabs join instantly with zero wait.

`@cwd_*` are runtime-only options (they die with the server), so there is no stale
state across reboots.

## Diagnostics

`restore-join.zsh` appends one line per restored tab to `~/.iterm-restore.log`
(uptime, resolved cwd, session name, attach/create, wait time). Remove that log
line once the feature is confirmed.
