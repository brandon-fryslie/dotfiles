#!/usr/bin/env bats
# test-package-skill.bats - Functional tests for the skill-creator package_skill.py
#
# TICKET: dotfiles-script-audit-lbl.21
#
# BUG VALIDATED:
# package_skill.py opened the zip at its final destination first, then lazily
# walked skill_path.rglob("*") while writing. With the natural invocation
# (`python package_skill.py .` from inside the skill folder) the output lands
# inside the scanned tree, the walk discovers the half-written archive, and
# the package contains itself; each re-run nests the previous archive again.
# The fix stages the archive in the system temp dir and moves it into place
# only when complete, and skips exactly the destination path during the walk
# (a previous run's artifact is not skill content). Staging also means a
# failed run leaves any pre-existing archive untouched.
#
# GAMING RESISTANCE:
# - Runs the real script from inside a real skill fixture and inspects the
#   actual zip entries — a fix that merely renames the self-entry still fails
# - The re-run case asserts exact entry sets, so nesting the previous archive
#   under any name fails
# - The failure case asserts a pre-existing archive survives byte-for-byte,
#   so writing the zip at the destination (even with an exclusion guard) fails
# - A skill legitimately shipping a *.skill asset must still be packaged, so
#   an over-correcting blanket *.skill exclusion also fails

bats_require_minimum_version 1.5.0

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../config/codex/skills/system-copy/skill-creator/scripts/package_skill.py"

# quick_validate (imported by the script) needs PyYAML; prefer the system
# python3 when it has yaml, fall back to uv's ephemeral env, else skip.
# Called directly in the test body (not under `run`) so skip takes effect.
require_packager() {
  if python3 -c 'import yaml' 2>/dev/null; then
    PACKAGER=(python3 "$SCRIPT")
  elif command -v uv >/dev/null 2>&1; then
    PACKAGER=(uv run --quiet --with pyyaml python3 "$SCRIPT")
  else
    skip "needs python3 with PyYAML or uv (brew install uv)"
  fi
}

# Sorted zip entry list, one per line.
zip_entries() {
  python3 -c 'import sys, zipfile; print("\n".join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))' "$1"
}

setup() {
  WORK=$(create_test_dir)
  SKILL="$WORK/my-skill"
  mkdir -p "$SKILL"
  printf -- '---\nname: my-skill\ndescription: fixture skill\n---\n\n# My Skill\n' > "$SKILL/SKILL.md"
  printf 'hello\n' > "$SKILL/extra.txt"
}

teardown() {
  chmod -R u+rwX "$WORK" 2>/dev/null
  rm -rf "$WORK"
}

@test "packaging from inside the skill dir: archive does not contain itself" {
  require_packager
  cd "$SKILL"
  run "${PACKAGER[@]}" .
  [ "$status" -eq 0 ]
  run zip_entries "$SKILL/my-skill.skill"
  [ "$output" = $'my-skill/SKILL.md\nmy-skill/extra.txt' ]
}

@test "re-run from inside the skill dir: previous archive is not nested" {
  require_packager
  cd "$SKILL"
  run "${PACKAGER[@]}" .
  [ "$status" -eq 0 ]
  run "${PACKAGER[@]}" .
  [ "$status" -eq 0 ]
  run zip_entries "$SKILL/my-skill.skill"
  [ "$output" = $'my-skill/SKILL.md\nmy-skill/extra.txt' ]
}

@test "mid-walk failure: nonzero exit and pre-existing archive intact byte-for-byte" {
  require_packager
  cd "$SKILL"
  run "${PACKAGER[@]}" .
  [ "$status" -eq 0 ]
  cp my-skill.skill "$WORK/baseline.skill"
  printf 'secret\n' > unreadable.txt
  chmod 000 unreadable.txt
  run "${PACKAGER[@]}" .
  [ "$status" -ne 0 ]
  cmp -s my-skill.skill "$WORK/baseline.skill"
}

@test "a *.skill asset inside the skill is still packaged (no blanket exclusion)" {
  require_packager
  printf 'asset payload\n' > "$SKILL/bundled.skill"
  run "${PACKAGER[@]}" "$SKILL" "$WORK/dist"
  [ "$status" -eq 0 ]
  run zip_entries "$WORK/dist/my-skill.skill"
  [ "$output" = $'my-skill/SKILL.md\nmy-skill/bundled.skill\nmy-skill/extra.txt' ]
}
