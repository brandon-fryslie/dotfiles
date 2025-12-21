# Migrations

One-time fixes that need to run on each machine. Not for ongoing config - just for fixing broken state from past decisions.

## Quick Reference

```bash
just migrate          # Run pending migrations
just migrate-status   # Show what's been run on this machine
just migrate-new NAME # Create new migration from template
```

## When to Use Migrations

**Use migrations for:**
- Fixing broken symlinks from removed/moved files
- One-time cleanup of deprecated config locations
- Data transformations when config format changes
- Removing state that should no longer exist

**Don't use migrations for:**
- Ongoing configuration (use dotbot configs)
- Things that need to run on every install (use install scripts)
- Anything that should be reversible (migrations are fire-and-forget)

## How It Works

1. `run-migrations.sh` sources from zshrc on shell startup
2. Each `NNNN-name.sh` script in `migrations/` is checked
3. Scripts define `migrate_check()` and `migrate_apply()`
4. Marker files in `~/.local/state/dotfiles-migrations/` track completion
5. Once marked done on a machine, never runs again

## Lifecycle

```
Create migration → Run on your machine → Commit/push →
Others pull & run → Eventually delete from repo (optional)
```

### When to Delete

Migrations can be deleted from the repo once:
- All your machines have run it (check with `just migrate-status` on each)
- Enough time has passed that fresh installs won't have the old state
- You're confident no machine will ever need it

Deleted migrations don't affect machines that already ran them (markers remain).

## Writing a Migration

### File Naming

```
NNNN-short-description.sh
```
- `NNNN` = sequential number (0001, 0002, etc.)
- `short-description` = what it fixes (kebab-case)

### Required Structure

```bash
#!/usr/bin/env bash
# Migration: NNNN-short-description
# Author: your-name
# Created: YYYY-MM-DD
#
# Problem:
#   What broken state exists and why?
#
# Fix:
#   What does this migration do to fix it?
#
# Safe to delete after:
#   When can this be removed from the repo?

# Configuration
TARGET="/path/to/thing"

migrate_check() {
    # Return 0 if migration is NEEDED
    # Return 1 if already in correct state

    # Example: check if broken symlink exists
    [[ -L "$TARGET" && ! -e "$TARGET" ]] && return 0
    return 1
}

migrate_apply() {
    # Do the fix. Return 0 on success, 1 on failure.

    rm "$TARGET"
    return 0
}
```

### Guidelines

1. **Be idempotent** - `migrate_check` must correctly detect if work is already done
2. **Be specific** - Only fix what's broken, don't "improve" while you're there
3. **Be safe** - Check before deleting. Backup if unsure.
4. **Be quiet** - No output unless something goes wrong (runner handles messages)
5. **Document why** - Future you won't remember why this exists

## Tracking

### This Machine

```bash
just migrate-status
# Shows which migrations have run on THIS machine
```

Markers stored in: `~/.local/state/dotfiles-migrations/`

### All Machines

There's no central tracking. To know if all machines have run a migration:
1. SSH to each machine
2. Run `just migrate-status`
3. Or check for marker files manually

If you need fancier tracking, you're over-engineering your dotfiles.

## Debugging

### Force Re-run a Migration

```bash
# Remove the marker file
rm ~/.local/state/dotfiles-migrations/0001-name.done

# Re-run
just migrate
```

### Test a Migration

```bash
# Source it manually and call the functions
source migrations/0001-name.sh
migrate_check && echo "needs to run" || echo "already done"
```

### Migration Failed

If `migrate_apply` returns non-zero:
1. Fix the underlying issue manually
2. Either fix the migration script and re-run, or
3. Touch the marker file to skip it: `touch ~/.local/state/dotfiles-migrations/0001-name.done`
