# Git formatter function
# Custom git status display for gitstatus-based VCS segment

# Formatter for Git status.
# Example output: master wip ⇣42⇡42 *42 merge ~42 +42 !42 ?42.
function my_git_formatter() {
  emulate -L zsh

  if [[ -n $P9K_CONTENT ]]; then
    # If P9K_CONTENT is not empty, use it. It's either "loading" or from vcs_info
    typeset -g my_git_format=$P9K_CONTENT
    return
  fi

  if (( $1 )); then
    # Styling for up-to-date Git status
    local vcs_empty="%240F"
    local vcs_good="%76F"
    local vcs_caution="%178F"
    local vcs_warn="%166F"
    local vcs_error='%160F'
    local vcs_redalert="%196F"

    local       meta='%246F'  # grey foreground
    local      clean='%76F'   # green foreground
    local   modified='%178F'  # yellow foreground
    local   staged='%40F'
    local   unstaged='%160F'
    local   vcs_ahead='%039F'
    local  vcs_behind='%178F'
    local  vcs_remote='%028F'
    local conflicted='%196F'  # red foreground
  else
    # Styling for incomplete and stale Git status
    local       meta='%244F'  # grey foreground
    local      clean='%244F'  # grey foreground
    local   modified='%244F'  # grey foreground
    local  untracked='%244F'  # grey foreground
    local conflicted='%244F'  # grey foreground
  fi

  local vcs_reset="%b%u${meta}"

  # staged unstaged ahead behind
  function _staged_ahead_commits() {
    local res

    # Display staged/unstaged changes, commits ahead/behind
    if (( VCS_STATUS_COMMITS_AHEAD || VCS_STATUS_COMMITS_BEHIND )); then
      (( VCS_STATUS_COMMITS_BEHIND )) && res+="%B${vcs_behind}-%U${VCS_STATUS_COMMITS_BEHIND}%u${vcs_reset}"
      (( VCS_STATUS_COMMITS_AHEAD && VCS_STATUS_COMMITS_BEHIND )) && res+=" "
      (( VCS_STATUS_COMMITS_AHEAD  )) && res+="%B${vcs_ahead}+%U${VCS_STATUS_COMMITS_AHEAD}%u${vcs_reset}"
      [[ "${res[-1]}" != " " ]] && res+=" "
    fi

    res+="%b%u"
    echo $res
  }

  function _local_branch_tag() {
    local res
    if [[ -n $VCS_STATUS_LOCAL_BRANCH ]]; then
      local branch=${(V)VCS_STATUS_LOCAL_BRANCH}
      # If local branch name is at most 32 characters long, show it in full
      # Otherwise show the first 12 … the last 12
      (( $#branch > 32 )) && branch[13,-13]="…"
      res+="${clean}${branch//\%/%%}"
    fi

    if [[ -n $VCS_STATUS_TAG
        # Show tag only if not on a branch
        && -z $VCS_STATUS_LOCAL_BRANCH
      ]]; then
    local tag=${(V)VCS_STATUS_TAG}
    # If tag name is at most 32 characters long, show it in full
    # Otherwise show the first 12 … the last 12
    (( $#tag > 32 )) && tag[13,-13]="…"
    res+=" ${meta}#${clean}${tag//\%/%%}"
  fi

  # Display the current Git commit if there is no branch and no tag
  [[ -z $VCS_STATUS_LOCAL_BRANCH && -z $VCS_STATUS_TAG ]] &&
    res+=" ${meta}@${clean}${VCS_STATUS_COMMIT[1,8]}"

  echo $res
}

function _remote_branch() {
  local res
  res+=" ${meta}[${vcs_remote}"
  if [[ -n $VCS_STATUS_REMOTE_BRANCH ]]; then
    res+="${empty}${VCS_STATUS_REMOTE_NAME}/${(V)VCS_STATUS_REMOTE_BRANCH//\%/%%}"
    # Commits ahead/behind
    (( VCS_STATUS_NUM_STAGED || VCS_STATUS_NUM_UNSTAGED || VCS_STATUS_NUM_UNTRACKED )) && res+=" %B"
    (( VCS_STATUS_NUM_STAGED     )) && res+="${staged}S"
    (( VCS_STATUS_NUM_UNSTAGED   )) && res+="${unstaged}U"
    (( VCS_STATUS_NUM_UNTRACKED  )) && res+="${untracked}"
    res+="%b"
  else
    res+="${vcs_empty}(none)"
  fi

  res+="${meta}]"
  echo $res
}

  local res

  res+="$(_staged_ahead_commits)"
  res+="$(_local_branch_tag)"
  res+="$(_remote_branch)"

  # Display "wip" if the latest commit's summary contains "wip" or "WIP"
  if [[ $VCS_STATUS_COMMIT_SUMMARY == (|*[^[:alnum:]])(wip|WIP)(|[^[:alnum:]]*) ]]; then
    res+=" ${modified}wip"
  fi

  # ⇠42 if behind the push remote
  (( VCS_STATUS_PUSH_COMMITS_BEHIND )) && res+=" ${clean}⇠${VCS_STATUS_PUSH_COMMITS_BEHIND}"
  (( VCS_STATUS_PUSH_COMMITS_AHEAD && !VCS_STATUS_PUSH_COMMITS_BEHIND )) && res+=" "
  # ⇢42 if ahead of the push remote; no leading space if also behind: ⇠42⇢42
  (( VCS_STATUS_PUSH_COMMITS_AHEAD  )) && res+="${clean}⇢${VCS_STATUS_PUSH_COMMITS_AHEAD}"
  # 'merge' if the repo is in an unusual state
  [[ -n $VCS_STATUS_ACTION     ]] && res+=" ${conflicted}${VCS_STATUS_ACTION}"
  # ~42 if have merge conflicts
  (( VCS_STATUS_NUM_CONFLICTED )) && res+=" ${conflicted}~${VCS_STATUS_NUM_CONFLICTED}"
  (( VCS_STATUS_STASHES        )) && res+=" (${meta}${VCS_STATUS_STASHES} stashed)"

  typeset -g my_git_format=$res
}
functions -M my_git_formatter 2>/dev/null
