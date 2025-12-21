#!/usr/bin/env bash
# Migration: MIGRATION_NAME
# Author: AUTHOR
# Created: CREATED_DATE
#
# Problem:
#   TODO: What broken state exists and why?
#
# Fix:
#   TODO: What does this migration do to fix it?
#
# Safe to delete after:
#   TODO: When can this be removed from the repo?

# Configuration
TARGET="/path/to/thing"

migrate_check() {
    # Return 0 if migration is NEEDED
    # Return 1 if already in correct state

    # TODO: implement check
    return 1
}

migrate_apply() {
    # Do the fix. Return 0 on success, 1 on failure.

    # TODO: implement fix
    return 0
}
