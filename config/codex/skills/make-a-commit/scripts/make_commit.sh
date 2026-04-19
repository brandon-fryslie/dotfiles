#!/usr/bin/env bash
set -euo pipefail

claude -p 'Make a commit immediately.  Add all files, do not run tests, and do not return until the worktree is clean'
