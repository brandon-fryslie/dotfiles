//
// path-state.mjs — what a path on disk holds, with and without following its links, as a value: its kind, a
// directory's entries, or a file's text, and otherwise the error code that kept it from being read.

import fs from "fs";

// [LAW:one-source-of-truth] The kind a stat names: a directory, a regular file, or something else (a FIFO, a socket,
// a device), which holds nothing a tool reads as a file.
const kindOf = (stat) => (stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "special");

// What a path holds once node follows its links: a directory, a regular file, something else, a link leading nowhere,
// a path it can't stat (with the error code, e.g. EACCES or ELOOP), or nothing at all. A directory is one whatever its
// read bit says: node loads a package through a directory it may search but not list, so whether it can be listed is
// listDir's question.
export function pathState(p) {
  try {
    if (!fs.lstatSync(p, { throwIfNoEntry: false })) return { kind: "absent" };
    const stat = fs.statSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "dangling", target: fs.readlinkSync(p) };
    return { kind: kindOf(stat) };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

// What sits at a path without following it: nothing, a directory, a file, something else, a symlink with its readlink
// text, or a path it can't lstat (with the error code). pathState answers what node finds there once it follows the
// links.
export function appPathState(p) {
  try {
    const stat = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "absent" };
    if (stat.isSymbolicLink()) return { kind: "link", target: fs.readlinkSync(p) };
    return { kind: kindOf(stat) };
  } catch (error) {
    if (typeof error.code !== "string") throw error;
    return { kind: "unreadable", code: error.code };
  }
}

export function describeEntry(state) {
  if (state.kind === "link") return `a link to ${state.target}`;
  if (state.kind === "unreadable") return `a path it can't read (${state.code})`;
  return { absent: "nothing", dir: "a directory", file: "a file", special: "a special file" }[state.kind];
}

// The text a file holds, or what its path holds instead: an error reading it is the code it carries, as a stat's is.
// A leading UTF-8 byte order mark is not text, as npm reads its JSON files.
export function readText(file) {
  const state = pathState(file);
  if (state.kind !== "file") return state;
  try {
    return { kind: "text", text: fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "") };
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
