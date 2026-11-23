//
// path-state.mjs — what a path on disk holds, with and without following its links, as a value; and what a tool that
// wants a directory, a file, its text or its JSON there gets: the thing, nothing at all, or the reason it can't be used.

import fs from "fs";

// [LAW:single-enforcer] An fs error as a fact about the path: a system call's error (EACCES, ELOOP, ...; it names the
// syscall) or node's own verdict on a file (ERR_FS_*, e.g. ERR_FS_FILE_TOO_LARGE) is what the path holds. Anything
// else, node's ERR_INVALID_ARG_* among them, is a bug in the caller, and is thrown.
export function pathErrorCode(error) {
  const isPathFact = typeof error.code === "string" && (typeof error.syscall === "string" || error.code.startsWith("ERR_FS_"));
  if (!isPathFact) throw error;
  return error.code;
}

// No entry at all: nothing by that name (ENOENT), or a path through something that is not a directory (ENOTDIR).
const NO_ENTRY = new Set(["ENOENT", "ENOTDIR"]);

// An fs call's result, or what its error says the path holds: no entry, or a path it can't read with the code.
function attempt(call, onNoEntry) {
  try {
    return call();
  } catch (error) {
    const code = pathErrorCode(error);
    return NO_ENTRY.has(code) ? onNoEntry() : { kind: "unreadable", code };
  }
}

// [LAW:one-source-of-truth] The kind a stat names: a directory, a regular file, or something else (a FIFO, a socket,
// a device), which holds nothing a tool reads as a file.
const kindOf = (stat) => (stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "special");

const ABSENT = Object.freeze({ kind: "absent", reason: "is missing" });

// What a path holds once node follows its links: a directory, a regular file, something else, a link leading nowhere,
// a path it can't stat (with the error code, e.g. EACCES or ELOOP), or nothing at all. A directory is one whatever its
// read bit says: node loads a package through a directory it may search but not list, so whether it can be listed is
// listDir's question.
export function pathState(p) {
  const lstatFailure = attempt(() => (fs.lstatSync(p), null), () => ABSENT);
  if (lstatFailure !== null) return lstatFailure;
  return attempt(() => ({ kind: kindOf(fs.statSync(p)) }), () => attempt(() => ({ kind: "dangling", target: fs.readlinkSync(p) }), () => ABSENT));
}

// What sits at a path without following it: nothing, a directory, a file, something else, a symlink with its readlink
// text, or a path it can't lstat (with the error code). pathState answers what node finds there once it follows the
// links.
export function appPathState(p) {
  return attempt(() => {
    const stat = fs.lstatSync(p);
    return stat.isSymbolicLink() ? { kind: "link", target: fs.readlinkSync(p) } : { kind: kindOf(stat) };
  }, () => ABSENT);
}

// What appPathState found, as the object of "holds": every kind it returns has its words, and any other is an error.
export function describeEntry(state) {
  if (state.kind === "link") return `a link to ${state.target}`;
  if (state.kind === "unreadable") return `a path it can't read (${state.code})`;
  const words = { absent: "nothing", dir: "a directory", file: "a file", special: "a special file" }[state.kind];
  if (words === undefined) throw new Error(`appPathState gives no ${state.kind} state`);
  return words;
}

// [LAW:types-are-the-program] Each state a path can hold instead of what a tool wants, and the one field that says
// why, so a state with no entry here is an error, not a reason with a gap in it.
const STATE_DETAIL = { absent: null, dir: null, file: null, special: null, dangling: "target", unreadable: "code", "invalid-json": "error", "wrong-shape": "holds" };

// A state as a reason token: its kind, and the field that says why.
export function pathStateText(state) {
  if (!Object.hasOwn(STATE_DETAIL, state.kind)) throw new Error(`a ${state.kind} state has no reason text`);
  const field = STATE_DETAIL[state.kind];
  return field === null ? state.kind : `${state.kind}:${state[field]}`;
}

const WANTED = { dir: "a directory", file: "a file" };

// [LAW:one-source-of-truth] The one sentence for why a path that should hold what a tool wants doesn't: it can't be
// read to tell, its text isn't JSON, it holds JSON of another shape, or it holds another kind of thing.
function unusable(wanted, state) {
  const reason = state.kind === "unreadable" ? `can't be read (${state.code})`
    : state.kind === "invalid-json" ? `doesn't parse as JSON: ${state.error}`
    : state.kind === "wrong-shape" ? `is not ${wanted} (it holds ${state.holds})`
    : `is not ${wanted} (${pathStateText(state)})`;
  return { kind: "unusable", state, reason };
}

// [LAW:parse-dont-validate] What a tool that wants a directory or a readable file at p gets: { kind: "dir" } or
// { kind: "file" }, { kind: "absent", reason }, or { kind: "unusable", state, reason }. Every outcome but the one wanted
// carries the reason a tool reports, so a path that isn't there and one that is there but can't be used are told apart
// by kind and named by one sentence.
export function inputAt(p, want) {
  const state = pathState(p);
  if (state.kind === "absent") return state;
  if (state.kind !== want) return unusable(WANTED[want], state);
  if (want === "dir") return state;
  const access = attempt(() => (fs.accessSync(p, fs.constants.R_OK), state), () => ABSENT);
  return access.kind === "unreadable" ? unusable(WANTED.file, access) : access;
}

// Whether a reader's outcome is one a tool can't use: nothing there, or something there it can't use, each with the
// reason the reader gave.
export const isUnmet = (outcome) => outcome.kind === "absent" || outcome.kind === "unusable";

// A file's bytes, or why there are none: { kind: "bytes", bytes }, absent, or unusable.
export function readBytes(file) {
  const state = pathState(file);
  if (state.kind === "absent") return state;
  if (state.kind !== "file") return unusable(WANTED.file, state);
  const read = attempt(() => ({ kind: "bytes", bytes: fs.readFileSync(file) }), () => ABSENT);
  return read.kind === "unreadable" ? unusable(WANTED.file, read) : read;
}

// A file's text exactly as it is on disk, a byte order mark included, so a tool that rewrites the file changes only
// what it means to; or why there is none.
export function readText(file) {
  const read = readBytes(file);
  return read.kind === "bytes" ? { kind: "text", text: read.bytes.toString("utf8") } : read;
}

// [LAW:one-source-of-truth] The one JSON reader: a file's value of the shape the tool reads (json-value.mjs's
// JSON_SHAPE), or why there is none, its text not parsing and a value of another shape among the reasons. Every tool
// reads its JSON inputs here, so they all read the same text the same way.
export function readJson(file, shape) {
  const read = readText(file);
  if (read.kind !== "text") return read;
  let value;
  try {
    // A leading UTF-8 byte order mark is not JSON text, as npm reads its JSON files.
    value = JSON.parse(read.text.replace(/^\uFEFF/, ""));
  } catch (error) {
    return unusable(shape.what, { kind: "invalid-json", error: error.message });
  }
  return shape.accepts(value) ? { kind: "json", value } : unusable(shape.what, { kind: "wrong-shape", holds: jsonKindOf(value) });
}

const jsonKindOf = (value) => (value === null ? "null" : Array.isArray(value) ? "an array" : typeof value === "object" ? "an object" : `a ${typeof value}`);

// Each file a tool reads out of a tree it listed: the text, or an error naming the path and why, since a tree's entry
// that can't be read is one the tool can't account for.
export function treeFileText(file) {
  const read = readText(file);
  if (read.kind !== "text") throw new Error(`${file} ${read.reason}`);
  return read.text;
}

// A directory's entries, or the error code that kept them from being read.
export function listDir(dir) {
  try {
    return { kind: "listed", entries: fs.readdirSync(dir, { withFileTypes: true }) };
  } catch (error) {
    return { kind: "unlistable", code: pathErrorCode(error) };
  }
}
