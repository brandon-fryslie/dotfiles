# Prompt elements configuration
# LEFT and RIGHT prompt element arrays

### RAD-LEFT-ELEMENTS RAD-ELEMENTS
# The list of segments shown on the left. Fill it with the most important segments.
typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
  # =========================[ Line #1 ]=========================
  # os_icon               # os identifier
  dir                     # current directory
  per_directory_history_joined   # Oh My Zsh per-directory-history local/global indicator
  custom_git_taculous     # git status (vcs_info-based, no daemon)
  # =========================[ Line #2 ]=========================
  newline                 # \n
  prompt_char           # prompt symbol
)

### RAD-RIGHT-ELEMENTS
# The list of segments shown on the right. Fill it with less important segments.
# Right prompt on the last prompt line (where you are typing your commands) gets
# automatically hidden when the input line reaches it. Right prompt above the
# last prompt line gets hidden if it would overlap with left prompt.
typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
  # =========================[ Line #1 ]=========================
  command_execution_time  # duration of the last command
  background_jobs         # presence of background jobs
  direnv                  # direnv status (https://direnv.net/)
  asdf                    # asdf version manager (https://github.com/asdf-vm/asdf)
  virtualenv              # python virtual environment (https://docs.python.org/3/library/venv.html)
  pyenv                   # python environment (https://github.com/pyenv/pyenv)
  goenv                   # go environment (https://github.com/syndbg/goenv)
  nodenv                  # node.js version from nodenv (https://github.com/nodenv/nodenv)
  nvm                     # node.js version from nvm (https://github.com/nvm-sh/nvm)
  nodeenv                 # node.js environment (https://github.com/ekalinin/nodeenv)
  kubecontext             # current kubernetes context (https://kubernetes.io/)
  terraform               # terraform workspace (https://www.terraform.io)
  terraform_version       # terraform version (https://www.terraform.io)
  aws                     # aws profile (https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)
  azure                   # azure account name (https://docs.microsoft.com/en-us/cli/azure)
  toolbox                 # toolbox name (https://github.com/containers/toolbox)
  context                 # user@hostname
  vpn_ip                  # virtual private network indicator
  todo                    # todo items (https://github.com/todotxt/todo.txt-cli)
  timewarrior             # timewarrior tracking status (https://timewarrior.net/)
  taskwarrior             # taskwarrior task count (https://taskwarrior.org/)
  time                    # current time
  # =========================[ Line #2 ]=========================
  newline                 # \n
)
