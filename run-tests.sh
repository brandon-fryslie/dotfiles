#!/usr/bin/env bash
# run-tests.sh - Run functional tests for dotfiles repository
#
# This script provides a convenient wrapper for running bats tests
# with proper setup and reporting.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"

# Parse arguments
VERBOSE=false
TIMING=false
FILTER=""

usage() {
  cat <<EOF
Usage: $0 [OPTIONS] [FILTER]

Run functional tests for dotfiles repository.

OPTIONS:
  -v, --verbose    Show verbose test output
  -t, --timing     Show timing information for each test
  -h, --help       Show this help message

FILTER:
  Optional test name pattern to filter which tests to run
  Example: $0 merge-json    # Run only merge-json tests

EXAMPLES:
  $0                          # Run all tests
  $0 -v                       # Run all tests with verbose output
  $0 -t merge-json            # Run merge-json tests with timing
  $0 installation             # Run only installation tests

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -t|--timing)
      TIMING=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      FILTER="$1"
      shift
      ;;
  esac
done

# Check if bats is installed
if ! command -v bats &>/dev/null; then
  echo -e "${RED}Error: bats is not installed${NC}"
  echo ""
  echo "Install bats:"
  echo "  brew install bats-core"
  echo "  # or"
  echo "  npm install -g bats"
  exit 1
fi

# Check if jq is installed (required for JSON tests)
if ! command -v jq &>/dev/null; then
  echo -e "${YELLOW}Warning: jq is not installed${NC}"
  echo "Some tests may be skipped. Install with:"
  echo "  brew install jq"
  echo ""
fi

# Check if just is installed (required for justfile tests)
if ! command -v just &>/dev/null; then
  echo -e "${YELLOW}Warning: just is not installed${NC}"
  echo "Some tests may be skipped. Install with:"
  echo "  brew install just"
  echo ""
fi

# Check if dotbot submodule is initialized
if [ ! -f "$SCRIPT_DIR/dotbot/bin/dotbot" ]; then
  echo -e "${YELLOW}Warning: dotbot submodule not initialized${NC}"
  echo "Run: git submodule update --init --recursive"
  echo ""
fi

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}Dotfiles Functional Test Suite${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Build bats command
BATS_CMD="bats"

if [ "$VERBOSE" = true ]; then
  BATS_CMD="$BATS_CMD --verbose-run"
fi

if [ "$TIMING" = true ]; then
  BATS_CMD="$BATS_CMD --timing"
fi

# Determine which tests to run
if [ -n "$FILTER" ]; then
  # Find test files matching filter
  TEST_FILES=$(find "$TESTS_DIR/functional" -name "*${FILTER}*.bats" 2>/dev/null || true)

  if [ -z "$TEST_FILES" ]; then
    echo -e "${RED}Error: No test files match filter: $FILTER${NC}"
    echo ""
    echo "Available test files:"
    find "$TESTS_DIR/functional" -name "*.bats" -exec basename {} \; | sed 's/^/  /'
    exit 1
  fi

  echo -e "${YELLOW}Running filtered tests: $FILTER${NC}"
  echo ""

  # Run filtered tests
  $BATS_CMD $TEST_FILES
  TEST_EXIT=$?
else
  # Run all tests
  echo -e "${GREEN}Running all functional tests...${NC}"
  echo ""

  $BATS_CMD "$TESTS_DIR/functional/"
  TEST_EXIT=$?
fi

echo ""
echo -e "${BLUE}==================================${NC}"

# Report results
if [ $TEST_EXIT -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  - Review test coverage: cat tests/TRACEABILITY.md"
  echo "  - Run specific tests: $0 <test-name>"
  echo "  - View verbose output: $0 -v"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "To debug:"
  echo "  - Run with verbose output: $0 -v"
  echo "  - Run specific test file: $0 <test-name>"
  echo "  - Check test logs for details"
  echo ""
  echo "Common issues:"
  echo "  - merge-json.sh bug: Check if P0-1 fix is applied"
  echo "  - Missing install script: Check if P0-3 is resolved"
  echo "  - Phantom commands: Check if P1-1 docs are updated"
  exit 1
fi
