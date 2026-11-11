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

  # Fallback styles if git-taculous theme hasn't set them.
  if ! zstyle -L ':vcs_info:*' enable >/dev/null 2>&1; then
    zstyle ':vcs_info:*' enable git
  fi
  if ! zstyle -L ':vcs_info:git*:*' get-revision >/dev/null 2>&1; then
    zstyle ':vcs_info:git*:*' get-revision true
    zstyle ':vcs_info:git*:*' check-for-changes true
    zstyle ':vcs_info:git*:*' stagedstr "%F{green}S%F{black}%B"
    zstyle ':vcs_info:git*:*' unstagedstr "%F{red}U%F{black}%B"
    zstyle ':vcs_info:git*' formats "%F{black}%B(%s) %12.12i %c%u %b%m%f"
    zstyle ':vcs_info:git*' actionformats "%F{black}%B(%s|%F{white}%a%F{black}%B) %12.12i %c%u %b%m%f"
  fi
  # The hooks carry this segment's own names: p10k defines +vi-git-stash, and whichever
  # file loads first would otherwise decide which stash hook runs [LAW:one-source-of-truth].
  # p10k's own `vcs` segment, if enabled, rewrites this zstyle at init.
  zstyle ':vcs_info:git*+set-message:*' hooks gittaculous-st gittaculous-stash gittaculous-username

  # Show remote ref name and number of commits ahead-of or behind
  function +vi-gittaculous-st() {
    local ahead behind remote
    local -a gitstatus
    remote=${$(git rev-parse --verify ${hook_com[branch]}@{upstream} --symbolic-full-name --abbrev-ref 2>/dev/null)}
    if [[ -n ${remote} ]]; then
      ahead=$(git rev-list ${hook_com[branch]}@{upstream}..HEAD 2>/dev/null | wc -l | sed -e 's/^[[:blank:]]*//')
      (( ahead )) && gitstatus+=( "%F{green}+${ahead}%F{black}%B" )
      behind=$(git rev-list HEAD..${hook_com[branch]}@{upstream} 2>/dev/null | wc -l | sed -e 's/^[[:blank:]]*//')
      (( behind )) && gitstatus+=( "%F{red}-${behind}%F{black}%B" )
      [[ ${#gitstatus} -gt 0 ]] && gitstatus=" ${(j:/:)gitstatus}"
      hook_com[branch]="${hook_com[branch]} [${remote}${gitstatus}]"
    fi
  }

  # Show count of stashed changes. Ask git, not the file layout: refs/stash is
  # no loose file once packed, and .git is a file in a linked worktree.
  function +vi-gittaculous-stash() {
    local stashes
    if stashes=$(git rev-list --walk-reflogs --count refs/stash 2>/dev/null) && (( stashes )); then
      hook_com[misc]+=" (${stashes} stashed)"
    fi
  }

  # Show the repo's own git user.name, only when it sets one
  function +vi-gittaculous-username() {
    local username
    if username=$(git config --local --get user.name) && [[ -n $username ]]; then
      (( ${#username} > 40 )) && username="${username[1,40]}..."
      # misc is prompt-expanded: a literal % in the name must not start an escape.
      hook_com[misc]+=" (${username//\%/%%})"
    fi
  }

  typeset -g POWERLEVEL9K_CUSTOM_GIT_TACULOUS='vcs_info && print -r -- ${vcs_info_msg_0_}'
fi
