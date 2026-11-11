#!/usr/bin/env python3
"""Install a skill from a GitHub repo path into $CODEX_HOME/skills."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import functools
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import zipfile

from github_utils import GitHubRequestError, github_request
DEFAULT_REF = "main"


@dataclass
class Args:
    url: str | None = None
    repo: str | None = None
    path: list[str] | None = None
    ref: str = DEFAULT_REF
    dest: str | None = None
    name: str | None = None
    method: str = "auto"


@dataclass
class Source:
    owner: str
    repo: str
    ref: str
    paths: list[str]


@dataclass
class Install:
    name: str
    src: str
    dest: str


class InstallError(Exception):
    pass


def _codex_home() -> str:
    return os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))


def _tmp_root() -> str:
    base = os.path.join(tempfile.gettempdir(), "codex")
    os.makedirs(base, exist_ok=True)
    return base


def _request(url: str) -> bytes:
    return github_request(url, "codex-skill-install")


def _parse_github_url(url: str, default_ref: str) -> tuple[str, str, str, str | None]:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc != "github.com":
        raise InstallError("Only GitHub URLs are supported for download mode.")
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise InstallError("Invalid GitHub URL.")
    owner, repo = parts[0], parts[1]
    ref = default_ref
    subpath = ""
    if len(parts) > 2:
        if parts[2] in ("tree", "blob"):
            if len(parts) < 4:
                raise InstallError("GitHub URL missing ref or path.")
            ref = parts[3]
            subpath = "/".join(parts[4:])
        else:
            subpath = "/".join(parts[2:])
    return owner, repo, ref, subpath or None


def _download_repo_zip(owner: str, repo: str, ref: str, dest_dir: str) -> str:
    zip_url = f"https://codeload.github.com/{owner}/{repo}/zip/{ref}"
    zip_path = os.path.join(dest_dir, "repo.zip")
    try:
        payload = _request(zip_url)
    except GitHubRequestError as exc:
        raise InstallError(f"Download failed: {exc}") from exc
    with open(zip_path, "wb") as file_handle:
        file_handle.write(payload)
    with zipfile.ZipFile(zip_path, "r") as zip_file:
        _safe_extract_zip(zip_file, dest_dir)
        top_levels = {name.split("/")[0] for name in zip_file.namelist() if name}
    if not top_levels:
        raise InstallError("Downloaded archive was empty.")
    if len(top_levels) != 1:
        raise InstallError("Unexpected archive layout.")
    return os.path.join(dest_dir, next(iter(top_levels)))


def _run_git(args: list[str], what: str) -> None:
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        cause = result.stderr.strip() or f"exit {result.returncode}"
        raise InstallError(f"{what} failed: {cause}")


def _safe_extract_zip(zip_file: zipfile.ZipFile, dest_dir: str) -> None:
    dest_root = os.path.realpath(dest_dir)
    for info in zip_file.infolist():
        extracted_path = os.path.realpath(os.path.join(dest_dir, info.filename))
        if extracted_path == dest_root or extracted_path.startswith(dest_root + os.sep):
            continue
        raise InstallError("Archive contains files outside the destination.")
    zip_file.extractall(dest_dir)


def _validate_relative_path(path: str) -> None:
    if os.path.isabs(path) or os.path.normpath(path).startswith(".."):
        raise InstallError("Skill path must be a relative path inside the repo.")


def _validate_skill_name(name: str) -> None:
    altsep = os.path.altsep
    if not name or os.path.sep in name or (altsep and altsep in name):
        raise InstallError("Skill name must be a single path segment.")
    if name in (".", ".."):
        raise InstallError("Invalid skill name.")


def _git_sparse_checkout(repo_url: str, ref: str, paths: list[str], dest_dir: str) -> str:
    repo_dir = os.path.join(dest_dir, "repo")
    _run_git(
        [
            "git",
            "clone",
            "--filter=blob:none",
            "--depth",
            "1",
            "--sparse",
            "--single-branch",
            "--branch",
            ref,
            repo_url,
            repo_dir,
        ],
        f"git clone {repo_url} (ref {ref})",
    )
    _run_git(
        ["git", "-C", repo_dir, "sparse-checkout", "set", *paths],
        f"git sparse-checkout of {repo_url}",
    )
    return repo_dir


def _validate_skill(path: str) -> None:
    if not os.path.isdir(path):
        raise InstallError(f"Skill path not found: {path}")
    skill_md = os.path.join(path, "SKILL.md")
    if not os.path.isfile(skill_md):
        raise InstallError("SKILL.md not found in selected skill directory.")


def _plan_installs(
    paths: list[str], name: str | None, repo_root: str, dest_root: str
) -> list[Install]:
    # [LAW:parse-dont-validate] every source and destination is checked here, before
    # anything is copied, so a bad second path cannot leave the first one installed.
    names = [name] if name is not None else [os.path.basename(p.rstrip("/")) for p in paths]
    installs: list[Install] = []
    for skill_name, path in zip(names, paths, strict=True):
        _validate_skill_name(skill_name)
        if any(install.name == skill_name for install in installs):
            raise InstallError(f"Two --path values would both install as {skill_name}.")
        dest_dir = os.path.join(dest_root, skill_name)
        if os.path.exists(dest_dir):
            raise InstallError(f"Destination already exists: {dest_dir}")
        skill_src = os.path.join(repo_root, path)
        _validate_skill(skill_src)
        installs.append(Install(skill_name, skill_src, dest_dir))
    return installs


def _copy_skills(installs: list[Install], dest_root: str) -> None:
    os.makedirs(dest_root, exist_ok=True)
    created: list[str] = []
    try:
        for install in installs:
            # mkdir first: a destination is ours to roll back only once we created it
            os.mkdir(install.dest)
            created.append(install.dest)
            shutil.copytree(install.src, install.dest, dirs_exist_ok=True)
    except OSError as exc:
        leftovers = []
        for dest in created:
            try:
                shutil.rmtree(dest)
            except OSError as rm_exc:
                leftovers.append(f"could not remove {dest}: {rm_exc}")
        detail = "; ".join([str(exc), *leftovers])
        raise InstallError(f"Copy failed, nothing installed: {detail}") from exc


def _build_repo_url(owner: str, repo: str) -> str:
    return f"https://github.com/{owner}/{repo}.git"


def _build_repo_ssh(owner: str, repo: str) -> str:
    return f"git@github.com:{owner}/{repo}.git"


def _prepare_repo(source: Source, method: str, tmp_dir: str) -> str:
    download = functools.partial(_download_repo_zip, source.owner, source.repo, source.ref)
    clone_https, clone_ssh = (
        functools.partial(_git_sparse_checkout, url, source.ref, source.paths)
        for url in (
            _build_repo_url(source.owner, source.repo),
            _build_repo_ssh(source.owner, source.repo),
        )
    )
    # [LAW:no-silent-failure] the one fallback ladder: every failed rung is reported,
    # whether a later rung succeeds or not.
    attempts = {
        "download": [download],
        "git": [clone_https, clone_ssh],
        "auto": [download, clone_https, clone_ssh],
    }[method]
    failures: list[str] = []
    for index, attempt in enumerate(attempts):
        work_dir = os.path.join(tmp_dir, str(index))
        os.mkdir(work_dir)
        try:
            repo_root = attempt(work_dir)
        except InstallError as exc:
            failures.append(str(exc))
            continue
        for failure in failures:
            print(f"Note: {failure} (fell back to the next method)", file=sys.stderr)
        return repo_root
    raise InstallError("; ".join(failures))


def _resolve_source(args: Args) -> Source:
    if args.url:
        owner, repo, ref, url_path = _parse_github_url(args.url, args.ref)
        if args.path is not None:
            paths = list(args.path)
        elif url_path:
            paths = [url_path]
        else:
            paths = []
        if not paths:
            raise InstallError("Missing --path for GitHub URL.")
        return Source(owner=owner, repo=repo, ref=ref, paths=paths)

    if not args.repo:
        raise InstallError("Provide --repo or --url.")
    if "://" in args.repo:
        return _resolve_source(
            Args(url=args.repo, repo=None, path=args.path, ref=args.ref)
        )

    repo_parts = [p for p in args.repo.split("/") if p]
    if len(repo_parts) != 2:
        raise InstallError("--repo must be in owner/repo format.")
    if not args.path:
        raise InstallError("Missing --path for --repo.")
    paths = list(args.path)
    return Source(
        owner=repo_parts[0],
        repo=repo_parts[1],
        ref=args.ref,
        paths=paths,
    )


def _default_dest() -> str:
    return os.path.join(_codex_home(), "skills")


def _parse_args(argv: list[str]) -> Args:
    parser = argparse.ArgumentParser(description="Install a skill from GitHub.")
    parser.add_argument("--repo", help="owner/repo")
    parser.add_argument("--url", help="https://github.com/owner/repo[/tree/ref/path]")
    parser.add_argument(
        "--path",
        nargs="+",
        help="Path(s) to skill(s) inside repo",
    )
    parser.add_argument("--ref", default=DEFAULT_REF)
    parser.add_argument("--dest", help="Destination skills directory")
    parser.add_argument(
        "--name", help="Destination skill name (defaults to basename of path)"
    )
    parser.add_argument(
        "--method",
        choices=["auto", "download", "git"],
        default="auto",
    )
    return parser.parse_args(argv, namespace=Args())


def main(argv: list[str]) -> int:
    args = _parse_args(argv)
    try:
        source = _resolve_source(args)
        if args.name is not None and len(source.paths) > 1:
            raise InstallError("--name names a single skill; it cannot be used with several --path values.")
        for path in source.paths:
            _validate_relative_path(path)
        dest_root = args.dest or _default_dest()
        tmp_dir = tempfile.mkdtemp(prefix="skill-install-", dir=_tmp_root())
        try:
            repo_root = _prepare_repo(source, args.method, tmp_dir)
            installs = _plan_installs(source.paths, args.name, repo_root, dest_root)
            _copy_skills(installs, dest_root)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        for install in installs:
            print(f"Installed {install.name} to {install.dest}")
        return 0
    except InstallError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
