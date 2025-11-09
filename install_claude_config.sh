#!/bin/bash -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd $SCRIPT_DIR/dotfiles_global


mkdir -p "$HOME/.claude"

for f in agents commands CLAUDE.md settings.json; do
  src_file="$(pwd)/$f"
  dest_file="$HOME/.claude/$f"
  tmp_link="$HOME/.claude/.${f}.tmp.$$"
  ts="$(date +%Y%m%d%H%M%S)"
  backup="${dest_file}.${ts}.bak"

  # Create temp symlink next to destination
  rm -f "$tmp_link"
  ln -s "$src_file" "$tmp_link"

  # If destination exists (file/dir/symlink), back it up
  if [[ -e "$dest_file" || -L "$dest_file" ]]; then
    mv "$dest_file" "$backup"
    echo "backed up $dest_file -> $backup"
  fi

  # Replace destination with new symlink
  rm -rf "$dest_file"
  mv "$tmp_link" "$dest_file"
  echo "linked $src_file -> $dest_file"
done
