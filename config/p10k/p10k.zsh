# Personal Powerlevel10k Configuration
#
# This config uses a modular structure:
# - rad-p10k plugin (rad-plugins repo) provides shareable defaults
# - active/*.zsh files provide personal overrides
#
# Structure:
#   active/00-init.zsh         - Sources rad-p10k, sets personal prefs
#   active/10-git-taculous.zsh - Personal vcs_info-based git (instead of gitstatus)
#   active/20-prompt-elements.zsh - Personal LEFT/RIGHT element choices
#
# The rad-p10k plugin provides:
#   - Prompt styling (separators, multiline, colors)
#   - Segment configurations (50+ tools)
#   - Git formatter (gitstatus-based)
#   - Transient prompt helpers
#   - Finalization (instant prompt, reload)
#
# Type `p10k configure` to generate a fresh config (replaces this structure).

# Temporarily change options.
'builtin' 'local' '-a' 'p10k_config_opts'
[[ ! -o 'aliases'         ]] || p10k_config_opts+=('aliases')
[[ ! -o 'sh_glob'         ]] || p10k_config_opts+=('sh_glob')
[[ ! -o 'no_brace_expand' ]] || p10k_config_opts+=('no_brace_expand')
'builtin' 'setopt' 'no_aliases' 'no_sh_glob' 'brace_expand'

# Capture script directory before entering anonymous function
'builtin' 'local' '_p10k_dir'="${${(%):-%x}:A:h}"

() {
  emulate -L zsh -o extended_glob

  # Source all active configuration modules in order
  for f in "$_p10k_dir"/active/*.zsh(N); do
    source "$f"
  done
}

# Tell `p10k configure` which file it should overwrite.
typeset -g POWERLEVEL9K_CONFIG_FILE=${${(%):-%x}:a}

(( ${#p10k_config_opts} )) && setopt ${p10k_config_opts[@]}
'builtin' 'unset' 'p10k_config_opts'
