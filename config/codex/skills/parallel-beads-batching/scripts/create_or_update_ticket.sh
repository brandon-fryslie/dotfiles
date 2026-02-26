#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  create_or_update_ticket.sh \
    --id <ticket-id> \
    --title <title> \
    --priority <0-4> \
    --body-file <file> \
    [--parent <ticket-id>] \
    [--depends-on <id1,id2,...>]
USAGE
}

ID=""
TITLE=""
PRIORITY=""
BODY_FILE=""
PARENT=""
DEPENDS_ON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --priority) PRIORITY="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --parent) PARENT="$2"; shift 2 ;;
    --depends-on) DEPENDS_ON="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$TITLE" || -z "$PRIORITY" || -z "$BODY_FILE" ]]; then
  echo "Missing required args" >&2
  usage
  exit 1
fi

if [[ ! -f "$BODY_FILE" ]]; then
  echo "Body file not found: $BODY_FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$($SCRIPT_DIR/resolve_canonical_beads_db.sh)"

# Create if missing; otherwise update.
if bd --db "$DB" show "$ID" --allow-stale --json >/dev/null 2>&1; then
  bd --db "$DB" update "$ID" --title "$TITLE" --priority "$PRIORITY" --body-file "$BODY_FILE" --json >/dev/null
else
  bd --db "$DB" create --id "$ID" --type task --priority "$PRIORITY" --title "$TITLE" --body-file "$BODY_FILE" --json >/dev/null
fi

if [[ -n "$PARENT" ]]; then
  bd --db "$DB" update "$ID" --parent "$PARENT" --json >/dev/null
fi

if [[ -n "$DEPENDS_ON" ]]; then
  IFS=',' read -r -a deps <<< "$DEPENDS_ON"
  for dep in "${deps[@]}"; do
    dep_trimmed="$(echo "$dep" | xargs)"
    [[ -z "$dep_trimmed" ]] && continue
    bd --db "$DB" dep add "$ID" "$dep_trimmed" >/dev/null
  done
fi

bd --db "$DB" sync --json >/dev/null
printf '%s\n' "$ID"
