# dotfiles

Personal dotfiles configuration with profile support for home and work environments.

## Overview

This repository contains my personal development environment configuration, managed using [Dotbot](https://github.com/anishathalye/dotbot). This is a **standard Dotbot installation** using configuration composition to support multiple profiles (home and work) and modular feature configurations.

**Philosophy**: Boring, reliable, obvious. No clever hacks, just solid implementations that work consistently across machines.

## Quick Start

```bash
# Clone the repository
git clone <repo-url> ~/icode/dotfiles
cd ~/icode/dotfiles

# Initialize dotbot submodule
just init

# Install home profile
just install home

# Or install work profile
just install work
```

## What's Included

### Shell & Terminal
- **Zsh** with custom configuration
- **Powerlevel10k** theme for enhanced prompt
- **rad-shell** custom plugin system by brandon-fryslie
- **zsh-autosuggestions** for command suggestions
- **zsh-completions** for enhanced tab completion
- **zsh-syntax-highlighting** for visual feedback
- **tmux** with full configuration directory

### Development Tools
- **Aider** - AI pair programming tool (configured via `.aider.conf.yml`)
- **Claude Code** - Full AI assistant integration with custom agents and commands
- **Git** with global ignore file
- **Docker** with custom aliases and completions via Lima
- **IntelliJ IDEA** as primary editor/IDE

### Language & Runtime Management
- **Python**: pyenv for version management
- **Node.js**: fnm (preferred), NVM (legacy), and bun
- **Java**: SDKMAN for version management
- **Ruby**: RVM support

### Package Management
- **Homebrew** for macOS packages
- **pnpm** for Node.js packages
- **Mackup** for application settings backup

### Navigation & Utilities
- **lsd** (LSDeluxe) for enhanced `ls` command
- **nav** for directory navigation
- **zaw** for fuzzy searching

## Installation

### Prerequisites
- macOS (Darwin)
- Git
- [just](https://github.com/casey/just) command runner: `brew install just`

### Installation Steps

```bash
# 1. Clone the repository
git clone <repository-url> ~/icode/dotfiles
cd ~/icode/dotfiles

# 2. Initialize Dotbot submodule
just init

# 3. (Optional) Backup existing dotfiles
just backup

# 4. Install with your chosen profile
just install home    # For personal setup
# OR
just install work    # For work setup

# 5. Restart your shell or source the config
exec zsh

# 6. Verify installation
just status
just verify-home     # or verify-work
```

## Available Commands

The `justfile` provides convenient commands for managing your dotfiles:

### Installation
```bash
just install home        # Install base + home profile + features
just install work        # Install base + work profile + features
just install base        # Install only base configuration
just dry-run-home        # Preview what would be installed (home)
just dry-run-work        # Preview what would be installed (work)
```

### Management
```bash
just status              # Check current profile and symlink status
just verify-home         # Verify all home profile symlinks are correct
just verify-work         # Verify all work profile symlinks are correct
just backup              # Backup current dotfiles before changes
just clean-broken        # Remove broken symlinks in home directory
```

### Maintenance
```bash
just check-missing       # Find files not listed in configs
just validate            # Validate YAML syntax (requires python3)
just init                # Initialize/update dotbot submodule
just update-dotbot       # Update dotbot to latest version
```

Run `just` without arguments to see all available commands.

### Claude Code Configuration (`install-claude.conf.yaml`)
- Custom agents for specialized workflows (testing, implementation, planning)
- Slash commands for common operations
- Plugin configuration (tracked separately from plugin repos)
- Repository-specific AI instructions

### Feature Configurations
- **rad-shell** (`install-rad.conf.yaml`): Shell plugin system setup
- **Watchers** (`install-watchers.conf.yaml`): File watcher system (planned)

## How It Works

### Configuration Composition

Dotbot is run sequentially for each configuration file:

```bash
# Home profile installation runs:
dotbot -c install-base.conf.yaml      # Base configurations
dotbot -c install-claude.conf.yaml    # Claude Code setup
dotbot -c install-home.conf.yaml      # Home profile (overrides base)
dotbot -c install-rad.conf.yaml       # rad-shell setup
```

Later configurations override earlier ones, allowing clean separation between:
- Shared base configurations
- Profile-specific overrides
- Optional feature additions

### Symlink Strategy
## Customization

**Adding shell plugins:**
```bash
# Add to dotfiles-home/rad-plugins:
brandon-fryslie/rad-plugins git
brandon-fryslie/rad-plugins docker
zsh-users/zsh-autosuggestions
```

### Working with Claude Code

The repository includes full Claude Code integration:

**Custom agents** in `config/claude/agents/`:
- `test-driven-implementer.md` - TDD workflow
- `functional-tester.md` - High-level test design
- `project-evaluator.md` - Project assessment
- `status-planner.md` - Planning and backlog generation

**Slash commands** in `config/claude/commands/`:
- `/test-and-implement` - Write tests first, then implement
- `/evaluate-and-plan` - Evaluate project and create plans
- `/setup-mcp-docs` - Setup MCP server for documentation

**Plugin configuration** is tracked, plugin repos are not:
- `~/.claude/plugins/*.json` are symlinked (tracked)
- `~/.claude/plugins/marketplaces/*` are real directories (untracked)

## Troubleshooting

### Symlinks not created
```bash
# Check dotbot output for errors
just install home

# Verify symlinks manually
just verify-home

# Check for broken symlinks
just clean-broken
```

### Shell not loading correctly
```bash
# Check for syntax errors
zsh -n ~/.zshrc

# Source the config manually
source ~/.zshrc

# Check rad-shell is properly set up
just verify-rad
```

### YAML validation errors
```bash
# Requires python3 with PyYAML
pip3 install pyyaml
just validate
```

### Profile switching not working
```bash
# Switching profiles requires re-running installation
just install work    # Switch to work profile

# Verify the switch
just status
readlink ~/.zshrc    # Should point to dotfiles-work/zshrc
```

## Advanced Usage

### Direct Dotbot Invocation

For debugging or custom workflows:

```bash
# Install specific config only
./dotbot/bin/dotbot -d . -c install-base.conf.yaml

# Dry run to see what would happen
./dotbot/bin/dotbot -d . --dry-run -c install-home.conf.yaml

# Verbose output for debugging
./dotbot/bin/dotbot -d . -v -c install-home.conf.yaml
```

### Using the Install Script

The `install` script provides an alternative interface:

```bash
./install home       # Install home profile
./install work       # Install work profile
./install base       # Install base only
```

This script runs dotbot sequentially with the appropriate configs for each profile.

## Known Limitations

1. **Profile switching** requires re-running installation (not live-switchable)
2. **iCloud Drive paths** have limitations with launchd (workaround: copy scripts to ~/bin)
3. **Git submodules** are not auto-initialized by dotbot (use `just init`)

## Documentation

- **[PROJECT_SPEC.md](PROJECT_SPEC.md)** - Technical overview, architecture, and vision
- **[CLAUDE.md](CLAUDE.md)** - Repository-specific guidance for Claude Code
- **[TESTING.md](TESTING.md)** - Test suite documentation and philosophy
- **[tests/README.md](tests/README.md)** - Detailed testing guide
- **[docs/WATCHERS-ARCHITECTURE.md](docs/WATCHERS-ARCHITECTURE.md)** - Watchers v2.0 design (planned feature)

## License

Personal configuration - feel free to fork and adapt for your own use.
