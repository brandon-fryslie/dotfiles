#!/usr/bin/env bash
# Display concise, glanceable tmux shortcuts in a persistent pane

# Use color codes for better readability
CYAN='\033[0;36m'
WHITE='\033[1;37m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

clear
cat << EOF
${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${WHITE}PANES${NC}    ${YELLOW}o${NC}next  ${YELLOW};${NC}last  ${YELLOW}q${NC}show#  ${YELLOW}z${NC}zoom  ${YELLOW}x${NC}kill  ${YELLOW}[${NC}scroll     ${WHITE}SPLIT${NC}  ${YELLOW}%${NC}vert  ${YELLOW}"${NC}horiz
${WHITE}WINDOWS${NC}  ${YELLOW}c${NC}new   ${YELLOW}n${NC}next  ${YELLOW}p${NC}prev   ${YELLOW}l${NC}last  ${YELLOW},${NC}rename        ${WHITE}SESSION${NC}  ${YELLOW}d${NC}detach  ${YELLOW}\$${NC}rename
${WHITE}RESIZE${NC}   ${YELLOW}Ctrl-↑↓←→${NC} (hold Ctrl+b, then arrows)           ${WHITE}HELP${NC}  ${YELLOW}h${NC}hide  ${YELLOW}/${NC}full  ${YELLOW}?${NC}all
${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
EOF

# Keep the pane alive (macOS doesn't support 'sleep infinity')
while true; do
  sleep 3600  # Sleep for 1 hour at a time
done
