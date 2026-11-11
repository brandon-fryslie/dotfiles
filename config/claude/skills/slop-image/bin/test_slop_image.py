"""
Tests for slop-image.py --out resolution.

Run: uv run --with pytest --with requests pytest test_slop_image.py
"""

import importlib.util
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


def test_file_path_with_multiple_images_is_rejected(tmp_path):
    with pytest.raises(SystemExit, match="pic.png"):
        parse_out(str(tmp_path / "pic.png"), 3)


def test_file_path_with_one_image_is_the_file(tmp_path):
    f = tmp_path / "pic.png"
    assert parse_out(str(f), 1).target("img.png") == f


def test_new_path_without_suffix_is_a_directory(tmp_path):
    d = tmp_path / "out"
    assert parse_out(str(d), 3).target("img.png") == d / "img.png"
