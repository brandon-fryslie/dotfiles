//
// node-modules.mjs — an app's node_modules as detect-dependencies and replace-dependency both read it: what a path
// holds once node follows its links, the packages its top level offers, and where (and whether) a package can be
// swapped.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Whether a package can be trialed is swapOutcome's answer and no one
// else's: replace-dependency trials exactly the packages it finds, and detect-dependencies reports every other one
// with the reason untrialableReason gives, so the report and the swap tool can't disagree about any layout.

import fs from "fs";
import path from "path";
import { isLocation } from "./replacement-log.mjs";

export function pkgPathParts(name) {
  return name.startsWith("@") && name.includes("/") ? name.split("/") : [name];
}

// What a path holds once node follows its links: a directory it can list, a file, a link leading nowhere, a path it
// can't read (with the error code, e.g. EACCES or ELOOP), or nothing at all.
export function pathState(p) {
  try {
    if (!fs.lstatSync(p, { throwIfNoEntry: false })) return { kind: "absent" };
    const stat = fs.statSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "dangling", target: fs.readlinkSync(p) };
    if (!stat.isDirectory()) return { kind: "file" };
    fs.readdirSync(p);
    return { kind: "dir" };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

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
  if (typeof manifest?.name !== "string" || typeof manifest?.version !== "string") return { kind: "unusable-manifest", reason: "no-name-or-version" };
  return { kind: "package", name: manifest.name, version: manifest.version };
}

// The names an app loads from its node_modules top level: node_modules/<name> and node_modules/@scope/<name>, the way
// node resolves them, through links. A scope that is not a listable directory is an entry under its own name, so its
// state is reported rather than lost. Dot entries (.bin, .pnpm, .original, .package-lock.json) are tooling.
export function topLevelEntries(nodeModules) {
  const names = (dir) => fs.readdirSync(dir).filter((name) => !name.startsWith(".")).sort();
  return names(nodeModules).flatMap((name) =>
    name.startsWith("@") && pathState(path.join(nodeModules, name)).kind === "dir"
      ? names(path.join(nodeModules, name)).map((child) => `${name}/${child}`)
      : [name]);
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

// app is { nodeModules, realNodeModules }: the app's node_modules as named, and its real path.
export function locationDir(app, location) {
  return path.join(app.nodeModules, ...location.split("/").slice(1));
}

// The readlink text at a location, or null when it is not a link node could follow (a directory, a file, nothing, or
// a path it can't lstat); packageAt reports what such a location holds.
function linkAt(dir) {
  try {
    const state = appPathState(dir);
    return state.kind === "link" ? state.target : null;
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return null;
  }
}

// [LAW:one-source-of-truth] The swap location: where every consumer of the app's copy loads it through. It is the app
// path, followed through each link to another location of the same package inside the app's node_modules, so for a
// pnpm layout, whose top-level link and .pnpm siblings all lead to one store copy, it is that copy's location. A link
// leading anywhere else (out of the app's node_modules, as a workspace package or our link to the root does, or to
// another package) is itself the swap location.
function findSwapLocation(app, pkgName) {
  const tail = `${path.sep}${path.join("node_modules", ...pkgPathParts(pkgName))}`;
  const chain = [locationOf(app.nodeModules, path.join(app.nodeModules, ...pkgPathParts(pkgName)))];
  for (;;) {
    const dir = locationDir(app, chain.at(-1));
    const target = linkAt(dir);
    const next = target === null ? null : linkDestination(dir, target);
    if (next === null || !next.startsWith(`${app.realNodeModules}${path.sep}`) || !next.endsWith(tail)) return { location: chain.at(-1) };
    const nextLocation = locationOf(app.realNodeModules, next);
    if (chain.includes(nextLocation)) return { loop: [...chain, nextLocation] };
    chain.push(nextLocation);
  }
}

// [LAW:types-are-the-program] Whether, and where, replace-dependency can swap the app's copy of a package. Every
// outcome but a loop names the swap location and what it holds:
//   found          the location holds pkgName itself: the one outcome replace-dependency trials
//   loop           the links loop, so no copy loads
//   outside        the location lies past a link out of the app's real node_modules (a scope linked to a workspace's
//                  own): setting it aside would move files the app doesn't own
//   not-a-package  the location holds no usable package.json
//   alias          the location holds another package (an npm alias), which npm can't install by the load name
export function swapOutcome(app, pkgName) {
  const swap = findSwapLocation(app, pkgName);
  if (swap.loop) return { kind: "loop", chain: swap.loop };
  const { location } = swap;
  const dir = locationDir(app, location);
  const holds = packageAt(dir);
  if (!canonicalEntry(dir).startsWith(`${app.realNodeModules}${path.sep}`)) return { kind: "outside", location, holds };
  if (holds.kind !== "package") return { kind: "not-a-package", location, holds };
  if (holds.name !== pkgName) return { kind: "alias", location, holds };
  return { kind: "found", location, holds };
}

// The reason an outcome other than found can't be trialed, as replace-dependency records it and detect-dependencies
// reports it.
export function untrialableReason(outcome) {
  if (outcome.kind === "loop") return `loop:${outcome.chain.join(" -> ")}`;
  if (outcome.kind === "outside") return `outside-app:${outcome.location}`;
  if (outcome.kind === "alias") return `alias-of:${outcome.holds.name}`;
  const { holds } = outcome;
  const detail = holds.code ?? holds.reason ?? holds.target;
  return `not-a-package:${holds.kind}${detail === undefined ? "" : `:${detail}`}`;
}
