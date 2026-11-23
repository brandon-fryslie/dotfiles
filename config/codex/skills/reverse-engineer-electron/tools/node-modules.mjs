//
// node-modules.mjs — an app's node_modules as detect-dependencies and replace-dependency both read it: what a path
// holds once node follows its links, the packages its top level offers, and where (and whether) a package can be
// swapped.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Whether a package can be trialed is swapOutcome's answer and no one
// else's: replace-dependency trials exactly the outcomes that are trialable, and detect-dependencies reports every other
// one with the reason the outcome carries, so the report and the swap tool can't disagree about any layout.

import fs from "fs";
import path from "path";
import { isLocation } from "./replacement-log.mjs";

export function pkgPathParts(name) {
  return name.startsWith("@") && name.includes("/") ? name.split("/") : [name];
}

// What a path holds once node follows its links: a directory, a file, a link leading nowhere, a path it can't stat
// (with the error code, e.g. EACCES or ELOOP), or nothing at all. A directory is one whatever its read bit says: node
// loads a package through a directory it may search but not list, so whether it can be listed is listDir's question.
export function pathState(p) {
  try {
    if (!fs.lstatSync(p, { throwIfNoEntry: false })) return { kind: "absent" };
    const stat = fs.statSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "dangling", target: fs.readlinkSync(p) };
    return { kind: stat.isDirectory() ? "dir" : "file" };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

// A directory's entries, or the error code that kept them from being read.
export function listDir(dir) {
  try {
    return { kind: "listed", entries: fs.readdirSync(dir, { withFileTypes: true }) };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unlistable", code: error.code };
  }
}

// [LAW:types-are-the-program] Each state that is not a package, and the one field that says why, so a reason built
// from a state names the cause it holds and a state with no entry here is an error, not a reason with a gap in it.
const STATE_DETAIL = { absent: null, file: null, "no-manifest": null, dangling: "target", unreadable: "code", "unusable-manifest": "reason" };

export function stateText(state) {
  if (!Object.hasOwn(STATE_DETAIL, state.kind)) throw new Error(`a ${state.kind} state has no reason text`);
  const field = STATE_DETAIL[state.kind];
  return field === null ? state.kind : `${state.kind}:${state[field]}`;
}

const isNonEmptyString = (value) => typeof value === "string" && value !== "";

// What a path holds as a package: the name and version its package.json gives, or, when it holds none, the path's
// own state, a directory with no package.json, or a package.json that can't be read or lacks a name or version.
export function packageAt(dir) {
  const state = pathState(dir);
  if (state.kind !== "dir") return state;
  let text;
  try {
    text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "no-manifest" };
    if (typeof error.code !== "string") throw error;
    return { kind: "unusable-manifest", reason: error.code };
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    return { kind: "unusable-manifest", reason: `invalid-json (${error.message})` };
  }
  if (!isNonEmptyString(manifest?.name) || !isNonEmptyString(manifest?.version)) return { kind: "unusable-manifest", reason: "no-name-or-version" };
  return { kind: "package", name: manifest.name, version: manifest.version };
}

// The names an app loads from its node_modules top level: node_modules/<name> and node_modules/@scope/<name>, the way
// node resolves them, through links, and each directory of them that can't be listed (node_modules or a scope), whose
// packages no one can name. A scope that is not a directory is an entry under its own name, so its state is reported
// rather than lost. Dot entries (.bin, .pnpm, .original, .package-lock.json) are tooling.
export function topLevelEntries(nodeModules) {
  const listing = (dir) => {
    const listed = listDir(dir);
    return listed.kind === "listed"
      ? { names: listed.entries.map((entry) => entry.name).filter((name) => !name.startsWith(".")).sort(), unlisted: [] }
      : { names: [], unlisted: [{ dir, code: listed.code }] };
  };
  const top = listing(nodeModules);
  const parts = top.names.map((name) => {
    const dir = path.join(nodeModules, name);
    if (!name.startsWith("@") || pathState(dir).kind !== "dir") return { names: [name], unlisted: [] };
    const scope = listing(dir);
    return { names: scope.names.map((child) => `${name}/${child}`), unlisted: scope.unlisted };
  });
  return { names: parts.flatMap((part) => part.names), unlisted: [...top.unlisted, ...parts.flatMap((part) => part.unlisted)] };
}

// What sits at a package's path in the app, without following it: nothing, a directory, or a symlink with its
// readlink text.
export function appPathState(appPkgDir) {
  const stat = fs.lstatSync(appPkgDir, { throwIfNoEntry: false });
  if (!stat) return { kind: "absent" };
  if (stat.isSymbolicLink()) return { kind: "link", target: fs.readlinkSync(appPkgDir) };
  return { kind: "dir" };
}

// An entry path in canonical form: its parent directories resolved through symlinks as far as they exist, so --app-dir
// and cwd naming one tree through different symlinked prefixes (/var vs /private/var on macOS) agree, and a path into
// a root scope nothing has been installed into yet still compares. The entry itself stays unresolved, so a workspace
// or npm-link entry keeps its indirection and a link left dangling by a removed root package is still recognised.
export function canonicalEntry(entryPath) {
  return path.join(realExisting(path.dirname(entryPath)), path.basename(entryPath));
}

export function realExisting(dir) {
  return fs.existsSync(dir) ? fs.realpathSync(dir) : path.join(realExisting(path.dirname(dir)), path.basename(dir));
}

// Where a symlink at appPkgDir with this readlink text leads: a relative target resolves from the link's real directory.
export function linkDestination(appPkgDir, target) {
  return canonicalEntry(path.resolve(fs.realpathSync(path.dirname(appPkgDir)), target));
}

// [LAW:single-enforcer] The one constructor of a location, the form replacement-log.mjs parses: the path from a
// node_modules directory to a package in it, spelled from the app's node_modules. A package's own app path is its name
// under the app's node_modules, whatever its parents link to; a link's destination is a canonical path, measured
// from the app's real node_modules, so an app whose node_modules is itself a symlink still writes one.
export function locationOf(nodeModules, dir) {
  const location = ["node_modules", ...path.relative(nodeModules, dir).split(path.sep)].join("/");
  if (!isLocation(location)) throw new Error(`${dir} is not inside ${nodeModules}`);
  return location;
}

// [LAW:single-enforcer] The one constructor of the app every location is measured in: its node_modules as named, and
// that directory's real path, which every inside-the-app check compares canonical paths against.
export function appAt(nodeModules) {
  return { nodeModules, realNodeModules: fs.realpathSync(nodeModules) };
}

export function locationDir(app, location) {
  return path.join(app.nodeModules, ...location.split("/").slice(1));
}

const isInside = (app, entryPath) => entryPath.startsWith(`${app.realNodeModules}${path.sep}`);

// What sits at a location without following it, a path it can't lstat included.
function entryAt(dir) {
  try {
    return appPathState(dir);
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

// [LAW:one-source-of-truth] The swap location: where every consumer of the app's copy loads it through. It is the app
// path, followed through each link to another location of the same package inside the app's node_modules, so for a
// pnpm layout, whose top-level link and .pnpm siblings all lead to one store copy, it is that copy's location. A link
// leading anywhere else (out of the app's node_modules, as a workspace package or our link to the root does, or to
// another package) is itself the swap location. Links that lead back into the chain are a loop, named by the chain.
function findSwapLocation(app, pkgName) {
  const tail = `${path.sep}${path.join("node_modules", ...pkgPathParts(pkgName))}`;
  const chain = [locationOf(app.nodeModules, path.join(app.nodeModules, ...pkgPathParts(pkgName)))];
  for (;;) {
    const dir = locationDir(app, chain.at(-1));
    const entry = entryAt(dir);
    const next = entry.kind === "link" ? linkDestination(dir, entry.target) : null;
    if (next === null || !isInside(app, next) || !next.endsWith(tail)) return { kind: "location", location: chain.at(-1) };
    const nextLocation = locationOf(app.realNodeModules, next);
    if (chain.includes(nextLocation)) return { kind: "loop", chain: [...chain, nextLocation] };
    chain.push(nextLocation);
  }
}

// [LAW:types-are-the-program] Whether, and where, replace-dependency can swap the app's copy of a package. Every
// outcome names the swap location (for a loop, the app path the loop starts from), what it holds, and whether the app
// owns it: a location past a link out of the app's real node_modules (a scope linked to a workspace's own) holds files
// nothing may move. An outcome is trialable when the app owns a location holding pkgName itself; any other carries the
// reason it isn't, in the order replace-dependency would hit them:
//   loop:<chain>                the links loop, so no copy loads
//   outside-app:<location>      the app doesn't own the location
//   not-a-package:<state>       the location holds no usable package.json
//   alias-of:<name>             the location holds another package (an npm alias), which npm can't install by the load name
export function swapOutcome(app, pkgName) {
  const swap = findSwapLocation(app, pkgName);
  const location = swap.kind === "loop" ? swap.chain[0] : swap.location;
  const dir = locationDir(app, location);
  const holds = packageAt(dir);
  const appOwns = isInside(app, canonicalEntry(dir));
  const reason = swap.kind === "loop" ? `loop:${swap.chain.join(" -> ")}`
    : !appOwns ? `outside-app:${location}`
    : holds.kind !== "package" ? `not-a-package:${stateText(holds)}`
    : holds.name !== pkgName ? `alias-of:${holds.name}`
    : null;
  return reason === null ? { trialable: true, location, holds, appOwns } : { trialable: false, reason, location, holds, appOwns };
}
