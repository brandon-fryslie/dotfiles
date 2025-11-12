# Dotfiles Project Specification

## Overview

This is a personal dotfiles repository that manages shell and development environment configurations across multiple profiles (home and work) using Dotbot for installation and symlinking.

## Core Features

### 1. Profile-Based Dotfiles Management

The repository uses Dotbot with configuration composition to support multiple profiles:

- **Global profile**: Base configurations shared across all profiles
- **Home profile**: Personal development setup
- **Work profile**: Work environment setup

Profiles override global settings using Dotbot's sequential execution model.

### 2. Automated File Watchers System

**Version 2.0 Architecture**

We need to completely change the 'watchers' functionality because it won't just be 'merging json'. We should have a YAML file that defines a 'watcher spec'. Each spec can define:

- **One or more input files to watch** (or a glob pattern)
- **A command** (command name + args) to run when they change
- **A single output file** to write

#### Two-Daemon Architecture

We have 2 launchd daemons:

1. **Config Watcher Daemon** (`com.user.dotfiles.watcher-reload`)
   - Watches the YAML config file that defines the watchers
   - Auto-reloads the execute daemon whenever the YAML config file changes
   - Validates new config before reloading
   - Keeps old daemon running if new config is invalid

2. **Execute Daemon** (`com.user.dotfiles.watcher-execute`)
   - Watches the dotfiles that are defined as input files in the watcher config file
   - Regenerates the necessary files (only) whenever an input file changes
   - Executes the specified command to produce output
   - Handles multiple watchers independently

#### Watcher Spec Format

```yaml
# ~/.config/dotfiles/watchers.yaml
version: "1.0"

watchers:
  - name: "mackup-config"
    description: "Merge global and profile-specific Mackup configs"
    inputs:
      - "~/icode/dotfiles/config-sources/mackup/base.yaml"
      - "~/icode/dotfiles/config-sources/mackup/home.yaml"
    command:
      name: "merge-yaml"
      args:
        - "--output"
        - "~/.mackup.cfg"
        - "~/icode/dotfiles/config-sources/mackup/base.yaml"
        - "~/icode/dotfiles/config-sources/mackup/home.yaml"
    output: "~/.mackup.cfg"
    enabled: true
```

#### Key Requirements

- **Flexibility**: Support any command (merge-yaml, cat, custom scripts)
- **Reliability**: Invalid configs don't break the system
- **Auto-reload**: Config changes automatically update daemon behavior
- **Error handling**: Individual watcher failures don't crash daemon
- **Logging**: Clear logs for debugging and monitoring
- **iCloud compatible**: Works despite iCloud Drive launchd restrictions

### 3. Shell Plugin System

Both profiles use the `rad-shell` plugin system (custom by brandon-fryslie) with profile-specific plugin configurations.

### 4. Version Managers

Multiple language version managers configured:
- **Python**: pyenv
- **Node.js**: fnm (preferred), NVM, bun
- **Java**: SDKMAN
- **Ruby**: RVM

## Architecture

### Directory Structure

```
dotfiles/
├── install.conf.yaml              # Global configuration
├── install-home.conf.yaml         # Home profile
├── install-work.conf.yaml         # Work profile
├── dotfiles_global/               # Global dotfile sources
├── dotfiles-home/                 # Home profile sources
├── dotfiles-work/                 # Work profile sources
├── config-sources/                # Modular config sources
│   ├── watchers.yaml             # Watcher definitions
│   ├── mackup/                   # Mackup config fragments
│   └── gitignore/                # Gitignore fragments
├── watchers/                      # Watcher system components
│   ├── bin/                      # Daemon scripts
│   ├── lib/                      # Libraries (parser, validator)
│   └── launchd/                  # launchd plist templates
├── scripts/                       # Utility scripts
│   ├── merge-json.sh             # JSON merging
│   └── merge-yaml.sh             # YAML merging
└── tests/                         # Test suite
    ├── functional/               # Functional tests
    ├── unit/                     # Unit tests
    ├── e2e/                      # End-to-end tests
    └── helpers/                  # Test utilities
```

### Installation Methods

**Primary method (justfile):**
```bash
just install-home    # Install global + home profile
just install-work    # Install global + work profile
```

**Alternative method (script):**
```bash
./install home       # Wrapper script
./install work
```

**Direct dotbot:**
```bash
./dotbot/bin/dotbot -d . -c install.conf.yaml
./dotbot/bin/dotbot -d . -c install-home.conf.yaml
```

## Technical Decisions

### Dotbot Configuration Composition

Originally attempted to use multiple `-c` flags with Dotbot:
```bash
dotbot -c install.conf.yaml -c install-home.conf.yaml  # Didn't work
```

**Issue**: Dotbot doesn't execute all link sections when multiple configs are combined.

**Solution**: Run Dotbot twice sequentially:
```bash
dotbot -c install.conf.yaml              # Global first
dotbot -c install-home.conf.yaml         # Profile second
```

This maintains clean separation while ensuring all symlinks are created.

### iCloud Drive Limitations

**Problem**: launchd cannot execute scripts from iCloud Drive paths (`~/Library/Mobile Documents/`)

**Solution**: Copy watcher scripts to `~/bin/` during installation:
- Source scripts remain in `~/icode/dotfiles/` (iCloud, version controlled)
- Runtime scripts copied to `~/bin/` (local, executable by launchd)
- Update mechanism via justfile commands

## Quality Standards

### Testing Requirements

- **Comprehensive test coverage**: All critical paths tested
- **Un-gameable tests**: Verify actual behavior, not proxies
- **Fast execution**: Test suite runs in < 1 minute
- **Clear failure messages**: Tests explain what's wrong

### Code Quality

From CLAUDE.md user instructions:
- **Simple, reliable**: Principle of least surprise
- **Boring implementations**: "Obviously this is how it's done"
- **No shortcuts**: Do it right the first time
- **Thoroughly tested**: Run tests after every change

### Documentation

- **Accuracy**: Documentation matches implementation exactly
- **No phantom commands**: All referenced commands exist
- **Clear warnings**: Limitations prominently documented
- **Examples work**: All examples are tested and functional

## Known Limitations

1. **Watchers system**: Currently being redesigned (v2.0 architecture)
2. **iCloud Drive**: launchd cannot execute from iCloud paths (workaround implemented)
3. **Profile switching**: Requires re-running installation (not live-switchable)

## Success Criteria

A successful dotfiles installation means:
- ✅ User can follow README without errors
- ✅ All documented commands work as written
- ✅ Symlinks point to correct profile dotfiles
- ✅ Shell starts without errors
- ✅ Version managers load correctly
- ✅ Watchers regenerate files automatically (when v2.0 complete)
- ✅ Tests pass on fresh installation

## Project Status

**Current Completion**: ~85% (core functionality complete)

**Completed**:
- ✅ Dotbot installation with profiles
- ✅ Profile switching (home/work)
- ✅ Shell configuration
- ✅ Version manager setup
- ✅ Test suite (79 functional tests)
- ✅ Documentation accuracy fixes

**In Progress**:
- 🔄 Watchers v2.0 implementation (16% complete)

**Planned**:
- ⏳ CI/CD pipeline
- ⏳ Pre-commit hooks
- ⏳ Troubleshooting guide

## References

- [Architecture Document](docs/WATCHERS-ARCHITECTURE.md) - Detailed watchers v2.0 design
- [Testing Guide](tests/README.md) - Test suite documentation
- [Migration Guide](MIGRATION.md) - Migrating from old system
- [User Instructions](CLAUDE.md) - Repository-specific guidance
