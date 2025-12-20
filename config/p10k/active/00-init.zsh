# p10k initialization
# Option preservation, unset existing config, version check

emulate -L zsh -o extended_glob

# Unset all configuration options. This allows you to apply configuration changes without
# restarting zsh. Edit ~/.p10k.zsh and type `source ~/.p10k.zsh`.
unset -m '(POWERLEVEL9K_*|DEFAULT_USER)~POWERLEVEL9K_GITSTATUS_DIR'

# Zsh >= 5.1 is required.
[[ $ZSH_VERSION == (5.<1->*|<6->.*) ]] || return

# Disable gitstatusd (avoids spawning the gitstatus daemon; removes git info from prompt).
typeset -g POWERLEVEL9K_DISABLE_GITSTATUS=true
