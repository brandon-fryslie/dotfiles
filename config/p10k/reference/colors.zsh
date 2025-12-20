# p10k Color Reference
# Useful color codes for customization
#
# Tip: Print colormap with this one-liner:
#   for i in {0..255}; do print -Pn "%K{$i}  %k%F{$i}${(l:3::0:)i}%f " ${${(M)$((i%6)):#3}:+$'\n'}; done

# Commonly used colors in this config:
#
# 6    cyan
# 9    peach
# 10   nice teal
# 11   bright yellow
# 14   bright blue
# 20   blue
# 28   dark green (vcs_remote)
# 31   blue (dir foreground)
# 32   blue/green (various)
# 37   teal (virtualenv, pyenv, go)
# 38   blue (terraform, ip)
# 39   cyan (dir anchor, vcs_ahead)
# 40   dark green (staged)
# 46   bright green
# 66   grey-blue (time, ram, load)
# 67   grey (perl)
# 68   blue (proxy, wifi, vi_visual)
# 70   green (status ok, node, aws_eb_env)
# 72   grey-green (nnn, lf, xplr)
# 74   blue (nix_shell, taskwarrior)
# 76   bright green (prompt_char ok, vcs clean)
# 94   brown (public_ip)
# 99   purple (php)
# 103  grey-blue (dir shortened)
# 106  olive (vi_normal)
# 110  blue (todo, timewarrior)
# 117  light blue (package)
# 124  dim red
# 125  magenta (erlang)
# 129  purple (elixir)
# 130  orange (per_dir_history global)
# 134  purple (kubecontext, dotnet)
# 135  purple (per_dir_history local)
# 160  bright red (status error, unstaged)
# 161  pink (laravel)
# 166  orange (vcs_warn, load critical)
# 168  pink (ruby)
# 172  orange (haskell_stack, cpu_arch, vi_overwrite)
# 178  yellow (vcs_caution, modified, direnv, battery disconnected)
# 180  tan (context)
# 196  bright red (vcs_redalert, prompt_char error)
# 208  orange (aws)
# 220  yellow (disk_usage warning)
# 234  dark grey (background)
# 240  grey (multiline connectors, vcs_empty)
# 244  grey (separators, vcs loading)
# 246  grey (meta)
# 248  grey (command_execution_time)
# 252  light grey (git-taculous base text)
# 255  white (os_icon)
