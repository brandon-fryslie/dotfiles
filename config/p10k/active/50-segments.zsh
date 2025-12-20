# Segment configurations
# Active segment settings only (see reference/segments-all.zsh for full documentation)

#################################[ os_icon: os identifier ]##################################
typeset -g POWERLEVEL9K_OS_ICON_FOREGROUND=255

################################[ prompt_char: prompt symbol ]################################
typeset -g POWERLEVEL9K_PROMPT_CHAR_BACKGROUND=
typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=76
typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=196
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIINS_CONTENT_EXPANSION='❯'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VICMD_CONTENT_EXPANSION='❮'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIVIS_CONTENT_EXPANSION='V'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIOWR_CONTENT_EXPANSION='▶'
typeset -g POWERLEVEL9K_PROMPT_CHAR_OVERWRITE_STATE=true
typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=
typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL=
typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_{LEFT,RIGHT}_WHITESPACE=

##################################[ dir: current directory ]##################################
typeset -g POWERLEVEL9K_DIR_FOREGROUND=31
typeset -g POWERLEVEL9K_SHORTEN_STRATEGY=truncate_to_unique
typeset -g POWERLEVEL9K_SHORTEN_DELIMITER=
typeset -g POWERLEVEL9K_DIR_SHORTENED_FOREGROUND=103
typeset -g POWERLEVEL9K_DIR_ANCHOR_FOREGROUND=39
typeset -g POWERLEVEL9K_DIR_ANCHOR_BOLD=true

local anchor_files=(
  .bzr .citc .git .hg .node-version .python-version .go-version .ruby-version
  .lua-version .java-version .perl-version .php-version .tool-versions .mise.toml
  .shorten_folder_marker .svn .terraform CVS Cargo.toml composer.json go.mod
  package.json stack.yaml
)
typeset -g POWERLEVEL9K_SHORTEN_FOLDER_MARKER="(${(j:|:)anchor_files})"
typeset -g POWERLEVEL9K_DIR_TRUNCATE_BEFORE_MARKER=false
typeset -g POWERLEVEL9K_SHORTEN_DIR_LENGTH=1
typeset -g POWERLEVEL9K_DIR_MAX_LENGTH=80
typeset -g POWERLEVEL9K_DIR_MIN_COMMAND_COLUMNS=40
typeset -g POWERLEVEL9K_DIR_MIN_COMMAND_COLUMNS_PCT=50
typeset -g POWERLEVEL9K_DIR_HYPERLINK=false
typeset -g POWERLEVEL9K_DIR_SHOW_WRITABLE=v3
typeset -g POWERLEVEL9K_DIR_CLASSES=()

#####################################[ vcs: git status ]######################################
typeset -g POWERLEVEL9K_VCS_BRANCH_ICON='\UE0A0 '
typeset -g POWERLEVEL9K_VCS_UNTRACKED_ICON='T'
typeset -g POWERLEVEL9K_VCS_COMMITS_BEHIND_FOREGROUND=208
typeset -g POWERLEVEL9K_VCS_MAX_INDEX_SIZE_DIRTY=-1
typeset -g POWERLEVEL9K_VCS_DISABLED_WORKDIR_PATTERN='~'
typeset -g POWERLEVEL9K_VCS_DISABLE_GITSTATUS_FORMATTING=true
typeset -g POWERLEVEL9K_VCS_CONTENT_EXPANSION='${$((my_git_formatter(1)))+${my_git_format}}'
typeset -g POWERLEVEL9K_VCS_LOADING_CONTENT_EXPANSION='${$((my_git_formatter(0)))+${my_git_format}}'
typeset -g POWERLEVEL9K_VCS_{STAGED,UNSTAGED,UNTRACKED,CONFLICTED,COMMITS_AHEAD,COMMITS_BEHIND}_MAX_NUM=-1
typeset -g POWERLEVEL9K_VCS_VISUAL_IDENTIFIER_COLOR=76
typeset -g POWERLEVEL9K_VCS_LOADING_VISUAL_IDENTIFIER_COLOR=244
typeset -g POWERLEVEL9K_VCS_VISUAL_IDENTIFIER_EXPANSION=
typeset -g POWERLEVEL9K_VCS_BACKENDS=(git)
typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND=76
typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND=76
typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND=178

##########################[ status: exit code of the last command ]###########################
typeset -g POWERLEVEL9K_STATUS_EXTENDED_STATES=true
typeset -g POWERLEVEL9K_STATUS_OK=true
typeset -g POWERLEVEL9K_STATUS_OK_FOREGROUND=70
typeset -g POWERLEVEL9K_STATUS_OK_VISUAL_IDENTIFIER_EXPANSION='✔'
typeset -g POWERLEVEL9K_STATUS_OK_PIPE=true
typeset -g POWERLEVEL9K_STATUS_OK_PIPE_FOREGROUND=70
typeset -g POWERLEVEL9K_STATUS_OK_PIPE_VISUAL_IDENTIFIER_EXPANSION='✔'
typeset -g POWERLEVEL9K_STATUS_ERROR=true
typeset -g POWERLEVEL9K_STATUS_ERROR_FOREGROUND=160
typeset -g POWERLEVEL9K_STATUS_ERROR_VISUAL_IDENTIFIER_EXPANSION='✘'
typeset -g POWERLEVEL9K_STATUS_ERROR_SIGNAL=true
typeset -g POWERLEVEL9K_STATUS_ERROR_SIGNAL_FOREGROUND=160
typeset -g POWERLEVEL9K_STATUS_VERBOSE_SIGNAME=false
typeset -g POWERLEVEL9K_STATUS_ERROR_SIGNAL_VISUAL_IDENTIFIER_EXPANSION='✘'
typeset -g POWERLEVEL9K_STATUS_ERROR_PIPE=true
typeset -g POWERLEVEL9K_STATUS_ERROR_PIPE_FOREGROUND=160
typeset -g POWERLEVEL9K_STATUS_ERROR_PIPE_VISUAL_IDENTIFIER_EXPANSION='✘'

###################[ command_execution_time: duration of the last command ]###################
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_THRESHOLD=3
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_PRECISION=0
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND=248
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FORMAT='d h m s'
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_VISUAL_IDENTIFIER_EXPANSION=

#######################[ background_jobs: presence of background jobs ]#######################
typeset -g POWERLEVEL9K_BACKGROUND_JOBS_VERBOSE=false
typeset -g POWERLEVEL9K_BACKGROUND_JOBS_FOREGROUND=37

#######################[ direnv: direnv status ]########################
typeset -g POWERLEVEL9K_DIRENV_FOREGROUND=178

###############[ asdf: asdf version manager ]###############
typeset -g POWERLEVEL9K_ASDF_FOREGROUND=66
typeset -g POWERLEVEL9K_ASDF_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_ASDF_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_ASDF_SHOW_SYSTEM=true
typeset -g POWERLEVEL9K_ASDF_SHOW_ON_UPGLOB=
typeset -g POWERLEVEL9K_ASDF_RUBY_FOREGROUND=168
typeset -g POWERLEVEL9K_ASDF_PYTHON_FOREGROUND=37
typeset -g POWERLEVEL9K_ASDF_GOLANG_FOREGROUND=37
typeset -g POWERLEVEL9K_ASDF_NODEJS_FOREGROUND=70
typeset -g POWERLEVEL9K_ASDF_RUST_FOREGROUND=37
typeset -g POWERLEVEL9K_ASDF_DOTNET_CORE_FOREGROUND=134
typeset -g POWERLEVEL9K_ASDF_FLUTTER_FOREGROUND=38
typeset -g POWERLEVEL9K_ASDF_LUA_FOREGROUND=32
typeset -g POWERLEVEL9K_ASDF_JAVA_FOREGROUND=32
typeset -g POWERLEVEL9K_ASDF_PERL_FOREGROUND=67
typeset -g POWERLEVEL9K_ASDF_ERLANG_FOREGROUND=125
typeset -g POWERLEVEL9K_ASDF_ELIXIR_FOREGROUND=129
typeset -g POWERLEVEL9K_ASDF_POSTGRES_FOREGROUND=31
typeset -g POWERLEVEL9K_ASDF_PHP_FOREGROUND=99
typeset -g POWERLEVEL9K_ASDF_HASKELL_FOREGROUND=172
typeset -g POWERLEVEL9K_ASDF_JULIA_FOREGROUND=70

##########[ nordvpn: nordvpn connection status ]###########
typeset -g POWERLEVEL9K_NORDVPN_FOREGROUND=39
typeset -g POWERLEVEL9K_NORDVPN_{DISCONNECTED,CONNECTING,DISCONNECTING}_CONTENT_EXPANSION=
typeset -g POWERLEVEL9K_NORDVPN_{DISCONNECTED,CONNECTING,DISCONNECTING}_VISUAL_IDENTIFIER_EXPANSION=

#################[ ranger/yazi/nnn/lf/xplr shells ]##################
typeset -g POWERLEVEL9K_RANGER_FOREGROUND=178
typeset -g POWERLEVEL9K_YAZI_FOREGROUND=178
typeset -g POWERLEVEL9K_NNN_FOREGROUND=72
typeset -g POWERLEVEL9K_LF_FOREGROUND=72
typeset -g POWERLEVEL9K_XPLR_FOREGROUND=72

###########################[ vim_shell: vim shell indicator ]###########################
typeset -g POWERLEVEL9K_VIM_SHELL_FOREGROUND=34

######[ midnight_commander shell ]######
typeset -g POWERLEVEL9K_MIDNIGHT_COMMANDER_FOREGROUND=178

#[ nix_shell ]##
typeset -g POWERLEVEL9K_NIX_SHELL_FOREGROUND=74

##################[ chezmoi_shell ]##################
typeset -g POWERLEVEL9K_CHEZMOI_SHELL_FOREGROUND=33

##################################[ disk_usage ]##################################
typeset -g POWERLEVEL9K_DISK_USAGE_NORMAL_FOREGROUND=35
typeset -g POWERLEVEL9K_DISK_USAGE_WARNING_FOREGROUND=220
typeset -g POWERLEVEL9K_DISK_USAGE_CRITICAL_FOREGROUND=160
typeset -g POWERLEVEL9K_DISK_USAGE_WARNING_LEVEL=90
typeset -g POWERLEVEL9K_DISK_USAGE_CRITICAL_LEVEL=95
typeset -g POWERLEVEL9K_DISK_USAGE_ONLY_WARNING=false

###########[ vi_mode ]###########
typeset -g POWERLEVEL9K_VI_COMMAND_MODE_STRING=NORMAL
typeset -g POWERLEVEL9K_VI_MODE_NORMAL_FOREGROUND=106
typeset -g POWERLEVEL9K_VI_VISUAL_MODE_STRING=VISUAL
typeset -g POWERLEVEL9K_VI_MODE_VISUAL_FOREGROUND=68
typeset -g POWERLEVEL9K_VI_OVERWRITE_MODE_STRING=OVERTYPE
typeset -g POWERLEVEL9K_VI_MODE_OVERWRITE_FOREGROUND=172
typeset -g POWERLEVEL9K_VI_INSERT_MODE_STRING=
typeset -g POWERLEVEL9K_VI_MODE_INSERT_FOREGROUND=66

######################################[ ram/swap ]#######################################
typeset -g POWERLEVEL9K_RAM_FOREGROUND=66
typeset -g POWERLEVEL9K_SWAP_FOREGROUND=96

######################################[ load: CPU load ]######################################
typeset -g POWERLEVEL9K_LOAD_WHICH=5
typeset -g POWERLEVEL9K_LOAD_NORMAL_FOREGROUND=66
typeset -g POWERLEVEL9K_LOAD_WARNING_FOREGROUND=178
typeset -g POWERLEVEL9K_LOAD_CRITICAL_FOREGROUND=166

################[ todo: todo items ]################
typeset -g POWERLEVEL9K_TODO_FOREGROUND=110
typeset -g POWERLEVEL9K_TODO_HIDE_ZERO_TOTAL=true
typeset -g POWERLEVEL9K_TODO_HIDE_ZERO_FILTERED=false

###########[ timewarrior ]############
typeset -g POWERLEVEL9K_TIMEWARRIOR_FOREGROUND=110
typeset -g POWERLEVEL9K_TIMEWARRIOR_CONTENT_EXPANSION='${P9K_CONTENT:0:24}${${P9K_CONTENT:24}:+…}'

##############[ taskwarrior ]##############
typeset -g POWERLEVEL9K_TASKWARRIOR_FOREGROUND=74

######[ per_directory_history ]#######
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_LOCAL_FOREGROUND=135
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_GLOBAL_FOREGROUND=130
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_LOCAL_CONTENT_EXPANSION=''
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_GLOBAL_CONTENT_EXPANSION=''
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_LOCAL_VISUAL_IDENTIFIER_EXPANSION=''
typeset -g POWERLEVEL9K_PER_DIRECTORY_HISTORY_GLOBAL_VISUAL_IDENTIFIER_EXPANSION=''

################################[ cpu_arch ]################################
typeset -g POWERLEVEL9K_CPU_ARCH_FOREGROUND=172

##################################[ context: user@hostname ]##################################
typeset -g POWERLEVEL9K_CONTEXT_ROOT_FOREGROUND=178
typeset -g POWERLEVEL9K_CONTEXT_{REMOTE,REMOTE_SUDO}_FOREGROUND=180
typeset -g POWERLEVEL9K_CONTEXT_FOREGROUND=180
typeset -g POWERLEVEL9K_CONTEXT_ROOT_TEMPLATE='%B%n@%m'
typeset -g POWERLEVEL9K_CONTEXT_{REMOTE,REMOTE_SUDO}_TEMPLATE='%n@%m'
typeset -g POWERLEVEL9K_CONTEXT_TEMPLATE='%n'

###[ virtualenv ]###
typeset -g POWERLEVEL9K_VIRTUALENV_FOREGROUND=37
typeset -g POWERLEVEL9K_VIRTUALENV_SHOW_PYTHON_VERSION=false
typeset -g POWERLEVEL9K_VIRTUALENV_SHOW_WITH_PYENV=false
typeset -g POWERLEVEL9K_VIRTUALENV_{LEFT,RIGHT}_DELIMITER=

#####################[ anaconda ]######################
typeset -g POWERLEVEL9K_ANACONDA_FOREGROUND=37
typeset -g POWERLEVEL9K_ANACONDA_CONTENT_EXPANSION='${${${${CONDA_PROMPT_MODIFIER#\(}% }%\)}:-${CONDA_PREFIX:t}}'

################[ pyenv ]################
typeset -g POWERLEVEL9K_PYENV_FOREGROUND=37
typeset -g POWERLEVEL9K_PYENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_PYENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_PYENV_SHOW_SYSTEM=true
typeset -g POWERLEVEL9K_PYENV_CONTENT_EXPANSION='${P9K_CONTENT}${${P9K_CONTENT:#$P9K_PYENV_PYTHON_VERSION(|/*)}:+ $P9K_PYENV_PYTHON_VERSION}'

################[ goenv ]################
typeset -g POWERLEVEL9K_GOENV_FOREGROUND=37
typeset -g POWERLEVEL9K_GOENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_GOENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_GOENV_SHOW_SYSTEM=true

##########[ nodenv ]##########
typeset -g POWERLEVEL9K_NODENV_FOREGROUND=70
typeset -g POWERLEVEL9K_NODENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_NODENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_NODENV_SHOW_SYSTEM=true

##############[ nvm ]###############
typeset -g POWERLEVEL9K_NVM_FOREGROUND=70
typeset -g POWERLEVEL9K_NVM_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_NVM_SHOW_SYSTEM=true

############[ nodeenv ]############
typeset -g POWERLEVEL9K_NODEENV_FOREGROUND=70
typeset -g POWERLEVEL9K_NODEENV_SHOW_NODE_VERSION=false
typeset -g POWERLEVEL9K_NODEENV_{LEFT,RIGHT}_DELIMITER=

##############################[ node_version ]###############################
typeset -g POWERLEVEL9K_NODE_VERSION_FOREGROUND=70
typeset -g POWERLEVEL9K_NODE_VERSION_PROJECT_ONLY=true

#######################[ go_version ]########################
typeset -g POWERLEVEL9K_GO_VERSION_FOREGROUND=37
typeset -g POWERLEVEL9K_GO_VERSION_PROJECT_ONLY=true

#################[ rust_version ]##################
typeset -g POWERLEVEL9K_RUST_VERSION_FOREGROUND=37
typeset -g POWERLEVEL9K_RUST_VERSION_PROJECT_ONLY=true

###############[ dotnet_version ]################
typeset -g POWERLEVEL9K_DOTNET_VERSION_FOREGROUND=134
typeset -g POWERLEVEL9K_DOTNET_VERSION_PROJECT_ONLY=true

#####################[ php_version ]######################
typeset -g POWERLEVEL9K_PHP_VERSION_FOREGROUND=99
typeset -g POWERLEVEL9K_PHP_VERSION_PROJECT_ONLY=true

##########[ laravel_version ]###########
typeset -g POWERLEVEL9K_LARAVEL_VERSION_FOREGROUND=161

####################[ java_version ]####################
typeset -g POWERLEVEL9K_JAVA_VERSION_FOREGROUND=32
typeset -g POWERLEVEL9K_JAVA_VERSION_PROJECT_ONLY=true
typeset -g POWERLEVEL9K_JAVA_VERSION_FULL=false

###[ package ]####
typeset -g POWERLEVEL9K_PACKAGE_FOREGROUND=117

#############[ rbenv ]##############
typeset -g POWERLEVEL9K_RBENV_FOREGROUND=168
typeset -g POWERLEVEL9K_RBENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_RBENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_RBENV_SHOW_SYSTEM=true

#######################[ rvm ]########################
typeset -g POWERLEVEL9K_RVM_FOREGROUND=168
typeset -g POWERLEVEL9K_RVM_SHOW_GEMSET=false
typeset -g POWERLEVEL9K_RVM_SHOW_PREFIX=false

###########[ fvm ]############
typeset -g POWERLEVEL9K_FVM_FOREGROUND=38

##########[ luaenv ]###########
typeset -g POWERLEVEL9K_LUAENV_FOREGROUND=32
typeset -g POWERLEVEL9K_LUAENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_LUAENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_LUAENV_SHOW_SYSTEM=true

###############[ jenv ]################
typeset -g POWERLEVEL9K_JENV_FOREGROUND=32
typeset -g POWERLEVEL9K_JENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_JENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_JENV_SHOW_SYSTEM=true

###########[ plenv ]############
typeset -g POWERLEVEL9K_PLENV_FOREGROUND=67
typeset -g POWERLEVEL9K_PLENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_PLENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_PLENV_SHOW_SYSTEM=true

###########[ perlbrew ]############
typeset -g POWERLEVEL9K_PERLBREW_FOREGROUND=67
typeset -g POWERLEVEL9K_PERLBREW_PROJECT_ONLY=true
typeset -g POWERLEVEL9K_PERLBREW_SHOW_PREFIX=false

############[ phpenv ]############
typeset -g POWERLEVEL9K_PHPENV_FOREGROUND=99
typeset -g POWERLEVEL9K_PHPENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_PHPENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_PHPENV_SHOW_SYSTEM=true

#######[ scalaenv ]#######
typeset -g POWERLEVEL9K_SCALAENV_FOREGROUND=160
typeset -g POWERLEVEL9K_SCALAENV_SOURCES=(shell local global)
typeset -g POWERLEVEL9K_SCALAENV_PROMPT_ALWAYS_SHOW=false
typeset -g POWERLEVEL9K_SCALAENV_SHOW_SYSTEM=true

##########[ haskell_stack ]###########
typeset -g POWERLEVEL9K_HASKELL_STACK_FOREGROUND=172
typeset -g POWERLEVEL9K_HASKELL_STACK_SOURCES=(shell local)
typeset -g POWERLEVEL9K_HASKELL_STACK_ALWAYS_SHOW=true

################[ terraform ]#################
typeset -g POWERLEVEL9K_TERRAFORM_SHOW_DEFAULT=false
typeset -g POWERLEVEL9K_TERRAFORM_CLASSES=('*' OTHER)
typeset -g POWERLEVEL9K_TERRAFORM_OTHER_FOREGROUND=38

#############[ terraform_version ]##############
typeset -g POWERLEVEL9K_TERRAFORM_VERSION_FOREGROUND=38

#############[ kubecontext ]#############
typeset -g POWERLEVEL9K_KUBECONTEXT_SHOW_ON_COMMAND='kubectl|helm|kubens|kubectx|oc|istioctl|kogito|k9s|helmfile|flux|fluxctl|stern|kubeseal|skaffold|kubent|kubecolor|cmctl|sparkctl'
typeset -g POWERLEVEL9K_KUBECONTEXT_CLASSES=('*' DEFAULT)
typeset -g POWERLEVEL9K_KUBECONTEXT_DEFAULT_FOREGROUND=134
typeset -g POWERLEVEL9K_KUBECONTEXT_DEFAULT_CONTENT_EXPANSION=
POWERLEVEL9K_KUBECONTEXT_DEFAULT_CONTENT_EXPANSION+='${P9K_KUBECONTEXT_CLOUD_CLUSTER:-${P9K_KUBECONTEXT_NAME}}'
POWERLEVEL9K_KUBECONTEXT_DEFAULT_CONTENT_EXPANSION+='${${:-/$P9K_KUBECONTEXT_NAMESPACE}:#/default}'

#[ aws ]#
typeset -g POWERLEVEL9K_AWS_SHOW_ON_COMMAND='aws|awless|cdk|terraform|pulumi|terragrunt'
typeset -g POWERLEVEL9K_AWS_CLASSES=('*' DEFAULT)
typeset -g POWERLEVEL9K_AWS_DEFAULT_FOREGROUND=208
typeset -g POWERLEVEL9K_AWS_CONTENT_EXPANSION='${P9K_AWS_PROFILE//\%/%%}${P9K_AWS_REGION:+ ${P9K_AWS_REGION//\%/%%}}'

#[ aws_eb_env ]#
typeset -g POWERLEVEL9K_AWS_EB_ENV_FOREGROUND=70

##########[ azure ]##########
typeset -g POWERLEVEL9K_AZURE_SHOW_ON_COMMAND='az|terraform|pulumi|terragrunt'
typeset -g POWERLEVEL9K_AZURE_CLASSES=('*' OTHER)
typeset -g POWERLEVEL9K_AZURE_OTHER_FOREGROUND=32

##########[ gcloud ]###########
typeset -g POWERLEVEL9K_GCLOUD_SHOW_ON_COMMAND='gcloud|gcs|gsutil'
typeset -g POWERLEVEL9K_GCLOUD_FOREGROUND=32
typeset -g POWERLEVEL9K_GCLOUD_PARTIAL_CONTENT_EXPANSION='${P9K_GCLOUD_PROJECT_ID//\%/%%}'
typeset -g POWERLEVEL9K_GCLOUD_COMPLETE_CONTENT_EXPANSION='${P9K_GCLOUD_PROJECT_NAME//\%/%%}'
typeset -g POWERLEVEL9K_GCLOUD_REFRESH_PROJECT_NAME_SECONDS=60

#[ google_app_cred ]#
typeset -g POWERLEVEL9K_GOOGLE_APP_CRED_SHOW_ON_COMMAND='terraform|pulumi|terragrunt'
typeset -g POWERLEVEL9K_GOOGLE_APP_CRED_CLASSES=('*' DEFAULT)
typeset -g POWERLEVEL9K_GOOGLE_APP_CRED_DEFAULT_FOREGROUND=32
typeset -g POWERLEVEL9K_GOOGLE_APP_CRED_DEFAULT_CONTENT_EXPANSION='${P9K_GOOGLE_APP_CRED_PROJECT_ID//\%/%%}'

##############[ toolbox ]###############
typeset -g POWERLEVEL9K_TOOLBOX_FOREGROUND=178
typeset -g POWERLEVEL9K_TOOLBOX_CONTENT_EXPANSION='${P9K_TOOLBOX_NAME:#fedora-toolbox-*}'

###############################[ public_ip ]###############################
typeset -g POWERLEVEL9K_PUBLIC_IP_FOREGROUND=94

########################[ vpn_ip ]#########################
typeset -g POWERLEVEL9K_VPN_IP_FOREGROUND=81
typeset -g POWERLEVEL9K_VPN_IP_CONTENT_EXPANSION=
typeset -g POWERLEVEL9K_VPN_IP_INTERFACE='(gpd|wg|(.*tun)|tailscale)[0-9]*|(zt.*)'
typeset -g POWERLEVEL9K_VPN_IP_SHOW_ALL=false

###########[ ip ]###########
typeset -g POWERLEVEL9K_IP_FOREGROUND=38
typeset -g POWERLEVEL9K_IP_CONTENT_EXPANSION='${P9K_IP_RX_RATE:+%70F⇣$P9K_IP_RX_RATE }${P9K_IP_TX_RATE:+%215F⇡$P9K_IP_TX_RATE }%38F$P9K_IP_IP'
typeset -g POWERLEVEL9K_IP_INTERFACE='[ew].*'

#########################[ proxy ]##########################
typeset -g POWERLEVEL9K_PROXY_FOREGROUND=68

################################[ battery ]#################################
typeset -g POWERLEVEL9K_BATTERY_LOW_THRESHOLD=20
typeset -g POWERLEVEL9K_BATTERY_LOW_FOREGROUND=160
typeset -g POWERLEVEL9K_BATTERY_{CHARGING,CHARGED}_FOREGROUND=70
typeset -g POWERLEVEL9K_BATTERY_DISCONNECTED_FOREGROUND=178
typeset -g POWERLEVEL9K_BATTERY_STAGES='\UF008E\UF007A\UF007B\UF007C\UF007D\UF007E\UF007F\UF0080\UF0081\UF0082\UF0079'
typeset -g POWERLEVEL9K_BATTERY_VERBOSE=false

#####################################[ wifi ]#####################################
typeset -g POWERLEVEL9K_WIFI_FOREGROUND=68

####################################[ time ]####################################
typeset -g POWERLEVEL9K_TIME_FOREGROUND=66
typeset -g POWERLEVEL9K_TIME_FORMAT='%D{%H:%M:%S}'
typeset -g POWERLEVEL9K_TIME_UPDATE_ON_COMMAND=true
typeset -g POWERLEVEL9K_TIME_VISUAL_IDENTIFIER_EXPANSION=
# rad-added https://github.com/romkatv/powerlevel10k/issues/1277#issuecomment-787415848
typeset -g POWERLEVEL9K_TIME_LEFT_RIGHT_WHITESPACE=' %k%234F\uE0B4'
