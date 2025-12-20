# Git-taculous git status (vcs_info-based)
# Personal custom git status using vcs_info instead of gitstatus daemon
#
# This is a personal preference that integrates with the git-taculous theme
# from rad-plugins. It uses vcs_info hooks for git status instead of the
# faster gitstatus daemon, providing consistent behavior with the theme.

if [[ -z ${GITTACULOUS_VCS_SETUP_DONE:-} ]]; then
  typeset -g GITTACULOUS_VCS_SETUP_DONE=true
  (( $+functions[add-zsh-hook] )) || autoload -U add-zsh-hook
  (( $+functions[vcs_info] )) || autoload -Uz vcs_info
  setopt promptsubst

  # Fallback styles/hooks if git-taculous theme hasn't set them.
  if ! zstyle -L ':vcs_info:*' enable >/dev/null 2>&1; then
    zstyle ':vcs_info:*' enable git
  fi
  if ! zstyle -L ':vcs_info:git*:*' get-revision >/dev/null 2>&1; then
    zstyle ':vcs_info:git*:*' get-revision true
    zstyle ':vcs_info:git*:*' check-for-changes true
    zstyle ':vcs_info:git*:*' stagedstr "%F{green}S%F{252}%B"
    zstyle ':vcs_info:git*:*' unstagedstr "%F{red}U%F{252}%B"
    zstyle ':vcs_info:git*' formats "%F{252}(%s) %12.12i %c%u %b%m%f"
    zstyle ':vcs_info:git*' actionformats "%F{252}(%s|%F{white}%a%F{252}) %12.12i %c%u %b%m%f"
  fi
  if ! zstyle -L ':vcs_info:git*+set-message:*' hooks >/dev/null 2>&1; then
    zstyle ':vcs_info:git*+set-message:*' hooks git-st git-stash git-username
  fi

  # Show remote ref name and number of commits ahead-of or behind
  (( $+functions[+vi-git-st] )) || function +vi-git-st() {
    local ahead behind remote
    local -a gitstatus
    remote=${$(git rev-parse --verify ${hook_com[branch]}@{upstream} --symbolic-full-name --abbrev-ref 2>/dev/null)}
    if [[ -n ${remote} ]]; then
      ahead=$(git rev-list ${hook_com[branch]}@{upstream}..HEAD 2>/dev/null | wc -l | sed -e 's/^[[:blank:]]*//')
      (( ahead )) && gitstatus+=( "%F{green}+${ahead}%F{252}" )
      behind=$(git rev-list HEAD..${hook_com[branch]}@{upstream} 2>/dev/null | wc -l | sed -e 's/^[[:blank:]]*//')
      (( behind )) && gitstatus+=( "%F{red}-${behind}%F{252}" )
      [[ ${#gitstatus} -gt 0 ]] && gitstatus=" ${(j:/:)gitstatus}"
      hook_com[branch]="${hook_com[branch]} [${remote}${gitstatus}]"
    fi
  }

  # Show count of stashed changes
  (( $+functions[+vi-git-stash] )) || function +vi-git-stash() {
    local -a stashes
    if [[ -s ${hook_com[base]}/.git/refs/stash ]]; then
      stashes=$(git stash list 2>/dev/null | wc -l | sed -e 's/^[[:blank:]]*//')
      hook_com[misc]+=" (${stashes} stashed)"
    fi
  }

  # Show local git user.name
  (( $+functions[+vi-git-username] )) || function +vi-git-username() {
    local -a username
    username=$(git config --local --get user.name | sed -e 's/\(.\{40\}\).*/\1.../')
    hook_com[misc]+=" ($username)"
  }

  typeset -g POWERLEVEL9K_CUSTOM_GIT_TACULOUS='vcs_info && print -r -- ${vcs_info_msg_0_}'
fi
