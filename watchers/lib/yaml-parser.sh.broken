#!/usr/bin/env bash
# yaml-parser.sh - Parse watchers.yaml configuration
#
# This script provides functions to parse and extract data from watchers.yaml
# files. It prefers yq if available, falls back to Python + PyYAML, and has
# a basic grep/sed fallback for simple cases.
#
# Usage:
#   yaml-parser.sh --get-version <config-file>
#   yaml-parser.sh --list-watchers <config-file>
#   yaml-parser.sh --get-inputs <config-file> <watcher-name>
#   yaml-parser.sh --get-command-name <config-file> <watcher-name>
#   yaml-parser.sh --get-command-args <config-file> <watcher-name>
#   yaml-parser.sh --get-output <config-file> <watcher-name>
#   yaml-parser.sh --get-enabled <config-file> <watcher-name>
#   yaml-parser.sh --validate <config-file>

set -euo pipefail

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Expand tilde in paths
# Usage: expand_tilde "~/path/to/file"
expand_tilde() {
  local path="$1"
  # Replace leading ~ with $HOME
  echo "${path/#\~/$HOME}"
}

# Check if yq is available and functional
has_yq() {
  command -v yq &>/dev/null && yq --version &>/dev/null
}

# Check if Python with YAML support is available
has_python_yaml() {
  command -v python3 &>/dev/null && python3 -c "import yaml" 2>/dev/null
}

# Validate that config file exists
validate_config_file() {
  local config_file="$1"

  if [[ ! -f "$config_file" ]]; then
    echo "ERROR: Config file not found: $config_file" >&2
    return 1
  fi

  return 0
}

# ============================================================================
# YQ-BASED PARSING (PREFERRED)
# ============================================================================

# Extract version using yq
yq_get_version() {
  local config_file="$1"
  yq eval '.version' "$config_file" 2>/dev/null || echo "null"
}

# List all watcher names using yq
yq_list_watchers() {
  local config_file="$1"
  yq eval '.watchers[].name' "$config_file" 2>/dev/null || return 1
}

# Get watcher spec field using yq
yq_get_watcher_field() {
  local config_file="$1"
  local watcher_name="$2"
  local field="$3"

  # Find the watcher index by name, then extract field
  local query=".watchers[] | select(.name == \"${watcher_name}\") | ${field}"
  yq eval "$query" "$config_file" 2>/dev/null || echo "null"
}

# Get array field as one item per line
yq_get_watcher_array() {
  local config_file="$1"
  local watcher_name="$2"
  local field="$3"

  local query=".watchers[] | select(.name == \"${watcher_name}\") | ${field}[]"
  yq eval "$query" "$config_file" 2>/dev/null || return 1
}

# ============================================================================
# PYTHON-BASED PARSING (FALLBACK)
# ============================================================================

# Parse using Python
python_parse() {
  local config_file="$1"
  local operation="$2"
  shift 2
  # Pass additional args as command-line arguments to Python

  python3 - "$config_file" "$operation" "$@" <<'EOF'
import yaml
import sys

try:
    config_file = sys.argv[1]
    operation = sys.argv[2]
    args = sys.argv[3:] if len(sys.argv) > 3 else []

    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)

    if config is None:
        sys.exit(1)

    if operation == 'get-version':
        version = config.get('version', 'null')
        print(version)

    elif operation == 'list-watchers':
        watchers = config.get('watchers', [])
        for watcher in watchers:
            name = watcher.get('name')
            if name:
                print(name)

    elif operation == 'get-inputs':
        watcher_name = args[0] if args else None
        if not watcher_name:
            sys.exit(1)
        watchers = config.get('watchers', [])
        for watcher in watchers:
            if watcher.get('name') == watcher_name:
                inputs = watcher.get('inputs', [])
                for inp in inputs:
                    print(inp)
                sys.exit(0)
        sys.exit(1)

    elif operation == 'get-command-name':
        watcher_name = args[0] if args else None
        if not watcher_name:
            sys.exit(1)
        watchers = config.get('watchers', [])
        for watcher in watchers:
            if watcher.get('name') == watcher_name:
                command = watcher.get('command', {})
                print(command.get('name', 'null'))
                sys.exit(0)
        sys.exit(1)

    elif operation == 'get-command-args':
        watcher_name = args[0] if args else None
        if not watcher_name:
            sys.exit(1)
        watchers = config.get('watchers', [])
        for watcher in watchers:
            if watcher.get('name') == watcher_name:
                command = watcher.get('command', {})
                cmd_args = command.get('args', [])
                for arg in cmd_args:
                    print(arg)
                sys.exit(0)
        sys.exit(1)

    elif operation == 'get-output':
        watcher_name = args[0] if args else None
        if not watcher_name:
            sys.exit(1)
        watchers = config.get('watchers', [])
        for watcher in watchers:
            if watcher.get('name') == watcher_name:
                output = watcher.get('output', 'null')
                print(output)
                sys.exit(0)
        sys.exit(1)

    elif operation == 'get-enabled':
        watcher_name = args[0] if args else None
        if not watcher_name:
            sys.exit(1)
        watchers = config.get('watchers', [])
        for watcher in watchers:
            if watcher.get('name') == watcher_name:
                enabled = watcher.get('enabled', True)
                print(str(enabled).lower())
                sys.exit(0)
        sys.exit(1)

    elif operation == 'validate':
        # Just try to load - if we get here, it's valid YAML
        version = config.get('version')
        if version is None:
            print('ERROR: Missing version field', file=sys.stderr)
            sys.exit(1)
        sys.exit(0)

except yaml.YAMLError as e:
    print(f'ERROR: Invalid YAML syntax: {e}', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
EOF
}

# ============================================================================
# PUBLIC API FUNCTIONS
# ============================================================================

# Get version from config
get_version() {
  local config_file="$1"

  validate_config_file "$config_file" || return 1

  if has_yq; then
    yq_get_version "$config_file"
  elif has_python_yaml; then
    python_parse "$config_file" "get-version"
  else
    # Grep fallback - simple but fragile
    grep "^version:" "$config_file" | sed 's/version: *["'"'"']\?\([^"'"'"']*\)["'"'"']\?/\1/' | head -1
  fi
}

# List all watcher names
list_watchers() {
  local config_file="$1"

  validate_config_file "$config_file" || return 1

  if has_yq; then
    yq_list_watchers "$config_file"
  elif has_python_yaml; then
    python_parse "$config_file" "list-watchers"
  else
    # Grep fallback - finds name fields under watchers
    sed -n '/^watchers:/,/^[^ ]/p' "$config_file" | \
      grep "^ *- *name:" | \
      sed 's/.*name: *["'"'"']\?\([^"'"'"']*\)["'"'"']\?/\1/'
  fi
}

# Get inputs for a specific watcher
get_inputs() {
  local config_file="$1"
  local watcher_name="$2"

  validate_config_file "$config_file" || return 1

  if [[ -z "$watcher_name" ]]; then
    echo "ERROR: Watcher name required" >&2
    return 1
  fi

  local inputs
  local rc
  if has_yq; then
    inputs=$(yq_get_watcher_array "$config_file" "$watcher_name" ".inputs")
    rc=$?
  elif has_python_yaml; then
    inputs=$(python_parse "$config_file" "get-inputs" "$watcher_name")
    rc=$?
  else
    echo "ERROR: yq or Python with PyYAML required for complex parsing" >&2
    return 1
  fi

  local rc=$?
  if [[ $rc -ne 0 || -z "$inputs" ]]; then
    echo "ERROR: Watcher not found or has no inputs: $watcher_name" >&2
    return 1
  fi

  # Expand tildes in each input path
  while IFS= read -r input; do
    expand_tilde "$input"
  done <<< "$inputs"
}

# Get command name for a specific watcher
  local config_file="$1"
  local watcher_name="$2"

  validate_config_file "$config_file" || return 1

  if [[ -z "$watcher_name" ]]; then
    echo "ERROR: Watcher name required" >&2
    return 1
  fi

  if [[ $rc -ne 0 || "$result" == "null" ]]; then
    echo "ERROR: Watcher not found: $watcher_name" >&2
    return 1
  fi

  echo "$result"

  if has_yq; then
    local result rc
    result=$(yq_get_watcher_field "$config_file" "$watcher_name" ".command.name")
    rc=$?
  elif has_python_yaml; then
    result=$(python_parse "$config_file" "get-command-name" "$watcher_name")
    rc=$?
    python_parse "$config_file" "get-command-name" "$watcher_name"
  else
    echo "ERROR: yq or Python with PyYAML required for complex parsing" >&2
  fi

  fi
}

# Get command args for a specific watcher
get_command_args() {
  local config_file="$1"
  local watcher_name="$2"

  validate_config_file "$config_file" || return 1

  if [[ -z "$watcher_name" ]]; then
    echo "ERROR: Watcher name required" >&2
    return 1
  fi

  local args
  local rc
  if has_yq; then
    args=$(yq_get_watcher_array "$config_file" "$watcher_name" ".command.args")
    rc=$?
  elif has_python_yaml; then
    args=$(python_parse "$config_file" "get-command-args" "$watcher_name")
    rc=$?
  else
    echo "ERROR: yq or Python with PyYAML required for complex parsing" >&2
    return 1
  fi

  # Args might be empty (optional field), so don't error if empty
  if [[ $rc -ne 0 ]]; then
    echo "ERROR: Watcher not found: $watcher_name" >&2
    return 1
  fi

  # Expand tildes in each arg
  while IFS= read -r arg; do
    if [[ -n "$arg" ]]; then
      expand_tilde "$arg"
    fi
  done <<< "$args"
}

# Get output path for a specific watcher
get_output() {
  local config_file="$1"
  local watcher_name="$2"

  validate_config_file "$config_file" || return 1

  if [[ -z "$watcher_name" ]]; then
    echo "ERROR: Watcher name required" >&2
    return 1
  fi

  local output
  local rc
  if has_yq; then
    output=$(yq_get_watcher_field "$config_file" "$watcher_name" ".output")
    rc=$?
  elif has_python_yaml; then
    output=$(python_parse "$config_file" "get-output" "$watcher_name")
    rc=$?
  else
    echo "ERROR: yq or Python with PyYAML required for complex parsing" >&2
    return 1
  fi

  if [[ $rc -ne 0 || "$output" == "null" ]]; then
    echo "ERROR: Watcher not found or has no output: $watcher_name" >&2
    return 1
  fi

  # Expand tilde in output path
  expand_tilde "$output"
}

# Get enabled flag for a specific watcher
get_enabled() {
  local config_file="$1"
  local watcher_name="$2"

  validate_config_file "$config_file" || return 1

  if [[ -z "$watcher_name" ]]; then
    echo "ERROR: Watcher name required" >&2
    return 1
  fi

  local enabled
  local rc
  if has_yq; then
    enabled=$(yq_get_watcher_field "$config_file" "$watcher_name" ".enabled")
    rc=$?
  elif has_python_yaml; then
    enabled=$(python_parse "$config_file" "get-enabled" "$watcher_name")
    rc=$?
  else
    echo "ERROR: yq or Python with PyYAML required for complex parsing" >&2
    return 1
  fi

  if [[ $rc -ne 0 ]]; then
    echo "ERROR: Watcher not found: $watcher_name" >&2
    return 1
  fi

  # Default to true if not specified
  if [[ "$enabled" == "null" ]]; then
    echo "true"
  else
    echo "$enabled"
  fi
}

# Validate config file
validate_config() {
  local config_file="$1"

  validate_config_file "$config_file" || return 1

  if has_python_yaml; then
    python_parse "$config_file" "validate"
  elif has_yq; then
    # Try to parse with yq
    if ! yq eval '.' "$config_file" &>/dev/null; then
      echo "ERROR: Invalid YAML syntax" >&2
      return 1
    fi

    # Check for version field
    local version=$(yq_get_version "$config_file")
    if [[ "$version" == "null" ]]; then
      echo "ERROR: Missing version field" >&2
      return 1
    fi

    return 0
  else
    # Basic validation with grep
    if ! grep -q "^version:" "$config_file"; then
      echo "ERROR: Missing version field" >&2
      return 1
    fi
    return 0
  fi
}

# ============================================================================
# MAIN COMMAND DISPATCH
# ============================================================================

main() {
  local operation="$1"
  shift

  case "$operation" in
    --get-version)
      get_version "$@"
      ;;
    --list-watchers)
      list_watchers "$@"
      ;;
    --get-inputs)
      get_inputs "$@"
      ;;
    --get-command-name)
      get_command_name "$@"
      ;;
    --get-command-args)
      get_command_args "$@"
      ;;
    --get-output)
      get_output "$@"
      ;;
    --get-enabled)
      get_enabled "$@"
      ;;
    --validate)
      validate_config "$@"
      ;;
    *)
      echo "Usage: $0 <operation> <config-file> [watcher-name]" >&2
      echo "Operations:" >&2
      echo "  --get-version <config-file>" >&2
      echo "  --list-watchers <config-file>" >&2
      echo "  --get-inputs <config-file> <watcher-name>" >&2
      echo "  --get-command-name <config-file> <watcher-name>" >&2
      echo "  --get-command-args <config-file> <watcher-name>" >&2
      echo "  --get-output <config-file> <watcher-name>" >&2
      echo "  --get-enabled <config-file> <watcher-name>" >&2
      echo "  --validate <config-file>" >&2
      return 1
      ;;
  esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
