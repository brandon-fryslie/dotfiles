# Operational Commands

Commands for context management, maintenance, and multi-agent coordination.

## bd prime - Context Injection

Outputs essential bd workflow context for hooks. Prevents agents from forgetting bd after compaction.

```bash
bd prime        # Auto-detects MCP vs CLI mode
bd prime --full # Force full CLI output (~1-2k tokens)
bd prime --mcp  # Force minimal MCP output (~50 tokens)
```

**Use in hooks**: Add to SessionStart or PreCompact hooks to auto-refresh bd context.

**Output includes**:
- Ready work summary
- In-progress issues
- Key workflow reminders
- Command reference (CLI mode)

## bd compact - Memory Decay

Summarizes old closed issues to reduce database size. This is **permanent** - original content is discarded.

### Agent-Driven Workflow (Recommended)

```bash
# 1. Get candidates for review
bd compact --analyze --json

# 2. Review and summarize (you do this part)
# Create summary capturing key decisions, outcomes

# 3. Apply your summary
bd compact --apply --id bd-42 --summary summary.txt
bd compact --apply --id bd-42 --summary - < summary.txt  # From stdin
```

### Tiers

| Tier | Age | Reduction | Use Case |
|------|-----|-----------|----------|
| 1 | 30+ days closed | ~70% | Standard compression |
| 2 | 90+ days closed | ~95% | Ultra compression |

```bash
bd compact --analyze --tier 1 --limit 10 --json  # Get first 10 tier-1 candidates
bd compact --analyze --tier 2 --json             # Get tier-2 candidates
```

### Statistics

```bash
bd compact --stats --json  # Show compaction statistics
```

### Legacy Auto Mode

Requires `ANTHROPIC_API_KEY`:
```bash
bd compact --auto --dry-run --all  # Preview
bd compact --auto --all            # Compact all eligible
```

## bd duplicates - Deduplication

Finds and merges duplicate issues based on content hash (title, description, design, criteria).

```bash
# Find duplicates
bd duplicates --json

# Preview what would be merged
bd duplicates --dry-run

# Auto-merge all duplicates
bd duplicates --auto-merge

# Manual merge specific issues
bd merge bd-42 bd-43 --into bd-41 --json
bd merge bd-42 bd-43 --into bd-41 --dry-run  # Preview first
```

**What gets merged**:
- Dependencies transferred to target
- Text references updated across all issues
- Source issues closed with "Merged into bd-X"

**Run periodically** to keep database clean, especially after importing from multiple sources.

## bd config - Project Configuration

Store project-level settings in SQLite (version-controlled via JSONL).

```bash
# Set values
bd config set jira.url "https://company.atlassian.net"
bd config set jira.project "PROJ"

# Get values
bd config get jira.url

# List all
bd config list --json

# Remove
bd config unset jira.url
```

**Use cases**:
- Integration credentials/URLs
- Project-specific settings
- Custom metadata

## Agent Mail - Multi-Agent Coordination

Optional real-time coordination for multiple agents working same repo.

### Benefits
- **20-50x latency**: <100ms vs 2-5 seconds (git sync)
- **Collision prevention**: Exclusive reservations prevent duplicate work
- **100% optional**: Everything works without it

### Check If Enabled

```bash
bd info --json | grep agent_mail
```

### When to Use

- Multiple AI agents working same repository concurrently
- Need faster-than-git coordination
- Want to prevent agents claiming same issue

### Configuration (Environment Variables)

```bash
export BEADS_AGENT_MAIL_URL=http://127.0.0.1:8765
export BEADS_AGENT_NAME=assistant-alpha
export BEADS_PROJECT_ID=my-project

# Then use bd normally - Agent Mail auto-activates
bd ready --json
bd update bd-42 --status in_progress  # Creates reservation
```

### Collision Example

```bash
# Agent A claims issue
bd update bd-42 --status in_progress
# → Reservation created for assistant-alpha

# Agent B tries to claim same issue
bd update bd-42 --status in_progress
# → Error: bd-42 reserved by assistant-alpha
```

### Without Agent Mail

If not configured, bd uses git-based eventual consistency:
- 2-5 second sync latency
- No collision prevention (last write wins)
- Still works fine for single-agent workflows

## bd rename-prefix - Change Issue Prefix

Change prefix for all issues (e.g., `knowledge-work-` → `kw-`).

```bash
bd rename-prefix kw- --dry-run  # Preview changes
bd rename-prefix kw- --json     # Execute
```

**Validates**:
- Max 8 characters
- Lowercase letters, numbers, hyphens only
- Must start with letter

**Updates**:
- All issue IDs
- All text references
- All dependencies
- Configuration

## bd stale - Find Forgotten Issues

Find issues not updated recently.

```bash
bd stale --days 30 --json                    # Not updated in 30 days
bd stale --days 90 --status in_progress --json  # Stale in_progress issues
bd stale --limit 10 --json                   # Top 10 stalest
```

**Use periodically** to find forgotten work that needs attention or closing.

## Daemon Management

Each workspace has its own daemon for auto-sync.

```bash
bd daemons list --json     # List all running
bd daemons health --json   # Check for version mismatches
bd daemons killall --json  # Restart all (after upgrade)
bd daemons logs . -n 100   # View logs
```

**After upgrading bd**: Run `bd daemons killall` to restart with new version.

**In git worktrees**: Use `bd --no-daemon` (shared `.beads/` breaks daemon mode).
