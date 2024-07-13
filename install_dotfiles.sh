#!/bin/bash -el
############################
# install_dotfiles.sh
# This script creates symlinks from the home directory to any desired dotfiles in ~/dotfiles
############################

log_debug() {
  [[ -z "${RAD_DEBUG}" ]] && return 0
  >&2 echo "$@"
}

# Build list of files to symlink
# Returns absolute paths
build_files_list() {
  local dotfiles_global_dir="$1"
  local dotfiles_dir="$2"

  local dotfiles_global="${dotfiles_global_dir}"
  local dotfiles_profile="${dotfiles_dir}"
  local filename

  log_debug "global dotfiles dir: ${dotfiles_global_dir}"

  [[ -z $dotfiles_global_dir ]] || [[ -z $dotfiles_dir ]] && { echo "ERROR: Check args to build_files_list"; exit 1; }

#  IFS="\n"

  # get global dotfiles
  for filepath in "${dotfiles_global}"/*; do
    # skip markdown files
    [[ "${filepath##*.}" == "md" ]] && continue

    filename="$(basename "${filepath}")"
    if [[ -f "${dotfiles_dir}/${filename}" ]]; then
      >&2 echo "skipping global filepath in favor of profile-specific filepath for ${filename}"
      continue
    fi

    GLOBAL_filepaths+=("${filepath}")
  done

  # get profile-specific dotfiles
  for filepath in "${dotfiles_profile}"/*; do
    # skip markdown files
    [[ "${filepath##*.}" == "md" ]] && continue

    GLOBAL_filepaths+=("${filepath}")
  done
}

create_symlink() {
  local source_file="$1"
  local target_file="$2"

  # Ensure the source file actually exists
  if [[ ! -f "${source_file}" ]]; then
    >&2 echo "ERROR: Source file '${source_file}' does not exist"
    exit 0
  fi

  # Check if the symlink already exists and points to the correct path
  if [[ ! -L "$target_file" || "$(readlink -f "$target_file")" != "$(readlink -f "$source_file")" ]]; then
    # Create or update the symlink
    ln -sf "$source_file" "$target_file"
  else
    # do nothing
    log_debug "DEBUG: Ignoring target '${target_file}' (source: ${source_file})"
  fi
}

############################

########## Variables

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
dotfiles_global_dir="${script_dir}/dotfiles_global"   # global dotfiles
dotfiles_profile=$1                                   # the profile to use for dotfiles.  dotfiles dir will be dotfiles-${dotfiles_profile}
dotfiles_dir=${script_dir}/dotfiles-${dotfiles_profile}  # dotfiles directory
dotfile_backup_dir=~/dotfiles_old                                 # old dotfiles backup directory

##########

[[ -z $dotfiles_profile ]] && { echo "ERROR: You must specify a dotfiles profile"; exit 1; }

# ensure dotfiles dir exists for profile
if [[ ! -d $dotfiles_dir ]]; then
  echo "Could not find dotfiles profile '${dotfiles_profile}' at directory '${dotfiles_dir}'"
  exit 1
fi

# create dotfiles_old in homedir
echo "Creating '$dotfile_backup_dir' for backup of any existing dotfiles in \$HOME"
mkdir -p $dotfile_backup_dir

# build list of files
GLOBAL_filepaths=()
build_files_list "${dotfiles_global_dir}" "${dotfiles_dir}"

# move any existing dotfiles in homedir to dotfiles_old directory
echo "Moving any existing non-symlink dotfiles from \$HOME to $dotfile_backup_dir"
for filepath in "${GLOBAL_filepaths[@]}"; do
  filename="$(basename "${filepath}")"
  if [[ -f "${HOME}/.${filename}" && ! -L "${HOME}/.${filename}" ]]; then
    echo "Backing up existing dotfile: ~/.${filename} to ${dotfile_backup_dir}"
    mv -f "${HOME}/.${filename}" "${HOME}/dotfiles_old/${filename}"
  fi
done

# create symlinks
for filepath in "${GLOBAL_filepaths[@]}"; do
  filename="$(basename "${filepath}")"
  echo "Creating symlink to ${filename} in \$HOME"
  create_symlink "${filepath}" "${HOME}/.${filename}"
done

echo "Done!"
