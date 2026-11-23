//
// node-modules.mjs — an app's node_modules as detect-dependencies and replace-dependency both read it: what a path
// holds once node follows its links, every copy of every package node can load from it, where (and whether) each copy
// can be swapped, and where the project installs a copy's replacement.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Whether a copy can be trialed is swapOutcome's answer and no one
// else's: replace-dependency trials exactly the copies whose outcome is trialable, and detect-dependencies reports every
// other one with the reason the outcome carries, so the report and the swap tool can't disagree about any layout.

import fs from "fs";
import path from "path";

// A location is a package's path relative to the app dir, as npm's lockfile spells one: node_modules/foo, or
// node_modules/.pnpm/foo@1.0.0/node_modules/foo. It ends in an entry name after its last node_modules: a name, or a
// scope and a name (a scope that holds no packages is an entry under its own name). replacement-log.mjs parses the
// locations a log stores with it.
export function isLocation(value) {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  const entry = parts.slice(parts.lastIndexOf("node_modules") + 1);
  const entryName = entry.length === 1 || (entry.length === 2 && entry[0].startsWith("@"));
  return parts[0] === "node_modules" && entryName && parts.every((part) => part !== "" && part !== "." && part !== "..") && !entry.some((part) => part.startsWith("."));
}

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

export const isNonEmptyString = (value) => typeof value === "string" && value !== "";

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
// node resolves them, through links, and each directory of them that can't be listed (node_modules, or a scope that
// can't be listed or even stat'd), whose packages no one can name. A scope that is a file or a dangling link holds no
// packages, so it is an entry under its own name and its state is reported. Dot entries (.bin, .pnpm, .original,
// .package-lock.json) are tooling.
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
    const state = name.startsWith("@") ? pathState(dir) : null;
    if (state?.kind === "unreadable") return { names: [], unlisted: [{ dir, code: state.code }] };
    if (state?.kind !== "dir") return { names: [name], unlisted: [] };
    const scope = listing(dir);
    return { names: scope.names.map((child) => `${name}/${child}`), unlisted: scope.unlisted };
  });
  return { names: parts.flatMap((part) => part.names), unlisted: [...top.unlisted, ...parts.flatMap((part) => part.unlisted)] };
}

// [LAW:single-enforcer] Every place in an app's node_modules a package can load from, found the way node resolves a
// require: the app's node_modules, then, for each package the app owns, every node_modules on that package's lookup
// path (its own, and one beside each directory above it that is not itself a node_modules) inside the app's
// node_modules. A pnpm store's dependencies are siblings in the store entry's node_modules, so node finds them that way,
// whatever the store is named. Each node_modules is visited once whatever it is reached through, so a symlinked nested
// node_modules counts and a link cycle ends; a package's own files and anything past a link out of the app (a
// workspace, a replacement) are never descended. node resolves a name without listing a directory, so each name in
// `probe` is looked up in every node_modules visited, listable or not. Returns each start (a name and the location it
// is reached at, always a path that holds something), each directory that couldn't be listed, and one verdict on the
// whole: absent (the app ships none, as a fully bundled one does), listed (every directory read), or incomplete with
// the reason, so no consumer can take a tree it couldn't read for one with nothing in it.
export function walkStarts(app, probe = []) {
  const state = pathState(app.nodeModules);
  if (state.kind === "absent") return { verdict: { kind: "absent" }, starts: [], unlisted: [] };
  if (state.kind !== "dir") return { verdict: { kind: "incomplete", reason: `node_modules is not a directory: ${stateText(state)}` }, starts: [], unlisted: [] };
  const visited = new Set();
  const starts = new Map();
  const unlisted = [];
  const visit = (nodeModules) => {
    const at = pathState(nodeModules);
    const key = at.kind === "dir" ? fs.realpathSync(nodeModules) : nodeModules;
    if (visited.has(key)) return;
    visited.add(key);
    if (at.kind === "unreadable") unlisted.push({ dir: nodeModules, code: at.code });
    // Anything else that is not a directory (nothing, a file, a dangling link) holds no packages node could load.
    if (at.kind !== "dir") return;
    const top = topLevelEntries(nodeModules);
    unlisted.push(...top.unlisted);
    const probed = probe.filter((name) => appPathState(path.join(nodeModules, ...pkgPathParts(name))).kind !== "absent");
    for (const name of new Set([...top.names, ...probed])) {
      const dir = path.join(nodeModules, ...pkgPathParts(name));
      const start = locationOf(app.nodeModules, dir);
      if (!starts.has(start)) starts.set(start, { name, start });
      if (pathState(dir).kind === "dir" && isInside(app, fs.realpathSync(dir))) lookupPaths(app, fs.realpathSync(dir)).forEach(visit);
    }
  };
  visit(app.nodeModules);

  const named = unlisted.map(({ dir, code }) => ({ path: path.relative(path.dirname(app.nodeModules), dir), code }));
  const verdict = named.length === 0
    ? { kind: "listed" }
    : { kind: "incomplete", reason: `couldn't list ${named.map(({ path: dir, code }) => `${dir} (${code})`).join(", ")}, so the packages inside aren't detected` };
  return { verdict, starts: [...starts.values()], unlisted: named };
}

// The node_modules directories node searches for a require from the package whose real path is pkgReal, nearest
// first, kept to the ones inside the app's node_modules and spelled from the app's node_modules as named.
function lookupPaths(app, pkgReal) {
  const paths = [];
  for (let dir = pkgReal; isInside(app, dir); dir = path.dirname(dir)) {
    if (path.basename(dir) !== "node_modules") paths.push(path.join(app.nodeModules, path.relative(app.realNodeModules, dir), "node_modules"));
  }
  return paths;
}

// Locations in path order, which puts every copy before the copies nested in it.
export const compareLocations = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// [LAW:one-source-of-truth] The copies a set of starts reach: each start judged by swapOutcome and grouped by the swap
// location it leads to, so the top-level link and every pnpm consumer link to one store copy are one copy, and a link
// that leads nowhere is a copy that loads nothing. A copy is { name, location, outcome, paths }, sorted by location.
export function copiesOf(app, starts) {
  const byLocation = new Map();
  for (const { name, start } of starts) {
    const outcome = swapOutcome(app, start, name);
    const copy = byLocation.get(outcome.location) ?? { name, location: outcome.location, outcome, paths: [] };
    if (!copy.paths.includes(start)) copy.paths.push(start);
    byLocation.set(outcome.location, copy);
  }
  return [...byLocation.values()]
    .map((copy) => ({ ...copy, paths: copy.paths.sort() }))
    .sort((a, b) => compareLocations(a.location, b.location));
}

// The location node's require of name from the app loads, before any link is followed.
export const topLevelLocation = (name) => ["node_modules", ...pkgPathParts(name)].join("/");

// [LAW:types-are-the-program] Where the project installs the replacement for name@version: an npm alias under a scope
// of its own, so replacements of one package's different versions sit side by side, and none can collide with a
// package the project installs by its own name. In the name and the version, every byte outside [a-z0-9.-] is written
// _ and two hex digits, so an encoded part never holds "__", which joins the two: the alias is a valid npm name, and
// two different name@version pairs never share one.
export function replacementOf(projectRoot, name, version) {
  const encode = (text) => [...Buffer.from(text, "utf8")]
    .map((byte) => (/[a-z0-9.-]/.test(String.fromCharCode(byte)) ? String.fromCharCode(byte) : `_${byte.toString(16).padStart(2, "0")}`))
    .join("");
  const encoded = `${encode(name)}__${encode(version)}`;
  const alias = `${REPLACEMENT_SCOPE}/${encoded}`;
  return { alias, spec: `${alias}@npm:${name}@${version}`, dir: path.join(projectRoot, "node_modules", REPLACEMENT_SCOPE, encoded) };
}

export const REPLACEMENT_SCOPE = "@replace-dependency";

// What sits at a path without following it: nothing, a directory, a file, a symlink with its readlink text, or a path
// it can't lstat (with the error code). pathState answers what node finds there once it follows the links.
export function appPathState(p) {
  try {
    const stat = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "absent" };
    if (stat.isSymbolicLink()) return { kind: "link", target: fs.readlinkSync(p) };
    return { kind: stat.isDirectory() ? "dir" : "file" };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

export function describeEntry(state) {
  if (state.kind === "link") return `a link to ${state.target}`;
  if (state.kind === "unreadable") return `a path it can't read (${state.code})`;
  return { absent: "nothing", dir: "a directory", file: "a file" }[state.kind];
}

// An entry path in canonical form: its parent directories resolved through symlinks as far as they exist, so --app-dir
// and cwd naming one tree through different symlinked prefixes (/var vs /private/var on macOS) agree, and a path into
// a root scope nothing has been installed into yet still compares. The entry itself stays unresolved, so a workspace
// or npm-link entry keeps its indirection and a link left dangling by a removed replacement is still recognised.
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
// that directory's real path, which every inside-the-app check compares canonical paths against. An app that ships no
// node_modules still has one, so the walk can say so.
export function appAt(nodeModules) {
  return { nodeModules, realNodeModules: realExisting(nodeModules) };
}

export function locationDir(app, location) {
  return path.join(app.nodeModules, ...location.split("/").slice(1));
}

export const isInside = (app, entryPath) => entryPath.startsWith(`${app.realNodeModules}${path.sep}`);

// [LAW:one-source-of-truth] The swap location: where every consumer of a copy loads it through. It is the start (a
// location where pkgName is reached), followed through each link to another location of the same package inside the
// app's node_modules, so for a pnpm layout, whose top-level link and .pnpm siblings all lead to one store copy, it is
// that copy's location. A link leading anywhere else (out of the app's node_modules, as a workspace package or our
// link to a replacement does, or to another package) is itself the swap location. A location the app owns is spelled
// canonically, so a copy reached through a symlinked nested node_modules has one location however it is reached.
// Links that lead back into the chain are a loop, named by the chain and located where it begins.
function findSwapLocation(app, start, pkgName) {
  const tail = `${path.sep}${path.join("node_modules", ...pkgPathParts(pkgName))}`;
  const canonical = (location) => {
    const entry = canonicalEntry(locationDir(app, location));
    return isInside(app, entry) ? locationOf(app.realNodeModules, entry) : location;
  };
  const chain = [start];
  for (;;) {
    const dir = locationDir(app, chain.at(-1));
    const entry = appPathState(dir);
    const next = entry.kind === "link" ? linkDestination(dir, entry.target) : null;
    if (next === null || !isInside(app, next) || !next.endsWith(tail)) return { kind: "location", location: canonical(chain.at(-1)) };
    const nextLocation = locationOf(app.realNodeModules, next);
    if (chain.includes(nextLocation)) return { kind: "loop", location: canonical(start), chain: [...chain, nextLocation] };
    chain.push(nextLocation);
  }
}

// The replacement a link at dir leads to, when it leads into a replacement scope outside the app: its alias, or null.
function replacementLinkedAt(app, dir) {
  const entry = appPathState(dir);
  if (entry.kind !== "link") return null;
  const destination = linkDestination(dir, entry.target);
  return path.basename(path.dirname(destination)) === REPLACEMENT_SCOPE && !isInside(app, destination) ? `${REPLACEMENT_SCOPE}/${path.basename(destination)}` : null;
}

// [LAW:types-are-the-program] Whether, and where, replace-dependency can swap the copy of pkgName reached at start.
// Every outcome names the swap location and the package node loads there, or null when it loads none:
//   { kind: "trialable", location, loads }                         the app owns the location and it holds pkgName itself
//   { kind: "untrialable", location, loads, cause, reason, appOwns }
// appOwns is false for a location past a link out of the app's real node_modules (a scope linked to a workspace's
// own), which holds files nothing may move. The cause is the first of these replace-dependency would hit, and the
// reason is the cause with what it found:
//   loop           loop:<chain>                the links loop, so no copy loads
//   outside-app    outside-app:<location>      the app doesn't own the location
//   replacement    replacement:<alias>         the location already links to a replacement of this tool's
//   not-a-package  not-a-package:<state>       the location holds no usable package.json
//   alias-of       alias-of:<name>             the location holds another package (an npm alias), which npm can't install by the load name
export function swapOutcome(app, start, pkgName) {
  const swap = findSwapLocation(app, start, pkgName);
  const { location } = swap;
  const dir = locationDir(app, location);
  const holds = packageAt(dir);
  const loads = holds.kind === "package" ? { name: holds.name, version: holds.version } : null;
  const appOwns = isInside(app, canonicalEntry(dir));
  const replacement = replacementLinkedAt(app, dir);
  const [cause, detail] = swap.kind === "loop" ? ["loop", swap.chain.join(" -> ")]
    : !appOwns ? ["outside-app", location]
    : replacement !== null ? ["replacement", replacement]
    : loads === null ? ["not-a-package", stateText(holds)]
    : loads.name !== pkgName ? ["alias-of", loads.name]
    : [null, null];
  return cause === null ? { kind: "trialable", location, loads } : { kind: "untrialable", location, loads, cause, reason: `${cause}:${detail}`, appOwns };
}
