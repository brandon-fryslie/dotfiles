# p10k Segments Reference
# Full documentation for all available segments
# Uncomment and customize as needed
#
# To enable a segment, add it to POWERLEVEL9K_LEFT_PROMPT_ELEMENTS or
# POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS in 20-prompt-elements.zsh

# ==============================================================================
# SEGMENT INDEX
# ==============================================================================
# os_icon                 - OS identifier
# prompt_char             - Prompt symbol (❯ or ❮)
# dir                     - Current directory
# vcs                     - Git status (built-in gitstatus)
# custom_git_taculous     - Git status (vcs_info based, no daemon)
# status                  - Exit code of last command
# command_execution_time  - Duration of last command
# background_jobs         - Presence of background jobs
# direnv                  - direnv status
# asdf                    - asdf version manager
# virtualenv              - Python virtual environment
# anaconda                - Conda environment
# pyenv                   - Python environment
# goenv                   - Go environment
# nodenv                  - Node.js from nodenv
# nvm                     - Node.js from nvm
# nodeenv                 - Node.js environment
# node_version            - Node.js version
# go_version              - Go version
# rust_version            - Rust version
# dotnet_version          - .NET version
# php_version             - PHP version
# laravel_version         - Laravel version
# java_version            - Java version
# package                 - name@version from package.json
# rbenv                   - Ruby from rbenv
# rvm                     - Ruby from rvm
# fvm                     - Flutter version
# luaenv                  - Lua from luaenv
# jenv                    - Java from jenv
# plenv                   - Perl from plenv
# perlbrew                - Perl from perlbrew
# phpenv                  - PHP from phpenv
# scalaenv                - Scala from scalaenv
# haskell_stack           - Haskell from stack
# terraform               - Terraform workspace
# terraform_version       - Terraform version
# kubecontext             - Kubernetes context
# aws                     - AWS profile
# aws_eb_env              - AWS Elastic Beanstalk
# azure                   - Azure account
# gcloud                  - Google Cloud
# google_app_cred         - Google application credentials
# toolbox                 - Toolbox name
# context                 - user@hostname
# nordvpn                 - NordVPN status
# ranger                  - Ranger shell
# yazi                    - Yazi shell
# nnn                     - nnn shell
# lf                      - lf shell
# xplr                    - xplr shell
# vim_shell               - Vim shell (:sh)
# midnight_commander      - Midnight Commander
# nix_shell               - Nix shell
# chezmoi_shell           - Chezmoi shell
# vi_mode                 - Vi mode indicator
# vpn_ip                  - VPN indicator
# ip                      - IP address and bandwidth
# public_ip               - Public IP
# proxy                   - HTTP/HTTPS/FTP proxy
# battery                 - Internal battery
# wifi                    - WiFi speed
# load                    - CPU load
# disk_usage              - Disk usage
# ram                     - Free RAM
# swap                    - Used swap
# todo                    - Todo items
# timewarrior             - Timewarrior status
# taskwarrior             - Taskwarrior task count
# per_directory_history   - Oh My Zsh per-directory-history
# cpu_arch                - CPU architecture
# time                    - Current time
# newline                 - Line break

# ==============================================================================
# SEGMENTS NOT IN ACTIVE CONFIG (available to enable)
# ==============================================================================

# #################################[ anaconda ]##################################
# # Anaconda environment color.
# typeset -g POWERLEVEL9K_ANACONDA_FOREGROUND=37
# # Anaconda segment format.
# typeset -g POWERLEVEL9K_ANACONDA_CONTENT_EXPANSION='${${${${CONDA_PROMPT_MODIFIER#\(}% }%\)}:-${CONDA_PREFIX:t}}'

# ##############################[ node_version ]################################
# # Node version color.
# typeset -g POWERLEVEL9K_NODE_VERSION_FOREGROUND=70
# # Show node version only when in a directory tree containing package.json.
# typeset -g POWERLEVEL9K_NODE_VERSION_PROJECT_ONLY=true

# #######################[ go_version ]########################
# # Go version color.
# typeset -g POWERLEVEL9K_GO_VERSION_FOREGROUND=37
# # Show go version only when in a go project subdirectory.
# typeset -g POWERLEVEL9K_GO_VERSION_PROJECT_ONLY=true

# #################[ rust_version ]##################
# # Rust version color.
# typeset -g POWERLEVEL9K_RUST_VERSION_FOREGROUND=37
# # Show rust version only when in a rust project subdirectory.
# typeset -g POWERLEVEL9K_RUST_VERSION_PROJECT_ONLY=true

# ###############[ dotnet_version ]################
# # .NET version color.
# typeset -g POWERLEVEL9K_DOTNET_VERSION_FOREGROUND=134
# # Show .NET version only when in a .NET project subdirectory.
# typeset -g POWERLEVEL9K_DOTNET_VERSION_PROJECT_ONLY=true

# #####################[ php_version ]######################
# # PHP version color.
# typeset -g POWERLEVEL9K_PHP_VERSION_FOREGROUND=99
# # Show PHP version only when in a PHP project subdirectory.
# typeset -g POWERLEVEL9K_PHP_VERSION_PROJECT_ONLY=true

# ##########[ laravel_version ]###########
# # Laravel version color.
# typeset -g POWERLEVEL9K_LARAVEL_VERSION_FOREGROUND=161

# ####################[ java_version ]####################
# # Java version color.
# typeset -g POWERLEVEL9K_JAVA_VERSION_FOREGROUND=32
# # Show java version only when in a java project subdirectory.
# typeset -g POWERLEVEL9K_JAVA_VERSION_PROJECT_ONLY=true
# # Show brief version.
# typeset -g POWERLEVEL9K_JAVA_VERSION_FULL=false

# ###[ package: name@version from package.json ]####
# # Package color.
# typeset -g POWERLEVEL9K_PACKAGE_FOREGROUND=117
# # Package format.
# # typeset -g POWERLEVEL9K_PACKAGE_CONTENT_EXPANSION='${P9K_PACKAGE_NAME//\%/%%}@${P9K_PACKAGE_VERSION//\%/%%}'

# #############[ rbenv ]##############
# # Rbenv color.
# typeset -g POWERLEVEL9K_RBENV_FOREGROUND=168
# # Hide ruby version if it doesn't come from one of these sources.
# typeset -g POWERLEVEL9K_RBENV_SOURCES=(shell local global)
# # If set to false, hide ruby version if it's the same as global.
# typeset -g POWERLEVEL9K_RBENV_PROMPT_ALWAYS_SHOW=false
# # If set to false, hide ruby version if it's equal to "system".
# typeset -g POWERLEVEL9K_RBENV_SHOW_SYSTEM=true

# #######################[ rvm ]########################
# # Rvm color.
# typeset -g POWERLEVEL9K_RVM_FOREGROUND=168
# # Don't show @gemset at the end.
# typeset -g POWERLEVEL9K_RVM_SHOW_GEMSET=false
# # Don't show ruby- at the front.
# typeset -g POWERLEVEL9K_RVM_SHOW_PREFIX=false

# ###########[ fvm: flutter version management ]############
# # Fvm color.
# typeset -g POWERLEVEL9K_FVM_FOREGROUND=38

# ##########[ nordvpn: nordvpn connection status (linux only) ]###########
# # NordVPN connection indicator color.
# typeset -g POWERLEVEL9K_NORDVPN_FOREGROUND=39
# # Hide NordVPN connection indicator when not connected.
# typeset -g POWERLEVEL9K_NORDVPN_{DISCONNECTED,CONNECTING,DISCONNECTING}_CONTENT_EXPANSION=
# typeset -g POWERLEVEL9K_NORDVPN_{DISCONNECTED,CONNECTING,DISCONNECTING}_VISUAL_IDENTIFIER_EXPANSION=

# #################[ ranger shell ]##################
# # Ranger shell color.
# typeset -g POWERLEVEL9K_RANGER_FOREGROUND=178

# ####################[ yazi shell ]#####################
# # Yazi shell color.
# typeset -g POWERLEVEL9K_YAZI_FOREGROUND=178

# ######################[ nnn shell ]#######################
# # Nnn shell color.
# typeset -g POWERLEVEL9K_NNN_FOREGROUND=72

# ######################[ lf shell ]#######################
# # lf shell color.
# typeset -g POWERLEVEL9K_LF_FOREGROUND=72

# ##################[ xplr shell ]##################
# # xplr shell color.
# typeset -g POWERLEVEL9K_XPLR_FOREGROUND=72

# ###########################[ vim_shell indicator ]###########################
# # Vim shell indicator color.
# typeset -g POWERLEVEL9K_VIM_SHELL_FOREGROUND=34

# ######[ midnight_commander shell ]######
# # Midnight Commander shell color.
# typeset -g POWERLEVEL9K_MIDNIGHT_COMMANDER_FOREGROUND=178

# #[ nix_shell ]##
# # Nix shell color.
# typeset -g POWERLEVEL9K_NIX_SHELL_FOREGROUND=74
# # Display the icon of nix_shell if PATH contains a subdirectory of /nix/store.
# # typeset -g POWERLEVEL9K_NIX_SHELL_INFER_FROM_PATH=false

# ##################[ chezmoi_shell ]##################
# # chezmoi shell color.
# typeset -g POWERLEVEL9K_CHEZMOI_SHELL_FOREGROUND=33

# ##################################[ disk_usage ]##################################
# # Colors for different levels of disk usage.
# typeset -g POWERLEVEL9K_DISK_USAGE_NORMAL_FOREGROUND=35
# typeset -g POWERLEVEL9K_DISK_USAGE_WARNING_FOREGROUND=220
# typeset -g POWERLEVEL9K_DISK_USAGE_CRITICAL_FOREGROUND=160
# # Thresholds for different levels of disk usage (percentage points).
# typeset -g POWERLEVEL9K_DISK_USAGE_WARNING_LEVEL=90
# typeset -g POWERLEVEL9K_DISK_USAGE_CRITICAL_LEVEL=95
# # If set to true, hide disk usage when below warning level.
# typeset -g POWERLEVEL9K_DISK_USAGE_ONLY_WARNING=false

# ###########[ vi_mode ]###########
# # Text and color for normal (command) vi mode.
# typeset -g POWERLEVEL9K_VI_COMMAND_MODE_STRING=NORMAL
# typeset -g POWERLEVEL9K_VI_MODE_NORMAL_FOREGROUND=106
# # Text and color for visual vi mode.
# typeset -g POWERLEVEL9K_VI_VISUAL_MODE_STRING=VISUAL
# typeset -g POWERLEVEL9K_VI_MODE_VISUAL_FOREGROUND=68
# # Text and color for overtype vi mode.
# typeset -g POWERLEVEL9K_VI_OVERWRITE_MODE_STRING=OVERTYPE
# typeset -g POWERLEVEL9K_VI_MODE_OVERWRITE_FOREGROUND=172
# # Text and color for insert vi mode.
# typeset -g POWERLEVEL9K_VI_INSERT_MODE_STRING=
# typeset -g POWERLEVEL9K_VI_MODE_INSERT_FOREGROUND=66

# ######################################[ ram ]#######################################
# # RAM color.
# typeset -g POWERLEVEL9K_RAM_FOREGROUND=66

# #####################################[ swap ]######################################
# # Swap color.
# typeset -g POWERLEVEL9K_SWAP_FOREGROUND=96

# ######################################[ load ]######################################
# # Show average CPU load over this many last minutes. Valid values are 1, 5 and 15.
# typeset -g POWERLEVEL9K_LOAD_WHICH=5
# # Load color when load is under 50%.
# typeset -g POWERLEVEL9K_LOAD_NORMAL_FOREGROUND=66
# # Load color when load is between 50% and 70%.
# typeset -g POWERLEVEL9K_LOAD_WARNING_FOREGROUND=178
# # Load color when load is over 70%.
# typeset -g POWERLEVEL9K_LOAD_CRITICAL_FOREGROUND=166

# ###############################[ public_ip ]###############################
# # Public IP color.
# typeset -g POWERLEVEL9K_PUBLIC_IP_FOREGROUND=94

# ###########[ ip: ip address and bandwidth usage ]###########
# # IP color.
# typeset -g POWERLEVEL9K_IP_FOREGROUND=38
# typeset -g POWERLEVEL9K_IP_CONTENT_EXPANSION='${P9K_IP_RX_RATE:+%70F⇣$P9K_IP_RX_RATE }${P9K_IP_TX_RATE:+%215F⇡$P9K_IP_TX_RATE }%38F$P9K_IP_IP'
# # Show information for the first network interface whose name matches this regex.
# typeset -g POWERLEVEL9K_IP_INTERFACE='[ew].*'

# #########################[ proxy ]##########################
# # Proxy color.
# typeset -g POWERLEVEL9K_PROXY_FOREGROUND=68

# ################################[ battery ]#################################
# # Show battery in red when it's below this level and not connected to power supply.
# typeset -g POWERLEVEL9K_BATTERY_LOW_THRESHOLD=20
# typeset -g POWERLEVEL9K_BATTERY_LOW_FOREGROUND=160
# # Show battery in green when it's charging or fully charged.
# typeset -g POWERLEVEL9K_BATTERY_{CHARGING,CHARGED}_FOREGROUND=70
# # Show battery in yellow when it's discharging.
# typeset -g POWERLEVEL9K_BATTERY_DISCONNECTED_FOREGROUND=178
# # Battery pictograms going from low to high level of charge.
# typeset -g POWERLEVEL9K_BATTERY_STAGES='\UF008E\UF007A\UF007B\UF007C\UF007D\UF007E\UF007F\UF0080\UF0081\UF0082\UF0079'
# # Don't show the remaining time to charge/discharge.
# typeset -g POWERLEVEL9K_BATTERY_VERBOSE=false

# #####################################[ wifi ]#####################################
# # WiFi color.
# typeset -g POWERLEVEL9K_WIFI_FOREGROUND=68
