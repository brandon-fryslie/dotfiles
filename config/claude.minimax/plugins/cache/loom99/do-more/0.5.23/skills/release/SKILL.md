---
name: "do-release"
description: "[status|bump|changelog|notes|tag|publish] Release management - versioning, changelog generation, git tagging, and full release workflow."
context: fork
---

# Release Skill

Manage releases: version bumping, changelog generation, release notes, git tagging, and full publish workflow.

<user-input>$ARGUMENTS</user-input>
<current-command>release</current-command>

## Action Detection

Parse `$ARGUMENTS` to determine action:

1. **If `$ARGUMENTS` provided** → Parse for action keyword
2. **If no arguments** → Default to "status"

**Actions:**
- `status` (default) → Show release status
- `bump [level]` → Bump version (major/minor/patch, default: patch)
- `changelog` → Generate/update CHANGELOG.md
- `notes` → Show release notes for current version
- `tag` → Create git tag for current version
- `publish [level]` → Full release workflow

Set `action` and `action_args` based on parsed arguments.

---

## Action: status

Show current release state.

### Implementation

1. **Read version from plugin.json**:
   ```bash
   grep '"version"' plugins/do/.claude-plugin/plugin.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'
   ```

2. **Get last git tag**:
   ```bash
   git describe --tags --abbrev=0 2>/dev/null || echo "none"
   ```

3. **Count commits since tag**:
   ```bash
   # If tag exists:
   git rev-list <tag>..HEAD --count
   # If no tag:
   git rev-list HEAD --count
   ```

4. **Check for uncommitted changes**:
   ```bash
   git status --porcelain
   ```

5. **Get all plugin versions**:
   - Read plugins/do/.claude-plugin/plugin.json
   - Read plugins/do-more/.claude-plugin/plugin.json
   - Read plugins/do-extra/.claude-plugin/plugin.json (if exists)

### Output

Display formatted status:

```
═══════════════════════════════════════
Release Status

  Current Version: 0.5.21
  Last Tag: v0.5.20 (or "none" if no tags)
  Commits Since Tag: 15
  Uncommitted Changes: [yes/no]

  Plugins:
  - do: 0.5.21
  - do-more: 0.5.21
  - do-extra: 0.5.15 (if exists)

Next: /do:release bump | changelog | publish
═══════════════════════════════════════
```

---

## Action: bump [level]

Increment version using semantic versioning.

### Implementation

1. **Parse level from action_args**:
   - "major" → Increment major, reset minor and patch to 0
   - "minor" → Increment minor, reset patch to 0
   - "patch" or empty → Increment patch (default)

2. **Bump version**:
   - For **patch**: Delegate to `just bump` (existing behavior)
   - For **minor** or **major**: Manually update version:
     - Read current version from `plugins/do/.claude-plugin/plugin.json`
     - Parse: MAJOR.MINOR.PATCH
     - Calculate new version based on level
     - Update version in plugin.json files using `just bump-plugin` approach
     - Update `.claude-plugin/marketplace.json`

3. **Display result**

### Output

```
═══════════════════════════════════════
Version Bump

  Previous: 0.5.21
  New: 0.6.0 (minor)

  Updated:
  - plugins/do/.claude-plugin/plugin.json
  - plugins/do-more/.claude-plugin/plugin.json
  - .claude-plugin/marketplace.json

Next: /do:release changelog | tag | publish
═══════════════════════════════════════
```

### Error Cases

- Invalid level → "Invalid level: must be major, minor, or patch"

---

## Action: changelog

Generate or update CHANGELOG.md from git commits.

### Implementation

1. **Get commits since last tag**:
   ```bash
   # If tag exists:
   git log <tag>..HEAD --oneline --no-merges
   # If no tag:
   git log --oneline --no-merges
   ```

2. **Parse and group commits**:
   - Scan commit messages for conventional commit prefixes
   - Group by type:
     - `feat:`, `add:` → **Added**
     - `fix:`, `bug:` → **Fixed**
     - `change:`, `update:`, `refactor:` → **Changed**
     - Others → **Other**
   - Strip prefix and clean up message

3. **Read existing CHANGELOG.md** (if exists)

4. **Generate new section**:
   - Current version from plugin.json
   - Current date (YYYY-MM-DD)
   - Grouped changes

5. **Write CHANGELOG.md**:
   - If file exists: Prepend new section
   - If file doesn't exist: Create with header + new section

### CHANGELOG.md Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.22] - 2026-01-19

### Added
- New feature X
- New feature Y

### Changed
- Updated Z

### Fixed
- Bug fix A

## [0.5.21] - 2026-01-18

...
```

### Output

```
═══════════════════════════════════════
Changelog Updated

  Version: 0.5.22
  Commits Processed: 15

  Added: 3 entries
  Changed: 5 entries
  Fixed: 2 entries
  Other: 5 entries

  File: CHANGELOG.md

Next: /do:release notes | tag | publish
═══════════════════════════════════════
```

### Error Cases

- No commits since tag → "No commits since last release. Nothing to add to changelog."
- Git error → Display git error message

---

## Action: notes

Display release notes for current version.

### Implementation

1. **Read current version from plugin.json**

2. **Extract section from CHANGELOG.md**:
   - If CHANGELOG.md exists:
     - Find section with `## [version]`
     - Extract everything until next `## [` or EOF
   - If CHANGELOG.md doesn't exist:
     - Generate from commits (same logic as changelog action)
     - Don't save to file

3. **Format for display**

### Output

```
═══════════════════════════════════════
Release Notes: v0.5.22

### Added
- New feature X
- New feature Y

### Changed
- Updated Z implementation

### Fixed
- Bug fix A
- Bug fix B

═══════════════════════════════════════
```

### Error Cases

- No CHANGELOG.md and no commits → "No release notes available. Run /do:release changelog first."

---

## Action: tag

Create git tag for current version.

### Implementation

1. **Read current version from plugin.json**

2. **Check if tag exists**:
   ```bash
   git tag -l "v<version>"
   ```

3. **If tag exists** → Error with instructions

4. **Create annotated tag**:
   - Tag name: `v<version>` (e.g., `v0.5.22`)
   - Tag message: `Release v<version>`
   ```bash
   git tag -a v<version> -m "Release v<version>"
   ```

5. **Display success**

### Output

```
═══════════════════════════════════════
Git Tag Created

  Tag: v0.5.22
  Type: Annotated
  Message: "Release v0.5.22"

Next: git push origin v0.5.22
      (or use /do:release publish to automate)
═══════════════════════════════════════
```

### Error Cases

- Tag already exists → "Tag v0.5.22 already exists. Delete with: git tag -d v0.5.22"
- Git error → Display git error message

---

## Action: publish [level]

Full release workflow - orchestrates all actions.

### Implementation

**Steps:**

1. **Validate**:
   - Run `just validate`
   - If fails: Abort with error details

2. **Check state**:
   - Check for uncommitted changes
   - If yes: Display warning and prompt for confirmation
   - If user declines: Abort

3. **Bump version**:
   - Run `bump` action with specified level (from action_args)
   - Default: patch

4. **Generate changelog**:
   - Run `changelog` action

5. **Commit changes**:
   ```bash
   git add -A
   git commit -m "Release v<version>"
   ```

6. **Create tag**:
   - Run `tag` action

7. **Display summary**:
   - Show completion status
   - Show push commands

### Output

```
═══════════════════════════════════════
Release Complete: v0.5.22

  ✓ Validation passed
  ✓ Version bumped: 0.5.21 → 0.5.22 (patch)
  ✓ Changelog updated
  ✓ Changes committed
  ✓ Tag created: v0.5.22

  Push to remote:
    git push origin master
    git push origin v0.5.22

═══════════════════════════════════════
```

### Error Cases

| Condition | Response |
|-----------|----------|
| Validation fails | Abort with error details |
| Tag exists | Error with delete instructions |
| No commits since tag | "Nothing to release. No commits since last tag." |
| Uncommitted changes | Warning, prompt for confirmation |
| Git error | Display error and rollback instructions |

---

## Error Handling Summary

| Error Type | Action | Response |
|------------|--------|----------|
| Validation failure | All | Abort with details |
| Tag exists | tag, publish | Error + delete instructions |
| No commits | changelog, publish | "Nothing to release" |
| Uncommitted changes | publish | Warning + confirmation |
| Invalid level | bump | Error with valid options |
| Git error | All | Display error message |

---

## Dependencies

- `just validate` - Plugin validation (must pass)
- `just bump` - Existing patch bump (delegates for patch level)
- Git commands - For commits, tags, logs
- plugin.json files - Source of truth for versions

---

## Notes

- **Version source of truth**: `plugins/*/. claude-plugin/plugin.json`
- **Marketplace sync**: `.claude-plugin/marketplace.json` is updated in sync
- **Tag format**: `v{version}` (e.g., `v0.5.22`)
- **Changelog format**: Keep a Changelog standard
- **Commit message**: `Release v{version}` for publish workflow
