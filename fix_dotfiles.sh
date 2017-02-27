files="gemrc rvmrc zgen-setup.zsh zshrc tmux.shared.conf"    # list of files/folders to symlink in homedir

echo "Reseting symlinks in $HOME to point to $HOME/dotfiles"
for file in $files; do
    file_path="$HOME/.$file"
    rm $file_path 2>/dev/null
    echo "Creating symlink $HOME/dotfiles/$file -> $file_path"
    ln -s "$HOME/dotfiles/$file" "$file_path"
done

echo "Done!"
