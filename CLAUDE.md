# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository that manages shell configuration across multiple environments (home and work profiles). The repository uses a profile-based system to maintain different configurations while sharing common settings.

## Architecture

### Profile System
- **dotfiles_global/**: Contains default configuration files used across all profiles
- **dotfiles-home/**: Home-specific configuration overrides
- **dotfiles-work/**: Work-specific configuration overrides
- **install_dotfiles.sh**: Main installation script that creates symlinks from home directory to dotfiles

### Profile Precedence
Files in profile-specific directories (home/work) take precedence over global files. If a file exists in both `dotfiles_global/` and `dotfiles-{profile}/`, the profile-specific version is used.

### Key Components
- **zshrc files**: Profile-specific zshrc files that source the global `~/.zshrc_global.zsh`
- **rad-plugins**: Lists of zsh plugins managed via zgenom/zgen plugin manager
- **aider.conf.yml**: AI coding assistant configuration in dotfiles_global/
- **p10k.zsh**: Powerlevel10k theme configuration
- **mackup.cfg**: Application settings sync configuration

## Installation and Usage

### Install Profile
```bash
./install_dotfiles.sh <profile>
```
Where `<profile>` is either "home" or "work".

### How Installation Works
1. Builds file list from global and profile-specific directories
2. Backs up existing dotfiles to `~/dotfiles_old/`
3. Creates symlinks from `~/.{filename}` to the appropriate dotfile
4. Profile-specific files override global files with the same name

### Auto-Installation
Both profile zshrc files include auto-installation logic that:
- Detects the dotfiles directory location
- Runs installation if the zshrc is being sourced directly from the repo
- Handles git updates and re-installation

## Shell Configuration

### Plugin Management
Uses zgenom (zgen fork) with brandon-fryslie/rad-plugins for modular shell functionality:
- Homebrew integration
- Docker completions  
- Git enhancements
- Development tools (sdkman, lazy nvm loading)
- Terminal customizations (powerlevel10k theme)

### Key Features
- **Lazy loading**: Node.js/NVM loaded on-demand for performance
- **Profile detection**: Automatically detects available project directories
- **Editor integration**: Configured for IntelliJ IDEA as primary editor
- **Color terminal support**: Enhanced ls with lsd, custom colormap functions

## Development Workflow

### Testing Changes
1. Make changes to files in appropriate directory (global vs profile-specific)
2. Run `./install_dotfiles.sh <profile>` to update symlinks
3. Source the updated configuration or restart terminal

### Adding New Configuration
- Add global configs to `dotfiles_global/`
- Add profile-specific overrides to `dotfiles-{profile}/`
- The install script will automatically handle symlinking

### Plugin Management
- Edit `rad-plugins` files to add/remove zsh plugins
- Changes take effect after restarting shell or running `zgenom reset`

## Special Considerations

- The repository uses symlinks, so editing files in the home directory directly edits the repo files
- Backup strategy: Original dotfiles are moved to `~/dotfiles_old/` before symlinking
- Git integration: Auto-pulls updates and handles stashing during zshrc sourcing
- Multiple directory detection: Supports various common project directory layouts (`~/icode`, `~/code`, `~/projects`)