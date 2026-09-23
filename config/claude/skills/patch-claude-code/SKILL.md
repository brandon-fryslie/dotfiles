---
name: patch-claude-code
description: How to inspect, understand, and runtime-patch the shipped Claude Code app — a Bun-compiled standalone binary whose JavaScript is minified and, since 2.1.258, code-split into ~1900 ESM chunks. Covers reading Bun's embedded module graph straight out of the installed binary, hosting that graph under node (never under Bun — node's V8 inspector is mandatory and Bun's JSC inspector is a dead end for this), anchoring seams on the property names that survive minification, and splicing changes in memory as modules are linked, without ever modifying the shipped bytes. Use when the task is to add a tool, hook a function, change behavior, or reverse-engineer any part of the Claude Code CLI binary.
---

# Inspecting & patching Claude Code

Claude Code ships as a **Bun-compiled standalone Mach-O** (`~/.local/share/claude/versions/<v>`,
the symlink target of `claude`) with its minified JavaScript embedded and no source maps.
Bun renames every module-scope binding, and the renamings **drift every weekly release**.

Three things to know before you touch anything. Two are rules that have each already
cost a day. The third is that most of this is already built.

---

## RULE 1 — The host is node. Bun's inspector is not the vehicle.

**Hard constraint, not a preference.** You read the app's module graph out of the installed
binary and run it **under node**. You do not drive the shipped Bun binary with Bun's
debugger. There is no version of the task where Bun's inspector is the right call.

Two reasons, both load-bearing:

1. **Bun offers no in-process JS injection hook for standalone binaries.** Nothing gets a
   line of your own JavaScript into that process before the app's code runs.
2. **JSC breakpoints do not bind in the startup window.** Startup is a sealed room: one
   uninterruptible synchronous stretch, and that is where the tool list is assembled. JSC
   cannot get a breakpoint in there, so there is nowhere for a Bun-hosted patch to land.

Node has neither problem. Under node you own the module loader (`vm.SourceTextModule`), so
you can splice a statement into a module's source **as it is linked** — before any of it
runs, with no debugger, no breakpoint and no paused process. That is the mechanism; see
*The injection mechanism*. And where you *do* want a debugger, node's **V8/CDP inspector is
complete**, including an in-process `inspector.Session` you drive from inside the host with
no `--inspect` flag. JSC has no equivalent of either capability here.

This route is not theoretical. The host boots the real 2.1.278 module graph under node,
makes a real API call, and prints the model's reply — see *Hosting status* for the exact
command and for the one thing that still blocks the interactive TUI.

### The three Bun env-var routes — tested, do not re-test them

| Route | What was actually observed |
| --- | --- |
| `BUN_INSPECT_PRELOAD=<file>` | **No effect** on the shipped standalone binary. Tested on 2.1.278: a preload file that wrote a marker file produced no marker — with and without `BUN_INSPECT` also set. |
| `BUN_INSPECT_CONNECT_TO=ws://host:port/path` | **Inert.** Tested: the binary never dialled out to a listening server. |
| `BUN_INSPECT=ws://127.0.0.1:PORT/path` | **The listener opens — and that is the ceiling.** Verified on 2.1.278: the process listened on the port *and* the TUI still booted normally, because the app's debugger detection reads `process.execArgv`, not this env var. Still a dead end for injection: JSC will not bind a breakpoint in the synchronous startup window where the tool list is built. |

That last row is the trap inside the trap. **An open listener is not injection.** You will
attach, you will see the target, and you will still not be able to stop the program
anywhere useful.

Be precise about what the Bun channel *does* give, so you recognise it as insufficient
rather than promising. `BUN_INSPECT` on a running session (a plain ws URL, no `?wait=1`)
supports `Runtime.evaluate` in the **global** scope — that was measured on 2.1.226: live
`process.pid`, `globalThis`, and `process.stdin.push(Buffer.from("/context\r"))` driving a
built-in command through the session's own dispatch. Global scope is also exactly the
ceiling: in that context `require`/`module` are `undefined` and the app's own state is
closure- or module-scoped, so nothing you actually need to reach is reachable. And
`?wait=1` makes it worse, not better — it freezes the process before anything is parsed,
so `Debugger.enable` yields **zero** `scriptParsed` events.

**This is not one session's opinion.** A production channel was built on `BUN_INSPECT`,
shipped, and then **deliberately removed on 2026-09-05** (`SEAMS.md`, *HISTORY — the channel
that was*): the gate no longer opens an inspector, sets `BUN_INSPECT`, or evaluates
anything in a session's global scope, because the in-memory seam reaches what the inspector
could not. The removal is the verdict. Do not re-litigate it.

### Rehearse the moment you will want to break this rule

It goes like this. You will run `file` on the binary, see a Bun executable, and think:
*"the shipped thing is Bun — using Bun's own inspector is the purer route. I'd be touching
the real shipped process instead of a node-hosted copy of its JavaScript. Node is a
reimplementation of the environment; Bun is the environment."*

That reasoning is genuinely attractive, and it is wrong, and it has now cost time twice.
Grant it its home turf — yes, fidelity to the real runtime matters, and yes, a hosted graph
runs under a shimmed `Bun`. Then fence it out: **fidelity you cannot break into is worth
nothing.** The purity argument loses on a fact, not on taste. JSC cannot break where the
patch has to land, and a high-fidelity host you cannot splice is strictly worse than a
shimmed host you can. The hosted graph, meanwhile, runs the recovered sources **verbatim** —
it is not a reimplementation of the app, only of Bun's surface around it.

The tell that you are drifting: you are reading Bun inspector documentation, you are setting
a `BUN_*` env var, or you are wondering whether a newer Bun fixed `--inspect-brk`. Stop at
the tell and go back to node.

---

## RULE 2 — Read the bytes freely; never *ship* an edit of them, and never keep a copy.

Reverse-engineering is the point: read, grep, dump, diff, annotate as much as you like.
What is forbidden is a patch that works by having modified bytes — the app's bytes on disk,
or recovered sources edited before they run. Both are the same anti-pattern: brittle,
breaks signature and version checks, and above all easy to fool yourself with. You will
believe you validated a behavior when what you actually ran was your edited copy.

The corollary matters as much and is easier to miss: **do not check an extracted copy of the
JS into a repo.** A copy is a second map of the installed binary and it starts lying the
next time the user updates — on a weekly cadence. The installed binary stays the single
source; everything else is a visibly derived read of it, in memory, nothing written to disk.
That principle is why the toolkit below parses the container instead of shipping a bundle,
and why no file in it holds a version literal or a version→offset table.

The permitted edit is an **in-memory splice at link time**, which never touches disk and is
resolved against the binary you are actually running. That is Rule 1's mechanism, and it is
the only one.

---

## START HERE — the toolkit exists. Extend it; do not rebuild it.

`~/code/cc-extra/` — the toolkit repo, `src/` plus `SEAMS.md`, every module with its own
test suite (`npm test`). It reads the installed binary's module
graph, hosts it under node, splices declared seams in memory and self-checks the boot.
Before writing a line of your own extraction, hosting or injection code, read
`src/bun-graph.js`, `src/seams.js`, the header of `src/seam-plan.js`, `src/bun-host.mjs`,
and `SEAMS.md`.

**All code for this work goes in `~/code/cc-extra`.** It lived in a plugin repo until
2026-09-22 and did not belong there; nothing about hosting or patching Claude Code is any
other repo's business, and no dependency runs between them in either direction.

| Module | Job |
| --- | --- |
| `bun-graph.js` | Reads Bun's embedded module graph from the **installed** binary, in memory. Pure parser (Buffer in, result out); one one-line edge touches the disk. |
| `embedded-fs.js` | Presents the graph as a read-only filesystem, for hosted code only — node's own `fs` is never patched. |
| `bun-surface.js` | The `globalThis.Bun` surface — 417 lines, far beyond the three boot-critical APIs. |
| `bun-runtime.mjs` | Links and evaluates the ESM graph under `vm.SourceTextModule`, and documents why node's own loader cannot. |
| `seams.js` | The anchors and the statements spliced in. The only file that knows anything about Claude Code's internals. |
| `seam-plan.js` | Resolves each seam against the whole graph to exactly one site, or refuses by name. |
| `seam-registry.js` | Holds every object the seams announced; hands back the one that provably owns a given conversation. |
| `bun-host.mjs` | The host: wires the above together and runs the app under node. |
| `boot-channel.js`, `boot-guard.js` | The line protocol the host reports on — `started`, `painted`, `absent-api <name>`, `boot-threw` — and crash naming that stops at the end of boot. |
| `SEAMS.md` | Mechanism and history — measurements, dead ends, and what each was worth. |

A launcher is not in the repo: the host writes its observations to a fd and the caller forms
the verdict. A worked one — a list of plans, keep the first that boots, stock `claude` as the
floor — is `plugins/laws/hooks/injector/launch.js` in `promptctl/laws` history, beside the one
real patch built on this route (a live craft-skill switch) and that patch's own `SEAMS.md`.

Run the graph reader against whatever is installed; it is also the launcher's self-check:

```bash
node ~/code/cc-extra/src/bun-graph.js "$(readlink -f "$(which claude)")"
```

On 2.1.278 that returns:

```json
{"ok":true,"modules":2139,"entryIndex":5,"entryName":"/$bunfs/root/cli","byLoader":{"js":1917,"file":134,"text":85,"napi":3}}
```

Anything you add — a new seam, a new tool, a new `Bun.*` member — is a value added to one of
those files, not a new apparatus beside them.

---

## Hosting status — what hosts today, and the one thing that blocks the TUI

**Read this before you plan a feature**, because it decides whether the hosted route can
deliver it at all. All of the following was verified by running the host: node 26.7.0,
`bun-host.mjs`, binary 2.1.278.

**You must pass node's `--experimental-vm-modules`.** Omit it and the only symptom is
`boot-threw vm.SourceTextModule is not a constructor`, which reads like the whole route is
broken rather than like a missing flag. Pass
`--experimental-vm-modules --disable-warning=ExperimentalWarning` every time you run
`src/bun-host.mjs`.

**Non-interactive hosting WORKS, end to end:**

```bash
node --experimental-vm-modules ~/code/cc-extra/src/bun-host.mjs \
  "$(readlink -f "$(which claude)")" -p "…" --model claude-haiku-4-5-20251001
```

That booted the real graph, made a real API call, and printed the model's reply. Boot
channel: `started` → `painted`.

**The interactive TUI hosts on 2.1.278.** Verified 2026-09-22 in a real PTY under tmux: the
trust dialog renders with wrapping and a working selector, boot channel `started` →
`painted`. It did not until `Bun.ant.CellSegmenter` existed, and that blocker is worth
knowing because its symptom names nothing: the pane simply stays empty and the process sits
there. 2.1.278's Ink renderer requires **`Bun.ant.CellSegmenter`**, from
`@anthropic-ai/bun-internal` — a **private Anthropic Bun build**. The app carries its own
error for exactly this and then swallows it:

```js
if(typeof Bun.ant?.CellSegmenter!=="function") throw Error("This build of @anthropic-ai/bun-internal has no Bun.ant.CellSegmenter; src/ink needs bun-internal >= the version pinned in package.json.")
```

It is constructed as:

```js
new Bun.ant.CellSegmenter({ambiguousIsNarrow:true, substitute, screen:{widthMask:3, narrow:0, wide:1, spacerTail:2, spacerHead:3, emptyCharIndex, spacerCharIndex, emptyWord, tabWidth}})
```

and it writes **packed cells directly into the renderer's `Int32Array` / `BigInt64Array`
screen buffer, two int32 per cell**. So standing one up was not "measure string widths" — it
was reproducing that per-cell write contract. `src/cell-segmenter.js` is the implementation;
read it before assuming a future renderer requirement is small.

The general lesson, which will cost a day the next time it is forgotten: a Bun member the
app demands inside its own `try`/`catch` fails as a HANG, not as an error. When a hosted
session paints and then stops, suspect a swallowed absence before you suspect the route.

### Reading the boot channel — the primary "why didn't it boot" diagnostic

`bun-host.mjs` writes to the fd named by `CC_EXTRA_BOOT_FD` (default 2), with records
separated by `\036`. To read it:

```bash
tr '\036' '\n' < err
```

Lines you will see: `started`, `painted`, `absent-api <name>`, `boot-threw <name>: <reason>`,
`absent <reason>`. Read this before theorising — it usually names the cause outright.

---

## The container format: Bun's own module table

This is why chunk name → content is **exact and complete, not inferred**. Bun appends a
module blob plus a module table to the executable, then a 32-byte offsets struct, then the
trailer. `bun-graph.js` parses it; read this so you understand what it hands you.

- **Trailer** `\n---- Bun! ----\n`. On macOS the Mach-O code signature follows it, so **the
  LAST occurrence is the real one.**
- **Offsets struct**, the 32 bytes immediately before the trailer. Fields read: `byteCount`
  u64 at +0, `modulesOffset` u32 at +8, `modulesLength` u32 at +12, `entryPointId` u32 at
  +16. The blob starts at `offsetsStructStart - byteCount`, and **every pointer in the table
  is relative to the blob start.**
- **Module table rows are 52 bytes**: `nameOffset` u32 at +0, `nameLength` u32 at +4,
  `contentsOffset` u32 at +8, `contentsLength` u32 at +12, `encoding` u8 at +48, `loader`
  u8 at +49.
- **Encodings**: 0 binary, 1 utf8, 2 utf16le. **Loaders**: 1 js, 5 file, 10 napi, 13 text.
- Module names are rooted at `/$bunfs/`. A row whose name is not a virtual path means the
  table was not where you thought it was.
- **The table names the entry point by index**, so nothing has to guess it or scan for it —
  which matters, because that name has already changed once (`/$bunfs/root/src/entrypoints/cli.js`
  → `/$bunfs/root/cli`).

What you get back per module is its `name`, `loader`, `encoding`, `offset`, `length`, and
`bytes()` / `text()` accessors — so "extracting the sources" is reading `text()` off the js
modules, in memory. The CLI deliberately prints a **summary only** (32 MB on stdout serves
nobody), so call the module API rather than expecting sources from the command line.

Three consequences worth stating plainly. Each row declares its own encoding and loader, so
nothing downstream sniffs bytes to decide how to decode a module or what it is. The only
thing coupled here is **Bun's** container format, which changes when Bun changes rather than
when Claude ships weekly. And the parse is provably right rather than plausible: one code
path reads 2.1.226 (14 modules, entry id 0) and 2.1.258 (1,818 modules, entry id 5), and the
2.1.226 bounds it reports are byte-identical both to the old delimiter scan's and to what
`Debugger.getScriptSource` returns from a live session.

### DEAD — the NUL-delimited record scan

2.1.226 embedded its JavaScript as **one CommonJS module**, recoverable by scanning for
`\0<path>\0<contents>` records. That is dead. From 2.1.258 a module's NAME and its CONTENTS
are **no longer adjacent in the file** (names near 69.8M, contents near 156M–188M), so the
scan has nothing to key on and returns `no-contents-record-for-path`. Parse the table.

### TRAP — the CJS-wrapper grep lies in a code-split build

Grepping the 2.1.278 binary for `(function(exports, require, module, __filename, __dirname) {`
finds **exactly 2 hits, around offset 59,603,527** — and those are **Bun's own Rust banner
templates**, not the app payload. Anchor on them and you will conclude the single-bundle
shape is still there and hunt a wrapper that does not exist. **In a code-split build there is
no single CJS wrapper for the app.** Determine the shape from the module table, or from the
presence of `/$bunfs/root/chunk-` imports — never from a wrapper-string hit.

---

## The two build shapes

**Single CJS module** (2.1.197, 2.1.226). One giant minified payload, CJS-wrapped: everything
module-scoped lives in one closure, and you can only reassign a binding from a frame inside
it.

**Code-split ESM** (2.1.258, 2.1.278). ~1,900 js modules: one entry plus code-split chunks.
Modules reference each other by absolute virtual path:

- static import: `import{Ce,Qn}from"/$bunfs/root/chunk-sz7tjnzh.js"`
- eager cross-chunk access: `import.meta.require("/$bunfs/root/chunk-xxxx.js").ExportName`
- lazy load: `load:()=>import("/$bunfs/root/chunk-xxxx.js")`

Chunk names are `chunk-` + 8 lowercase alphanumeric characters + `.js`. Each module source
opens with a `// @bun @bytecode` banner, the Anthropic legal header, and a `// Version: <ver>`
line — the banner heads **many** modules, not just the entry, so it is not an entrypoint
anchor.

Landmarks in the 2.1.278 binary (217,695,408 bytes, Mach-O arm64), **approximate and to be
re-derived per release** — these are landmarks, not constants: compiled bytecode plus
symbol/string tables around **67–80 MB**; plaintext minified ESM module sources from about
**166.5 MB to about 203 MB**; the trailer near **217,052,039**, followed by the code
signature. Those figures are for human orientation while you read the binary by hand.
**Nothing should ever parse by them** — that is what the module table is for, and a
{version: offset} table is the thing this whole approach exists to avoid.

**Chunk names are content hashes.** They change every release. A chunk name never belongs in
a seam, a script, or a note — which module carries a thing is an **answer**, not an input.

---

## Anchoring: property names survive minification

This is the single most important anchoring rule, and it is the reason this whole approach
holds across weekly releases without a hand-maintained table.

**Bun renames every module-scope binding, but it cannot rename a PROPERTY** without proving
nothing reaches it dynamically. Method names, field names and object keys come through
minification **verbatim**. The class holding the conversation is `A3`; the accessor that
reaches it is two letters; `rewindConversationTo` is spelled out in full.

So anchor on a property name — never on an offset, a variable, or a line number.
`options.toolCatalog.getAllBaseTools()`, `isEnabled`, `create`, `call`, `inputSchema`,
`argumentHint`, `supportsNonInteractive`, `restoreMessageSync` are all readable and stable.
Measured across all 1,818 modules of 2.1.258: `rewindConversationTo(` occurs **once**,
`restoreMessageSync=(` occurs **once**, 1,788 characters apart with no intervening `class`
— so they are provably in the same class body — and resolving both takes **20 ms**.

### Facade chunks hand you a minified→semantic name map for free

Many chunks are pure re-export barrels whose `export{...}` statement is an **unminified name
map**:

```js
export{tFe as isBridgeSafeCommand,cXn as toBridgeSlashCommands,Nv as getSkillToolCommands,lae as getSlashCommandToolSkills,Lc as isCommandEnabled}
```

Harvest every `export{...}` across the graph and you have **ground-truth names for a large
part of the app with zero inference**. Do this **before** writing any structural regex: a
fingerprint is a guess that survives minification, an export map is the compiler telling you
the answer.

### Fall back to literals and structure for what that misses

For the rest — and for the single-CJS shape, which has no facades — anchor on what survives
byte-for-byte:

1. **String / regex / number literals.** `"Free up context by summarizing the conversation
   so far"`, the telemetry event `"tengu_input_slash_missing"`, the regex `/--inspect(-brk)?/`.
   Find the literal; the enclosing or nearby function is your seam.
2. **Structural fingerprints.** Shape is stable when names are not — e.g. `getAllBaseTools`
   is the no-arg function whose result is `.map((n)=>n.isEnabled())`-ed:
   `/(\w+)\(\),\w+=\w+\.map\(\(\w+\)=>\w+\.isEnabled\(\)\)/`.
3. **Object-shape fingerprints.** A "command" is `type:"local"|"local-jsx"` + `name` +
   `description`. A "tool" carries `isEnabled` / `create` / `call` / `inputSchema` (see *The
   tool contract*).

When you must resolve a mangled name in a script, write the anchor as a regex with a fallback
to the last-known name **and log what resolved** — a silent fallback to the old name is the
failure mode you are logging against.

### The two correctness traps (both have cost real time)

- **Mangled names are scope-local, not global.** `v4` was `getAllBaseTools` in one module
  *and* `uuid.v4()` in a vendored AWS SDK in the same payload. **Never global-string-replace
  a mangled name.** Anchor to the specific site, and key any minified→human map by
  **(scope, symbol)**, never the bare name.
- **One name, two definitions.** `/goal` and `/mcp` each have BOTH a `type:"local"` and a
  `type:"local-jsx"` object under the same `name:`. Disambiguate by `type` or structure, or
  you will patch the one nobody uses.

Confirm any seam empirically before building on it. Never trust a guess about a seam you have
not watched execute.

---

## The injection mechanism: an in-memory source seam

Not a breakpoint. A seam is a declared fragment of the app's own source plus a statement to
splice in front of it, applied **in memory as the module is linked**. Nothing on disk is
edited, so this is not Rule 2's disqualified path.

A seam, from `seams.js`:

```js
{
  name: 'controller',
  // The lookbehind excludes `this.restoreMessageSync`, `au.restoreMessageSync` and the
  // `restoreMessageSync:` property in a props object, leaving only the field declaration.
  anchor: /(?<![.\w$])restoreMessageSync\s*=\s*(?=\()/,
  insert: `__lawsSeam=globalThis.__LAWS_SEAM__.controller(this);`,
}
```

Five rules make it hold. Each one is there because the alternative fails quietly.

- **Anchor on a property name.** See the section above. No chunk name and no version literal
  ever appears in a seam.
- **Resolution is eager and whole-graph, and must match EXACTLY ONCE** — one module, one
  offset. That is not knowable while transforming module-by-module on demand, so the whole
  graph is resolved before anything is compiled. Zero matches, several modules, and several
  sites within one module are three distinct named refusals: `no-module-carries-the-seam`,
  `several-modules-carry-the-seam`, `seam-matches-more-than-once-in-its-module`. **A seam that
  resolved to the wrong place is worse than one that did not resolve, because the first still
  runs.**
- **Splice highest offset first.** Front-to-back shifts every later index by the length of
  every earlier insertion — a plan that is right about the first seam and wrong about the rest.
- **What you splice in is a call handing the live object to a registrar global**
  (`__LAWS_SEAM__`), installed by the host before any module is evaluated. That is how you
  reach an object the graph never exports, with no inspector, no breakpoint, and no paused
  process. Deliberately **not** `globalThis.__LAWS_SEAM__?.controller(this)`: the registrar
  cannot be absent by construction, and an optional call would convert "the injector is
  broken" into a session that looks fine and silently does nothing.
- **Anchor on a class FIELD, not a method, when you need the object early.** A field
  initializer runs at construction with `this` bound to the instance. A method body only runs
  if the user happens to trigger it — by which point it is far too late to have been told
  about the object. Generalise that: pick the site whose *execution time* is when you need
  the value, not merely the site that mentions it.

Drift then shows up as a **boot refusal with a named reason plus a fallback to stock
`claude`** — never as silent misbehaviour. That is the whole safety property: a user who opts
into a hosted session must never end up with a broken one.

Two things the registrar taught, worth carrying: the seam fires for **every** instance the app
builds, not just the main REPL's, so a registry holds all of them and the caller says which
one it means (by a message uuid the live store provably contains) rather than the registry
guessing "the last one". And a transform applied to **every** module — byte-identical back
when there is no seam — keeps the variability in the plan's data instead of in a branch at
the callsite.

---

## Hosting the graph under node

`bun-host.mjs` is the wiring; the pieces with logic have their own suites. What you need to
know to extend it:

**Node's own ESM loader cannot host this graph.** Bun's chunks call
`import.meta.require("/$bunfs/root/chunk-*.js")` — a **synchronous, lazy** require between ES
modules that returns a live namespace even when the target is mid-evaluation. Two plausible
designs were measured and failed: node's `require(esm)` refuses to link a module whose graph
touches one currently evaluating (`ERR_REQUIRE_CYCLE_MODULE`), and rewriting those callsites
into static imports creates cycles the real graph never had, which break on TDZ. What works
is **`vm.SourceTextModule`** in `bun-runtime.mjs`: it links the graph itself, hands out a
namespace on demand exactly as Bun does, and lets `import.meta` be populated directly — so
the recovered sources run **verbatim**, with no rewriting step anywhere.

`import.meta.require` is synchronous, so a module can only be required on demand if it is
already linked; the host therefore links **every** js module up front in one unconditional
pass. Cost, measured on 2.1.258: ~800 ms to link 1,640 modules, ~700 ms more to first frame.

**The `Bun` surface doctrine: every member is either a real implementation or absent.** A
present-but-wrong stub keeps the process alive while corrupting what it touched, and is
invisible; an absent member is recorded by name and reaches the launcher. Members the graph
never uses were deleted rather than kept as plausible placeholders. Concretely:

- **Three APIs are boot-critical.** Without real implementations the TUI crashes during its
  first render — a swallowed `TypeError: …reading 'length'` that presents as a hang:
  `Bun.semver` (`.order` / `.satisfies`, ~355×/boot), `Bun.stripANSI`, `Bun.wrapAnsi`. A stub
  that returns `undefined` is the trap: it converts a clean failure into a mystery several
  frames downstream.
- **The doctrine applies one level down, into namespaces.** 2.1.270 calls
  `Bun.unsafe.setJITPolicy?.(1)` when the message loop starts and on a 10 s timer — the `?.`
  guards a missing `setJITPolicy`, not a missing `Bun.unsafe`, so a hosted session died on its
  first turn. Absences are recorded by dotted name (`unsafe.setJITPolicy`) so an empty
  namespace still reads as absence.
- A `Bun.*` the app already wraps in `try` or behind an `in` check is a graceful-degradation
  hook, and letting it be absent there is correct.

### The known gaps on 2.1.278, and which `absent-api` lines actually matter

Most `absent-api` lines are harmless. Two are not, and knowing the difference is the
difference between reading a boot log and guessing at one.

- **`Bun.ant.CellSegmenter` — fatal, and it blocks the interactive TUI.** See *Hosting
  status*.
- **`Bun.YAML` — missing from the surface, and 2.1.278 needs it.** `Bun.YAML.parse` /
  `Bun.YAML.stringify` read skill and command **frontmatter**, which happens during boot. The
  surface reports `absent-api YAML`, and being absent it returns `undefined` — precisely the
  trap the doctrine above warns about. Supplying a YAML namespace clears the report (verified
  by backing it with js-yaml in a scratch copy, for the experiment only). Which
  implementation belongs in the shipped surface is a decision for that repo's owner, so treat
  this as a **known gap plus what it needs**, not as a merged fix.
- **`Bun.ant` is an Anthropic-private namespace, not public Bun.** Members seen:
  `CellSegmenter`, `getPeerPid`, `getPeerUid` (daemon peer credentials),
  `memoryPressureLevel`, `waitForUrlEvent`. **Every one except `CellSegmenter` is called
  inside try/catch or behind a `typeof` / platform guard**, so they are safely absent — which
  is why `absent-api ant` on its own is not the problem.

**Census of every `Bun.*` the 2.1.278 graph touches** — the checklist to re-run when a
release adds an API. Counts are occurrences across all js modules:

| Count | Members |
| --- | --- |
| 11 | `hash` |
| 8 | `ant` |
| 6 | `spawn` |
| 5 | `sliceAnsi` |
| 4 | `unsafe`, `serve` |
| 3 | `wrapAnsi`, `which`, `stdin`, `Image` |
| 2 | `YAML`, `Terminal`, `semver`, `listen`, `deepEquals`, `connect` |
| 1 | `zstdDecompressSync`, `zstdDecompress`, `WebView`, `version`, `Transpiler`, `TOML`, `stripANSI`, `stringWidth`, `SQL`, `sleepSync`, `JSONL`, `isStandaloneExecutable`, `generateHeapSnapshot`, `gc`, `file` |

`Bun.JSONL`, `Bun.TOML`, `Bun.SQL`, `Bun.Image`, `Bun.WebView`, `Bun.Terminal` and
`Bun.sliceAnsi` are the APIs a future surface may need.

**The boot self-check: observations in the host, the verdict in the launcher.** The host
reports only what it can see — `painted` the first time the hosted graph writes to the
terminal, a named refusal, `absent-api <name>` lines as they occur — and forms no verdict.
`launch.js` owns the clock, because the two failures that matter are invisible from inside: a
hang, and the louder cousin where the app prints a notice and then dies. **The first byte on
stdout is not sufficient evidence of a session** — removing `Bun.stripANSI` let the app print
a pre-flight renderer notice and *then* die, and byte-watching called that booted. So a plan
becomes the session only if it painted **and** was still there a settle window later; the
launcher runs a list of plans and keeps the first that boots, with stock `claude` as the floor.

**Absolute silence on inherited stdout/stderr.** The target *is* the interactive TUI, and a
single stray write corrupts its render. The host reports on a separate boot-channel fd for
exactly this reason. Every diagnostic of yours goes to that channel or a log file — never to
the terminal.

**Verify a TUI boot in a real PTY** (`tmux -L <priv-socket>`, or `script -q /dev/null claude`),
never a pipe — the TUI needs a TTY. A non-interactive `-p` run needs none of this, which is
part of why it is the case that hosts today. On **2.1.258**, in a real PTY under tmux, the
launcher boots the hosted graph to an idle authenticated TUI, and with `Bun.stripANSI`
deliberately removed it detects not-booted and falls back to stock `claude` with a named
reason and no hang. On **2.1.278** the same PTY run paints and then hangs, for the
`CellSegmenter` reason in *Hosting status*.

Two cautions when you run those tests:

- **Never `tmux kill-server`.** It is hook-blocked on this machine and would destroy every
  session anyway. `unset TMUX` first, use an isolated `-L <socket>` with a short
  `TMUX_TMPDIR`, and `kill-session -t <name>` only.
- The app persists a `fullscreenAutoDisabled` flag in `~/.claude.json` when its renderer
  fails to start, so a live break test mutates the user's config and must be cleaned up
  afterwards.

### `inspector.Session` — for a single-bundle build, or for live inspection

Still useful, no longer the primary mechanism. It is the right tool when you are hosting the
**single-CJS** shape, or when you want to read live values rather than change behavior. Its
virtue is that it needs no `--inspect` flag, so no debugger-detection problem and no
"Debugger listening" chatter.

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
session.post('Debugger.enable', {}, () => runBundle());   // run the payload AFTER arming
```

Rules, if you use it: **break inside the scope that holds the binding** (module-scoped names
are invisible from the host's top level); keep an **idempotency guard plus a resume-always
safety net**, so a thrown expression never leaves the program hanging paused; **silence**, as
above — a `console.log` from your patch will corrupt the TUI and present as a rendering
glitch rather than as your bug; and resolve names by anchor, not literal.

One more, if you ever launch with `node --inspect-brk`: **Claude detects a debugger and kills
its own TUI.** A function in the app (`i3f` in 2.1.197) checks `process.execArgv` /
`NODE_OPTIONS` for `--inspect*` and, finding one, never sets up the interactive UI; the
process then quietly exits. Scrub the flag before the app runs:

```js
process.execArgv = (process.execArgv||[]).filter(a => !/--inspect|--debug/.test(a));
```

The 2.1.197-era prototype of the single-bundle host lives in
`~/code/cc-source-study/research/cli-tools-patch/` (`node-loader.js`, `run-injected.js`,
`launch-injected.sh`, `NODE-BUN-SHIM-API-SURFACE.md`). Read it as history; the injector
directory is the live code.

---

## The tool contract — use the shipped factory, don't hand-roll an object

Older material in this area built a tool as a ~20-property object literal (`{name,
inputSchema:{safeParse…}, inputJSONSchema, isEnabled, isConcurrencySafe, checkPermissions,
prompt, description, mapToolResultToToolResultBlockParam, call}`). **On 2.1.278 that is the
wrong shape**, and it is a second definition of "what a tool is" that drifts every release.
Use the shipped factory — one source of truth, maintained by the people shipping the app.

Tools are built by a factory, minified `Tt` in 2.1.278:

```js
SomeTool = Tt({
  name, aliases, searchHint, backgrounding, maxResultSizeChars, userFacingName,
  get inputSchema(){…}, get outputSchema(){…},
  shouldDefer, isEnabled(){…}, isConcurrencySafe(){…}, isReadOnly(){…},
  toAutoClassifierInput(e){…},
  async description(){…}, async prompt(){…},
  renderToolUseMessage(e){…},
  create(ctx){ return { async call(input){ … return {data:…} } } },
  mapToolResultToToolResultBlockParam(out,id){…}
})
```

The factory supplies defaults, so a spec really only needs `name`, `inputSchema`, `create`,
and the description/prompt text. Defaults: `isEnabled:()=>true`,
`isConcurrencySafe:()=>false`, `isReadOnly:()=>false`, `isDestructive:()=>false`,
`remoteExecution:{supported:false}`, `toAutoClassifierInput:()=>""`, `userFacingName:()=>""`.

`create(ctx)` receives a **narrowed tool context**, not raw app state: a large object of
getters exposing things like `messageQueue`, `toolState`, `permissions()`, `messages()`,
`appendSystemMessage`, `requestDialog`, `todos`, `markEndedByModel`, `agentId`, `storageV5`.

**TRAP for anyone wrapping an existing tool: the returned object closes over the original
spec.** Reassigning `tool.create` on the returned object has **no effect** — the factory
captured `spec.create` at construction time. Your patch applies cleanly, reports success, and
changes nothing. Mutable-in-practice members on the returned object are things like
`isEnabled` and the description / prompt / schema members. To change call behavior, replace
`tool.call` itself, or splice the spec before the factory runs.

---

## The tool-list seam — one wrong choice here silently does nothing

- **`getAllBaseTools`** (minified `GP` in 2.1.278) returns a static array of tool-object
  references. This is the base list.
- **`getTools`** (minified `tx`) calls **`GP()` directly, as a module-scoped binding**, then
  filters: drops a few names, applies permission filtering, and keeps only tools whose
  `isEnabled()` returns true.
- The **catalog** is `{getAllBaseTools, getTools, assembleToolPool}` (minified `hV`), passed
  around as `options.toolCatalog`.

**The expensive consequence: mutating `catalog.getAllBaseTools` does NOT change the main
session's offered tools.** `getTools` calls the binding `GP`, not the catalog property. The
property feeds *other* consumers — system-prompt tool descriptions, unknown-tool error paths
— and subagent pools go through `options.toolCatalog.assembleToolPool(...)`. Patch the
property and everything succeeds: no exception, no warning, no new tool. To affect the main
session, reach the binding — which is what a source seam is for.

**Timing.** The main session's `options.tools` is computed **once** during startup (the
tools/commands load step calls `getTools`). An injected tool must be in place **before**
that, or you must patch the live `options.tools` array instead. Subagent and task pools
re-assemble per spawn, so they pick up catalog-level changes.

---

## Worked example — exposing `/goal` to the model (2.1.278)

This is the example that paid for this document. Read it as a demonstration of the method.

**Two command objects share the name `/goal`.** One `type:"local-jsx"` interactive
(`description:"Set a goal Claude checks before stopping"`,
`argumentHint:"[<condition> | clear]"`), and one `type:"local"` non-interactive
(`supportsNonInteractive:true`, `thinClientDispatch:"post-text"`, `description:"Set a goal —
keep working until the condition is met"`).

**Session-shape gates.** `Ce()` = `!launchOptions.isInteractive()` (true when
NON-interactive); `Qn()` = `surfaceCapabilities.caps().workspace==="remote"`. The `local`
`/goal` is enabled only when `Ce()||Qn()`; the model-facing tool below is enabled only when
`!(Ce()||Qn())`. They are deliberately mutually exclusive.

**A shipped model-facing goal tool already exists.** `ProposeGoalTool`, `name:"ProposeGoal"`,
condition capped at 500 chars. It is **already in `getAllBaseTools()`'s array
unconditionally** and is excluded only by its own `isEnabled()`. On a normal interactive local
session that `isEnabled()` returns false for exactly one reason — a server-side feature gate,
`P("tengu_propose_goal", false)`. Every other condition passes. **Look for the shipped
implementation before building one**: this seam was a gate, not a missing feature.

**How it runs the command — enqueue; do not call the dispatcher.** The tool does
`recordQueuedGoalOrigin(condition, "proposal_direct")` and then:

```js
messageQueue.enqueue({agentId, mode:"prompt", value:`/goal ${condition}`, origin:{kind:"task-notification"}})
```

Enqueueing the command as a prompt **is** the shipped way a tool causes a slash command to
run. It returns immediately, which also sidesteps the known deadlock where a tool `call()`
that awaits an interactive command never resolves. Do not try to call `processSlashCommand`
from a tool: it now takes ~16 arguments and is far too brittle to fabricate a call to.

**Approval behavior.** With the `modelProposedGoals` setting at its default `"auto"`, passing
`ask_user:false` sets the goal **directly, with no approval dialog**. `"alwaysAsk"` forces the
dialog; `"disabled"` refuses.

### Why configuration cannot enable that gate

Recorded so nobody spends an afternoon retrying it. Feature-value resolution order is:
environment overrides → config overrides → remote payload → disk cache → default.

- **Both override channels are compiled out of shipped builds**:
  `getEnvironmentOverrides(){return null}`, `readConfigOverrides(){return}`,
  `setConfigOverride(){return}`.
- **If the remote GrowthBook payload is non-empty but lacks the key, the function returns the
  DEFAULT and skips the disk cache entirely.** The disk cache (`cachedGrowthBookFeatures` in
  `~/.claude.json`) is consulted only when the remote payload is empty.
- Related env vars seen: `DISABLE_GROWTHBOOK`, `CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF`.
- Hand-seeding `cachedGrowthBookFeatures` makes you a **second writer to a file the gate
  client owns and periodically overwrites**. Even when it appears to work, it is a race you
  lose on a schedule you do not control.

The gate is a runtime value. Change it at runtime, through the mechanism in this skill.

---

## Per-release checklist

Names drift every release. That is expected; the anchors are how you absorb it.

1. **Read the graph from the installed binary** —
   `node bun-graph.js "$(readlink -f "$(which claude)")"`. A named absence here means Bun's
   container format moved; that is a `bun-graph.js` change, not a per-version table.
2. **Never write the sources to disk and never check a copy in.** The binary is the single
   source; the graph is a derived read of it.
3. **Harvest the export maps first** — every `export{...}` across the graph — then fill gaps
   with property, literal and structural anchors. No chunk name, no version literal.
4. **Let seam resolution prove itself.** Every seam must resolve to exactly one module at one
   offset. Zero matches, several modules and several sites are distinct named refusals; read
   the reason rather than loosening the anchor until something matches.
5. **Boot in a real PTY, under node.** If it stalls, read the `absent-api` lines — a new
   boot-critical `Bun.*` (or a new member inside a namespace) may have appeared. Still node;
   still not Bun's inspector. The three env-var routes in Rule 1 are dead in every release
   tested, and a new release is not a reason to re-test them.
6. **Verify the effect live** — the tool actually offered, the behavior actually changed. "The
   seam resolved" is not verification, and both the `catalog.getAllBaseTools` and the
   captured-`create` traps succeed perfectly while doing nothing.
