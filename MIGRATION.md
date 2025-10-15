# Migrating from install_dotfiles.sh to Dotbot

This document explains the differences between your custom `install_dotfiles.sh` script and Dotbot, and provides a migration path.

## Current State Analysis

### What install_dotfiles.sh Does

1. **Takes a profile argument**: `./install_dotfiles.sh home` or `./install_dotfiles.sh work`
2. **Builds a file list** by:
   - First scanning `dotfiles_global/` for all files (skipping .md files)
   - Then scanning `dotfiles-{profile}/` for profile-specific files
   - Profile-specific files override global files with the same name
3. **Backs up existing files**: Moves non-symlink files from `~/` to `~/dotfiles_old/`
4. **Creates symlinks**: Links files from repo to `~/.{filename}`

### What Dotbot Does

1. **Uses YAML configuration**: Each profile has a `install-*.conf.yaml` file
2. **Declarative approach**: You explicitly list each symlink in YAML
3. **More features**:
   - Can create directories
   - Can run shell commands
   - Can clean broken symlinks
   - More control over symlink behavior
4. **No profile argument needed**: You run specific config files

## Key Differences

### 1. File Discovery

**install_dotfiles.sh**: Automatically discovers all files in directories
```bash
# Automatically finds all files in dotfiles_global/ and dotfiles-home/
./install_dotfiles.sh home
```

**Dotbot**: Explicitly declares each file in YAML
```yaml
- link:
    ~/.zshrc: dotfiles-home/zshrc
    ~/.rad-plugins: dotfiles-home/rad-plugins
```

**Trade-off**: Dotbot requires more maintenance (must update YAML when adding files) but gives you explicit control and visibility.

### 2. Override Behavior

**install_dotfiles.sh**: Profile files automatically override global files with the same basename
```bash
# If both exist, profile version wins:
# dotfiles_global/zshrc (skipped)
# dotfiles-home/zshrc (used)
```

**Dotbot**: Last declaration wins in YAML
```yaml
# Global first
~/.zshrc: dotfiles_global/zshrc
# Profile override (this one wins)
~/.zshrc: dotfiles-home/zshrc
```

### 3. Backup Strategy

**install_dotfiles.sh**: Creates `~/dotfiles_old/` and backs up existing non-symlink files
```bash
# Backs up existing files before creating symlinks
mkdir -p ~/dotfiles_old
mv ~/.zshrc ~/dotfiles_old/zshrc
```

**Dotbot**: Uses `force: true` to overwrite existing symlinks, but won't automatically backup
```yaml
- defaults:
    link:
      force: true  # Overwrites existing symlinks
      relink: true # Updates existing symlinks
```

**Important**: Dotbot won't back up your existing files. Do this manually before first run!

### 4. Running the Installation

**install_dotfiles.sh**:
```bash
./install_dotfiles.sh home
./install_dotfiles.sh work
```

**Dotbot**:
```bash
./install home  # Uses install-home.conf.yaml
./install work  # Uses install-work.conf.yaml
./install       # Uses install.conf.yaml (global only)
```

## Migration Steps

### Step 1: Backup Your Current Setup

Before switching to Dotbot completely, backup your existing dotfiles:

```bash
# Create a backup
mkdir -p ~/dotfiles_backup_$(date +%Y%m%d)
cp -r ~/.zshrc ~/.rad-plugins ~/.aider.conf.yml ~/dotfiles_backup_$(date +%Y%m%d)/
```

Or use the justfile:
```bash
just backup
```

### Step 2: Verify Dotbot Configuration

Your Dotbot configs are already set up, but verify they're complete:

**Global config** (`install.conf.yaml`):
- Lists files from `dotfiles_global/`

**Home config** (`install-home.conf.yaml`):
- Includes global files
- Adds home-specific overrides

**Work config** (`install-work.conf.yaml`):
- Includes global files
- Adds work-specific overrides

### Step 3: Check for Missing Files

The old script auto-discovered files. Check if any files are missing from Dotbot configs:

```bash
# Find files in dotfiles_global/ not in install.conf.yaml
just check-missing-global

# Find files in dotfiles-home/ not in install-home.conf.yaml
just check-missing-home

# Find files in dotfiles-work/ not in install-work.conf.yaml
just check-missing-work
```

### Step 4: Test Dotbot Installation

Test without modifying your system:

```bash
# Dry run to see what would be installed
just dry-run-home
just dry-run-work
```

Or manually review:
```bash
# Review what would be linked
just show-links-home
just show-links-work
```

### Step 5: Run Dotbot Installation

When ready, run the actual installation:

```bash
# For home profile
just install-home

# For work profile
just install-work

# For global only
just install-global
```

### Step 6: Verify Installation

Check that all symlinks are correct:

```bash
# Check all dotfiles are symlinked
just verify-home
just verify-work
```

Manually check a few critical files:
```bash
ls -la ~/.zshrc
ls -la ~/.rad-plugins
ls -la ~/.aider.conf.yml
```

### Step 7: Remove Old Script (Optional)

Once you've verified Dotbot works correctly:

```bash
# Keep for reference but don't use
mv install_dotfiles.sh install_dotfiles.sh.old
```

## Adding New Dotfiles

### Old Way (install_dotfiles.sh)

```bash
# Just create the file, it's auto-discovered
echo "new config" > dotfiles-home/newconfig
./install_dotfiles.sh home
```

### New Way (Dotbot)

```bash
# 1. Create the file
echo "new config" > dotfiles-home/newconfig

# 2. Add to install-home.conf.yaml
# Edit the file and add:
#   ~/.newconfig: dotfiles-home/newconfig

# 3. Run installation
just install-home
```

## Advantages of Dotbot

1. **Explicit configuration**: No surprises about what gets linked
2. **Version controlled**: Your symlink configuration is in git
3. **Additional features**: Can run shell commands, create directories, etc.
4. **Better error handling**: Clear YAML syntax errors
5. **Widely used**: More documentation and community support
6. **Extensible**: Plugin system for custom behavior

## Disadvantages of Dotbot

1. **More manual work**: Must explicitly add each file to YAML
2. **No automatic backup**: Need to handle backups yourself
3. **Verbose**: YAML can be more verbose than bash script
4. **Learning curve**: Need to understand YAML syntax

## Recommended Workflow

1. **Keep both tools initially**: Test Dotbot while having install_dotfiles.sh as backup
2. **Use justfile**: Simplifies common operations
3. **Add verification**: Run `just verify-home` after changes
4. **Document in git**: Commit message should note which files were added/changed

## Troubleshooting

### Symlink conflicts

If Dotbot reports conflicts:
```bash
# Check what's already linked
ls -la ~/.<file>

# Remove old symlink if safe
rm ~/.<file>

# Re-run Dotbot
just install-home
```

### Files not linking

Check YAML syntax:
```bash
# Validate YAML
just validate
```

### Want old behavior back

```bash
# Your old script still works
./install_dotfiles.sh home
```

## Summary

| Feature | install_dotfiles.sh | Dotbot |
|---------|-------------------|--------|
| File discovery | Automatic | Manual (YAML) |
| Override behavior | Implicit (basename match) | Explicit (order in YAML) |
| Backup strategy | Automatic to ~/dotfiles_old | Manual |
| Configuration | Bash code | YAML declarative |
| Profile selection | Command argument | Different config files |
| Extensibility | Edit bash script | YAML + plugins |
| Community support | Custom solution | Popular tool |

**Recommendation**: Migrate to Dotbot for better maintainability and explicit control. Use the justfile to make common operations easy.
