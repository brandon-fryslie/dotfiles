# File Watchers for Auto-Regenerating Configs

This system uses macOS launchd to automatically regenerate config files whenever their source files change. No symlinks - files are merged and copied.

## ⚠️ CRITICAL: iCloud Drive Limitation

**The watchers system currently does not function when the dotfiles repository is stored in iCloud Drive.**

### Why This Happens

macOS launchd agents require Full Disk Access permission to execute scripts located in iCloud Drive directories (`~/Library/Mobile Documents/`). This is a security restriction that cannot be bypassed without granting system-wide permissions.

**Current repository location:** `~/Library/Mobile Documents/com~apple~CloudDocs/_mine/icode/dotfiles` (iCloud Drive)

### Impact

If you attempt to set up watchers while the repository is in iCloud Drive:
- launchd agents will fail to load with "Operation not permitted" errors
- File changes will not trigger merges
- No error messages will appear in normal operation
- You'll need to check Console.app logs to see permission errors

### Solutions

**Option 1: Move Repository Outside iCloud Drive [RECOMMENDED]**
```bash
# Move to local directory
mv ~/Library/Mobile\ Documents/com~apple~CloudDocs/_mine/icode/dotfiles ~/icode/dotfiles
cd ~/icode/dotfiles
just install-home  # Re-install symlinks
```

**Option 2: Copy Scripts to Non-iCloud Location [COMPLEX]**
- Modify `setup-watchers.sh` to copy scripts to `~/.local/bin/` or `~/bin/`
- Update launchd plists to reference copied scripts
- Maintain two copies of scripts (development risk)

**Option 3: Use Alternative File Watching [FUTURE]**
- Replace launchd with `fswatch` (no permission issues)
- Requires architecture change
- Not currently implemented

### Checking Your Installation

To check if you're affected:
```bash
# Check repository location
pwd
# If output contains "Mobile Documents" or "iCloud", watchers won't work

# Alternative: check if in iCloud
[[ "$(pwd)" =~ "Library/Mobile Documents" ]] && echo "⚠️ In iCloud Drive - watchers will not work" || echo "✓ Not in iCloud - watchers should work"
```

### Recommendation

**For now, do NOT attempt to use the watchers system if your repository is in iCloud Drive.** Either move the repository to a local directory or wait for a future architecture update.

This limitation will be addressed in a future sprint. See GitHub issues for progress.

---

## Why Use This?

- **Auto-merge JSON configs**: Keep base config + profile overrides, automatically merge them
- **No templating**: Just plain JSON files that get merged
- **Instant updates**: Changes to source files immediately regenerate output
- **Profile separation**: Keep home/work configs separate, merge them at runtime

## How It Works

1. **Source files**: Keep multiple JSON files in `config-sources/`
   - `base-config.json` - shared settings
   - `home-override.json` - home-specific overrides
   - `work-override.json` - work-specific overrides

2. **launchd watcher**: Monitors source files for changes

3. **Merge script**: When changes detected, runs `merge-json.sh` to combine files

4. **Output file**: Merged result written to `~/.config/app-config.json`

## Setup

### Quick Start

```bash
# Run the example watcher setup
just setup-watchers

# Or manually run the example
chmod +x scripts/setup-example-watcher.sh
./scripts/setup-example-watcher.sh
```

### Manual Setup

To create your own watcher:

1. **Create source files** in `config-sources/`:
   ```bash
   # Base config shared across profiles
   cat > config-sources/my-app-base.json <<EOF
   {
     "setting1": "value1",
     "setting2": "value2"
   }
   EOF

   # Home profile overrides
   cat > config-sources/my-app-home.json <<EOF
   {
     "setting2": "home-value"
   }
   EOF
   ```

2. **Edit `scripts/setup-watchers.sh`** and add:
   ```bash
   create_watcher \
       "com.user.my-app-merge" \
       "${SCRIPT_DIR}/merge-json.sh" \
       "$HOME/.config/my-app.json" \
       "${SCRIPT_DIR}/../config-sources/my-app-base.json" \
       "${SCRIPT_DIR}/../config-sources/my-app-home.json"
   ```

3. **Run setup**:
   ```bash
   just setup-watchers
   ```

## Usage

### Managing Watchers

```bash
# Setup all watchers
just setup-watchers

# List active watchers
just list-watchers

# Remove all watchers
just remove-watchers

# View logs for a watcher
just watch-logs com.user.dotfiles-config-merge
```

### Manual Merging

You can also manually merge files without watchers:

```bash
# Merge two JSON files
just merge-example config-sources/base.json config-sources/override.json ~/.config/output.json

# Or directly with the script
./scripts/merge-json.sh output.json input1.json input2.json input3.json
```

### Testing Your Setup

```bash
# 1. Setup the example watcher
./scripts/setup-example-watcher.sh

# 2. Check the output
cat ~/.config/app-config.json

# 3. Edit a source file
echo '{"newSetting": "test"}' >> config-sources/home-override.json

# 4. Wait a moment, then check output again (should be updated)
cat ~/.config/app-config.json

# 5. View logs
tail ~/Library/Logs/com.user.dotfiles-config-merge.log
```

## How JSON Merging Works

The merge script uses `jq` to merge JSON objects. Later files override earlier ones:

```json
// base-config.json
{
  "editor": "vim",
  "theme": "dark",
  "settings": {
    "tabSize": 2,
    "autoSave": true
  }
}

// home-override.json
{
  "editor": "idea",
  "settings": {
    "tabSize": 4
  }
}

// Result: ~/.config/app-config.json
{
  "editor": "idea",        // overridden
  "theme": "dark",         // from base
  "settings": {
    "tabSize": 4,          // overridden
    "autoSave": true       // from base
  }
}
```

## launchd Details

### Plist Location
Watchers are installed to: `~/Library/LaunchAgents/com.user.*.plist`

### Logs
- Stdout: `~/Library/Logs/com.user.{watcher-name}.log`
- Stderr: `~/Library/Logs/com.user.{watcher-name}.error.log`

### Manual Control

```bash
# Load a watcher
launchctl load ~/Library/LaunchAgents/com.user.my-watcher.plist

# Unload a watcher
launchctl unload ~/Library/LaunchAgents/com.user.my-watcher.plist

# Check if running
launchctl list | grep com.user
```

## Advantages Over Templating

### With Go Templates (chezmoi style):
```json
{
  "projectsDir": "{{ if eq .chezmoi.hostname \"work\" }}~/code{{ else }}~/icode{{ end }}",
  "editor": "{{ .editor }}"
}
```
**Problems**: Template syntax in JSON, need to learn templating language, complex conditionals

### With File Merging (this approach):
```json
// base.json
{
  "editor": "idea"
}

// home.json
{
  "projectsDir": "~/icode"
}

// work.json
{
  "projectsDir": "~/code"
}
```
**Benefits**: Plain JSON, no special syntax, clear separation, easy to read

## Advanced: Multiple Outputs

You can have one watcher per output file:

```bash
# Watcher 1: VSCode config
create_watcher "com.user.vscode-merge" \
    "merge-json.sh" \
    "$HOME/.config/Code/User/settings.json" \
    "config-sources/vscode-base.json" \
    "config-sources/vscode-home.json"

# Watcher 2: App config
create_watcher "com.user.app-merge" \
    "merge-json.sh" \
    "$HOME/.config/app.json" \
    "config-sources/app-base.json" \
    "config-sources/app-home.json"
```

Each watcher monitors different files and generates different outputs.

## Troubleshooting

### Watcher not triggering
```bash
# Check if watcher is loaded
launchctl list | grep com.user

# Check logs for errors
tail ~/Library/Logs/com.user.*.error.log

# Manually trigger
./scripts/merge-json.sh output.json input1.json input2.json
```

### jq not found
```bash
brew install jq
```

### Permission errors
```bash
chmod +x scripts/*.sh
```

### Operation not permitted errors
This is the iCloud Drive limitation described at the top of this document. Move your repository outside iCloud Drive to resolve.

## Dotbot Integration

To setup watchers automatically when installing dotfiles, add to your profile config:

```yaml
# install-home.conf.yaml
- shell:
    - [./scripts/setup-example-watcher.sh, Setup config file watcher]
```

Then watchers will be configured every time you run `just install-home`.
