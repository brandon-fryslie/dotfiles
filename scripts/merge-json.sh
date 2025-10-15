#!/bin/bash
# Merge multiple JSON files into one
# Usage: merge-json.sh output.json input1.json input2.json [input3.json ...]

set -euo pipefail

OUTPUT="$1"
shift
INPUTS=("$@")

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required for merging JSON files"
    exit 1
fi

# Build jq filter to merge all inputs
# Each subsequent file overrides previous values
# Start with empty object {} and reduce inputs, merging each
FILTER="reduce inputs as \$item ({}; . * \$item)"

# Merge files
# Use -n (null-input) to start with empty object, not first file
jq -n "$FILTER" "${INPUTS[@]}" > "$OUTPUT"

echo "✓ Merged ${#INPUTS[@]} files into $OUTPUT"
