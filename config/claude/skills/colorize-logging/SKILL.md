---
name: colorize-logging
description: Transform an application's logging/output to Brandon's colorized logging style — a reset-safe ANSI color layer with semantic level functions (info=yellow, warning=bold-yellow, success=green, error=red, verbose-trace=magenta) where color alone carries the level and there are no text labels. Use when the user says "apply my logging style", "colorize the logging", "make the logging match my style", "convert print/console.log statements to my colored logging", "add my logging library", "standardize this app's log output", or wants a project's ad-hoc prints and stdlib logging replaced with this specific style. Works in any language; Python is the reference.
---

# Colorize logging — Brandon's style

Replace an application's scattered `print`/`console.log`/`println`/stdlib-logging calls with a small **reset-safe ANSI color layer** and **semantic log functions**, choosing each call's level from the *meaning* of the message. Color is the only level indicator — never emit `INFO:`/`[WARN]` text labels.

The canonical implementation is [`reference/colors.py`](reference/colors.py). It is the source of truth for the style. In non-Python apps, port the same behavior and keep the color→level mapping identical.

## The style — non-negotiable rules

**Palette (ANSI SGR codes):** green=32 · yellow=33 · blue=34 · red=31 · cyan=36 · magenta=35 · bold=1.

**Reset-safe `colorize`:** wrap the string in the color code + `\x1b[0m`, AND replace any embedded `\x1b[0m` inside the string with `code`-then-reset, so a nested reset doesn't strip color from the rest of the line. This is the distinctive part — do not drop it.

**Semantic level → color (memorize this table):**

| Function | Color | Use for |
|---|---|---|
| `info_log` | yellow | normal user-visible progress; primary state-changing actions ("Backing up X", "Restoring X to Y") |
| `warning_log` | **bold** yellow | non-fatal anomalies / recoverable oddities ("X is a symlink. Skipping", "broken link. Fixing") |
| `success_log` | green | completion / good outcome ("All done", "Synced 12 apps") |
| `error_log` | red | errors that don't exit |
| `error` | red + `exit` | fatal: print red then exit non-zero |
| `vlog` | magenta | verbose-only trace: skips, no-ops, "already synced", "doesn't exist. Skipping", fine-grained detail |

**Other characteristics of the style:**
- Plain `print` to stdout — NOT the stdlib `logging` framework, NOT a logger object.
- Variadic where the language allows (`*strs`), one line printed per argument.
- Native interpolation (f-strings / template literals), not `%`/`.format` concatenation.
- No level prefixes, no timestamps, no logger names — just the colored message.
- Messages are short sentences; the codebase's flavor uses a double space before a trailing clause ("Config file X doesn't exist.  Skipping") — mirror the existing message text, don't rewrite it.

## Classifying existing calls (the actual judgment)

The hard part is picking the level. Decide by what the message *is*, not by the old call's name:
- Does the user need to see it in normal operation, and does it describe an action being taken? → `info_log`.
- Is it a detail only useful when debugging — a skip, a "nothing to do", a path echo? → `vlog` (verbose-gated). When in doubt between info and vlog, prefer `vlog` — keep normal output quiet.
- Is something unexpected but handled? → `warning_log`.
- Is it a terminal success message? → `success_log`.
- Is it an error? `error_log` if execution continues, `error` if it should abort.

## Procedure

1. **Detect language + current logging.** Grep the target for how it emits output: `print(` / `console.log` / `println` / `fmt.Print*` / `echo` / raw `\033[`/`\x1b[` ANSI, and any stdlib `logging`/logger usage. Read enough call sites to understand the message vocabulary.
2. **Install the color layer.** Add a `colors.<ext>` module that ports `reference/colors.py`: `colorize` (reset-safe) + the palette + the six semantic functions. Match the app's module conventions and import style.
3. **Wire the verbose gate to what already exists.** Find the app's existing verbosity flag (CLI `-v/--verbose`, a config bool, an env var) and gate `vlog` on it. Do NOT invent a parallel verbosity system.
4. **Replace call sites** one by one, classifying each message into a level per the table above. Preserve the exact message text and interpolated values; change only the emission and the level.
5. **Preserve behavior.** Never alter control flow. A fatal `sys.exit`/`raise`/`os.Exit` stays fatal — route it through `error` but keep the exit. Don't add/remove messages; don't reorder.
6. **Leave stderr semantics alone unless asked.** This style prints to stdout. If the app deliberately writes errors to stderr and that matters, keep errors on stderr (color still applies).
7. **Verify:** run the app (or the touched path) and confirm output is colored, levels read correctly, and verbose-only lines are silent without the flag.

## Optional hardening (offer, don't impose — it's not in the reference)

The reference always emits ANSI. If the user wants robustness, offer (do not add silently): skip coloring when `not sys.stdout.isatty()` or when `NO_COLOR` is set. Keep it opt-in so the transform stays faithful to the base style.

## Worked example (from the real mackup transform)

<example>
Before (plain prints, level implicit in prose):
```python
if not os.path.exists(config_file):
    print("Config file {} doesn't exist. Skipping".format(filename))
elif os.path.islink(config_file):
    print("{} in home directory is a symlink. Skipping".format(filename))
else:
    print("Backing up {} ...".format(filename))
```

After (semantic levels; skip→vlog, anomaly→warning, action→info):
```python
from .colors import info_log, warning_log
from . import utils  # utils.vlog gated on VERBOSE

if not os.path.exists(config_file):
    utils.vlog(f"Config file {filename} doesn't exist.  Skipping")
elif os.path.islink(config_file):
    warning_log(f"{filename} in home directory is a symlink.  Skipping")
else:
    info_log(f"Backing up {filename}")
```
</example>

Note how the same `print` became three different levels purely from the message meaning — that classification is the whole job.
