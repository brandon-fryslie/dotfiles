#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=en_US.UTF-8

NO_COPY=false
for arg in "$@"; do
  case "$arg" in
    --no-copy) NO_COPY=true ;;
    *) echo "Unknown argument: $arg" >&2; echo "Usage: $0 [--no-copy]" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SCRIPT_DIR}/config/claude/CLAUDE.md"

# [LAW:one-source-of-truth] dotbot may have already symlinked the destination
# to $SOURCE itself; cp onto the same inode fails "are identical" under set -e.
# Same file means the desired end state already holds — nothing to do.
copy_into_place() {
  [[ "$1" -ef "$2" ]] || cp "$1" "$2"
}

if [[ "$NO_COPY" == false ]]; then
  copy_into_place "$SOURCE" ~/.claude/CLAUDE.md
  copy_into_place "$SOURCE" ~/.codex/CODEX.md
fi

echo ""
echo "  For you, my love 💖"
echo ""

COLS=$(tput cols)

# ── pre-compute lookup tables via awk (sin/cos + color escapes) ───────
declare -a COS SIN COLOR_ESC
eval "$(awk 'BEGIN {
  pi = 3.14159265358979
  for (i = 0; i < 360; i++) {
    r_a = i * pi / 180
    printf "COS[%d]=%d; SIN[%d]=%d; ", i, int(cos(r_a)*1000), i, int(sin(r_a)*1000)
    hi = int(i / 60)
    f = int((i % 60) * 255 / 60)
    q = 255 - f
    if      (hi == 0) { r=255; g=f;   b=0   }
    else if (hi == 1) { r=q;   g=255; b=0   }
    else if (hi == 2) { r=0;   g=255; b=f   }
    else if (hi == 3) { r=0;   g=q;   b=255 }
    else if (hi == 4) { r=f;   g=0;   b=255 }
    else              { r=255; g=0;   b=q   }
    printf "COLOR_ESC[%d]=\"\\033[38;2;%d;%d;%dm\";\n", i, r, g, b
  }
}')"

# HSV dimmed (for fireworks fading — can't pre-compute variable brightness)
rainbow_dim() {
  local h=$(($1 % 360)) hi=$((($1 % 360) / 60)) bright=$2
  local f=$(( (h % 60) * bright / 60 )) q=$(( bright - (h % 60) * bright / 60 ))
  local r g b
  case $hi in
    0) r=$bright; g=$f;     b=0      ;; 1) r=$q;     g=$bright; b=0      ;;
    2) r=0;       g=$bright; b=$f    ;; 3) r=0;       g=$q;      b=$bright ;;
    4) r=$f;      g=0;       b=$bright;; *) r=$bright; g=0;       b=$q      ;;
  esac
  printf '\033[38;2;%d;%d;%dm' "$r" "$g" "$b"
}

# ── generate heart shape (ellipse math, perfect symmetry, full fill) ──
GEN_W=69 GEN_H=26 GEN_CTR=34
LCX=20 RCX=48 LCY=8 RX=15 RY=9
MERGE_ROW=10 BOT_ROW=25 MAX_HW=29
RX2=$((RX*RX)) RY2=$((RY*RY)) RXRY2=$((RX2*RY2))

declare -a PAL PLEN
PAL[1]="░"              PLEN[1]=1
PAL[2]="▒▓"             PLEN[2]=2
PAL[3]="█▇▓▆"           PLEN[3]=4
PAL[4]="♥❤♡❣✦✧"        PLEN[4]=6
PAL[5]="✶⋆✿❀❁❋✾✻"     PLEN[5]=8
PAL[6]="◆◇❖◈✸✷★☆"     PLEN[6]=8
PAL[7]="·˚°∘⟡⋆•❧"     PLEN[7]=8

declare -a HEART
for (( row=0; row<GEN_H; row++ )); do
  line=""
  for (( col=0; col<GEN_W; col++ )); do
    inside=0
    dx=$((col - LCX)); dy=$((row - LCY))
    (( dx*dx*RY2 + dy*dy*RX2 <= RXRY2 )) && inside=1
    if (( !inside )); then
      dx=$((col - RCX))
      (( dx*dx*RY2 + dy*dy*RX2 <= RXRY2 )) && inside=1
    fi
    if (( !inside && row >= MERGE_ROW )); then
      hw=$(( MAX_HW * (BOT_ROW - row) / (BOT_ROW - MERGE_ROW) ))
      (( col >= GEN_CTR - hw && col <= GEN_CTR + hw )) && inside=1
    fi
    if (( !inside )); then line+=" "; continue; fi

    depth=1
    for (( d=2; d<=7; d++ )); do
      srx=$((RX - d*2)); sry=$((RY - d))
      in_shrunk=0
      if (( srx > 0 && sry > 0 )); then
        srx2=$((srx*srx)); sry2=$((sry*sry)); srxry2=$((srx2*sry2))
        dx=$((col - LCX)); dy=$((row - LCY))
        (( dx*dx*sry2 + dy*dy*srx2 <= srxry2 )) && in_shrunk=1
        if (( !in_shrunk )); then
          dx=$((col - RCX))
          (( dx*dx*sry2 + dy*dy*srx2 <= srxry2 )) && in_shrunk=1
        fi
      fi
      if (( !in_shrunk && row >= MERGE_ROW )); then
        shw=$(( MAX_HW * (BOT_ROW - row) / (BOT_ROW - MERGE_ROW) - d*2 ))
        (( shw > 0 && col >= GEN_CTR - shw && col <= GEN_CTR + shw )) && in_shrunk=1
      fi
      if (( in_shrunk )); then depth=$d; else break; fi
    done
    (( depth > 7 )) && depth=7

    if (( depth >= 4 && (row * 3 + col * 7) % 19 == 0 )); then
      line+="♥"
    elif (( depth >= 5 && (row * 5 + col * 11) % 17 == 0 )); then
      line+="❤"
    elif (( depth >= 6 && (row * 7 + col * 3) % 13 == 0 )); then
      line+="✿"
    else
      p="${PAL[$depth]}"; pl=${PLEN[$depth]}
      idx=$(( (row * 7 + col * 13 + depth * 5) % pl ))
      line+="${p:idx:1}"
    fi
  done
  HEART[$row]="$line"
done

HEART_H=$GEN_H
HEART_W=$GEN_W

# Center offset
PAD=$(( (COLS - HEART_W) / 2 ))
(( PAD < 0 )) && PAD=0
PAD_STR=""
for (( i=0; i<PAD; i++ )); do PAD_STR+=" "; done

# Reserve space and save cursor at top of heart
for (( i=0; i<HEART_H; i++ )); do echo; done
printf '\033[%dA' "$HEART_H"
tput sc

# ── organic gradient renderer ─────────────────────────────────────────
# Focal point traces a Lissajous orbit OUTSIDE the heart bounds.
# Hue = octagonal_distance_to_focal + directional_projection (teardrop)
# Pre-computed COLOR_ESC[] lookup eliminates per-cell RGB math.

draw_frame() {
  local angle=$(($1 % 360)) base=$2
  # Focal point on elliptical orbit (constant direction, no reversals)
  local fx=$((GEN_CTR + COS[angle] * 50 / 1000))
  local fy=$((GEN_H / 2 + SIN[angle] * 28 / 1000))
  # Bias direction: focal → heart center (creates teardrop iso-hue curves)
  local bdx=$((GEN_CTR - fx)) bdy=$(( (GEN_H / 2 - fy) * 2 ))
  local abdx=${bdx#-} abdy=${bdy#-}
  local blen
  (( abdx > abdy )) && blen=$((abdx + abdy / 2)) || blen=$((abdy + abdx / 2))
  (( blen < 1 )) && blen=1

  tput rc
  for row in "${!HEART[@]}"; do
    local line="${HEART[$row]}"
    local buf="$PAD_STR"
    for (( col=0; col<${#line}; col++ )); do
      local ch="${line:col:1}"
      if [[ "$ch" == " " ]]; then
        buf+=" "
      else
        local dx=$((col - fx)) dy=$(( (row - fy) * 2 ))
        local adx=${dx#-} ady=${dy#-} dist
        (( adx > ady )) && dist=$((adx + ady / 2)) || dist=$((ady + adx / 2))
        local proj=$(( (dx * bdx + dy * bdy) / blen ))
        # Spatial dither: ±5° noise to soften color band edges
        local dither=$(( (row * 17 + col * 31 + row * col * 7) % 11 - 5 ))
        local hue=$(( (dist * 3 + proj / 2 + base + dither) % 360 ))
        (( hue < 0 )) && (( hue += 360 ))
        buf+="${COLOR_ESC[$hue]}${ch}"
      fi
    done
    printf '%b' "${buf}\033[0m\n"
  done
}

# ── flame color lookup table ──────────────────────────────────────────
declare -a FLAME_ESC
for (( d=0; d<=30; d++ )); do
  if (( d == 0 )); then r=255; g=255; b=220
  elif (( d <= 2 )); then r=255; g=255; b=$((100 - d * 30))
  elif (( d <= 5 )); then r=255; g=$((220 - (d - 2) * 40)); b=0
  elif (( d <= 9 )); then r=255; g=$((100 - (d - 5) * 25)); b=0
  else r=$((220 - (d - 9) * 8)); g=20; b=0; (( r < 150 )) && r=150
  fi
  FLAME_ESC[$d]=$(printf '\033[38;2;%d;%d;%dm' "$r" "$g" "$b")
done

draw_frame_flame() {
  local angle=$(($1 % 360)) base=$2 flame_front=$3
  local fx=$((GEN_CTR + COS[angle] * 50 / 1000))
  local fy=$((GEN_H / 2 + SIN[angle] * 28 / 1000))
  local bdx=$((GEN_CTR - fx)) bdy=$(( (GEN_H / 2 - fy) * 2 ))
  local abdx=${bdx#-} abdy=${bdy#-}
  local blen
  (( abdx > abdy )) && blen=$((abdx + abdy / 2)) || blen=$((abdy + abdx / 2))
  (( blen < 1 )) && blen=1

  tput rc
  for row in "${!HEART[@]}"; do
    local line="${HEART[$row]}"
    local buf="$PAD_STR"
    for (( col=0; col<${#line}; col++ )); do
      local ch="${line:col:1}"
      if [[ "$ch" == " " ]]; then
        buf+=" "
      elif (( row >= flame_front )); then
        # Flame overlay: white-hot at front, cooling to deep red behind
        local fdist=$(( row - flame_front ))
        local flicker=$(( (row * 7 + col * 13 + flame_front * 3) % 5 ))
        local fd=$(( fdist + flicker - 2 ))
        (( fd < 0 )) && fd=0
        (( fd > 30 )) && fd=30
        buf+="${FLAME_ESC[$fd]}${ch}"
      else
        local dx=$((col - fx)) dy=$(( (row - fy) * 2 ))
        local adx=${dx#-} ady=${dy#-} dist
        (( adx > ady )) && dist=$((adx + ady / 2)) || dist=$((ady + adx / 2))
        local proj=$(( (dx * bdx + dy * bdy) / blen ))
        local dither=$(( (row * 17 + col * 31 + row * col * 7) % 11 - 5 ))
        local hue=$(( (dist * 3 + proj / 2 + base + dither) % 360 ))
        (( hue < 0 )) && (( hue += 360 ))
        buf+="${COLOR_ESC[$hue]}${ch}"
      fi
    done
    printf '%b' "${buf}\033[0m\n"
  done
}

# ── fireworks ─────────────────────────────────────────────────────────

# Fixed-point scale: positions * FP_S for sub-pixel movement at 60fps
FP_S=5
MAX_PARTICLES=150
declare -a PX PY PVX PVY PHUE PLIFE PCHAR
PARTICLE_COUNT=0

SPARKLE=("✦" "✧" "·" "˚" "°" "♥" "❤" "✿" "*" "+" "×")

spawn_burst() {
  local cx=$1 cy=$2 count=$3 base_hue=$4
  for (( i=0; i<count; i++ )); do
    (( PARTICLE_COUNT >= MAX_PARTICLES )) && return
    local idx=$PARTICLE_COUNT
    PX[$idx]=$((cx * FP_S))
    PY[$idx]=$((cy * FP_S))
    PVX[$idx]=$(( (RANDOM % 9) - 4 ))
    PVY[$idx]=$(( (RANDOM % 7) - 5 ))
    PHUE[$idx]=$(( (base_hue + RANDOM % 80) % 360 ))
    PLIFE[$idx]=$(( 40 + RANDOM % 40 ))
    PCHAR[$idx]="${SPARKLE[$(( RANDOM % ${#SPARKLE[@]} ))]}"
    PARTICLE_COUNT=$((PARTICLE_COUNT + 1))
  done
}

# ── animation ─────────────────────────────────────────────────────────

cleanup() { tput cnorm; tput sgr0; }
trap cleanup EXIT
tput civis

# Phase 1: smooth organic gradient animation (~2s at 60fps)
# Ease-in only (no deceleration): starts gentle, continuously accelerates
P1_FRAMES=120
for (( frame=0; frame<P1_FRAMES; frame++ )); do
  # progress_deg: 0→90 for first-quadrant cosine ease-in
  progress_deg=$(( frame * 90 / P1_FRAMES ))
  # eased: 1 - cos(progress*90°), scaled 0→1000
  eased=$(( 1000 - COS[progress_deg] ))
  # Map eased progress to 0→360° angle
  angle=$(( eased * 360 / 1000 ))
  draw_frame $angle $angle
  sleep 0.016
done

# Pre-compute firework setup BEFORE flame so explosion is instant
# Query cursor position: \033[6n returns \033[ROW;COLR
IFS=';' read -t 1 -sdR -p $'\033[6n' CURSOR_ROW _ 2>/dev/null || CURSOR_ROW=$HEART_H
CURSOR_ROW=${CURSOR_ROW#*[}
(( CURSOR_ROW < HEART_H )) && CURSOR_ROW=$((HEART_H + 2))
HEART_TOP=$(( CURSOR_ROW - HEART_H ))
ROWS=$(tput lines)

# Pre-spawn all firework particles
for sample_row in $(seq 0 2 $((HEART_H - 1))); do
  local_line="${HEART[$sample_row]}"
  for sample_col in $(seq 5 6 "${#local_line}"); do
    ch="${local_line:sample_col:1}"
    [[ "$ch" == " " ]] && continue
    spawn_burst $((PAD + sample_col)) $((HEART_TOP + sample_row)) 2 $(( sample_row * 25 + sample_col * 5 ))
  done
done
center_x=$(( PAD + HEART_W / 2 ))
center_y=$(( HEART_TOP + HEART_H / 2 ))
spawn_burst "$center_x" "$center_y" 25 0
spawn_burst $((center_x - 14)) $((center_y - 5)) 15 120
spawn_burst $((center_x + 14)) $((center_y - 5)) 15 240
spawn_burst "$center_x" $((center_y - 7)) 15 60
spawn_burst "$center_x" $((center_y + 4)) 15 300

# Phase 2: flame wells up from bottom tip, ease-in (cubic: slow start, fast finish)
FLAME_FRAMES=61
for (( frame=0; frame<=FLAME_FRAMES; frame++ )); do
  # Cubic ease-in: progress^3 — creeps at first, then rockets to the top
  progress_num=$(( frame * frame * frame ))
  progress_den=$(( FLAME_FRAMES * FLAME_FRAMES * FLAME_FRAMES ))
  flame_front=$(( GEN_H - 1 - progress_num * (GEN_H - 1) / progress_den ))
  (( flame_front < 0 )) && flame_front=0

  # Continue gradient rotation seamlessly from Phase 1 endpoint (360°)
  grad_angle=$(( 360 + frame * 2 ))
  draw_frame_flame $((grad_angle % 360)) $((grad_angle % 360)) $flame_front
  sleep 0.016
done

# Phase 3: flame hits top → instant explosion, zero delay
# Erase the heart — it's gone now, only particles remain
BLANK_LINE="$PAD_STR$(printf '%*s' "$HEART_W" "")"
tput rc
for (( i=0; i<HEART_H; i++ )); do
  printf '%s\n' "$BLANK_LINE"
done

# Reserve space below for falling particles
FIREWORK_ROWS=$(( ROWS - CURSOR_ROW ))
(( FIREWORK_ROWS < 10 )) && FIREWORK_ROWS=10
for (( i=0; i<FIREWORK_ROWS; i++ )); do echo; done
printf '\033[%dA' "$FIREWORK_ROWS"

declare -a PREV_X PREV_Y
for (( p=0; p<PARTICLE_COUNT; p++ )); do
  PREV_X[$p]=-1
  PREV_Y[$p]=-1
done

# Animate particles falling + fading at 60fps (fixed-point positions)
for (( frame=0; frame<180; frame++ )); do
  alive=0

  for (( p=0; p<PARTICLE_COUNT; p++ )); do
    life=${PLIFE[$p]}
    (( life <= 0 )) && continue
    alive=1

    prev_x=${PREV_X[$p]}
    prev_y=${PREV_Y[$p]}
    if (( prev_x >= 0 && prev_y >= 0 && prev_x < COLS && prev_y < ROWS )); then
      printf '\033[%d;%dH ' "$((prev_y + 1))" "$((prev_x + 1))"
    fi

    PX[$p]=$(( PX[p] + PVX[p] ))
    PY[$p]=$(( PY[p] + PVY[p] ))
    # Gravity: accumulate 1 unit every 5 frames (matches FP_S)
    (( frame % FP_S == 0 )) && PVY[$p]=$(( PVY[p] + 1 ))
    PLIFE[$p]=$(( life - 1 ))

    # Convert fixed-point to screen coordinates
    cur_x=$(( PX[p] / FP_S ))
    cur_y=$(( PY[p] / FP_S ))

    PREV_X[$p]=$cur_x
    PREV_Y[$p]=$cur_y

    (( cur_x < 0 || cur_x >= COLS || cur_y < 0 || cur_y >= ROWS )) && continue

    bright=$(( life * 255 / 80 ))
    (( bright > 255 )) && bright=255
    (( bright < 30 )) && bright=30

    # Inline cursor move + color (no tput fork)
    h_f=$(( PHUE[p] % 360 )); hi_f=$((PHUE[p] % 360 / 60))
    f_f=$(( (h_f % 60) * bright / 60 )); q_f=$(( bright - (h_f % 60) * bright / 60 ))
    case $hi_f in
      0) r_f=$bright; g_f=$f_f;    b_f=0      ;; 1) r_f=$q_f;   g_f=$bright; b_f=0      ;;
      2) r_f=0;       g_f=$bright; b_f=$f_f   ;; 3) r_f=0;       g_f=$q_f;   b_f=$bright ;;
      4) r_f=$f_f;    g_f=0;       b_f=$bright ;; *) r_f=$bright; g_f=0;       b_f=$q_f   ;;
    esac
    printf '\033[%d;%dH\033[38;2;%d;%d;%dm%s' \
      "$((cur_y + 1))" "$((cur_x + 1))" "$r_f" "$g_f" "$b_f" "${PCHAR[$p]}"
  done

  (( alive == 0 )) && break
  sleep 0.016
done

# Clean up any remaining particles
for (( p=0; p<PARTICLE_COUNT; p++ )); do
  prev_x=${PREV_X[$p]}
  prev_y=${PREV_Y[$p]}
  if (( prev_x >= 0 && prev_y >= 0 && prev_x < COLS && prev_y < ROWS )); then
    printf '\033[%d;%dH ' "$((prev_y + 1))" "$((prev_x + 1))"
  fi
done

# Final message centered where the heart was
printf '\033[%d;%dH' "$((HEART_TOP + HEART_H / 2 + 1))" "$(( (COLS - 22) / 2 + 1 ))"
printf '\033[38;2;255;105;180mFor you, my love 💖\033[0m'
printf '\033[%d;1H\033[0m\n' "$((CURSOR_ROW + FIREWORK_ROWS))"
