#!/bin/bash
############################
# install_dotfiles.sh
# This script creates symlinks from the home directory to any desired dotfiles in ~/dotfiles
############################

########## Variables

dir=~/dotfiles                    # dotfiles directory
olddir=~/dotfiles_old             # old dotfiles backup directory
files="gemrc rvmrc zgen-setup.zsh zshrc tmux.shared.conf"    # list of files/folders to symlink in homedir

##########

# create dotfiles_old in homedir
echo "Creating $olddir for backup of any existing dotfiles in ~"
mkdir -p $olddir
echo "...done"

# change to the dotfiles directory
echo "Changing to the $dir directory"
cd $dir
echo "...done"

# move any existing dotfiles in homedir to dotfiles_old directory, then create symlinks
echo "Moving any existing dotfiles from ~ to $olddir"
for file in $files; do
    mv ~/.$file ~/dotfiles_old/ 2>/dev/null
    echo "Creating symlink to $file in home directory"
    ln -s $dir/$file ~/.$file
done

# Symlink platform-specific Tmux separately
mv ~/.tmux.conf $olddir
echo "Creating symlink to tmux.conf in home directory"
if [ "$(uname)" == "Darwin" ]; then
    echo "Symlinking OSX config for Tmux"
    ln -s $dir/tmux.osx.conf ~/.tmux.conf
else
    echo "Symlinking Linux config for Tmux"
    ln -s $dir/tmux.linux.conf ~/.tmux.conf
fi