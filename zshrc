# Source Zgen and create init file if necessary
# Add custom Zsh plugins to .zgen-setup.zsh
source ~/.zgen-setup.zsh

# Add customizations below
export PATH="$PATH:/Users/frybr02/projects/docker-common-scripts/bin"

export ENABLE_DOCKER_PROMPT=true
export LAZY_NODE_PROMPT=true

export JAVA8_HOME="/Library/Java/JavaVirtualMachines/jdk1.8.0_25.jdk/Contents/Home"
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk1.8.0_25.jdk/Contents/Home"
export BUILDR_JAVA_OPTS="-Xmx2560m -Djava.security.egd=file:///dev/urandom -XX:ReservedCodeCacheSize=512m"
export ALM_JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk1.8.0_25.jdk/Contents/Home"
export SOLR_JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk1.8.0_25.jdk/Contents/Home"

# Add RVM to PATH for scripting. Make sure this is the last PATH variable change.
export PATH="$PATH:$HOME/.rvm/bin"

alias e.rc="atom ~/dotfiles"
alias cd.rc="cd ~/dotfiles"