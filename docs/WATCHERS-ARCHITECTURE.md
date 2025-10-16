# Watchers Architecture Design

**Version:** 2.0
**Date:** 2025-10-15
**Status:** Design Phase

## Overview

A flexible file watching system that monitors dotfiles for changes and regenerates output files using configurable commands. The system uses two launchd daemons for self-reloading capability.

## Core Concepts

### Watcher Spec

A **watcher spec** defines:
- **Input files**: One or more files to watch (supports glob patterns)
- **Command**: Command name + arguments to execute when inputs change
- **Output file**: Single output file to write/regenerate

### Two-Daemon Architecture

1. **Config Watcher Daemon** (`com.user.dotfiles.watcher-reload`)
   - Watches: `~/.config/dotfiles/watchers.yaml`
   - Action: Reload the Execute Daemon when config changes
   - Purpose: Auto-reload without manual intervention

2. **Execute Daemon** (`com.user.dotfiles.watcher-execute`)
   - Watches: All input files defined in watcher specs
   - Action: Run specified command to regenerate output file
   - Purpose: Keep output files in sync with inputs

## Configuration Format

### YAML Schema

```yaml
# ~/.config/dotfiles/watchers.yaml
version: "1.0"

watchers:
  - name: "mackup-config"
    description: "Merge global and profile-specific Mackup configs"
    inputs:
      - "~/.config/dotfiles/config-sources/mackup/base.yaml"
      - "~/.config/dotfiles/config-sources/mackup/home.yaml"
    command:
      name: "merge-yaml"
      args:
        - "--output"
        - "~/.mackup.cfg"
        - "~/.config/dotfiles/config-sources/mackup/base.yaml"
        - "~/.config/dotfiles/config-sources/mackup/home.yaml"
    output: "~/.mackup.cfg"
    enabled: true

  - name: "gitignore-global"
    description: "Concatenate gitignore fragments"
    inputs:
      - "~/.config/dotfiles/config-sources/gitignore/*.gitignore"
    command:
      name: "cat"
      args:
        - "~/.config/dotfiles/config-sources/gitignore/*.gitignore"
    output: "~/.gitignore_global"
    enabled: true

  - name: "custom-command-example"
    description: "Run custom script"
    inputs:
      - "~/.config/dotfiles/config-sources/custom/input.txt"
    command:
      name: "~/.config/dotfiles/scripts/custom-processor.sh"
      args:
        - "--input"
        - "~/.config/dotfiles/config-sources/custom/input.txt"
        - "--output"
        - "~/.customrc"
    output: "~/.customrc"
    enabled: false
```

### Field Specifications

#### `version` (string, required)
- Schema version for future compatibility
- Current: `"1.0"`

#### `watchers` (array, required)
Array of watcher spec objects.

#### Watcher Spec Object

- **`name`** (string, required)
  - Unique identifier for this watcher
  - Used in logs and error messages
  - Pattern: `[a-z0-9-]+`

- **`description`** (string, optional)
  - Human-readable description
  - Shown in status output

- **`inputs`** (array of strings, required)
  - File paths to watch
  - Supports glob patterns: `~/.config/dotfiles/**/*.yaml`
  - Tilde expansion supported: `~/path`
  - At least one input required

- **`command`** (object, required)
  - **`name`** (string, required): Command name or script path
  - **`args`** (array of strings, optional): Arguments to pass

- **`output`** (string, required)
  - Single output file path
  - Will be overwritten when inputs change
  - Tilde expansion supported

- **`enabled`** (boolean, optional, default: true)
  - Whether this watcher is active
  - Disabled watchers are validated but not executed

## Architecture Details

### Component Structure

```
dotfiles/
├── watchers/
│   ├── bin/
│   │   ├── watcher-daemon.sh          # Execute daemon main script
│   │   ├── config-watcher-daemon.sh   # Config watcher main script
│   │   ├── watcher-executor.sh        # Executes individual watcher specs
│   │   └── watcher-validator.sh       # Validates YAML config
│   ├── lib/
│   │   ├── yaml-parser.sh             # Parse watchers.yaml
│   │   ├── file-watcher.sh            # File watching logic
│   │   └── command-runner.sh          # Safe command execution
│   └── launchd/
│       ├── com.user.dotfiles.watcher-reload.plist
│       └── com.user.dotfiles.watcher-execute.plist
├── scripts/
│   ├── merge-yaml.sh                   # YAML merging command
│   └── merge-json.sh                   # Existing JSON merger
└── config-sources/
    ├── mackup/
    │   ├── base.yaml
    │   └── home.yaml
    └── gitignore/
        ├── global.gitignore
        └── macos.gitignore
```

### Daemon 1: Config Watcher (`watcher-reload`)

**Purpose:** Reload the execute daemon when config changes

**Behavior:**
1. Watch `~/.config/dotfiles/watchers.yaml` for changes
2. When changed:
   - Validate new YAML syntax
   - If valid: Reload execute daemon (`launchctl unload` + `launchctl load`)
   - If invalid: Log error, don't reload (keep old config running)
3. Log reload events

**launchd Configuration:**
```xml
<key>WatchPaths</key>
<array>
    <string>~/.config/dotfiles/watchers.yaml</string>
</array>
<key>QueueDirectories</key>
<array/>
<key>RunAtLoad</key>
<true/>
```

### Daemon 2: Execute Daemon (`watcher-execute`)

**Purpose:** Execute watcher specs when input files change

**Behavior:**
1. On load/reload:
   - Parse `watchers.yaml`
   - Validate all specs
   - Build watch list from all enabled watcher inputs
2. When ANY watched file changes:
   - Identify which watcher spec(s) are affected
   - For each affected spec:
     - Expand glob patterns in inputs
     - Build command with args
     - Execute command safely
     - Verify output file was created/updated
     - Log success/failure
3. Handle errors gracefully (don't crash on single failure)

**launchd Configuration:**
```xml
<key>WatchPaths</key>
<array>
    <!-- Dynamically generated from watchers.yaml -->
    <string>~/.config/dotfiles/config-sources/mackup/base.yaml</string>
    <string>~/.config/dotfiles/config-sources/mackup/home.yaml</string>
    <!-- ... more paths ... -->
</array>
<key>RunAtLoad</key>
<true/>
```

### File Watching Strategy

**Challenge:** launchd `WatchPaths` doesn't support glob patterns

**Solution:**
1. On daemon load, expand all globs to actual file paths
2. Generate launchd plist with explicit paths
3. If new files match a glob pattern, require config reload

**Alternative (future):** Use `fswatch` or similar for more sophisticated watching

## Implementation Plan

### Phase 1: Core Infrastructure (P0)

1. **YAML Config Parser** (`lib/yaml-parser.sh`)
   - Parse watchers.yaml using `yq` or native bash + `grep`
   - Extract watcher specs into structured data
   - Handle tilde expansion

2. **Config Validator** (`bin/watcher-validator.sh`)
   - Validate YAML schema
   - Check required fields
   - Verify commands exist
   - Expand and validate globs
   - Check for duplicate names

3. **Watcher Executor** (`bin/watcher-executor.sh`)
   - Accept watcher spec as input
   - Build command from spec
   - Execute command safely
   - Verify output created
   - Return success/failure

### Phase 2: Daemons (P0)

4. **Config Watcher Daemon** (`bin/config-watcher-daemon.sh`)
   - Simple script: validate + reload
   - Robust error handling
   - Logging to syslog

5. **Execute Daemon** (`bin/watcher-daemon.sh`)
   - Load and parse config
   - Identify which spec triggered
   - Execute appropriate spec
   - Comprehensive logging

6. **launchd Plists**
   - Template-based generation
   - Install/uninstall scripts

### Phase 3: Supporting Commands (P1)

7. **merge-yaml.sh** - YAML merging utility
8. **watcher-cli.sh** - User-facing CLI for management
   - `watcher status` - Show all watchers and state
   - `watcher run <name>` - Manually trigger a watcher
   - `watcher validate` - Validate config
   - `watcher reload` - Reload daemons

### Phase 4: Migration & Documentation (P1)

9. **Migrate existing watchers** to new YAML format
10. **Update WATCHERS.md** with new architecture
11. **Add examples** and troubleshooting

## iCloud Drive Solution

### Problem
launchd cannot execute scripts from iCloud Drive paths:
- `~/Library/Mobile Documents/com~apple~CloudDocs/`
- Error: "Operation not permitted"

### Solution Options

#### Option A: Copy Scripts to ~/bin (Recommended)

**Implementation:**
```bash
# During dotfiles installation
mkdir -p ~/bin
cp -r ~/icode/dotfiles/watchers/bin/* ~/bin/
cp -r ~/icode/dotfiles/watchers/lib/* ~/bin/
chmod +x ~/bin/*.sh

# launchd plist points to ~/bin
<key>ProgramArguments</key>
<array>
    <string>/Users/username/bin/watcher-daemon.sh</string>
</array>
```

**Pros:**
- Works with launchd restrictions
- Clear separation: source (iCloud) vs runtime (local)
- Fast execution (no iCloud sync delays)

**Cons:**
- Must copy on install/update
- Two copies of scripts

#### Option B: Symlink dotfiles repo to ~/.config

**Implementation:**
```bash
ln -s ~/icode/dotfiles ~/.config/dotfiles
# launchd references ~/.config/dotfiles/watchers/bin/...
```

**Pros:**
- Single copy of scripts
- Changes immediately reflected

**Cons:**
- Symlink points to iCloud (may still have issues)
- Less explicit

#### Option C: Move repo out of iCloud

**Not recommended** - defeats purpose of syncing dotfiles

### Recommendation

Use **Option A** with justfile automation:

```bash
just install-watchers-scripts  # Copy to ~/bin
just install-watchers-daemons  # Load launchd plists
just reload-watchers           # Reload after changes
```

## Testing Strategy

### Unit Tests

1. **YAML Parser Tests**
   - Valid config parsing
   - Invalid YAML handling
   - Missing required fields
   - Glob expansion

2. **Validator Tests**
   - Schema validation
   - Command existence checks
   - Duplicate name detection
   - Circular dependency detection

3. **Executor Tests**
   - Command execution
   - Output verification
   - Error handling
   - Timeout handling

### Integration Tests

4. **Config Watcher Tests**
   - Config change detection
   - Valid config reload
   - Invalid config rejection
   - Daemon reload triggering

5. **Execute Daemon Tests**
   - Input file change detection
   - Correct watcher triggering
   - Multi-watcher scenarios
   - Glob pattern watching

### End-to-End Tests

6. **Full Workflow Tests**
   - Add new watcher to config
   - Modify input file
   - Verify output regenerated
   - Modify config
   - Verify daemon reloaded

## Security Considerations

1. **Command Validation**
   - Whitelist allowed commands OR
   - Require full paths to scripts
   - Sanitize arguments

2. **Path Validation**
   - Prevent path traversal
   - Validate output paths
   - Check permissions before writing

3. **Error Handling**
   - Don't expose sensitive info in logs
   - Fail safely (don't corrupt existing files)
   - Rate limiting for failing watchers

## Performance Considerations

1. **Startup Time**
   - Parse YAML once on daemon load
   - Cache parsed specs in memory

2. **Change Detection**
   - launchd handles file watching (efficient)
   - Minimize work in hot path

3. **Execution**
   - Run commands asynchronously if possible
   - Debounce rapid changes (wait 1-2 seconds)

## Error Handling

### Config Watcher Errors

- **Invalid YAML**: Log error, keep old daemon running
- **Daemon reload fails**: Log error, alert user
- **Permission denied**: Log error with troubleshooting

### Execute Daemon Errors

- **Command not found**: Log error, disable watcher
- **Command fails**: Log stderr, retry once
- **Output not created**: Log error, don't mark success
- **Permission denied**: Log error with path

## Logging

### Log Locations

- **Config Watcher**: `~/Library/Logs/dotfiles-watcher-reload.log`
- **Execute Daemon**: `~/Library/Logs/dotfiles-watcher-execute.log`

### Log Format

```
[2025-10-15 14:32:45] [INFO] [watcher-execute] Config loaded: 3 watchers enabled
[2025-10-15 14:33:12] [INFO] [watcher-execute] Triggered: mackup-config (input changed: base.yaml)
[2025-10-15 14:33:12] [INFO] [watcher-execute] Executing: merge-yaml --output ~/.mackup.cfg ...
[2025-10-15 14:33:13] [SUCCESS] [watcher-execute] Output created: ~/.mackup.cfg (1.2KB)
[2025-10-15 14:35:01] [ERROR] [watcher-execute] Command failed: gitignore-global (exit 1)
```

## Migration Path

### From Old System

Old `WATCHERS.md` documented merge-json examples. Migration:

```bash
# Old approach (manual)
./scripts/merge-json.sh ~/.mackup.cfg \
  config-sources/mackup/base.json \
  config-sources/mackup/home.json

# New approach (automated)
# Add to watchers.yaml:
watchers:
  - name: "mackup-config"
    inputs:
      - "~/.config/dotfiles/config-sources/mackup/base.yaml"
      - "~/.config/dotfiles/config-sources/mackup/home.yaml"
    command:
      name: "merge-yaml"
      args: ["--output", "~/.mackup.cfg", ...]
    output: "~/.mackup.cfg"
```

### Backward Compatibility

- Keep `merge-json.sh` working standalone
- `merge-yaml.sh` can also be used manually
- Watchers are opt-in (don't break existing workflows)

## Success Criteria

1. ✅ Config changes auto-reload execute daemon
2. ✅ Input file changes trigger correct watcher
3. ✅ Output files regenerated correctly
4. ✅ Invalid configs don't crash system
5. ✅ Works despite iCloud Drive limitations
6. ✅ Comprehensive test coverage
7. ✅ Clear error messages and logs
8. ✅ Easy to add new watchers
9. ✅ Documentation matches implementation
10. ✅ Zero manual intervention after setup

## Open Questions

1. **YAML vs TOML vs JSON for config?**
   - **Decision: YAML** (human-friendly, supports comments)

2. **Use `yq` or native bash parsing?**
   - **Decision: TBD** (yq if available, fallback to grep/sed)

3. **Debounce strategy for rapid changes?**
   - **Decision: 2-second debounce** using `sleep` + timestamp check

4. **Max watchers limit?**
   - **Decision: No hard limit** (practical limit ~20-30)

5. **Support for watch directories vs files?**
   - **Decision: Files + globs only** (simpler, more explicit)

6. **Circular dependency detection?**
   - **Decision: Yes** (validate output != any input)

## References

- launchd.plist(5) man page
- Apple Technical Note TN2083 (Daemons and Agents)
- Existing merge-json.sh implementation
- WATCHERS.md documentation
