//
// package-lock.mjs — what an app's package-lock.json records: every package version at the location npm installed it
// at, read the way npm reads each lockfile format, and a verdict on whether every entry could be read.

import { byNameThenLocation, compareLocations, entryNameOf, isLocation, isNonEmptyString, isPackageName, isPlainObject, mismatchText, nestedLocation, parseNpmSpec, readText, verdictOn } from "./node-modules.mjs";

const unread = (entry, reason) => ({ kind: "unread", entry, reason });

// A location a lockfile installs a package at: a location whose entry is a package, not a bare scope.
const isPackageLocation = (location) => isLocation(location) && isPackageName(entryNameOf(location));

// [LAW:parse-dont-validate] [LAW:single-enforcer] One entry a lockfile records at a location, as what it records
// there: a link, the package it names, or the reason it names none. Every format's entries pass through here, so
// each is held to the one location and package-name grammar before its format reads it as a link or a record.
function parseEntry(location, entry, recordOf) {
  if (!isPackageLocation(location)) return unread(location, "is not a package location");
  if (!isPlainObject(entry)) return unread(location, "is not an object");
  const record = recordOf(entry);
  if (record.kind === "link") return record;
  if (record.kind === "unread") return unread(location, record.reason);
  const { name, version } = record;
  if (!isPackageName(name)) return unread(location, `records name ${JSON.stringify(name)}, which is not a package name`);
  if (version === undefined) return unread(location, "records no version");
  if (!isNonEmptyString(version)) return unread(location, `records version ${JSON.stringify(version)}, which is not a version`);
  return { kind: "package", package: { name, version, location } };
}

// A v2/v3 packages entry: a link, or the package its key's entry names, except an alias's entry, which records the
// package it is as its name.
const packagesRecord = (location) => (entry) => (entry.link === true
  ? { kind: "link" }
  : { kind: "record", name: Object.hasOwn(entry, "name") ? entry.name : entryNameOf(location), version: entry.version });

// A v2/v3 packages section, keyed by location. A key outside the app's node_modules (the root project "", a
// workspace's folder and what it installs) holds no copy the app loads from there.
const packagesEntries = (packages) => Object.entries(packages).map(([key, entry]) => (key.split("/")[0] === "node_modules"
  ? parseEntry(key, entry, packagesRecord(key))
  : { kind: "outside" }));

// A v1 dependencies entry, which npm 6 keys by the name it is installed under: a linked folder's version is
// file:<path>, and an alias's is the npm:<name>@<version> spec of the package it is.
const dependenciesRecord = (key) => ({ version }) => {
  if (typeof version === "string" && version.startsWith("file:")) return { kind: "link" };
  if (typeof version !== "string" || !version.startsWith("npm:")) return { kind: "record", name: key, version };
  const alias = parseNpmSpec(version);
  return alias === null ? { kind: "unread", reason: `records version ${JSON.stringify(version)}, which is not an npm:<name>@<version> alias` } : { kind: "record", ...alias };
};

// A v1 dependencies tree, each entry at the location its nesting puts it: npm 6 nests the packages installed inside a
// package under that package's own dependencies.
const dependenciesEntries = (records, parent) => Object.entries(records).flatMap(([key, entry]) => {
  const location = nestedLocation(parent, key);
  const nested = !isPlainObject(entry) || entry.dependencies === undefined ? []
    : isPlainObject(entry.dependencies) ? dependenciesEntries(entry.dependencies, location)
    : [unread(location, "records dependencies that are not an object")];
  return [parseEntry(location, entry, dependenciesRecord(key)), ...nested];
});

// [LAW:types-are-the-program] Each package-lock.json format, by its lockfileVersion, and the section it records its
// installed packages in. A v2 lockfile's dependencies is a mirror kept for npm 6; npm reads packages, and so does this.
const FORMATS = new Map([
  [1, { section: "dependencies", entries: (records) => dependenciesEntries(records, null) }],
  [2, { section: "packages", entries: packagesEntries }],
  [3, { section: "packages", entries: packagesEntries }],
]);

// [LAW:parse-dont-validate] A package-lock.json's text as every entry its format records, or the reason it can't be
// read as a lockfile at all.
function parsePackageLock(text) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch (error) {
    return { kind: "unusable", reason: `it doesn't parse as JSON: ${error.message}` };
  }
  if (!isPlainObject(lock)) return { kind: "unusable", reason: "it is not a JSON object" };
  const format = FORMATS.get(lock.lockfileVersion);
  if (format === undefined) {
    return { kind: "unusable", reason: lock.lockfileVersion === undefined ? "it records no lockfileVersion" : `its lockfileVersion ${JSON.stringify(lock.lockfileVersion)} is not 1, 2 or 3` };
  }
  const records = lock[format.section];
  if (!isPlainObject(records)) return { kind: "unusable", reason: `its ${format.section} ${records === undefined ? "is missing" : "is not an object"}` };
  return { kind: "entries", entries: format.entries(records) };
}

// [LAW:one-source-of-truth] Every package version the package-lock.json at file records, at the location it records
// it at, named by the one location grammar node-modules.mjs owns. [LAW:no-silent-failure] Its verdict is the one
// node_modules gets: absent, listed, or incomplete with the reason, and every entry it can't read is listed by its
// location as unread. An unusable lockfile is bad input, not a bug in the tool reading it, and that tool's run still
// writes its report, so the lockfile is reported and never read as one that records nothing.
export function loadLockfile(file) {
  const read = readText(file);
  if (read.kind === "absent") return { verdict: { kind: "absent" }, packages: [], unread: [] };
  const lock = read.kind === "text" ? parsePackageLock(read.text) : { kind: "unusable", reason: `it ${mismatchText("file", read)}` };
  if (lock.kind === "unusable") return { verdict: { kind: "incomplete", reason: lock.reason }, packages: [], unread: [] };
  const unreadEntries = lock.entries
    .filter(({ kind }) => kind === "unread")
    .map(({ entry, reason }) => ({ entry, reason }))
    .sort((left, right) => compareLocations(left.entry, right.entry));
  return {
    verdict: verdictOn(unreadEntries, (entries) => entries.map(({ entry, reason }) => `${entry} ${reason}`).join(", ")),
    packages: byNameThenLocation(lock.entries.filter(({ kind }) => kind === "package").map((entry) => entry.package)),
    unread: unreadEntries,
  };
}
