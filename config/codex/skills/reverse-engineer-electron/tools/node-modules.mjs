//
// node-modules.mjs — an app's node_modules as detect-dependencies and replace-dependency both read it: what a path
// holds once node follows its links, every copy of every package node can load from it, where (and whether) each copy
// can be swapped, and where the project installs a copy's replacement.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Whether a copy can be trialed is swapOutcome's answer and no one
// else's: replace-dependency trials exactly the copies whose outcome is trialable, and detect-dependencies reports every
// other one with the reason the outcome carries, so the two can't disagree about any copy the walk lists. A copy found
// only by probing a directory that can't be listed is one replace-dependency can trial and detect-dependencies can't
// name; detect-dependencies reports that directory, and its verdict on the tree is incomplete.

import fs from "fs";
import path from "path";
import { isNonEmptyString } from "./json-value.mjs";
import { appPathState, listDir, mismatchText, pathState, pathStateText, readJson } from "./path-state.mjs";
import { verdictOn } from "./verdict.mjs";

// [LAW:single-enforcer] A package name as npm spells one: a name, or a scope and a name, neither starting with "."
// and holding no "/" of its own. It is the one grammar for a --pkg argument, a candidate source's names, a lockfile's
// names, and the entry a location ends in; a scope is its first half.
const SCOPE = "@[^/@.][^/]*";
const PACKAGE_NAME = new RegExp(`^(?:${SCOPE}/)?[^/@.][^/]*$`);
const SCOPE_NAME = new RegExp(`^${SCOPE}$`);
export const isPackageName = (value) => typeof value === "string" && PACKAGE_NAME.test(value);

// The entry a node_modules path names after its last node_modules: a package name, or a scope that holds no packages
// (an entry under its own name), or null when it names neither.
export function entryNameOf(nodeModulesPath) {
  const parts = nodeModulesPath.split("/");
  const last = parts.lastIndexOf("node_modules");
  if (last === -1) return null;
  const entry = parts.slice(last + 1);
  const name = entry.length >= 2 && entry[0].startsWith("@") ? `${entry[0]}/${entry[1]}` : entry[0];
  return name !== undefined && (isPackageName(name) || SCOPE_NAME.test(name)) ? name : null;
}

// A location is a package's path relative to the app dir, as npm's lockfile spells one: node_modules/foo, or
// node_modules/.pnpm/foo@1.0.0/node_modules/foo. It ends in an entry name after its last node_modules, and in nothing
// past it. replacement-log.mjs parses the locations a log stores with it.
export function isLocation(value) {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  const name = entryNameOf(value);
  return name !== null && parts[0] === "node_modules" && value.endsWith(`node_modules/${name}`) && parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export function pkgPathParts(name) {
  return name.startsWith("@") && name.includes("/") ? name.split("/") : [name];
}

// What a path holds that is not a package, as a reason: a package state packageAt adds, or a path state.
export function stateText(state) {
  if (state.kind === "no-manifest") return state.kind;
  if (state.kind === "unusable-manifest") return `${state.kind}:${state.reason}`;
  return pathStateText(state);
}

// What a path holds as a package: the name and version its package.json gives, or, when it holds none, the path's
// own state, a directory with no package.json, or a package.json that can't be read, lacks a name or version, or
// gives a name no package can have.
export function packageAt(dir) {
  const state = pathState(dir);
  if (state.kind !== "dir") return state;
  const read = readJson(path.join(dir, "package.json"));
  if (read.kind === "absent") return { kind: "no-manifest" };
  if (read.kind !== "json") return { kind: "unusable-manifest", reason: pathStateText(read) };
  const manifest = read.value;
  if (!isNonEmptyString(manifest?.name) || !isNonEmptyString(manifest?.version)) return { kind: "unusable-manifest", reason: "no-name-or-version" };
  if (!isPackageName(manifest.name)) return { kind: "unusable-manifest", reason: "invalid-name" };
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
// whatever the store is named. Each spelling of a node_modules is listed, and each directory is descended once whatever
// it is reached through, so a symlinked nested node_modules counts and a link cycle ends; a package's own files and anything past a link out of the app (a
// workspace, a replacement) are never descended. node resolves a name without listing a directory, so each name in
// `probe` is looked up in every node_modules visited, listable or not. Returns each start (a name and the location it
// is reached at, always a path that holds something), each directory that couldn't be listed, and one verdict on the
// whole: absent (the app ships none, as a fully bundled one does), listed (every directory read), or incomplete with
// the reason, so no consumer can take a tree it couldn't read for one with nothing in it.
export function walkStarts(app, probe = []) {
  const state = pathState(app.nodeModules);
  if (state.kind === "absent") return { verdict: { kind: "absent" }, starts: [], unlisted: [] };
  if (state.kind !== "dir") return { verdict: { kind: "incomplete", reason: `node_modules ${mismatchText("directory", state)}` }, starts: [], unlisted: [] };
  const visited = new Set();
  const starts = new Map();
  const unlisted = [];
  // Each spelling of a node_modules is listed for its starts, since every one is a path node loads through; a
  // directory is descended from only the first time it is reached, which ends a link cycle.
  const spelled = new Set();
  const visit = (nodeModules) => {
    if (spelled.has(nodeModules)) return;
    spelled.add(nodeModules);
    const at = pathState(nodeModules);
    const key = at.kind === "dir" ? fs.realpathSync(nodeModules) : nodeModules;
    const firstVisit = !visited.has(key);
    visited.add(key);
    if (at.kind === "unreadable" && firstVisit) unlisted.push({ dir: nodeModules, code: at.code });
    // Anything else that is not a directory (nothing, a file, a dangling link) holds no packages node could load.
    if (at.kind !== "dir") return;
    const top = topLevelEntries(nodeModules);
    if (firstVisit) unlisted.push(...top.unlisted);
    const probed = probe.filter((name) => appPathState(path.join(nodeModules, ...pkgPathParts(name))).kind !== "absent");
    const descend = [];
    for (const name of new Set([...top.names, ...probed])) {
      const dir = path.join(nodeModules, ...pkgPathParts(name));
      const start = locationOf(app.nodeModules, dir);
      if (!starts.has(start)) starts.set(start, { name, start });
      if (firstVisit && pathState(dir).kind === "dir" && isInside(app, fs.realpathSync(dir))) descend.push(...lookupPaths(app, fs.realpathSync(dir)));
    }
    descend.forEach(visit);
  };
  visit(app.nodeModules);

  const named = unlisted.map(({ dir, code }) => ({ path: path.relative(path.dirname(app.nodeModules), dir), code }));
  const verdict = verdictOn(named, (dirs) => `couldn't list ${dirs.map(({ path: dir, code }) => `${dir} (${code})`).join(", ")}, so the packages inside aren't detected`);
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

// Packages or copies by name, then by location.
export const byNameThenLocation = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name) || compareLocations(a.location, b.location));

// [LAW:one-source-of-truth] The copies a set of starts reach: each start judged by swapOutcome and grouped by the swap
// location it leads to, so the top-level link and every pnpm consumer link to one store copy are one copy, and a link
// that leads nowhere is a copy that loads nothing. A copy is { name, location, outcome, paths }, sorted by location;
// its name is the package it holds, or, when it holds none, the name it is reached by.
export function copiesOf(app, starts) {
  const byLocation = new Map();
  for (const { name, start } of starts) {
    const outcome = swapOutcome(app, start);
    const copy = byLocation.get(outcome.location) ?? { name: outcome.loads?.name ?? name, location: outcome.location, outcome, paths: [] };
    if (!copy.paths.includes(start)) copy.paths.push(start);
    byLocation.set(outcome.location, copy);
  }
  return [...byLocation.values()]
    .map((copy) => ({ ...copy, paths: copy.paths.sort() }))
    .sort((a, b) => compareLocations(a.location, b.location));
}

// The location of name installed in the node_modules of the package at parent, or, with no parent, the location
// node's require of name from the app loads, before any link is followed.
export const nestedLocation = (parent, name) => [...(parent === null ? [] : [parent]), "node_modules", ...pkgPathParts(name)].join("/");
export const topLevelLocation = (name) => nestedLocation(null, name);

// [LAW:one-source-of-truth] An npm alias spec, npm:<name>@<version>: the form a replacement is installed under, and
// the form a v1 lockfile records an alias's version in.
const npmSpec = (name, version) => `npm:${name}@${version}`;
export function parseNpmSpec(spec) {
  const match = /^npm:(.+)@([^@]+)$/.exec(spec);
  return match !== null && isPackageName(match[1]) ? { name: match[1], version: match[2] } : null;
}

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
  return { alias, spec: `${alias}@${npmSpec(name, version)}`, dir: path.join(replacementScopeDir(projectRoot), encoded) };
}

export const REPLACEMENT_SCOPE = "@replace-dependency";

// [LAW:one-source-of-truth] The one directory a project's replacements are installed into.
const replacementScopeDir = (projectRoot) => path.join(projectRoot, "node_modules", REPLACEMENT_SCOPE);

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

// [LAW:single-enforcer] The one place a directory becomes a location, the form replacement-log.mjs parses: the path
// from a node_modules directory to a package in it, spelled from the app's node_modules. A package's own app path is its name
// under the app's node_modules, whatever its parents link to; a link's destination is a canonical path, measured
// from the app's real node_modules, so an app whose node_modules is itself a symlink still writes one.
export function locationOf(nodeModules, dir) {
  const location = locationIn(nodeModules, dir);
  if (location === null) throw new Error(`${dir} is not inside ${nodeModules}`);
  return location;
}

// The location dir is at in nodeModules, or null when dir is no location there.
function locationIn(nodeModules, dir) {
  const location = ["node_modules", ...path.relative(nodeModules, dir).split(path.sep)].join("/");
  return isLocation(location) ? location : null;
}

// [LAW:single-enforcer] The one constructor of the app every location is measured in: its node_modules as named, and
// that directory's real path, which every inside-the-app check compares canonical paths against, and the canonical
// directory the project at projectRoot installs replacements into. An app that ships no node_modules still has one, so
// the walk can say so.
export function appAt(nodeModules, projectRoot) {
  return { nodeModules, realNodeModules: realExisting(nodeModules), replacementScope: realExisting(replacementScopeDir(projectRoot)) };
}

export function locationDir(app, location) {
  return path.join(app.nodeModules, ...location.split("/").slice(1));
}

export const isInside = (app, entryPath) => entryPath.startsWith(`${app.realNodeModules}${path.sep}`);

// [LAW:one-source-of-truth] The swap location: where every consumer of a copy loads it through. It is the start (a
// location where a package is reached), followed through each link to another location inside the app's
// node_modules, so for a pnpm layout, whose top-level link and .pnpm siblings all lead to one store copy, it is that
// copy's location, and an npm alias's link is one more path to the copy it leads to. A link leading anywhere else (out
// of the app's node_modules, as a workspace package or our link to a replacement does, or into a package's own files)
// is itself the swap location. A location the app owns is spelled canonically, so a copy reached through a symlinked
// nested node_modules has one location however it is reached. Links that lead back into the chain are a loop, named by
// the chain and located where it begins.
function findSwapLocation(app, start) {
  const canonical = (location) => {
    const entry = canonicalEntry(locationDir(app, location));
    return isInside(app, entry) ? locationOf(app.realNodeModules, entry) : location;
  };
  const chain = [start];
  for (;;) {
    const dir = locationDir(app, chain.at(-1));
    const entry = appPathState(dir);
    const next = entry.kind === "link" ? linkDestination(dir, entry.target) : null;
    const nextLocation = next !== null && isInside(app, next) ? locationIn(app.realNodeModules, next) : null;
    if (nextLocation === null) return { kind: "location", location: canonical(chain.at(-1)) };
    if (chain.includes(nextLocation)) return { kind: "loop", location: canonical(start), chain: [...chain, nextLocation] };
    chain.push(nextLocation);
  }
}

// The replacement a link at dir leads to, when it leads into the project's replacement scope: its alias, or null.
function replacementLinkedAt(app, dir) {
  const entry = appPathState(dir);
  if (entry.kind !== "link") return null;
  const destination = linkDestination(dir, entry.target);
  return path.dirname(destination) === app.replacementScope ? `${REPLACEMENT_SCOPE}/${path.basename(destination)}` : null;
}

// [LAW:one-source-of-truth] The location of the copy whose swap took the copy at location out of the app, read off the
// tree: the outermost location containing it that now links to one of the project's replacements, or null when none
// does. A swap set that container aside with everything nested in it, so nothing in the app loads the copy.
export function containerSwappedAt(app, location) {
  const parts = location.split("/");
  const containers = parts.flatMap((part, index) => (part === "node_modules" && index > 0 ? [parts.slice(0, index).join("/")] : []));
  return containers.find((container) => isLocation(container) && replacementLinkedAt(app, locationDir(app, container)) !== null) ?? null;
}

// [LAW:types-are-the-program] Whether, and where, replace-dependency can swap the copy reached at start.
// Every outcome names the swap location and the package node loads there, or null when it loads none:
//   { kind: "trialable", location, loads }                         the app owns the location and it holds a package
//   { kind: "untrialable", location, loads, cause, reason, appOwns }
// appOwns is false for a location past a link out of the app's real node_modules (a scope linked to a workspace's
// own), which holds files nothing may move. The cause is the first of these replace-dependency would hit, and the
// reason is the cause with what it found:
//   loop           loop:<chain>                the links loop, so no copy loads
//   outside-app    outside-app:<location>      the app doesn't own the location
//   replacement    replacement:<alias>         the location already links to a replacement of this tool's
//   not-a-package  not-a-package:<state>       the location holds no usable package.json
// A location that holds a package other than the name it is reached by (an npm alias) is trialable as the package it
// holds: its replacement is installed under an alias of its own, whatever name loads it.
export function swapOutcome(app, start) {
  const swap = findSwapLocation(app, start);
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
    : [null, null];
  return cause === null ? { kind: "trialable", location, loads } : { kind: "untrialable", location, loads, cause, reason: `${cause}:${detail}`, appOwns };
}
