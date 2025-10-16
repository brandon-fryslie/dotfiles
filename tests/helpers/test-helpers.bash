#!/usr/bin/env bash
# test-helpers.bash - Shared utilities for functional tests

# Get the absolute path to the dotfiles repository root
get_repo_root() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$(cd "$script_dir/../.." && pwd)"
}

# Export repository root for tests to use
export DOTFILES_ROOT="$(get_repo_root)"

# Create a temporary test home directory
# Usage: TEST_HOME=$(create_test_home)
create_test_home() {
  local test_home=$(mktemp -d -t dotfiles-test-home.XXXXXX)
  echo "$test_home"
}

# Create a temporary test directory
# Usage: TEST_DIR=$(create_test_dir)
create_test_dir() {
  local test_dir=$(mktemp -d -t dotfiles-test.XXXXXX)
  echo "$test_dir"
}

# Clean up a temporary directory
# Usage: cleanup_test_dir "$TEST_DIR"
cleanup_test_dir() {
  local dir="$1"
  if [[ -n "$dir" && -d "$dir" && "$dir" =~ "dotfiles-test" ]]; then
    rm -rf "$dir"
  fi
}

# Assert that a file exists
# Usage: assert_file_exists "/path/to/file"
assert_file_exists() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: File does not exist: $file" >&2
    return 1
  fi
  return 0
}

# Assert that a directory exists
# Usage: assert_dir_exists "/path/to/dir"
assert_dir_exists() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo "FAIL: Directory does not exist: $dir" >&2
    return 1
  fi
  return 0
}

# Assert that a symlink exists
# Usage: assert_symlink_exists "$HOME/.zshrc"
assert_symlink_exists() {
  local link="$1"
  if [[ ! -L "$link" ]]; then
    echo "FAIL: Symlink does not exist: $link" >&2
    return 1
  fi
  return 0
}

# Assert that a symlink points to expected target
# Usage: assert_symlink_target "$HOME/.zshrc" "dotfiles-home/zshrc"
assert_symlink_target() {
  local link="$1"
  local expected_pattern="$2"

  if [[ ! -L "$link" ]]; then
    echo "FAIL: Not a symlink: $link" >&2
    return 1
  fi

  local target=$(readlink "$link")
  if [[ ! "$target" =~ $expected_pattern ]]; then
    echo "FAIL: Symlink target does not match" >&2
    echo "  Link: $link" >&2
    echo "  Target: $target" >&2
    echo "  Expected pattern: $expected_pattern" >&2
    return 1
  fi
  return 0
}

# Assert JSON file contains expected structure
# Usage: assert_json_type "$file" "object"
assert_json_type() {
  local file="$1"
  local expected_type="$2"

  if [[ ! -f "$file" ]]; then
    echo "FAIL: JSON file does not exist: $file" >&2
    return 1
  fi

  local actual_type=$(jq -r 'type' "$file" 2>/dev/null)
  if [[ "$actual_type" != "$expected_type" ]]; then
    echo "FAIL: JSON type mismatch" >&2
    echo "  File: $file" >&2
    echo "  Expected: $expected_type" >&2
    echo "  Actual: $actual_type" >&2
    echo "  Content: $(cat "$file")" >&2
    return 1
  fi
  return 0
}

# Assert JSON file contains expected key with expected value
# Usage: assert_json_value "$file" ".editor" "idea"
assert_json_value() {
  local file="$1"
  local jq_path="$2"
  local expected_value="$3"

  if [[ ! -f "$file" ]]; then
    echo "FAIL: JSON file does not exist: $file" >&2
    return 1
  fi

  local actual_value=$(jq -r "$jq_path" "$file" 2>/dev/null)
  if [[ "$actual_value" != "$expected_value" ]]; then
    echo "FAIL: JSON value mismatch" >&2
    echo "  File: $file" >&2
    echo "  Path: $jq_path" >&2
    echo "  Expected: $expected_value" >&2
    echo "  Actual: $actual_value" >&2
    return 1
  fi
  return 0
}

# Check if a command exists
# Usage: if command_exists jq; then ...; fi
command_exists() {
  command -v "$1" &>/dev/null
}

# Require a command or skip test
# Usage: require_command jq "brew install jq"
require_command() {
  local cmd="$1"
  local install_hint="${2:-}"

  if ! command_exists "$cmd"; then
    if [[ -n "$install_hint" ]]; then
      skip "Required command not found: $cmd (install: $install_hint)"
    else
      skip "Required command not found: $cmd"
    fi
  fi
}

# Create a sample JSON file for testing
# Usage: create_sample_json "$file" "key" "value"
create_sample_json() {
  local file="$1"
  shift
  local -a pairs=("$@")

  # Build JSON object from key-value pairs
  local json="{"
  local first=true
  while [[ $# -ge 2 ]]; do
    if [[ "$first" != "true" ]]; then
      json+=","
    fi
    json+="\"$1\":\"$2\""
    first=false
    shift 2
  done
  json+="}"

  echo "$json" > "$file"
}

# Verify YAML file is valid
# Usage: assert_valid_yaml "$file"
assert_valid_yaml() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "FAIL: YAML file does not exist: $file" >&2
    return 1
  fi

  # Try to parse with Python (most systems have Python)
  if command_exists python3; then
    if ! python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
      echo "FAIL: Invalid YAML: $file" >&2
      return 1
    fi
  else
    # Fallback: basic syntax check (not comprehensive)
    if ! grep -q "^[a-zA-Z]" "$file"; then
      echo "FAIL: YAML file appears empty or invalid: $file" >&2
      return 1
    fi
  fi
  return 0
}

# Assert that a string contains a substring
# Usage: assert_contains "hello world" "world"
assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ ! "$haystack" =~ $needle ]]; then
    echo "FAIL: String does not contain expected substring" >&2
    echo "  Expected substring: $needle" >&2
    echo "  Actual string: $haystack" >&2
    return 1
  fi
  return 0
}

# Assert that a string does not contain a substring
# Usage: assert_not_contains "hello world" "foo"
assert_not_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" =~ $needle ]]; then
    echo "FAIL: String contains unexpected substring" >&2
    echo "  Unexpected substring: $needle" >&2
    echo "  Actual string: $haystack" >&2
    return 1
  fi
  return 0
}

# Wait for a file to be created (with timeout)
# Usage: wait_for_file "/path/to/file" 5
wait_for_file() {
  local file="$1"
  local timeout="${2:-10}"
  local elapsed=0

  while [[ ! -f "$file" && $elapsed -lt $timeout ]]; do
    sleep 0.5
    elapsed=$((elapsed + 1))
  done

  if [[ ! -f "$file" ]]; then
    echo "FAIL: Timeout waiting for file: $file" >&2
    return 1
  fi
  return 0
}

# Print test section header
# Usage: test_header "Testing merge-json.sh"
test_header() {
  echo "----------------------------------------"
  echo "$1"
  echo "----------------------------------------"
}

# Print test debug info (only if TEST_DEBUG is set)
# Usage: debug "Variable value: $foo"
debug() {
  if [[ -n "${TEST_DEBUG:-}" ]]; then
    echo "[DEBUG] $*" >&2
  fi
}

# Create a minimal dotbot config for testing
# Usage: create_test_dotbot_config "$config_file" "$test_home"
create_test_dotbot_config() {
  local config_file="$1"
  local test_home="$2"

  cat > "$config_file" <<EOF
- link:
    ~/.test-file: test-dotfiles/test-file
EOF
}

# Verify that dotbot executable exists and is functional
# Usage: require_dotbot
require_dotbot() {
  local dotbot="$DOTFILES_ROOT/dotbot/bin/dotbot"

  if [[ ! -f "$dotbot" ]]; then
    skip "Dotbot not found. Run: git submodule update --init --recursive"
  fi

  if [[ ! -x "$dotbot" ]]; then
    skip "Dotbot is not executable: $dotbot"
  fi
}

# Verify that jq is available
# Usage: require_jq
require_jq() {
  require_command jq "brew install jq"
}

# Verify that just is available
# Usage: require_just
require_just() {
  require_command just "brew install just"
}
