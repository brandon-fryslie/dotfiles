# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository that manages shell and development environment configurations across multiple profiles (home and work) using Dotbot for installation and symlinking.

## Installation Commands

### Installing dotfiles with Dotbot

This is a **standard Dotbot installation** that uses the justfile to call dotbot directly with composed configurations.

```bash
# Using justfile (standard method)
just install-global      # Install only global dotfiles
just install-home        # Install global + home profile
just install-work        # Install global + work profile

# Dry run to see what would happen
just dry-run-home
just dry-run-work

# Direct dotbot invocation (if needed)
./dotbot/bin/dotbot -d . -c install.conf.yaml -c install-home.conf.yaml
```

Dotbot uses **configuration composition**: multiple `-c` flags are processed in order, with later configs overriding earlier ones. This enables the profile system.

### Legacy Scripts (Deprecated)

Both old installation scripts are deprecated:
- `install` (custom wrapper script) - removed
- `install_dotfiles.sh` (old custom script) - see `MIGRATION.md`

## Architecture and Structure

### Profile System (Standard Dotbot Configuration Composition)

This is a **standard Dotbot setup** using configuration composition. Dotbot processes multiple config files in order via multiple `-c` flags, with later configs overriding earlier ones.

**Structure:**
1. **Global configuration** (`install.conf.yaml` + `dotfiles_global/`): Base configurations shared across all profiles
   - Aider, Git ignore patterns, Powerlevel10k theme, Mackup, RVM/Gem configs
   - Applied first, can be overridden by profile configs

2. **Home profile** (`install-home.conf.yaml` + `dotfiles-home/`): Personal development setup
   - Personal-specific `.zshrc`, `.rad-plugins`, and `.mackup.cfg`
   - Overrides global settings when used with: `dotbot -c install.conf.yaml -c install-home.conf.yaml`

3. **Work profile** (`install-work.conf.yaml` + `dotfiles-work/`): Work environment setup
   - Work-specific `.zshrc`, `.rad-plugins`, and `.pypirc`
   - Overrides global settings when used with: `dotbot -c install.conf.yaml -c install-work.conf.yaml`

### How Configuration Composition Works

```bash
# Global only - installs base files
dotbot -c install.conf.yaml

# Global + Home - base files + home overrides
dotbot -c install.conf.yaml -c install-home.conf.yaml

# Global + Work - base files + work overrides
dotbot -c install.conf.yaml -c install-work.conf.yaml
```

When the same target file (e.g., `~/.zshrc`) is defined in multiple configs, the **last one wins**. This allows profiles to override global defaults.

All configurations use `relink: true` and `force: true` to overwrite existing symlinks.

### Shell Plugin System (rad-shell)

Both profiles use the `rad-shell` plugin system (custom by brandon-fryslie). The `.rad-plugins` files define which plugins to load:

**Key plugin loading order:**
1. Powerlevel10k theme
2. Homebrew support (loaded early)
3. Dotfiles aliases
4. Docker completions
5. zaw (fuzzy finder), autosuggestions, completions
6. Custom rad-plugins: git, sdkman, shell-tools, rad-dev, docker
7. Syntax highlighting (loaded near end)
8. shell-customize plugin
9. iTerm integration (must be last)

### Profile-Specific Configurations

**Home profile** (`dotfiles-home/zshrc`):
- `PROJECTS_DIR="$HOME/icode"`
- `DOTFILES_DIR="$HOME/icode/dotfiles"`
- Uses IntelliJ IDEA as editor (`VISUAL=idea`)
- Includes pyenv, SDKMAN, Docker (Lima), NVM, fnm, bun configurations
- Has Zinit plugin manager setup at the end
- Claude Code detection with `is_claude()` and `not_claude()` helpers
- Skips rad-shell initialization when running in Claude Code

**Work profile** (`dotfiles-work/zshrc`):
- `PROJECTS_DIR=~/code`
- `DOTFILES_DIR=$HOME/code/dotfiles`
- Uses IntelliJ IDEA as editor
- Simpler configuration focused on work-specific needs
- Sets `POWERLEVEL9K_INSTANT_PROMPT=off`
- Docker completions from Docker Desktop
- Always sources rad-shell (no Claude Code detection)

## Important Patterns

### Claude Code Integration

The home profile includes special handling for Claude Code environments:
```zsh
is_claude() { [[ -n "${CLAUDECODE}" ]] && return 0 || return 1 }
not_claude() { ! is_claude && return 0 || return 1 }

if not_claude; then
  source ~/.rad-shell/rad-init.zsh
  [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
fi
```

This prevents loading interactive shell features when Claude Code is analyzing the environment.

### Language Version Managers

Multiple version managers are configured:
- **Python**: pyenv (`$PYENV_ROOT`)
- **Node.js**: fnm (preferred), NVM (legacy), Volta (commented out), bun
- **Java**: SDKMAN (`$SDKMAN_DIR`) and hardcoded Temurin 11 in home profile
- **Ruby**: RVM support via `.rvmrc`

### Docker Configuration

Both profiles configure Docker to use Lima socket:
```zsh
export DOCKER_HOST="unix://$HOME/.lima/docker.sock"
```

## Development Workflow

### Using the justfile

The repository includes a `justfile` with helpful commands. Run `just` to see all available commands.

**Common operations:**
```bash
just status              # Show current profile and symlink status
just verify-home         # Verify home profile symlinks are correct
just backup              # Backup current dotfiles before making changes
just check-missing       # Check for files not listed in configs
just clean-broken        # Remove broken symlinks
```

### Making Changes

When modifying configurations:

1. Edit files in the appropriate directory (`dotfiles_global/`, `dotfiles-home/`, or `dotfiles-work/`)
2. Files are already symlinked to `~/`, so changes take effect immediately for most configs
3. For shell configs (`.zshrc`), source the file or restart your shell to test changes
4. Verify changes with `just verify-home` or `just verify-work`
5. Commit changes with descriptive messages (see git history for style)

### Adding New Dotfiles

**Manual method:**
```bash
# 1. Create the file
echo "config content" > dotfiles-home/newconfig

# 2. Add to configuration file
echo "  ~/.newconfig: dotfiles-home/newconfig" >> install-home.conf.yaml

# 3. Install
just install-home
```

Alternatively, you can manually edit the `install-home.conf.yaml` file:
1. Place the file in the appropriate directory
2. Add a symlink entry to the relevant `install*.conf.yaml` file:
   ```yaml
   ~/.newconfig: dotfiles-home/newconfig
   ```
3. Test by running `just install-home`

### Modifying Shell Plugins

Edit `.rad-plugins` in the appropriate profile directory. Plugin format is:
```
repo/plugin [optional-subpath]
```

Comments use `#` prefix. Plugins are loaded in order.

## Key Files and Locations

- `justfile`: **Primary interface** - task runner with all dotbot commands
- `dotbot/`: Dotbot submodule (standard installation)
- `dotbot/bin/dotbot`: Dotbot executable invoked by justfile
- `install.conf.yaml`: Global dotfiles configuration
- `install-home.conf.yaml`: Home profile overrides (used with global)
- `install-work.conf.yaml`: Work profile overrides (used with global)
- `dotfiles_global/`: Global dotfile sources
- `dotfiles-home/`: Home profile dotfile sources
- `dotfiles-work/`: Work profile dotfile sources
- `MIGRATION.md`: Guide for migrating from old custom scripts
- `install_dotfiles.sh`: Legacy installation script (deprecated, kept for reference)

## Testing

To test configuration changes without affecting your live environment:
1. Create a test user or use a VM
2. Clone the repo and run the install script
3. Start a new shell and verify functionality

## Notes

- The repository path differs between profiles: `~/icode/dotfiles` (home) vs `~/code/dotfiles` (work)
- Both profiles use lsd for enhanced `ls` command
- Home profile has significantly more tooling and version managers configured
- Git config sets `core.excludesfile` to `~/.gitignore_global` in home profile zshrc
