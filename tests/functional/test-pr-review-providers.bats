#!/usr/bin/env bats
# test-pr-review-providers.bats - Provider contract tests for the
# address-pr-reviews skill and its providers (adversarial, local).
#
# GAMING RESISTANCE [LAW:behavior-not-structure]:
# - Tests assert the provider CONTRACT (loader validation, capability/function
#   agreement, canonical anchoring semantics), not implementation internals.
# - The diff-anchoring tests feed a real unified diff and assert the computed
#   legal-anchor domain and re-anchoring annotations — outcomes GitHub's API
#   would otherwise reject at runtime.

SKILL_DIR="${BATS_TEST_DIRNAME}/../../config/claude/skills/address-pr-reviews"

@test "provider loader validates every shipped provider against the contract" {
  run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import provider_loader
for name in ('adversarial', 'local'):
    p = provider_loader.get(name)
    caps = p.CAPABILITIES
    assert set(caps) == {'resolve', 'trigger', 'setup_check'}, (name, caps)
    for fn in ('wait', 'fetch'):
        assert callable(getattr(p, fn)), (name, fn)
    for cap, declared in caps.items():
        assert not declared or callable(getattr(p, cap)), (name, cap)
print('ok')
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok"* ]]
}

@test "explicit provider name overrides env and provider.json" {
  PR_REVIEW_PROVIDER=local run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import provider_loader
p = provider_loader.get('adversarial')
print(p.__name__)
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"adversarial_provider"* ]]
}

@test "unknown provider fails loudly, never falls back" {
  run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import provider_loader
provider_loader.get('nonexistent')
"
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]]
}

@test "commentable_lines computes the exact legal anchor domain from a diff" {
  run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import adversarial_provider as ap
diff = '''diff --git a/foo.py b/foo.py
--- a/foo.py
+++ b/foo.py
@@ -10,3 +10,4 @@ def f():
 context10
-removed
+added11
+added12
 context13
diff --git a/gone.py b/gone.py
--- a/gone.py
+++ /dev/null
@@ -1,2 +0,0 @@
-x
-y
'''
legal = ap.commentable_lines(diff)
assert legal == {'foo.py': {10, 11, 12, 13}}, legal

# An added line whose CONTENT starts with '++ b/' renders as '+++ b/...' —
# it must count as a commentable line, not reset the file header.
tricky = '''diff --git a/bar.py b/bar.py
--- a/bar.py
+++ b/bar.py
@@ -1,2 +1,3 @@
 keep1
+++ b/not-a-header
 keep3
'''
legal = ap.commentable_lines(tricky)
assert legal == {'bar.py': {1, 2, 3}}, legal
print('ok')
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok"* ]]
}

@test "anchor re-anchors out-of-diff lines loudly and flags non-diff files" {
  run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import adversarial_provider as ap
legal = {'foo.py': {10, 11, 12, 13}}
exact = ap.anchor({'file': 'foo.py', 'line': 11, 'title': 't', 'body': 'b'}, legal)
assert exact['anchored'] and exact['line'] == 11 and exact['body'] == 'b'
moved = ap.anchor({'file': 'foo.py', 'line': 99, 'title': 't', 'body': 'b'}, legal)
assert moved['anchored'] and moved['line'] == 13
assert 'reviewer cited line 99' in moved['body']
outside = ap.anchor({'file': 'other.py', 'line': 5, 'title': 't', 'body': 'b'}, legal)
assert outside['anchored'] is False
print('ok')
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok"* ]]
}

@test "reviewer output validation rejects malformed findings" {
  run python3 -c "
import sys; sys.path.insert(0, '$SKILL_DIR')
import adversarial_provider as ap
import json

# A well-formed envelope whose result is missing required finding keys must raise.
class P:
    returncode = 0
    stderr = ''
    stdout = json.dumps({'type': 'result', 'subtype': 'success', 'is_error': False,
                         'result': json.dumps({'summary': 's',
                                               'findings': [{'file': 'f'}]})})
import subprocess
subprocess.run = lambda *a, **k: P()
try:
    ap._run_reviewer('prompt', 'sonnet')
    raise SystemExit('should have raised')
except RuntimeError as e:
    assert 'missing keys' in str(e), e
print('ok')
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok"* ]]
}
