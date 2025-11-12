# dotfiles

Personal dotfiles configuration with profile support for home and work environments.

## Overview

This repository contains my personal development environment configuration, managed using [Dotbot](https://github.com/anishathalye/dotbot). This is a **standard Dotbot installation** using configuration composition to support multiple profiles (home and work).

## Quick Start

```bash
# Clone the repository
git clone <repo-url> ~/icode/dotfiles
cd ~/icode/dotfiles

# Initialize dotbot submodule
just init

# Install home profile
just install-home

# Or install work profile
just install-work
```

## Tools and Applications

### Shell & Terminal
- **Zsh** with custom configuration
- **Powerlevel10k** theme for enhanced prompt
- **rad-shell** custom plugin system
- **zsh-autosuggestions** for command suggestions
- **zsh-completions** for enhanced tab completion
- **zsh-syntax-highlighting** for command syntax highlighting

### Development Tools
- **Aider** - AI pair programming tool (configured via `.aider.conf.yml`)
- **Git** with global ignore file and custom configuration
- **Docker** with custom aliases and completions
- **IntelliJ IDEA** as primary editor/IDE

### Language & Runtime Management
- **Python** with pyenv for version management
- **Node.js** with fnm (preferred), NVM, and bun for version management
- **Java** with SDKMAN for version management
- **Ruby** with RVM support
- **pnpm** for Node.js package management

### Package Management
- **Homebrew** for macOS package management
- **Mackup** for application settings backup

### Navigation & File Management
- **lsd** (LSDeluxe) for enhanced `ls` command
- **nav** for directory navigation
- **zaw** for fuzzy searching

## Installation

### Prerequisites
- macOS (Darwin)
- Git
- Homebrew (will be configured via rad-plugins)
- [just](https://github.com/casey/just) command runner (install: `brew install just`)

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
just install-home    # For personal setup
# OR
just install-work    # For work setup

# 5. Verify installation
just status
just verify-home     # or verify-work
```

### Available Commands

Run `just` to see all available commands:

```bash
just                    # Show all commands
just install-home       # Install global + home profile
just install-work       # Install global + work profile
just dry-run-home       # See what would be installed
just status             # Check current profile and symlinks
just verify-home        # Verify all symlinks are correct
just check-missing      # Find files not in configs
just backup             # Backup current dotfiles
```

## Profile Configurations

### Home Profile (`dotfiles-home/`)
- Personal project directories (`~/icode`)
- Personal Git configuration
- Full development tool suite

### Work Profile (`dotfiles-work/`)
- Work project directories (`~/code`)
- Work-specific configurations
- Corporate environment settings

### Global Configuration (`dotfiles_global/`)
- Aider configuration
- Git global ignore patterns
- Powerlevel10k theme settings
- Mackup backup configuration
- RVM and Gem configurations

## File Structure

```
dotfiles/
├── dotfiles-home/          # Home profile configurations
├── dotfiles-work/          # Work profile configurations
├── dotfiles_global/        # Global configurations
├── install                 # Interactive installation script
├── install.conf.yaml       # Global dotbot configuration
├── install-home.conf.yaml  # Home profile dotbot configuration
├── install-work.conf.yaml  # Work profile dotbot configuration
└── dotbot/                 # Dotbot submodule
```

## Key Features

- **Profile Support**: Separate configurations for home and work environments
- **AI Development**: Pre-configured Aider setup for AI-assisted coding
- **Modern Shell**: Enhanced Zsh with powerful plugins and theming
- **Multi-language Support**: Ready-to-go setups for Python, Node.js, Java, Ruby
- **Docker Integration**: Enhanced Docker workflow with custom aliases
- **Backup Ready**: Mackup integration for application settings backup

## Customization

### Adding New Tools
1. Add configuration files to the appropriate profile directory
2. Update the corresponding `install-*.conf.yaml` file
3. Add any required plugins to `rad-plugins` files

### Modifying Shell Configuration
- Edit `dotfiles-home/zshrc` or `dotfiles-work/zshrc` for profile-specific changes
- Edit files in `dotfiles_global/` for changes that apply to all profiles
- Modify `rad-plugins` files to add or remove shell plugins

## Dependencies

This configuration relies on several external tools that will be installed automatically:
- Dotbot (included as submodule)
- rad-shell plugin system
- Various Zsh plugins
- Development tools via Homebrew

## Troubleshooting

If you encounter issues:

1. Ensure you have the latest version of Git and Homebrew
2. Check that the Dotbot submodule is properly initialized
3. Verify file permissions for the install script
4. Run `just validate` to check YAML configuration files

## License

Personal configuration - feel free to fork and adapt for your own use.

## Symlinking Claude

ln -sfn "$(pwd)/agents" ~/.claude/agents
ln -sfn "$(pwd)/commands" ~/.claude/commands
ln -sfn "$(pwd)/CLAUDE.md" ~/.claude/CLAUDE.md
ln -sfn "$(pwd)/settings.json" ~/.claude/settings.json
