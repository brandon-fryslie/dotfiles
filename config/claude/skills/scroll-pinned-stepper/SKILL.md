---
name: scroll-pinned-stepper
description: Implement a scroll-pinned stepper (scrollytelling "sticky graphic") into the user's current project — a graphic that freezes in place via CSS sticky, advances through a series of states as the reader scrolls past text steps, then releases. Use when the user wants to add scrollytelling, a sticky/pinned scroll graphic, a "scroll and it freezes then changes" effect, a scroll-driven stepper, scrollama-style steps, or references the Reuters/NYT/Pudding sticky-graphic pattern. Adapts to the project's existing framework (vanilla, React, Svelte, Vue) rather than imposing one.
---

# Scroll-Pinned Stepper

Implement the scrollytelling **sticky-graphic** pattern: a graphic pins to the
viewport, updates through declared states as the reader scrolls past text
"steps", then releases. The freeze is plain CSS `position: sticky` — no library
and no scroll-offset math is required.

## The contract (this is the whole design — preserve it in any framework)

These four invariants ARE the pattern. They are framework-independent. Translate
them into the host project's idiom; never weaken them to fit a framework.

1. **Steps are data, not code.** One array of `{ caption, state }`. The `state`
   object carries *every* per-step difference the graphic shows (position, color,
   scale, opacity, label, image src — whatever varies). Adding a step is a
   one-entry data edit and nothing else.
   `[LAW:types-are-the-program]` — the array is the strongest true theorem about
   the sequence; the renderer is its proof.

2. **One pure render.** A single `render(state)` sets the graphic's appearance
   from the state value and runs identically every time. There is **no per-step
   branch** anywhere — no `if (active === 0)`, no `switch`, no per-step CSS class.
   `[LAW:dataflow-not-control-flow]` — variability lives in the value passed in,
   never in which code path runs.

3. **One source of truth for the active step.** A single `active` index (state in
   React/Svelte/Vue, a variable in vanilla), written in exactly one place. The
   graphic and any step highlighting are *derived* from it.
   `[LAW:one-source-of-truth]`.

4. **One enforcer for step detection.** Exactly one `IntersectionObserver` (or one
   framework equivalent) decides the active step. Do not scatter scroll math
   across multiple listeners that could disagree.
   `[LAW:single-enforcer]`.

The pin itself: a `position: sticky; top: 0; height: 100vh` layer inside a tall
track. The track's height creates the scroll distance; CSS owns the freeze.
Never reimplement pinning in JS — that is rough and brittle.

## Procedure

1. **Locate the host stack.** Detect the framework and where view code lives
   (look for `package.json`, component dirs, existing routing). The output must
   read like the surrounding code — match its component style, naming, and CSS
   approach (CSS modules, Tailwind, styled-components, plain CSS). If the project
   is empty/static, emit a self-contained HTML file like the reference.

2. **Gather the steps.** Ask the user what the sequence is: how many steps, the
   caption text, and what the graphic should *do* at each (move, recolor, swap
   image, zoom a map, etc.). If they don't have content yet, scaffold 3–4
   placeholder steps they can fill in — but the placeholders must already vary by
   data alone, so filling them in is a pure data edit.

3. **Read the reference, then translate the contract.** `reference/vanilla.html`
   is the canonical proof of the four invariants. Do not copy it verbatim into a
   framework project — re-express the *contract* in the host idiom:
   - React: `const [active, setActive] = useState(0)`; one `<Figure state={STEPS[active].state} />`; one `useEffect` that wires a single `IntersectionObserver` over the step refs.
   - Svelte: `let active = 0`; bind it from one observer action; the graphic's attrs derive reactively from `STEPS[active].state`.
   - Vanilla: use the reference directly.

4. **Verify against reality, do not punt to the user.** `[LAW:verifiable-goals]`
   Run the project (or open the file) and confirm, by observation: the graphic
   pins at `top:0` through the middle steps, changes through every declared state,
   and releases after the last. Use the project's run command or Chrome DevTools
   MCP to scroll and sample. Report what you observed.

## Definition of done (the mechanical-ease test)

The skill succeeded only if **adding a 5th step is a one-line addition to the
steps array with zero edits to render or observer logic.** If a new step would
force a code change, the schema is missing a discriminator — fix the schema
before finishing, never after. Per-step conditionals in the emitted code mean
the skill failed, regardless of whether the demo works.

## Anti-patterns (these crystallize the pattern — reject them)

- ❌ One DOM element or CSS rule per step (`.step-1{} .step-2{}`). N types for one
  behavior — use one element whose look is a function of data. `[LAW:one-type-per-behavior]`
- ❌ A `switch`/`if`-ladder on the active index inside render.
- ❌ JS that computes scroll offsets to "pin" the graphic — `position: sticky`
  already does this.
- ❌ Two listeners that both set the active step.
- ❌ Shipping a parallel React+Svelte+Vue set of files "to be safe." Emit only the
  host project's idiom. `[LAW:no-mode-explosion]`
