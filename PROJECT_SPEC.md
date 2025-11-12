# Dotfiles Project Specification

## Overview

Personal dotfiles repository for managing shell and development environment configurations across multiple profiles (home and work) using Dotbot for installation and symlinking. This is a **standard Dotbot installation** using configuration composition to support clean separation between global, profile-specific, and feature-specific configurations.

## Vision

A bulletproof, boring, reliable dotfiles system that:
- **Just works** - No surprises, no clever hacks, obvious implementations
- **Scales elegantly** - Easy to add new configs without touching existing ones
- **Stays in sync** - Configuration changes propagate automatically (via watchers)
- **Travels well** - Works across multiple machines with different profiles
- **Self-documents** - Structure and commands are self-explanatory

## Core Features

### 1. Profile-Based Dotfiles Management

The repository uses Dotbot with configuration composition to support multiple profiles. Each profile is a separate configuration file that gets applied sequentially:

**Profiles:**
- **Base** (`install-base.conf.yaml`): Core configurations shared across all profiles
- **Home** (`install-home.conf.yaml`): Personal development setup
- **Work** (`install-work.conf.yaml`): Work environment setup
- **Claude** (`install-claude.conf.yaml`): Claude Code AI configuration
- **Rad** (`install-rad.conf.yaml`): rad-shell plugin system setup
- **Watchers** (`install-watchers.conf.yaml`): File watcher system (future)

**Key Design Decision:**
Profiles override global settings using Dotbot's sequential execution model. Run Dotbot multiple times (once per config) to ensure all symlinks are created correctly:

```bash
dotbot -c install-base.conf.yaml      # Base first
dotbot -c install-home.conf.yaml      # Profile overrides
dotbot -c install-rad.conf.yaml       # Feature addons
```

This maintains clean separation while ensuring proper override behavior.

### 3. File Watchers System (Planned)

**Status:** Architecture designed, implementation pending

**Vision:** Auto-regenerate configuration files when source fragments change.

**Version 2.0 Architecture:**

We'll have a YAML file that defines watcher specs. Each spec can define:
- **One or more input files to watch** (or a glob pattern)
- **A command** (command name + args) to run when they change
- **A single output file** to write

#### Two-Daemon Architecture

1. **Config Watcher Daemon** (`com.user.dotfiles.watcher-reload`)
   - Watches the YAML config file that defines the watchers
   - Auto-reloads the execute daemon whenever the YAML config changes
   - Validates new config before reloading
   - Keeps old daemon running if new config is invalid

2. **Execute Daemon** (`com.user.dotfiles.watcher-execute`)
   - Watches the dotfiles defined as input files in the watcher config
   - Regenerates necessary files (only) whenever an input file changes
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
        - "base.yaml"
        - "home.yaml"
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

### 4. Shell Plugin System

Both profiles use the `rad-shell` plugin system (custom by brandon-fryslie) with profile-specific plugin configurations via `.rad-plugins` files.

**Key shell features:**
- Powerlevel10k theme for enhanced prompt
- zsh-autosuggestions for command completion
- zsh-syntax-highlighting for visual feedback
- Custom aliases and functions
- Claude Code detection (skips interactive features in Claude environment)

### 5. Multi-Language Version Managers

Configured version managers for multiple languages:
- **Python**: pyenv (`$PYENV_ROOT`)
- **Node.js**: fnm (preferred), NVM (legacy), bun
- **Java**: SDKMAN (`$SDKMAN_DIR`)
- **Ruby**: RVM support via `.rvmrc`

### 6. Claude Code Integration

Full integration with Claude Code AI assistant:
- Custom agents for specialized workflows (test-driven development, implementation, planning)
- Slash commands for common operations
- Plugin system for extending functionality
- Environment detection to skip interactive shell features when running in Claude

## Architecture

TODO

### Installation Methods

**Primary method (justfile):**
```bash
just install home     # Install base + home profile + features
just install work     # Install base + work profile + features
just install base     # Install only base configuration
```

**Alternative method (script):**
```bash
./install home        # Calls dotbot with home profile configs
./install work        # Calls dotbot with work profile configs
./install base        # Base only
```

**Direct dotbot (advanced):**
```bash
./dotbot/bin/dotbot -d . -c install-base.conf.yaml
./dotbot/bin/dotbot -d . -c install-home.conf.yaml
./dotbot/bin/dotbot -d . -c install-rad.conf.yaml
```

## Technical Decisions

### Dotbot Configuration Composition

**Approach**: Run Dotbot sequentially for each configuration file.

```bash
dotbot -c install-base.conf.yaml       # Base configs
dotbot -c install-home.conf.yaml       # Profile overrides
dotbot -c install-rad.conf.yaml        # Feature addons
```

This ensures:
- Clean separation between concerns
- Proper override behavior (later configs win)
- All symlinks are created correctly
- Easy to add new feature configs without touching existing ones

## Future Vision

### Phase 1: Watchers System (Next)
Implement the two-daemon watcher architecture to auto-regenerate config files from modular sources.

### Phase 2: Multi-Machine Sync
Use Mackup or similar to sync application settings across machines, with dotfiles managing the Mackup configuration.

### Phase 3: Bootstrapping
One-command fresh machine setup:
```bash
curl -fsSL https://raw.githubusercontent.com/user/dotfiles/master/bootstrap.sh | bash
```

### Phase 4: Configuration Validation
Pre-commit hooks and CI to validate:
- YAML syntax in all config files
- Symlink targets exist
- No broken references in documentation
- Tests pass on clean install

## References

- [README.md](README.md) - User-facing documentation and quick start
- [CLAUDE.md](CLAUDE.md) - Repository-specific guidance for Claude Code
- [tests/README.md](tests/README.md) - Test suite documentation
- [docs/WATCHERS-ARCHITECTURE.md](docs/WATCHERS-ARCHITECTURE.md) - Detailed watchers v2.0 design
- [PROJECT_SPEC.md](PROJECT_SPEC.md) - This document
