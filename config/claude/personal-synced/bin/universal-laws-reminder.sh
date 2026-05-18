#!/bin/bash
# Universal Laws Reminder Hook
# Injects reminders to summarize architectural constraints at strategic moments

HOOK_TYPE="$1"
STATE_FILE="$HOME/.claude/.last_laws_reminder"
COOLDOWN_SECONDS=300  # 5 minutes

# Long variant: forces active engagement by requiring application to current task
REMINDER_LONG="For the following request, please consider the universal laws and how any design or implementation you create will achieve it's highest quality expression through them.  You can improve your results substantially by express this directly in the chat.  Engaging with the laws is a must.  Although it may seem tedious and repetitive to repeatedly derive the concrete details from the abstract, that engagement is critical for applying abstract thinking concepts correctly at all stages of the SLDC.  This is not a checklist to satisfy, this is a philosophy for approaching any task. "

# Short variant: still forces engagement with actual content, just less elaboration
REMINDER_SHORT="Briefly summarize the <universal-laws> in their totality. "

# Time-based throttling: only fire if cooldown has elapsed
should_remind() {
  LAST=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ $((NOW - LAST)) -gt $COOLDOWN_SECONDS ]; then
    echo "$NOW" > "$STATE_FILE"
    return 0
  fi
  return 1
}

case "$HOOK_TYPE" in
  user-prompt)
    # Full engagement at task start
    # Resets the cooldown timer
    echo "$(date +%s)" > "$STATE_FILE"
    echo "$REMINDER_LONG"
    ;;

  read-post)
    # Time-throttled: short nudge if 5+ minutes since last reminder
    if should_remind; then
      echo "$REMINDER_SHORT"
    fi
    ;;

  task-pre)
    # Full engagement before spawning subagents
    # Resets the cooldown timer
    echo "$(date +%s)" > "$STATE_FILE"
    echo "$REMINDER_LONG"
    ;;

  *)
    # Unknown hook type, do nothing
    ;;
esac