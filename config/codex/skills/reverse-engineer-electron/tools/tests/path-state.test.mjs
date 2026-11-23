import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";
import { JSON_SHAPE } from "../json-value.mjs";
import { fileDigest, inputAt, pathState, readJson, readText } from "../path-state.mjs";

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// A path in a fresh temp dir, made by make.
function pathMadeBy(make) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-path-state-"));
  roots.push(root);
  const file = path.join(root, "input.json");
  make(file, root);
  return file;
}

const readAt = (make, shape = JSON_SHAPE.object) => readJson(pathMadeBy(make), shape);

const parseError = (text) => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error.message;
  }
};

const restrictsRoot = { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false };

test("readJson gives a file's JSON value, with a leading byte order mark read as npm reads it", () => {
  assert.deepEqual(readAt((file) => writeText(file, '{"name":"a"}')), { kind: "json", value: { name: "a" } });
  assert.deepEqual(readAt((file) => writeText(file, '﻿{"name":"a"}')), { kind: "json", value: { name: "a" } });
});

test("readJson tells a path that isn't there from one that is there but holds no JSON, and says why in one sentence", () => {
  const cases = [
    [() => {}, { kind: "absent", reason: "is missing" }],
    [(file) => fs.symlinkSync("gone.json", file), { kind: "unusable", state: { kind: "dangling", target: "gone.json" }, reason: "is not a file (dangling:gone.json)" }],
    [(file) => fs.mkdirSync(file), { kind: "unusable", state: { kind: "dir" }, reason: "is not a file (dir)" }],
    [(file) => assert.equal(spawnSync("mkfifo", [file]).status, 0), { kind: "unusable", state: { kind: "special" }, reason: "is not a file (special)" }],
    [(file) => writeText(file, "{ not json"), { kind: "unusable", state: { kind: "invalid-json", error: parseError("{ not json") }, reason: `doesn't parse as JSON: ${parseError("{ not json")}` }],
  ];
  for (const [make, expected] of cases) assert.deepEqual(readAt(make), expected, expected.reason);
});

test("readJson gives only a value of the shape the tool reads, and names the shape it got instead", () => {
  const cases = [
    ["null", JSON_SHAPE.object, "is not a JSON object (it holds null)"],
    ["[]", JSON_SHAPE.object, "is not a JSON object (it holds an array)"],
    ['{"a":1}', JSON_SHAPE.array, "is not a JSON array (it holds an object)"],
    ["5", JSON_SHAPE.array, "is not a JSON array (it holds a number)"],
  ];
  for (const [text, shape, reason] of cases) {
    const read = readAt((file) => writeText(file, text), shape);
    assert.equal(read.kind, "unusable", text);
    assert.equal(read.reason, reason);
  }
  assert.deepEqual(readAt((file) => writeText(file, "[1]"), JSON_SHAPE.array), { kind: "json", value: [1] });
});

test("readJson reports a file it can't read by its error code", restrictsRoot, () => {
  const read = readAt((file) => {
    writeText(file, "{}");
    fs.chmodSync(file, 0o000);
  });
  assert.deepEqual(read, { kind: "unusable", state: { kind: "unreadable", code: "EACCES" }, reason: "can't be read (EACCES)" });
});

test("inputAt reports a file that can be stat'd but not read, so a tool never takes it for usable", restrictsRoot, () => {
  const file = pathMadeBy((file) => {
    writeText(file, "x");
    fs.chmodSync(file, 0o000);
  });
  assert.deepEqual(inputAt(file, "file"), { kind: "unusable", state: { kind: "unreadable", code: "EACCES" }, reason: "can't be read (EACCES)" });
  assert.deepEqual(inputAt(path.dirname(file), "dir"), { kind: "dir" });
});

test("a path through a regular file holds nothing, and a caller's bad argument is a bug, not an unreadable path", () => {
  const file = pathMadeBy((file) => writeText(file, "{}"));
  assert.equal(pathState(path.join(file, "below")).kind, "absent");
  assert.equal(inputAt(path.join(file, "below"), "dir").reason, "is missing");
  assert.throws(() => pathState(123), { code: "ERR_INVALID_ARG_TYPE" });
});

test("readText gives a file's text as it is on disk, a byte order mark included", () => {
  const file = pathMadeBy((file) => writeText(file, "﻿var a;"));
  assert.deepEqual(readText(file), { kind: "text", text: "﻿var a;" });
});

test("a file node won't read whole is a fact about the path, not a bug", () => {
  const file = pathMadeBy((file) => {
    fs.writeFileSync(file, "");
    fs.truncateSync(file, 3 * 1024 ** 3);
  });
  const read = readText(file);
  assert.equal(read.kind, "unusable");
  assert.equal(read.reason, "can't be read (ERR_FS_FILE_TOO_LARGE)");
});

test("fileDigest is the sha256 of a file's bytes, read across more than one chunk", () => {
  const bytes = Buffer.alloc(2.5 * 1024 * 1024, "ab");
  const file = pathMadeBy((file) => fs.writeFileSync(file, bytes));
  assert.deepEqual(fileDigest(file), { kind: "sha256", hex: createHash("sha256").update(bytes).digest("hex") });
  assert.equal(fileDigest(path.dirname(file)).reason, "is not a file (dir)");
});
