#/usr/bin/zsh
dotfiles_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/dotfiles"

files=`cd $dotfiles_dir && ls`    # list of files/folders to symlink in homedir


echo "Reseting symlinks in $HOME to point to $dotfiles_dir/*"
for file in $files; do
    dotfile_path="$dotfiles_dir/$file"
    symlink_path="$HOME/.$file"
    if [[ ! -h $symlink_path ]]; then
        backup_dir=$HOME/.dotfile_backup
        mkdir -p $backup_dir
        echo "Backing up existing non-symlinked dotfile to ~/.dotfile_backup"
        mv $symlink_path $backup_dir
    else
        echo "Removing existing symlink at '$symlink_path'"
        rm -f $symlink_path
    fi
    echo "Creating symlink $dotfile_path -> $symlink_path"
    ln -s "$dotfile_path" "$symlink_path"
    echo
done

echo "Done!"
