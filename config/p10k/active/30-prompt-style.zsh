# Prompt style configuration
# Mode, separators, multiline settings, icons

# Defines character set used by powerlevel10k
typeset -g POWERLEVEL9K_MODE=nerdfont-v3

# When set to `moderate`, some icons will have an extra space after them
typeset -g POWERLEVEL9K_ICON_PADDING=none

# Icons position relative to content
typeset -g POWERLEVEL9K_ICON_BEFORE_CONTENT=

# Add an empty line before each prompt
typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true

# Connect left prompt lines with these symbols
typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_PREFIX='%240F╭─'
typeset -g POWERLEVEL9K_MULTILINE_NEWLINE_PROMPT_PREFIX='%240F├─'
typeset -g POWERLEVEL9K_MULTILINE_LAST_PROMPT_PREFIX='%240F╰─'

# Connect right prompt lines with these symbols
typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_SUFFIX=
typeset -g POWERLEVEL9K_MULTILINE_NEWLINE_PROMPT_SUFFIX=
typeset -g POWERLEVEL9K_MULTILINE_LAST_PROMPT_SUFFIX=

# Filler between left and right prompt on the first prompt line
typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_GAP_CHAR='─'
typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_GAP_BACKGROUND=
typeset -g POWERLEVEL9K_MULTILINE_NEWLINE_PROMPT_GAP_BACKGROUND=

if [[ $POWERLEVEL9K_MULTILINE_FIRST_PROMPT_GAP_CHAR != ' ' ]]; then
  # The color of the filler
  typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_GAP_FOREGROUND=240
  # Start filler from the edge of the screen if there are no left segments on the first line
  typeset -g POWERLEVEL9K_EMPTY_LINE_LEFT_PROMPT_FIRST_SEGMENT_END_SYMBOL='%{%}'
  # End filler on the edge of the screen if there are no right segments on the first line
  typeset -g POWERLEVEL9K_EMPTY_LINE_RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL='%{%}'
fi

# Default background color
typeset -g POWERLEVEL9K_BACKGROUND=234

# Separator between same-color segments on the left
typeset -g POWERLEVEL9K_LEFT_SUBSEGMENT_SEPARATOR='%244F\uE285'
# Separator between same-color segments on the right
typeset -g POWERLEVEL9K_RIGHT_SUBSEGMENT_SEPARATOR='%244F\uE200'
# Separator between different-color segments on the left
typeset -g POWERLEVEL9K_LEFT_SEGMENT_SEPARATOR='%244F\uE285'
# Separator between different-color segments on the right
typeset -g POWERLEVEL9K_RIGHT_SEGMENT_SEPARATOR='%244F\uE200'

# The right end of left prompt
typeset -g POWERLEVEL9K_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL='%F{244}\uE285 '
typeset -g POWERLEVEL9K_LEFT_PROMPT_LAST_SEGMENT_END_FOREGROUND=4

# The left end of right prompt
typeset -g POWERLEVEL9K_RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL=' %F{244}\uE200'

# The left end of left prompt
typeset -g POWERLEVEL9K_LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL=''

# The right end of right prompt
typeset -g POWERLEVEL9K_RIGHT_PROMPT_LAST_SEGMENT_END_SYMBOL=''

# Left prompt terminator for lines without any segments
typeset -g POWERLEVEL9K_EMPTY_LINE_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=
