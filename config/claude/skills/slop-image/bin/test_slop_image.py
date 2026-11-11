"""
Tests for slop-image.py --out resolution and the format each provider is asked for.

Run: uv run --with pytest --with requests pytest test_slop_image.py
"""

import dataclasses
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
FLUX = slop_image.PROVIDERS["fal-flux"]
NANO = slop_image.PROVIDERS["fal-nano-banana"]
SDXL = slop_image.PROVIDERS["replicate-sdxl"]

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"rest"
JPEG_BYTES = b"\xff\xd8\xff" + b"rest"


class FakeResponse:
    def __init__(self, content=b"", body=None):
        self.ok = True
        self.status_code = 200
        self.content = content
        self.headers = {}
        self._body = body
        self.text = repr(body)

    def json(self):
        return self._body


def run_main(monkeypatch, *args):
    monkeypatch.setattr(slop_image, "get_key", lambda *a: ("k", "test"))
    monkeypatch.setattr(sys, "argv", ["slop-image", "a cat", *args])
    slop_image.main()


def fake_provider(monkeypatch, provider, calls):
    def generate(name, key, prompt, aspect, fmt):
        calls.append(fmt)
        return f"https://img/{len(calls)}"
    monkeypatch.setitem(slop_image.PROVIDERS, provider.name,
                        dataclasses.replace(provider, generate=generate))


def test_existing_dotted_directory_is_a_directory(tmp_path):
    d = tmp_path / "v2.0"
    d.mkdir()
    out = parse_out(str(d), 1, FLUX)
    assert out.target("img.png") == d / "img.png"


def test_new_dotted_name_is_a_directory_and_is_created(tmp_path):
    d = tmp_path / "batch.2026-11"
    assert parse_out(str(d), 4, FLUX).target("img.png") == d / "img.png"
    assert d.is_dir()


def test_trailing_slash_is_a_directory(tmp_path):
    d = tmp_path / "pics.png"
    assert parse_out(f"{d}/", 1, FLUX).target("img.png") == d / "img.png"
    assert d.is_dir()


def test_file_path_with_multiple_images_is_rejected(tmp_path):
    with pytest.raises(SystemExit, match="pic.png"):
        parse_out(str(tmp_path / "pic.png"), 3, FLUX)


def test_file_path_with_one_image_is_the_file_and_its_parent_is_created(tmp_path):
    f = tmp_path / "new" / "pic.png"
    assert parse_out(str(f), 1, FLUX).target("img.png") == f
    assert f.parent.is_dir()


@pytest.mark.parametrize("name", ["hero.JPEG", "hero.jpeg", "hero.jpg"])
def test_jpeg_suffixes_ask_for_jpeg_and_write_exactly_the_named_path(tmp_path, name):
    f = tmp_path / name
    out = parse_out(str(f), 1, NANO)
    assert out.format is slop_image.JPEG
    assert out.target("img.png") == f


def test_new_path_without_suffix_is_a_directory(tmp_path):
    d = tmp_path / "out"
    assert parse_out(str(d), 3, FLUX).target("img.png") == d / "img.png"


def test_existing_regular_file_cannot_be_the_directory(tmp_path):
    f = tmp_path / "notes"
    f.write_text("keep me")
    with pytest.raises(SystemExit, match="cannot create directory"):
        parse_out(str(f), 3, FLUX)
    assert f.read_text() == "keep me"


def test_directory_asks_for_the_providers_default_format(tmp_path):
    assert parse_out(str(tmp_path), 1, FLUX).format is slop_image.JPEG
    assert parse_out(str(tmp_path), 1, NANO).format is slop_image.PNG


@pytest.mark.parametrize("provider, name, offered", [
    (FLUX, "x.webp", "jpeg, png"),
    (SDXL, "x.jpg", "png"),
    (NANO, "x.gif", "png, jpeg, webp"),
])
def test_format_the_provider_cannot_produce_is_refused(tmp_path, provider, name, offered):
    with pytest.raises(SystemExit, match=f"can produce only {offered}$"):
        parse_out(str(tmp_path / name), 1, provider)
    assert not (tmp_path / name).exists()


@pytest.mark.parametrize("out", ["pic.png", "notes", "pic.webp", "logo.gif"])
def test_bad_out_is_rejected_before_any_provider_is_called(tmp_path, monkeypatch, out):
    (tmp_path / "notes").write_text("a file, not a directory")
    calls = []
    fake_provider(monkeypatch, FLUX, calls)
    count = "3" if out in ("pic.png", "notes") else "1"
    with pytest.raises(SystemExit):
        run_main(monkeypatch, "--count", count, "--out", str(tmp_path / out))
    assert calls == []
    assert not (tmp_path / "logo.gif").exists()


def test_file_suffix_sets_the_output_format_fal_is_asked_for(tmp_path, monkeypatch):
    bodies = []

    def post(url, json, **kw):
        bodies.append(json)
        return FakeResponse(body={"images": [{"url": "https://img/1"}]})

    monkeypatch.setattr(slop_image.requests, "post", post)
    monkeypatch.setattr(slop_image.requests, "get", lambda url, **kw: FakeResponse(JPEG_BYTES))
    f = tmp_path / "pic.jpg"
    run_main(monkeypatch, "--provider", "fal-nano-banana", "--out", str(f))
    assert bodies[0]["output_format"] == "jpeg"
    assert f.read_bytes() == JPEG_BYTES


def test_directory_file_is_named_for_the_requested_format(tmp_path, monkeypatch, capsys):
    calls = []
    fake_provider(monkeypatch, FLUX, calls)
    monkeypatch.setattr(slop_image.requests, "get", lambda url, **kw: FakeResponse(JPEG_BYTES))
    run_main(monkeypatch, "--out", str(tmp_path))
    assert calls == [slop_image.JPEG]
    saved = Path(capsys.readouterr().out.strip())
    assert saved.parent == tmp_path.resolve() and saved.suffix == ".jpg"


def test_bytes_not_in_the_requested_format_are_not_written(tmp_path, monkeypatch):
    calls = []
    fake_provider(monkeypatch, FLUX, calls)
    monkeypatch.setattr(slop_image.requests, "get", lambda url, **kw: FakeResponse(PNG_BYTES))
    f = tmp_path / "pic.jpg"
    with pytest.raises(SystemExit, match="asked for jpeg"):
        run_main(monkeypatch, "--out", str(f))
    assert not f.exists()


def test_saved_paths_are_reported_even_when_a_later_image_fails(tmp_path, monkeypatch, capsys):
    fake_provider(monkeypatch, FLUX, [])

    def save(url, prompt, out, index, total):
        if index == 1:
            raise SystemExit("[slop-image] asked for jpeg but the download is not jpeg")
        return out.target(f"img-{index + 1}.png")

    monkeypatch.setattr(slop_image, "save_image", save)
    with pytest.raises(SystemExit):
        run_main(monkeypatch, "--count", "2", "--out", str(tmp_path))
    assert capsys.readouterr().out == f"{tmp_path / 'img-1.png'}\n"
