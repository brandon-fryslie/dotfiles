#!/usr/bin/env bash
# ABOUTME: Generates human-readable duplicate detection report from Opus analysis output
# Combines per-category duplicate findings into a prioritized markdown report

set -euo pipefail

usage() {
    cat <<EOF
Usage: $(basename "$0") <duplicates-dir> [output-file]

Generate markdown report from duplicate detection results.

ARGUMENTS:
    duplicates-dir    Directory containing per-category duplicate JSON files
    output-file       Output markdown file (default: duplicates-report.md)

INPUT FORMAT:
    Each JSON file should contain array of duplicate groups from Opus analysis.

EXAMPLE:
    $(basename "$0") ./duplicates ./duplicates-report.md
EOF
    # [LAW:no-silent-failure] exit code is the CLI contract: 0 only for -h,
    # error paths pass 1 so callers (set -e, && chains) see the failure
    exit "${1:-0}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

if [[ -z "${1:-}" ]]; then
    echo "Error: duplicates directory required" >&2
    usage 1 >&2
fi

DUPLICATES_DIR="$1"
OUTPUT="${2:-duplicates-report.md}"

if [[ ! -d "$DUPLICATES_DIR" ]]; then
    echo "Error: directory not found: $DUPLICATES_DIR" >&2
    exit 1
fi

# [LAW:single-enforcer] every section renders through this one loop, so a jq
# failure on any file is fatal with the file named — never swallowed. The
# summary counts and these sections derive from the same data; letting one
# fail silently lets the report contradict itself. [LAW:one-source-of-truth]
render_section() {
    local program=$1
    local f category
    for f in "$DUPLICATES_DIR"/*.json; do
        [[ -f "$f" ]] || continue
        category=$(basename "$f" .json)
        jq -r --arg cat "$category" "$program" "$f" \
            || { echo "Error: failed to render entries from $f" >&2; exit 1; }
    done
}

# Count totals
high_count=0
medium_count=0
low_count=0

for f in "$DUPLICATES_DIR"/*.json; do
    [[ -f "$f" ]] || continue
    h=$(jq '[.[] | select(.confidence == "HIGH")] | length' "$f")
    m=$(jq '[.[] | select(.confidence == "MEDIUM")] | length' "$f")
    l=$(jq '[.[] | select(.confidence == "LOW")] | length' "$f")
    high_count=$((high_count + h))
    medium_count=$((medium_count + m))
    low_count=$((low_count + l))
done

# [LAW:effects-at-boundaries] capture-then-write (same pattern as
# extract-functions.sh): the whole report is built before $OUTPUT is touched,
# so a failure aborts with the existing file intact instead of leaving a
# truncated artifact.
report=$(
    echo "# Duplicate Functions Report"
    echo ""
    echo "Generated: $(date '+%Y-%m-%d %H:%M')"
    echo ""
    echo "## Summary"
    echo ""
    echo "| Confidence | Count | Action |"
    echo "|------------|-------|--------|"
    echo "| HIGH | $high_count | Consolidate immediately |"
    echo "| MEDIUM | $medium_count | Investigate further |"
    echo "| LOW | $low_count | Review if time permits |"
    echo ""
    echo "---"
    echo ""
    echo "## HIGH Confidence Duplicates"
    echo ""
    echo "These functions are definitely duplicates. Consolidate them."
    echo ""
    render_section '
        .[] | select(.confidence == "HIGH") |
        "### \(.intent)\n\n" +
        "**Category:** \($cat)\n\n" +
        "**Functions:**\n" +
        (.functions | map("- `\(.name)` in `\(.file):\(.line)`" + if .notes then " - \(.notes)" else "" end) | join("\n")) +
        "\n\n" +
        "**Differences:** \(.differences // "None - identical implementations")\n\n" +
        "**Recommendation:** Keep `\(.recommendation.survivor)` - \(.recommendation.reason)\n\n" +
        "---\n"
    '
    echo ""
    echo "## MEDIUM Confidence Duplicates"
    echo ""
    echo "These functions likely do the same thing. Investigate before consolidating."
    echo ""
    render_section '
        .[] | select(.confidence == "MEDIUM") |
        "### \(.intent)\n\n" +
        "**Category:** \($cat)\n\n" +
        "**Functions:**\n" +
        (.functions | map("- `\(.name)` in `\(.file):\(.line)`" + if .notes then " - \(.notes)" else "" end) | join("\n")) +
        "\n\n" +
        "**Differences:** \(.differences)\n\n" +
        "**Recommendation:** \(.recommendation.action) - \(.recommendation.reason)\n\n" +
        "---\n"
    '
    echo ""
    echo "## LOW Confidence (Possibly Related)"
    echo ""
    echo "These functions might be related. Review if time permits."
    echo ""
    render_section '
        .[] | select(.confidence == "LOW") |
        "### \(.intent)\n\n" +
        "**Category:** \($cat)\n\n" +
        "**Functions:**\n" +
        (.functions | map("- `\(.name)` in `\(.file):\(.line)`") | join("\n")) +
        "\n\n" +
        "**Notes:** \(.differences)\n\n" +
        "---\n"
    '
)
printf '%s\n' "$report" > "$OUTPUT"

echo "Report generated: $OUTPUT" >&2
echo "  HIGH confidence: $high_count groups" >&2
echo "  MEDIUM confidence: $medium_count groups" >&2
echo "  LOW confidence: $low_count groups" >&2
