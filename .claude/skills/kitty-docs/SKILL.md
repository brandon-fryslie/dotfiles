---
name: kitty-docs
description: Reference codebase for Kitty. Use this skill when you need to understand anything about how Kitty terminal works.
---

# Kitty Documentation Reference

63 files | 12230 lines | 120609 tokens

## Overview

Kitty terminal emulator documentation. Use this skill for:
- Configuration options (kitty.conf)
- Keyboard mappings and shortcuts
- Shell integration (zsh, bash, fish)
- Graphics protocol and image display
- Kittens (extensions like ssh, diff, hints)
- Remote control and automation

## Usage

**IMPORTANT:** `files.md` is 495KB - NEVER load directly into context!

See `../../_templates/repomix-docs-workflow.md` for the standard query workflow.

**Skill path:** `/Users/bmf/code/dotfiles/.claude/skills/kitty-docs`

### Quick Reference

| Topic | Pattern | afterLines |
|-------|---------|------------|
| Shell integration | `## File: docs/shell-integration\\.rst` | 250 |
| Keyboard mappings | `## File: docs/mapping\\.rst` | 400 |
| FAQ | `## File: docs/faq\\.rst` | 600 |
| Configuration | `## File: docs/conf\\.rst` | 150 |
| Layouts | `## File: docs/layouts\\.rst` | 300 |
| Remote control | `## File: docs/remote-control\\.rst` | 350 |
| SSH kitten | `## File: docs/kittens/ssh\\.rst` | 220 |
| macOS Option key | `macos_option` (use `contextLines: 5`) | - |

## Index

See `references/index.md` for the complete topic-to-file mapping, organized by:
- Configuration & Setup
- Keyboard & Input
- Windows, Tabs & Layouts
- Terminal Features
- Graphics & Rendering
- Remote Control & Automation
- Kittens (Extensions)
- File Transfer
- Troubleshooting & FAQ

---

Source: [Kitty](https://github.com/kovidgoyal/kitty) | Packed with [Repomix](https://github.com/yamadashy/repomix)
