#!/bin/bash
############################
# install_dotfiles.sh
# This script creates symlinks from the home directory to any desired dotfiles in ~/dotfiles
############################

########## Variables

dotfiles_profile=$1                                   # the profile to use for dotfiles.  dotfiles dir will be dotfiles-${dotfiles_profile}
dotfiles_dir=~/dotfiles/dotfiles-${dotfiles_profile}  # dotfiles directory
olddir=~/dotfiles_old                                 # old dotfiles backup directory
files="gemrc rvmrc zshrc gitignore_global rad-plugins"    # list of files/folders to symlink in homedir

##########

[[ -z $dotfiles_profile ]] && { echo "ERROR: You must specify a dotfiles profile"; exit 1; }

# ensure dotfiles dir exists for profile
if [[ ! -d $dotfiles_dir ]]; then
  echo "Could not find dotfiles profile '${dotfiles_profile}' at directory '${dotfiles_dir}'"
  exit 1
fi

# create dotfiles_old in homedir
echo "Creating $olddir for backup of any existing dotfiles in ~"
mkdir -p $olddir
echo "...done"

# change to the dotfiles directory
echo "Changing to the $dotfiles_dir directory"
cd $dotfiles_dir
echo "...done"

# move any existing dotfiles in homedir to dotfiles_old directory, then create symlinks
echo "Moving any existing dotfiles from ~ to $olddir"
for file in $files; do
    mv ~/.$file ~/dotfiles_old/ 2>/dev/null
    echo "Creating symlink to $file in home directory"
    ln -s $dotfiles_dir/$file ~/.$file
done
