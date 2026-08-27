---
name: patch-claude-code
description: >
  How to inspect, understand, and runtime-patch the shipped Claude Code app — which
  ships as a single Bun-compiled, minified JS bundle. Covers extracting the bundle,
  running it under node via a Bun→node shim, locating code "seams" by invariant
  anchors (string/regex literals and structure that survive minification, since the
  names do not), and injecting changes AT RUNTIME via an in-process inspector.Session
  without ever modifying the shipped bytes. Use when the task is to add a tool, hook a
  function, change behavior, or reverse-engineer any part of the Claude Code CLI binary.
---

# Inspecting & patching Claude Code

Claude Code ships as a **Bun-compiled standalone binary** whose payload is one giant
**minified JavaScript bundle** (~18 MB, CJS-wrapped). There are no source maps. Every
identifier is mangled (`getAllBaseTools` → `v4`) and the names **drift every release**.
This skill is the repeatable method for working with it.

The north-star rule, when the goal is a *patch*: **do not modify the shipped bytes.**
Run the real bundle and change it *at runtime* through the V8 inspector. Modifying the
file on disk is a different (and usually wrong) thing — it's brittle, it breaks
signature/version checks, and it's easy to fool yourself into "it worked" when you
actually ran edited code. Reverse-engineering (reading the bundle) is fine and expected;
*shipping* an on-disk edit is the anti-pattern.

A complete, working reference implementation of everything below lives in
`~/code/cc-source-study/cli-tools-patch/` (`node-loader.js`, `run-injected.js`,
`launch-injected.sh`, `NODE-BUN-SHIM-API-SURFACE.md`). Read it alongside this skill.

---

## Step 1 — Inspect: get the bundle and run the *real* code under node

**Find and extract the bundle.**
```bash
readlink -f "$(which claude)"        # → /opt/homebrew/Caskroom/claude-code/<ver>/claude (a Bun Mach-O binary)
```
The JS payload can be extracted verbatim (a raw dump — never edit it). Keep it as
`bundle-<version>.js`. It is a CJS module: line 2 opens with the wrapper
`(function(exports, require, module, __filename, __dirname) {`.

**Run it under node, not Bun.** Bun's JSC inspector is unusable for injection
(`--inspect-brk` doesn't break on entry; `setBreakpointByUrl` doesn't bind). Node's
V8/CDP inspector is complete. To run a Bun bundle under node you need a **Bun→node
compatibility shim** that defines `globalThis.Bun`, `eval`s the verbatim bundle, and
calls its CJS wrapper. See `node-loader.js`. Two things about the shim are non-obvious:

- **Three Bun APIs are boot-critical** — without real implementations the TUI crashes
  during its first render (a swallowed `TypeError: …reading 'length'`, looks like a
  hang): `Bun.semver` (`.order`/`.satisfies`, called ~355×/boot), `Bun.stripANSI`,
  `Bun.wrapAnsi`. A stub returning `undefined` is the trap — a stub must return a
  **valid value or throw**, never `undefined`. Full surface: `NODE-BUN-SHIM-API-SURFACE.md`.
- **Claude detects a debugger and kills its own TUI.** A bundle function (`i3f` in
  2.1.197) checks `process.execArgv` / `NODE_OPTIONS` for `--inspect*` and, if found,
  never sets up the interactive UI — the process then quietly exits. If you launch with
  `node --inspect-brk`, you MUST scrub the flag from `process.execArgv` in the shim
  before the bundle runs:
  ```js
  process.execArgv = (process.execArgv||[]).filter(a => !/--inspect|--debug/.test(a));
  ```
  Better still, avoid the flag entirely — see Step 4 (in-process Session).

Verify boot in a real PTY (`tmux -L <priv-socket>` or `script`), not a pipe — the TUI
needs a TTY. A correct shim boots the interactive TUI in ~1.5s.

---

## Step 2 — Find an anchor: locate a seam without knowing its minified name

Minified **names** are worthless across releases. What survives, byte-for-byte, is:

1. **String / regex / number literals.** `"Free up context by summarizing the
   conversation so far"`, the telemetry event `"tengu_input_slash_missing"`, the regex
   `/--inspect(-brk)?/` — all identical in every build. These are your highest-confidence
   anchors: find the literal, then the enclosing/nearby function is your seam.
2. **Structural fingerprints.** The *shape* of code is stable even when names change:
   - `getAllBaseTools` = the no-arg function whose result is `.map((n)=>n.isEnabled())`-ed:
     `/(\w+)\(\),\w+=\w+\.map\(\(\w+\)=>\w+\.isEnabled\(\)\)/`
   - `processSlashCommand` dispatch = the app's own preamble
     `{processSlashCommand:X}=await …(() => (jMe(),IKt))`:
     `/processSlashCommand:\w+\}=await[^;]{0,80}\(\)\s*=>\s*\((\w+)\(\),(\w+)\)/`
     (group 1 = the init memo, group 2 = the holder object).
   - Command objects = `name:"compact"` + a `description:"…"` + `argumentHint:"…"` nearby.
3. **Object-shape fingerprints.** A "tool" is any object with
   `isEnabled`/`isConcurrencySafe`/`checkPermissions`/`call`. A "command" has
   `type:"local"|"local-jsx"` + `name` + `description`.

**Write anchors as regexes with a fallback to the last-known name.** That's the whole
trick to version-robustness:
```js
const pick = (re, fallback) => { const m = src.match(re); return m ? m[1] : fallback; };
const getAllBaseTools = pick(/(\w+)\(\),\w+=\w+\.map\(\(\w+\)=>\w+\.isEnabled\(\)\)/, 'v4');
```
`node-loader.js`'s `locate()` does exactly this for the injection seams and logs what it
resolved — copy that pattern.

### The two correctness traps (both cost real time)

- **Names are scope-local, not global.** `v4` is `getAllBaseTools` in one module *and*
  `uuid.v4()` in a vendored AWS SDK in the same bundle. Never do a global string-replace
  of a mangled name — anchor to the *specific* call/definition site, and key any
  minified→human map by **(scope, symbol)**, not the bare name.
- **One name, two definitions.** `/goal` and `/mcp` each have BOTH a `type:"local"` and a
  `type:"local-jsx"` object under the same `name:`. Disambiguate by `type`/structure or
  you'll conflate two distinct things.

### Building a minified→human map (the general version of this)

If you're producing a reusable name map (not just locating one seam): align a known
**real source ↔ minified source** of the *same* version to get ground truth, then
generalize by (a) anchoring on invariant literals, (b) propagating names outward through
the **call graph** from anchored nodes by structural position, and (c) using LLM
inference only for the unanchored residue, with confidence scores. Literals + call-graph
structure are the reliable backbone; treat inference as the last layer, never the first.

---

## Step 3 — Understand what you're looking at

Reading minified code is pattern-reading. Useful landmarks in the Claude Code bundle:

- **CJS wrapper** (line 2): `(function(exports, require, module, __filename, __dirname){…})`.
  Everything module-scoped (like `getAllBaseTools`) lives inside this closure — you can
  only reassign it from a frame *inside* the wrapper (see Step 4).
- **Lazy module init**: `var X = b(()=>{ …assign module vars… })`. Calling `X()` forces
  initialization. Command objects are built this way (`/compact`'s object is populated by
  one of these memos).
- **Tool list**: `getAllBaseTools` returns a static array of tool-object *references*
  (`[qXn,yQn,…]`). It takes no args and has no access to the command registry.
- **Slash commands**: dispatched by `processSlashCommand` (holder `IKt`, init `jMe`).
  Types: `local` (returns text), `local-jsx` (returns a React/Ink element the TUI
  *mounts* via an `{jsx:…}` callback — the 3rd param of `processSlashCommand`), `prompt`
  (feeds the model). A tool that calls `processSlashCommand` gets the **effect** but
  can't mount the jsx UI, because that callback is the main component's state setter,
  not something a tool's result can reach.
- **Runtime guards**: the app assumes Bun (`typeof Bun.version`), so the shim must
  *spoof* Bun and back every `Bun.*` the taken paths call. A `Bun.*` wrapped in try/catch
  (e.g. `Bun.Terminal`) is a graceful-degradation hook — a *throwing* stub there is fine.

Confirm your understanding empirically: extract a function's body, or set a breakpoint and
`Debugger.evaluateOnCallFrame` to inspect live values. Never trust a guess about a seam
you haven't observed executing.

---

## Step 4 — Make a patch: inject at runtime, in-process, silently

The clean mechanism is an **in-process `inspector.Session`** driven from the shim. It
needs no `--inspect` flag (so no debugger-detection problem, no "Debugger listening"
chatter), no second process, and prints nothing to the terminal — which matters because
the target *is* the interactive TUI and any stray stdout/stderr corrupts its render.

Pattern (reassign a module-scoped function to wrap it):
```js
const inspector = require('inspector');
const session = new inspector.Session(); session.connect();
let armed=false, done=false;
session.on('Debugger.scriptParsed', (m) => {           // the eval'd bundle: url==='' , endLine>5000
  if (armed||done) return; const p=m.params;
  if ((p.url===''|| /bundle|node-loader/.test(p.url)) && p.endLine>5000) {
    armed=true;
    // break just inside the CJS wrapper (line 1, col past the opening brace) — the target
    // module-scoped fn is hoisted and in scope there.
    session.post('Debugger.setBreakpoint', {location:{scriptId:p.scriptId, lineNumber:1, columnNumber:WRAPCOL}}, ()=>{});
  }
});
session.on('Debugger.paused', (m) => {
  if (done) { session.post('Debugger.resume',{},()=>{}); return; }
  done=true;
  const cf=m.params.callFrames[0].callFrameId;
  session.post('Debugger.evaluateOnCallFrame',
    {callFrameId:cf, expression:REASSIGN_EXPR, returnByValue:true},
    ()=> session.post('Debugger.resume',{},()=> session.disconnect()));
});
session.post('Debugger.enable', {}, () => runBundle());   // run the wrapper AFTER arming
```
`REASSIGN_EXPR` runs in the wrapper's scope, so it can see and reassign the module-scoped
name (resolved by anchor in Step 2), e.g. wrap `getAllBaseTools` to append tools:
`var o=NAME; NAME=function(){ return o.apply(this,arguments).concat(EXTRA); };`

Rules that keep this from breaking:
- **Break *inside* the wrapper**, not at node-loader's top level — the target binding
  isn't in scope anywhere else.
- **Idempotency + a resume-always safety net.** Guard with a `__patched` flag; on any
  failure still `Debugger.resume` so the program never hangs paused.
- **Silence.** Route all diagnostics to a log file, never stdout/stderr. `console.log`
  from your patch WILL corrupt the TUI. (This is the single most common self-inflicted bug.)
- **Resolve names by anchor, not literal.** Bake the Step-2 `locate()` result into
  `REASSIGN_EXPR` so the patch survives the next release.

For a version-controlled launcher, a single `exec node node-loader.js bundle.js "$@"`
with the injection gated behind an env var is enough — one process, the TUI owns the
terminal, nothing of yours is visible.

---

## Checklist for a new release (names drifted — that's expected)

1. Re-extract `bundle-<newver>.js` (verbatim).
2. Run `locate()` / your anchors; confirm each seam resolves (log the resolved names).
   Any that fall back to the old name = an anchor to re-verify against the new structure.
3. Boot under the shim in a PTY; confirm the TUI reaches idle (~1.5s). If it stalls, diff
   the Bun-API miss log — a new boot-critical `Bun.*` may have appeared.
4. Apply the patch; verify the *effect* live (not just "the expression evaluated").
