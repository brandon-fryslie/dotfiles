#!/usr/bin/env bash
# What an install does to a real file or directory already sitting at a managed path.
#
# Asserted is the outcome [LAW:behavior-not-structure]: against a throwaway HOME, real
# dotbot runs install-base's own defaults and link entries over a real ~/.config/certs
# holding files (the 2026-10-10 loss), a real ~/.zshenv, and a real ~/.bashrc. The
# directory and the file are moved to a reported backup with their contents intact and
# the managed paths become links; the bash startup file is left alone and the install
# fails. A second run over the installed state succeeds and backs up nothing more.
# Separately, every install-*.conf.yaml that links must default to backup and none may set
# `force: true` on a link (`clean` only removes dead symlinks, so its force is left alone).
#
# Run: tests/install-backup.sh   (needs uv; dotbot and PyYAML come from `uvx --from dotbot`)
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
work=$(mktemp -d); work=$(cd "$work" && pwd -P)
trap 'rm -rf "$work"' EXIT

fail() { echo "FAIL - $*" >&2; [ -f "$work/dotbot.log" ] && cat "$work/dotbot.log" >&2; exit 1; }

# dotbot's own interpreter, resolved once so HOME can be swapped for the run without
# moving uv's cache.
py=$(uvx --from dotbot python -c 'import sys; print(sys.executable)')

# Every config that links must back up by default and none may let dotbot delete: before its
# first link step a defaults block sets backup: true, and force is never true, in that block
# or on an entry. install-base is the only one run below; this holds the rest to the same.
"$py" -I - "$repo" <<'PY' || fail "a config does not back up by default, or declares force: true"
import glob, sys, yaml
bad = []
for path in sorted(glob.glob(sys.argv[1] + "/install-*.conf.yaml")):
    backup_default = False
    for step in yaml.safe_load(open(path)):
        link_defaults = (step.get("defaults") or {}).get("link", {})
        if link_defaults.get("force") is True:
            bad.append(path + ": defaults.link.force")
        backup_default = backup_default or link_defaults.get("backup") is True
        if "link" in step and not backup_default:
            bad.append(path + ": links without defaults.link.backup: true")
        for dest, entry in (step.get("link") or {}).items():
            if isinstance(entry, dict) and entry.get("force") is True:
                bad.append(path + ": " + dest)
if bad:
    sys.exit("\n".join(bad))
PY

# install-base's defaults and link entries only: its shell and clean steps touch the machine.
"$py" -I - "$repo/install-base.conf.yaml" "$work/links.yaml" <<'PY'
import sys, yaml
steps = yaml.safe_load(open(sys.argv[1]))
yaml.safe_dump([s for s in steps if "defaults" in s or "link" in s], open(sys.argv[2], "w"))
PY

home="$work/home"
mkdir -p "$home/.config/certs"
echo ca  > "$home/.config/certs/proxyman-ca.pem"
echo env > "$home/.config/certs/env.sh"
echo mine > "$home/.zshenv"
echo bash > "$home/.bashrc"

install() { HOME="$home" "$(dirname "$py")/dotbot" -d "$repo" -c "$work/links.yaml" >"$work/dotbot.log" 2>&1; }

# Fails, and for the bash startup file: any other failure must not read as the refusal.
install && fail "the install succeeded with a real ~/.bashrc in the way"
grep -qF "~/.bashrc already exists" "$work/dotbot.log" || fail "the install failed, but not over ~/.bashrc"

[ -L "$home/.config/certs" ] || fail "~/.config/certs is not linked"
[ -L "$home/.zshenv" ]       || fail "~/.zshenv is not linked"
[ -f "$home/.bashrc" ] && [ ! -L "$home/.bashrc" ] && [ "$(cat "$home/.bashrc")" = bash ] \
  || fail "the real ~/.bashrc was replaced"

certs_backup=$(ls -d "$home"/.config/certs.dotbot-backup.* 2>/dev/null) || fail "no backup of ~/.config/certs"
[ "$(cat "$certs_backup/proxyman-ca.pem")" = ca ] && [ "$(cat "$certs_backup/env.sh")" = env ] \
  || fail "the backed-up certs directory lost its contents"
zshenv_backup=$(ls -d "$home"/.zshenv.dotbot-backup.* 2>/dev/null) || fail "no backup of ~/.zshenv"
[ "$(cat "$zshenv_backup")" = mine ] || fail "the backed-up ~/.zshenv lost its contents"
grep -qF "Backed up file ~/.config/certs to ~/.config/certs.dotbot-backup." "$work/dotbot.log" \
  || fail "the certs backup path was not reported"

# Resolve the bash conflict; the installed state must then converge with nothing more backed up.
rm "$home/.bashrc"
before=$(find "$home" -name '*.dotbot-backup.*' | sort)
install || fail "the second install failed"
[ "$before" = "$(find "$home" -name '*.dotbot-backup.*' | sort)" ] || fail "the second install backed something up"

echo "ok - a real file or directory at a managed path is backed up, never deleted"
