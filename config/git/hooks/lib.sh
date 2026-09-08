# Shared by every hook in this directory. Two jobs, nothing else:
# decide whether text carries a Claude session URL, and hand control to the
# repo-local hook this global hooksPath displaced.

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# The one authoritative definition of what a Claude session URL looks like.
# The history scrubber reads this same file; a second copy would be a second
# clock, and the day they disagree the scrubber cleans what the hook rejects.
session_url_pattern() {
  tr -d '\n' < "$HOOKS_DIR/claude-session-url.pattern"
}

# The guard's own source necessarily contains the very string the guard detects --
# the pattern file IS the pattern -- so a scan that reads it refuses to let the
# guard be committed at all. Exempt those files, computed from where the guard
# actually lives rather than a written list of names: a rename cannot silently
# widen the exemption, and a repo that merely has a like-named path gets none of
# it. [LAW:one-source-of-truth] HOOKS_DIR is the single anchor -- the Claude
# PreToolUse guard is located relative to it, not named a second time.
guard_own_pathspecs() {
  local root guard_root f real
  root="$(git rev-parse --show-toplevel)" || return 0
  real="$(cd "$HOOKS_DIR" && pwd -P)"
  guard_root="$(cd "$real/../.." && pwd -P)"
  for f in "$real"/* "$guard_root/claude/hooks/guard-session-url.sh"; do
    [ -e "$f" ] || continue
    case "$f" in "$root"/*) printf ':(exclude)%s\n' "${f#"$root"/}" ;; esac
  done
}

# Exit 0 when the file is clean, 1 when it carries a session URL.
scan_file_for_session_url() {
  grep -qiE "$(session_url_pattern)" "$1"
}

refuse() {
  cat >&2 <<MSG

  ┌─────────────────────────────────────────────────────────────────────┐
  │  COMMIT REFUSED — Claude session URL detected                       │
  └─────────────────────────────────────────────────────────────────────┘

  $1

  A claude.ai/code/ link is not an opaque id. It resolves to the entire
  conversation — every file read, every credential seen, every customer
  name — for anyone holding it. Publishing one is not recoverable: a
  force-push unlinks the commit but the object stays served by its SHA.

  Offending line(s):

$(grep -inE "$(session_url_pattern)" "$2" | sed 's/^/      /')

  Remove the link and commit again.

MSG
}

# core.hooksPath displaces .git/hooks entirely, so anything that lived there
# stops running and says nothing about it. Run it ourselves and let its exit
# code stand.
chain_to_local_hook() {
  local name="$1"; shift
  local local_hook
  # --git-path honours core.hooksPath, which now points at THIS directory --
  # using it here would re-enter this hook forever. Address .git/hooks directly.
  local_hook="$(git rev-parse --absolute-git-dir)/hooks/$name"
  [ -x "$local_hook" ] || return 0
  "$local_hook" "$@"
}
