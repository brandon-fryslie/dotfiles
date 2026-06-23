# Variant A vs B — how different are they, actually?

Both variants were implemented end to end (shared core + one small variant file
each). This is the measured answer to "show me how different they are."

## The headline

The feature is **296 lines**. Switching identity model changes **~6 of them**.
Everything that was hard — surviving a restart (`carrier.zsh`), the race-free
resurrect coordination that fixes the confirmed 120s-hang bug (`coordination.zsh`),
the gate, the attach/create executor, logging (`restore.zsh`) — is **byte-identical
shared code**. The "identity model" is a leaf, not an architecture fork.

Selecting a variant is one symlink:

    variant.zsh -> variant-dir.zsh        # A
    variant.zsh -> variant-session.zsh    # B

## The entire difference (comments stripped)

Writer — what gets recorded while the tab is alive:

    A:  restore_make_handle dir ''        "$PWD"
    B:  session=$(tmux display-message -p '#S')
        restore_make_handle session "$session" "$PWD"

Resolver — how a restored handle picks its target (primary, fallback, cwd):

    A:  name=$(restore_derive_name "$cwd");  print "$name  $name      $cwd"
    B:  primary=${session:-$(derive_name cwd)}; print "$primary $fallback $cwd"

That's it. B captures the session name and prefers it; A derives the name from the
directory. Same handle format, same carrier, same coordination, same executor.

## Where the behavior actually diverges

| Scenario                                            | A (dir-keyed)                  | B (exact-session)              | Differ? |
|-----------------------------------------------------|--------------------------------|--------------------------------|---------|
| Session named after its dir (the normal case)       | attach `promptctl`             | attach `promptctl`             | no      |
| `$HOME` plain-shell tab                             | `default`                      | `default`                      | no      |
| cmd+t fresh tab                                      | inert                          | inert                          | no      |
| Exact session vanished after reboot                 | create `promptctl` at cwd      | fall back → create `promptctl` | no      |
| Session **renamed off its dir** (`work` in `…/promptctl`) | targets `promptctl` (custom name lost) | attaches `work` (preserved) | **yes** |
| Two tabs, **same dir, different sessions**           | both collapse onto one session | each keeps its own session     | **yes** |

Two real differences, both the same theme: *may a session's identity decouple from
its directory?* A says no (directory is identity); B says yes (the session is).

## Recommendation

**B is a strict superset of A.** When a session name equals its dir basename — the
common case — B does exactly what A does. When it doesn't, B preserves what you set
up; and when the exact session is gone, B falls back to A's deterministic behavior.
The only cost is one `tmux display-message` call per prompt in the writer.

Given you run tmux sessions as first-class objects (the two-layer independence that
ruled out `tmux -CC`), B matches how you actually work: a session is a thing with a
name, not just "the shell for this folder." Recommend **B** — but it's a one-symlink,
fully reversible choice, and the offline test suite covers both.
