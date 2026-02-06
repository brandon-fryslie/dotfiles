#!/usr/bin/env python3
"""
Shared utilities for do plugin hooks.
"""
import os
import base64
import hashlib
from datetime import datetime

# Constants
QUEUE_DIR = ".agent_planning"
QUEUE_PREFIX = ".cmd-queue-"
LOG_DIR = "/tmp/do_plugin"


def log_debug(session_id, script_name, msg):
    """Write debug log if DO_PLUGIN_DEBUG is set."""
    if not os.environ.get('DO_PLUGIN_DEBUG'):
        return
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, "hooks.log")
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Include short session ID for correlation
    short_session = session_id[:8] if len(session_id) > 8 else session_id
    with open(log_file, 'a') as f:
        f.write(f"[{timestamp}] [{short_session}] [{script_name}] {msg}\n")


def get_queue_path(session_id):
    """Get the queue file path for a session."""
    return os.path.join(QUEUE_DIR, f"{QUEUE_PREFIX}{session_id}")


def encode_entry(cmd, prompt_text):
    """Encode command + prompt as single base64 line."""
    full = f"{cmd} {prompt_text}" if prompt_text else cmd
    return base64.b64encode(full.encode('utf-8')).decode('ascii')


def decode_entry(encoded):
    """Decode base64 entry back to command string."""
    return base64.b64decode(encoded.encode('ascii')).decode('utf-8')


def get_script_hash(filepath):
    """Compute short hash of a script file for version tracking."""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()[:8]
    except:
        return "unknown"
