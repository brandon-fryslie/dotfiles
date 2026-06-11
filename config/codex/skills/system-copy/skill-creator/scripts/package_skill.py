#!/usr/bin/env python3
"""
Skill Packager - Creates a distributable .skill file of a skill folder

Usage:
    python utils/package_skill.py <path/to/skill-folder> [output-directory]

Example:
    python utils/package_skill.py skills/public/my-skill
    python utils/package_skill.py skills/public/my-skill ./dist
"""

import os
import sys
import tempfile
import zipfile
from pathlib import Path

from quick_validate import validate_skill


def package_skill(skill_path, output_dir=None):
    """
    Package a skill folder into a .skill file.

    Args:
        skill_path: Path to the skill folder
        output_dir: Optional output directory for the .skill file (defaults to current directory)

    Returns:
        Path to the created .skill file, or None if error
    """
    skill_path = Path(skill_path).resolve()

    # Validate skill folder exists
    if not skill_path.exists():
        print(f"[ERROR] Skill folder not found: {skill_path}")
        return None

    if not skill_path.is_dir():
        print(f"[ERROR] Path is not a directory: {skill_path}")
        return None

    # Validate SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"[ERROR] SKILL.md not found in {skill_path}")
        return None

    # Run validation before packaging
    print("Validating skill...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"[ERROR] Validation failed: {message}")
        print("   Please fix the validation errors before packaging.")
        return None
    print(f"[OK] {message}\n")

    # Determine output location
    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        # resolve() so the destination-skip comparison below holds by
        # construction, not by getcwd's POSIX symlink-free contract
        output_path = Path.cwd().resolve()

    skill_filename = output_path / f"{skill_name}.skill"

    # [LAW:effects-at-boundaries] Stage the archive under a temp name and move it
    # into place only once complete — otherwise the lazy rglob walk finds the
    # half-written archive and packages it into itself when the output lands
    # inside the skill folder. Staging in the destination directory keeps
    # os.replace on one filesystem, so the move is atomic and a failed run
    # leaves any pre-existing archive untouched.
    tmp_fd, tmp_name = tempfile.mkstemp(prefix=f".{skill_name}.skill.", dir=output_path)
    os.close(tmp_fd)
    tmp_archive = Path(tmp_name)
    try:
        with zipfile.ZipFile(tmp_archive, "w", zipfile.ZIP_DEFLATED) as zipf:
            # Walk through the skill directory
            for file_path in skill_path.rglob("*"):
                # The two paths this run owns — a previous archive at the
                # destination and the in-progress staging file — are not
                # skill content; skip exactly those, nothing else.
                if file_path.is_file() and file_path not in (skill_filename, tmp_archive):
                    # Calculate the relative path within the zip
                    arcname = file_path.relative_to(skill_path.parent)
                    zipf.write(file_path, arcname)
                    print(f"  Added: {arcname}")

        os.replace(tmp_archive, skill_filename)
        print(f"\n[OK] Successfully packaged skill to: {skill_filename}")
        return skill_filename

    except Exception as e:
        print(f"[ERROR] Error creating .skill file: {e}")
        return None

    finally:
        tmp_archive.unlink(missing_ok=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: python utils/package_skill.py <path/to/skill-folder> [output-directory]")
        print("\nExample:")
        print("  python utils/package_skill.py skills/public/my-skill")
        print("  python utils/package_skill.py skills/public/my-skill ./dist")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output directory: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
