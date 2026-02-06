#!/usr/bin/env python3
"""
Simple hello world script for dev-loop stop hook.
Reads from stdin and appends to .agent_logs/dev-loop/stop-hook.log
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Read stdin
stdin_data = sys.stdin.read()

# Create log directory if it doesn't exist
log_dir = Path(".agent_logs/dev-loop")
log_dir.mkdir(parents=True, exist_ok=True)

# Append to log file with timestamp
with open(log_dir / "stop-hook.log", "a") as f:
    f.write(f"{datetime.now().isoformat()} {stdin_data}")