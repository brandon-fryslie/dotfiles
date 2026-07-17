# Canonical reference implementation of Brandon's logging style (Python).
# This is the source of truth for the STYLE. Port the same semantics to whatever
# language the target application uses; keep the color->level mapping identical.

RESET = "\x1b[0m"


def color_code(code: int) -> str:
    return f"\x1b[{code}m"


def colorize(code: int, s: str) -> str:
    # Reset-safe: re-apply the color after any embedded reset so a nested RESET
    # inside `s` doesn't kill the color for the remainder of the line.
    c = color_code(code)
    return f"{c}{str(s).replace(RESET, c)}{RESET}"


def green(s: str) -> str:   return colorize(32, s)
def yellow(s: str) -> str:  return colorize(33, s)
def blue(s: str) -> str:    return colorize(34, s)
def red(s: str) -> str:     return colorize(31, s)
def cyan(s: str) -> str:    return colorize(36, s)
def magenta(s: str) -> str: return colorize(35, s)
def bold(s: str) -> str:    return colorize(1, s)


# --- semantic log functions: color alone carries the level, no text labels ---

def info_log(*strs: str) -> None:        # normal, user-visible progress
    for s in strs:
        print(yellow(s))


def warning_log(*strs: str) -> None:     # non-fatal anomaly, recoverable
    for s in strs:
        print(bold(yellow(s)))


def success_log(*strs: str) -> None:     # completion / good outcome
    for s in strs:
        print(green(s))


def error_log(*strs: str) -> None:       # error (non-exiting)
    for s in strs:
        print(red(s))


def vlog(message: str, verbose: bool) -> None:
    # Verbose-only trace. In the app, gate on the existing VERBOSE flag rather
    # than inventing a new one. Original mackup form: `if VERBOSE: print(magenta(message))`.
    if verbose:
        print(magenta(message))


def error(message: str) -> None:         # fatal: emit red + exit non-zero
    import sys
    sys.exit(red(f"Error: {message}"))
