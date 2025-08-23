## .zshrc file sourced by all dotfiles profiles

# Uncomment to enable profiling
# zmodload zsh/zprof

setopt clobber
setopt share_history

# Source Zgen and create init file if necessary
# Add custom Zsh plugins to .zgen-setup.zsh
source ~/.rad-shell/rad-init.zsh

fpath=("/Users/bmf/.zfunc" $fpath)


# Theme configuration
export ENABLE_DOCKER_PROMPT=false
export LAZY_NODE_PROMPT=true

# Editor configuration
export VISUAL=idea
export EDITOR=vi

# Local code configuration
# Detect and set PROJECTS_DIR
for d in "$HOME/icode" "$HOME/code" "$HOME/projects"; do
  [[ -d $d ]] && { PROJECTS_DIR=$d; break; }
done

eval "$(fnm env --use-on-cd --shell zsh)"

fpath+=~/.zfunc
fpath=(/Users/brandonfryslie/.docker/completions $fpath)

[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh


colormap() {
  for i in {0..255}; do print -Pn "%K{$i}  %k%F{$i}${(l:3::0:)i}%f " ${${(M)$((i%6)):#3}:+$'\n'}; done
}

alias ls=lsd
alias l='ls -l'
alias la='ls -a'
alias lla='ls -la'
alias lt='ls --tree'

e.rad-plugins() {
  cd ~/.zgenom/sources/brandon-fryslie/rad-plugins/___
  idea .
}

venv-envrc() {
  type direnv &>/dev/null || brew install direnv
  echo 'source .venv/bin/activate' >> .envrc
  direnv allow
}

alias .j='just --justfile ~/.user.justfile --working-directory .'
