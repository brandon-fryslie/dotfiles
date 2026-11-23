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

// [LAW:one-source-of-truth] The one JSON reader: a file's value, or what its path holds instead, or the parse error of
// text that isn't JSON. Every tool reads its JSON inputs here, so they all read the same text the same way.
export function readJson(file) {
  const read = readText(file);
  if (read.kind !== "text") return read;
  try {
    return { kind: "json", value: JSON.parse(read.text) };
  } catch (error) {
    return { kind: "invalid-json", error: error.message };
  }
}

// [LAW:types-are-the-program] Each path state, and the one field that says why, so a state with no entry here is an
// error, not a reason with a gap in it.
const STATE_DETAIL = { absent: null, dir: null, file: null, special: null, dangling: "target", unreadable: "code", "invalid-json": "error" };

export function pathStateText(state) {
  if (!Object.hasOwn(STATE_DETAIL, state.kind)) throw new Error(`a ${state.kind} state has no reason text`);
  const field = STATE_DETAIL[state.kind];
  return field === null ? state.kind : `${state.kind}:${state[field]}`;
}

// Why a path that should hold a kind of thing doesn't: nothing is there, it holds another kind, it can't be read to
// tell, or its text isn't JSON.
export function mismatchText(expected, state) {
  if (state.kind === "absent") return "is missing";
  if (state.kind === "unreadable") return `can't be read (${state.code})`;
  if (state.kind === "invalid-json") return `doesn't parse as JSON: ${state.error}`;
  return `is not a ${expected} (${pathStateText(state)})`;
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
