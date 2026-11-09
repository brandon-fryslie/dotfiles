"""find-session's transcript locator and reader, imported rather than copied.

find-reviews reads the same transcripts find-session does; two readers would be two
answers to where transcripts live and what a malformed line means. [LAW:one-source-of-truth]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "find-session"))

from _session_lib import iter_rows, projects_root, slug_for  # noqa: E402

__all__ = ["iter_rows", "projects_root", "slug_for"]
