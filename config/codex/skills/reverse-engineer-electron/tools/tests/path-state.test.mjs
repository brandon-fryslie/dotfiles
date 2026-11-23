import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";
import { mismatchText, readJson } from "../path-state.mjs";

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// What readJson reads from a path made by make.
function readAt(make) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-path-state-"));
  roots.push(root);
  const file = path.join(root, "input.json");
  make(file);
  return readJson(file);
}

const parseError = (text) => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error.message;
  }
};

test("readJson gives a file's JSON value, with a leading byte order mark read as npm reads it", () => {
  assert.deepEqual(readAt((file) => writeText(file, '{"name":"a"}')), { kind: "json", value: { name: "a" } });
  assert.deepEqual(readAt((file) => writeText(file, '﻿{"name":"a"}')), { kind: "json", value: { name: "a" } });
});

test("readJson tells a path that isn't there from one that is there but holds no JSON, and says why", () => {
  const cases = [
    [() => {}, { kind: "absent" }],
    [(file) => fs.symlinkSync("gone.json", file), { kind: "dangling", target: "gone.json" }],
    [(file) => fs.mkdirSync(file), { kind: "dir" }],
    [(file) => assert.equal(spawnSync("mkfifo", [file]).status, 0), { kind: "special" }],
    [(file) => writeText(file, "{ not json"), { kind: "invalid-json", error: parseError("{ not json") }],
  ];
  for (const [make, expected] of cases) assert.deepEqual(readAt(make), expected, expected.kind);
});

test("readJson reports a file it can't read by its error code", { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false }, () => {
  const read = readAt((file) => {
    writeText(file, "{}");
    fs.chmodSync(file, 0o000);
  });
  assert.deepEqual(read, { kind: "unreadable", code: "EACCES" });
});

test("mismatchText says why a path doesn't hold what was expected, in one sentence per state", () => {
  const cases = [
    [{ kind: "absent" }, "is missing"],
    [{ kind: "dangling", target: "gone.json" }, "is not a file (dangling:gone.json)"],
    [{ kind: "dir" }, "is not a file (dir)"],
    [{ kind: "special" }, "is not a file (special)"],
    [{ kind: "unreadable", code: "EACCES" }, "can't be read (EACCES)"],
    [{ kind: "invalid-json", error: "Unexpected end" }, "doesn't parse as JSON: Unexpected end"],
  ];
  for (const [state, text] of cases) assert.equal(mismatchText("file", state), text);
});
