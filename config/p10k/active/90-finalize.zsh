# Finalize p10k configuration
# Instant prompt, hot reload, and configuration reload

# Instant prompt mode.
#   - off:     Disable instant prompt.
#   - quiet:   Enable instant prompt and don't print warnings when detecting console output
#              during zsh initialization.
#   - verbose: Enable instant prompt and print a warning when detecting console output during
#              zsh initialization.
typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

# Hot reload allows you to change POWERLEVEL9K options after Powerlevel10k has been initialized.
# Can slow down prompt by 1-2 milliseconds.
typeset -g POWERLEVEL9K_DISABLE_HOT_RELOAD=false

# If p10k is already loaded, reload configuration.
# This works even with POWERLEVEL9K_DISABLE_HOT_RELOAD=true.
(( ! $+functions[p10k] )) || p10k reload
