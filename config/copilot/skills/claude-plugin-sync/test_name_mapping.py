#!/usr/bin/env python3
"""Tests for name_mapping: reference rewriting and the canonical name map.

The regression these tests exist for: rewrite_content's command pattern
matched ANY slash-word-colon-word text (paths like src/utils:helpers,
owner/repo:branch, timestamps) and get_copilot_name auto-registered the
garbage captures, corrupting synced content and polluting the canonical map.
"""

import pytest

from name_mapping import NameMapper, ReferenceRewriter


@pytest.fixture
def mapper():
    m = NameMapper()
    m.register_extension("do:plan")
    m.register_extension("do:it")
    m.register_extension("do:project-evaluator")
    return m


# --- Non-references must survive verbatim -----------------------------------

@pytest.mark.parametrize("text", [
    "See src/utils:helpers for info, and 12/30:45 timestamps",
    "clone bmf/dotfiles:master today",
    "try /not:registered now",
    'Skill("foo:bar")',
    'subagent_type="other:agent"',
    "path src/do:plan stays",  # registered name, but mid-token — anchor must reject
])
def test_non_references_survive_verbatim(mapper, text):
    assert ReferenceRewriter.rewrite_content(text, mapper) == text


def test_non_references_do_not_pollute_canonical_map(mapper):
    before = dict(mapper.canonical_map)
    ReferenceRewriter.rewrite_content(
        "See src/utils:helpers and 12/30:45 and /not:registered", mapper
    )
    assert mapper.canonical_map == before


# --- Genuine registered references are rewritten -----------------------------

@pytest.mark.parametrize("text,expected", [
    ("/do:plan first", "skill do-plan first"),
    ("Use /do:plan here", "Use skill do-plan here"),
    ('Skill("do:it")', 'Skill("do-it")'),
    ("use skill do:plan now", "use skill do-plan now"),
    ('subagent_type="do:project-evaluator"', 'subagent_type="do-project-evaluator"'),
])
def test_registered_references_rewritten(mapper, text, expected):
    assert ReferenceRewriter.rewrite_content(text, mapper) == expected


def test_mixed_content_rewrites_only_real_references(mapper):
    content = "Run /do:plan, read src/utils:helpers, then Skill(\"do:it\")."
    result = ReferenceRewriter.rewrite_content(content, mapper)
    assert result == "Run skill do-plan, read src/utils:helpers, then Skill(\"do-it\")."


# --- get_copilot_name is a pure lookup ---------------------------------------

def test_get_copilot_name_registered(mapper):
    assert mapper.get_copilot_name("do:plan") == "do-plan"


def test_get_copilot_name_unregistered_raises_and_does_not_register(mapper):
    with pytest.raises(KeyError):
        mapper.get_copilot_name("never:registered")
    assert "never:registered" not in mapper.canonical_map


# --- Collision suffixes still work for real registrations --------------------

def test_collision_suffix_only_for_genuine_collisions():
    m = NameMapper()
    assert m.register_extension("do:plan") == "do-plan"
    assert m.register_extension("do-plan") == "do-plan-2"


# --- extract_references uses per-pattern extraction ---------------------------

def test_extract_references_no_fabricated_attribute_refs():
    refs = ReferenceRewriter.extract_references(
        'subagent_type="do:impl" and /do:plan and Skill("a:b")'
    )
    assert refs == {"do:impl", "do:plan", "a:b"}
