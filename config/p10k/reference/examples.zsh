# p10k User-Defined Segment Examples
# Templates for creating custom prompt segments
#
# To use: copy these to an active config file and customize

# Example of a user-defined prompt segment. Function prompt_example will be called on every
# prompt if `example` prompt segment is added to POWERLEVEL9K_LEFT_PROMPT_ELEMENTS or
# POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS. It displays an icon and orange text greeting the user.
#
# Type `p10k help segment` for documentation and a more sophisticated example.
#
# function prompt_example() {
#   p10k segment -f 208 -i '⭐' -t 'hello, %n'
# }

# User-defined prompt segments may optionally provide an instant_prompt_* function. Its job
# is to generate the prompt segment for display in instant prompt. See
# https://github.com/romkatv/powerlevel10k#instant-prompt.
#
# Powerlevel10k will call instant_prompt_* at the same time as the regular prompt_* function
# and will record all `p10k segment` calls it makes. When displaying instant prompt, Powerlevel10k
# will replay these calls without actually calling instant_prompt_*. It is imperative that
# instant_prompt_* always makes the same `p10k segment` calls regardless of environment. If this
# rule is not observed, the content of instant prompt will be incorrect.
#
# Usually, you should either not define instant_prompt_* or simply call prompt_* from it. If
# instant_prompt_* is not defined for a segment, the segment won't be shown in instant prompt.
#
# function instant_prompt_example() {
#   # Since prompt_example always makes the same `p10k segment` calls, we can call it from
#   # instant_prompt_example. This will give us the same `example` prompt segment in the instant
#   # and regular prompts.
#   prompt_example
# }

# User-defined prompt segments can be customized the same way as built-in segments.
# typeset -g POWERLEVEL9K_EXAMPLE_FOREGROUND=208
# typeset -g POWERLEVEL9K_EXAMPLE_VISUAL_IDENTIFIER_EXPANSION='⭐'


# ==============================================================================
# More examples from the p10k docs
# ==============================================================================

# Show current directory with custom styling based on git repo status
# function prompt_my_dir() {
#   if [[ -n $VCS_STATUS_LOCAL_BRANCH ]]; then
#     p10k segment -f 39 -t '%~'  # In git repo: cyan
#   else
#     p10k segment -f 31 -t '%~'  # Not in git repo: blue
#   fi
# }

# Show a segment only when a specific file exists
# function prompt_has_package_json() {
#   [[ -f package.json ]] || return
#   p10k segment -f 70 -i '📦' -t 'npm project'
# }

# Show environment variable if set
# function prompt_my_env() {
#   [[ -n $MY_CUSTOM_VAR ]] || return
#   p10k segment -f 178 -t "$MY_CUSTOM_VAR"
# }
