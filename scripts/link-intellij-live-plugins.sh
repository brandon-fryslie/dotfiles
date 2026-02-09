#!/usr/bin/env bash
# Link IntelliJ live-plugins from dotfiles into each IntelliJ version directory.
# Idempotent: skips correct symlinks, replaces stale ones, backs up real directories.
set -euo pipefail

DOTFILES_SOURCE="$(cd "$(dirname "$0")/.." && pwd)/config/intellij-live-plugins"
JETBRAINS_DIR="$HOME/Library/Application Support/JetBrains"

if [[ ! -d "$JETBRAINS_DIR" ]]; then
  echo "JetBrains directory not found at $JETBRAINS_DIR — skipping"
  exit 0
fi

found=0
for dir in "$JETBRAINS_DIR"/IntelliJIdea*; do
  [[ -d "$dir" ]] || continue
  found=1
  target="$dir/live-plugins"

  # Already correctly linked
  if [[ -L "$target" ]] && [[ "$(readlink "$target")" == "$DOTFILES_SOURCE" ]]; then
    echo "OK: $target -> $DOTFILES_SOURCE"
    continue
  fi

  # Stale symlink — remove it
  if [[ -L "$target" ]]; then
    echo "Replacing stale symlink: $target"
    rm "$target"
  # Real directory — back it up
  elif [[ -d "$target" ]]; then
    backup="$target.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backing up existing directory: $target -> $backup"
    mv "$target" "$backup"
  fi

  ln -s "$DOTFILES_SOURCE" "$target"
  echo "Linked: $target -> $DOTFILES_SOURCE"
done

if [[ $found -eq 0 ]]; then
  echo "No IntelliJIdea* directories found in $JETBRAINS_DIR — skipping"
fi
