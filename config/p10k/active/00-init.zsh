# Personal p10k initialization
# Sources rad-p10k plugin and sets up personal overrides
#
# This file sources the shareable rad-p10k configuration from rad-plugins,
# then applies personal customizations on top.

emulate -L zsh -o extended_glob

# Source rad-p10k plugin for base configuration
# rad-p10k provides: styling, segments, git formatter, transient prompt
if [[ -f "${RAD_PLUGINS_DIR:-$HOME/code/brandon-fryslie_rad-plugins}/rad-p10k/rad-p10k.plugin.zsh" ]]; then
  source "${RAD_PLUGINS_DIR:-$HOME/code/brandon-fryslie_rad-plugins}/rad-p10k/rad-p10k.plugin.zsh"
fi

# Personal override: Disable gitstatus daemon (use vcs_info instead)
# This is a personal preference - gitstatus is faster but vcs_info integrates
# with the git-taculous theme hooks
typeset -g POWERLEVEL9K_DISABLE_GITSTATUS=true
