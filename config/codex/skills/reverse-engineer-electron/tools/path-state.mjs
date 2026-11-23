//
// path-state.mjs — what a path on disk holds, with and without following its links, as a value: its kind, a
// directory's entries, or a file's text, JSON or digest, and otherwise why it can't be read.
//
// [LAW:single-enforcer] Every tool reads an input through here, so a path that is there but can't be read is never
// taken for one that isn't: each reader returns what it read, { kind: "absent", reason }, or
// { kind: "unusable", state, reason }. A reason is what a tool prints after the path ("can't be read (EACCES)").

import { createHash } from "crypto";
import fs from "fs";
import { jsonTypeOf } from "./json-value.mjs";

// [LAW:no-silent-failure] An error that is a fact about a path (a failed system call, or node's refusal of the file:
// ERR_FS_FILE_TOO_LARGE past what one read holds, ERR_STRING_TOO_LONG past what one string holds) is its code; any
// other error is a bug, and is thrown.
export function pathErrorCode(error) {
  if (typeof error?.syscall === "string" || /^ERR_(FS_|STRING_TOO_LONG$)/.test(error?.code ?? "")) return error.code;
  throw error;
}

// A path that couldn't be stat'd. ENOTDIR means a directory above it is a file, so nothing is there.
const failedState = (error) => {
  const code = pathErrorCode(error);
  return code === "ENOTDIR" ? { kind: "absent" } : { kind: "unreadable", code };
};

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
    return failedState(error);
  }
}

// What sits at a path without following it: nothing, a directory, a file, something else, a symlink with its readlink
// text, or a path it can't lstat (with the error code). pathState answers what node finds there once it follows the
// links. A tree entry (shape.mjs's listFiles) is one of these kinds too.
export function appPathState(p) {
  try {
    const stat = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!stat) return { kind: "absent" };
    if (stat.isSymbolicLink()) return { kind: "link", target: fs.readlinkSync(p) };
    return { kind: kindOf(stat) };
  } catch (error) {
    return failedState(error);
  }
}

export function describeEntry(state) {
  if (state.kind === "link") return `a link to ${state.target}`;
  if (state.kind === "unreadable") return `a path it can't read (${state.code})`;
  return { absent: "nothing", dir: "a directory", file: "a file", special: "a special file" }[state.kind];
}

// [LAW:types-are-the-program] Each state a reader can find instead of what it wanted, and the one field that says why,
// so a state with no entry here is an error, not a reason with a gap in it.
const STATE_DETAIL = { absent: null, dir: null, file: null, special: null, dangling: "target", unreadable: "code", "not-json": "message", "wrong-shape": "holds" };

export function pathStateText(state) {
  if (!Object.hasOwn(STATE_DETAIL, state.kind)) throw new Error(`a ${state.kind} state has no reason text`);
  const field = STATE_DETAIL[state.kind];
  return field === null ? state.kind : `${state.kind}:${state[field]}`;
}

// Why a path that should hold a kind of thing doesn't: it holds another kind, or it can't be read to tell.
export const mismatchText = (expected, state) => (state.kind === "unreadable" ? `can't be read (${state.code})` : `is not a ${expected} (${pathStateText(state)})`);

const ABSENT = { kind: "absent", reason: "does not exist" };
const unusable = (state, reason) => ({ kind: "unusable", state, reason });
const NOUN = { dir: "directory", file: "file" };
// The access a kind needs to be used: a directory searched, a file read.
const ACCESS = { dir: fs.constants.X_OK, file: fs.constants.R_OK };

// An input a tool was given: { kind: "dir" } or { kind: "file" }, one of the kinds it accepts and usable as one, or
// why not. A directory is usable when it can be searched, whether or not it can be listed.
export function inputAt(p, ...kinds) {
  const state = pathState(p);
  if (state.kind === "absent") return ABSENT;
  if (!kinds.includes(state.kind)) return unusable(state, mismatchText(kinds.map((kind) => NOUN[kind]).join(" or "), state));
  try {
    fs.accessSync(p, ACCESS[state.kind]);
  } catch (error) {
    const unreadable = { kind: "unreadable", code: pathErrorCode(error) };
    return unusable(unreadable, mismatchText(NOUN[state.kind], unreadable));
  }
  return { kind: state.kind };
}

// A regular file's contents, read by read(file), or why there are none. Links are followed, as node follows them.
function readFile(file, read) {
  const state = pathState(file);
  if (state.kind === "absent") return ABSENT;
  if (state.kind !== "file") return unusable(state, mismatchText("file", state));
  try {
    return read(file);
  } catch (error) {
    const unreadable = { kind: "unreadable", code: pathErrorCode(error) };
    return unusable(unreadable, mismatchText("file", unreadable));
  }
}

// The exact text a file holds, a leading byte order mark kept, so a tool that rewrites the file changes only what it
// means to.
export const readText = (file) => readFile(file, (f) => ({ kind: "text", text: fs.readFileSync(f, "utf8") }));

const JSON_TYPE_TEXT = { null: "JSON null", array: "a JSON array", object: "a JSON object", string: "a JSON string", number: "a JSON number", boolean: "a JSON boolean" };

// [LAW:one-source-of-truth] The JSON a file holds, read as npm reads its JSON files: a leading UTF-8 byte order mark
// is not text. Its value must have shape (a JSON_SHAPE), or the file is unusable with the type it holds.
export function readJson(file, shape) {
  const read = readText(file);
  if (read.kind !== "text") return read;
  let value;
  try {
    value = JSON.parse(read.text.replace(/^﻿/, ""));
  } catch (error) {
    return unusable({ kind: "not-json", message: error.message }, `doesn't parse as JSON: ${error.message}`);
  }
  if (!shape.holds(value)) return unusable({ kind: "wrong-shape", holds: jsonTypeOf(value) }, `is ${JSON_TYPE_TEXT[jsonTypeOf(value)]}, not ${JSON_TYPE_TEXT[shape.type]}`);
  return { kind: "json", value };
}


// A file's sha256, read in chunks, so a file past what one read can hold (an asar over 2 GiB) still has one.
export const fileDigest = (file) => readFile(file, (f) => {
  const hash = createHash("sha256");
  const chunk = Buffer.alloc(1 << 20);
  const fd = fs.openSync(f, "r");
  try {
    for (let n = fs.readSync(fd, chunk); n > 0; n = fs.readSync(fd, chunk)) hash.update(chunk.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return { kind: "digest", sha256: hash.digest("hex") };
});

// A directory's entries, or the error code that kept them from being read.
export function listDir(dir) {
  try {
    return { kind: "listed", entries: fs.readdirSync(dir, { withFileTypes: true }) };
  } catch (error) {
    return { kind: "unlistable", code: pathErrorCode(error) };
  }
}
