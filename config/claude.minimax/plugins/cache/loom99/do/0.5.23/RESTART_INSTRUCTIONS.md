# Stop Hook Installation - Restart Required

## What Changed

The dev-loop plugin Stop hook has been fixed with these critical changes:

1. **Timestamp Parsing Bug Fixed** - Now correctly selects latest PLAN file by datetime
2. **Command-Based Architecture** - Switched from prompt-based to command-based execution
3. **New hooks.json Configuration** - Properly configured to execute Python script
4. **Removed Conflicting Script** - Deleted obsolete handle_stop_hook.py

## Why Restart is Required

Claude Code caches plugin configurations in memory when it starts. The changes to the Stop hook configuration will NOT take effect until Claude Code is restarted to reload the plugin.

**Current State**: Claude Code is still using the OLD cached configuration (prompt-based hook with empty source hooks.json)

**After Restart**: Claude Code will use the NEW configuration (command-based hook executing check_backlog_on_stop.py)

## Restart Instructions

### Option 1: Full Restart (Recommended)

1. Save any work in progress
2. Completely quit Claude Code (Cmd+Q on Mac, or File > Quit)
3. Wait 5 seconds for all processes to fully terminate
4. Restart Claude Code
5. The plugin will automatically reload with new configuration

### Option 2: Plugin Reinstall (Alternative)

If Claude Code supports plugin reinstallation without restart:

1. Open Claude Code plugin manager
2. Uninstall the dev-loop plugin
3. Reinstall the dev-loop plugin from the loom99 marketplace
4. Configuration should be updated

**Note**: Full restart is more reliable and ensures clean state.

## Verification After Restart

To verify the Stop hook is working correctly:

### Test 1: Hook Blocks When Backlog Exists

The hook should currently block stopping because PLAN-2025-11-16-142554.md has 101 unambiguous backlog items.

**Steps**:
1. In Claude Code, try to stop or exit
2. Expected: Stop is prevented with message showing item count
3. Message should suggest running `/do:plan`

**Expected Output**:
```
⚠️  Stop prevented: 101 unambiguous backlog item(s) remain in PLAN-2025-11-16-142554.md

The dev-loop workflow requires all backlog items to be completed before stopping.

Please run: /do:plan

This will re-evaluate the current state and update the planning documents.
Continue this cycle until no actionable items remain.
```

### Test 2: Hook Allows Stop When Backlog Complete (Future Test)

After completing all backlog items:

**Steps**:
1. Complete all items in the PLAN file (check all `- [ ]` boxes or resolve all items)
2. Try to stop Claude Code
3. Expected: Stop is allowed with confirmation message

**Expected Output**:
```
✓ No unambiguous backlog items found in PLAN-2025-11-16-142554.md

Planning loop complete. Claude may stop.
```

## Troubleshooting

### Hook Doesn't Execute After Restart

**Check installed hooks.json**:
```bash
cat ~/.claude/plugins/marketplaces/loom99/plugins/dev-loop/hooks/hooks.json
```

Should show:
```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 ./bin/check_backlog_on_stop.py",
        "timeout": 30000
      }
    ]
  }
}
```

**Check installed plugin.json**:
```bash
jq .hooks ~/.claude/plugins/marketplaces/loom99/plugins/dev-loop/.claude-plugin/plugin.json
```

Should show: `"./hooks/hooks.json"`

**If files don't match source**:
1. Try uninstalling and reinstalling the plugin
2. Check Claude Code logs for plugin loading errors
3. Verify plugin directory permissions are readable

### Hook Executes But Shows Wrong Behavior

**Test script manually**:
```bash
cd ~/icode/loom99-claude-marketplace
python3 plugins/dev-loop/bin/check_backlog_on_stop.py
```

This should show the same output that the hook would display.

**Check for Python errors**:
- Ensure Python 3 is installed and in PATH
- Check that .agent_planning directory exists
- Verify PLAN files have correct timestamp format

### Hook Blocks Even With No Backlog

**Debug the detection logic**:
```bash
# Run script manually to see which file and items it detected
cd ~/icode/loom99-claude-marketplace
python3 plugins/dev-loop/bin/check_backlog_on_stop.py
```

**Check PLAN file content**:
- Look for unchecked items: `- [ ] item`
- Look for TODO markers: `TODO: something`
- Look for priority items: `P0: task`
- Look for work sections with content

## Files Modified

**Source files** (~/icode/loom99-claude-marketplace/plugins/dev-loop/):
- `bin/check_backlog_on_stop.py` - Fixed timestamp parsing
- `hooks/hooks.json` - Created command-based configuration
- `.claude-plugin/plugin.json` - Already had correct hooks reference

**Installed files** (will be updated after restart):
- `~/.claude/plugins/marketplaces/loom99/plugins/dev-loop/hooks/hooks.json`
- `~/.claude/plugins/marketplaces/loom99/plugins/dev-loop/bin/check_backlog_on_stop.py`
- `~/.claude/plugins/marketplaces/loom99/plugins/dev-loop/bin/handle_stop_hook.py` - DELETED

## Next Steps

1. **Restart Claude Code** (see instructions above)
2. **Test the Stop hook** (see verification tests above)
3. **Report any issues** if hook doesn't work as expected
4. **Continue development** once hook is verified working

## Implementation Details

For technical details about the fixes, see:
- PLAN-2025-11-16-142554.md (P0-1 through P0-5)
- Git commit messages for each P0 item
- check_backlog_on_stop.py source code comments
