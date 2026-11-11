"""
Tests for slop-image.py --out resolution.

Run: uv run --with pytest --with requests pytest test_slop_image.py
"""

import importlib.util
import sys
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "slop_image", Path(__file__).with_name("slop-image.py")
)
slop_image = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(slop_image)
parse_out = slop_image.parse_out


def test_existing_dotted_directory_is_a_directory(tmp_path):
    d = tmp_path / "v2.0"
    d.mkdir()
    out = parse_out(str(d), 1)
    assert out.target("img.png") == d / "img.png"


def test_new_dotted_name_is_a_directory_and_is_created(tmp_path):
    d = tmp_path / "batch.2026-11"
    assert parse_out(str(d), 4).target("img.png") == d / "img.png"
    assert d.is_dir()


def test_trailing_slash_is_a_directory(tmp_path):
    d = tmp_path / "pics.png"
    assert parse_out(f"{d}/", 1).target("img.png") == d / "img.png"
    assert d.is_dir()


def test_file_path_with_multiple_images_is_rejected(tmp_path):
    with pytest.raises(SystemExit, match="pic.png"):
        parse_out(str(tmp_path / "pic.png"), 3)


def test_file_path_with_one_image_is_the_file_and_its_parent_is_created(tmp_path):
    f = tmp_path / "new" / "pic.png"
    assert parse_out(str(f), 1).target("img.png") == f
    assert f.parent.is_dir()


def test_file_extension_follows_the_downloaded_bytes(tmp_path):
    f = tmp_path / "pic.jpg"
    assert parse_out(str(f), 1).target("img.png") == tmp_path / "pic.png"


def test_new_path_without_suffix_is_a_directory(tmp_path):
    d = tmp_path / "out"
    assert parse_out(str(d), 3).target("img.png") == d / "img.png"


def test_existing_regular_file_cannot_be_the_directory(tmp_path):
    f = tmp_path / "notes"
    f.write_text("keep me")
    with pytest.raises(SystemExit, match="cannot create directory"):
        parse_out(str(f), 3)
    assert f.read_text() == "keep me"


@pytest.mark.parametrize("out", ["pic.png", "notes"])
def test_bad_out_is_rejected_before_any_provider_is_called(tmp_path, monkeypatch, out):
    (tmp_path / "notes").write_text("a file, not a directory")
    calls = []
    monkeypatch.setitem(slop_image.DISPATCH, "fal-flux", lambda *a: calls.append(a))
    monkeypatch.setattr(sys, "argv", [
        "slop-image", "a cat", "--count", "3", "--out", str(tmp_path / out),
    ])
    with pytest.raises(SystemExit):
        slop_image.main()
    assert calls == []
