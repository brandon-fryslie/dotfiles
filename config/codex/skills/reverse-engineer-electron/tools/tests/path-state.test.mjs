import assert from "node:assert/strict";
import { constants } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JSON_SHAPE } from "../json-value.mjs";
import { appPathState, fileDigest, inputAt, pathErrorCode, pathState, readJson, readText } from "../path-state.mjs";

const AS_ROOT = process.getuid?.() === 0 && "root reads everything";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-path-state-"));
}

test("a path under a file is absent, not unreadable: nothing can be there", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "plain"), "x");
  const under = path.join(dir, "plain", "package.json");
  assert.deepEqual(pathState(under), { kind: "absent" });
  assert.deepEqual(appPathState(under), { kind: "absent" });
  assert.equal(readJson(under, JSON_SHAPE.object).kind, "absent");
  assert.equal(inputAt(under, "file").kind, "absent");
});

test("each reader tells a file it can't read from one that isn't there", { skip: AS_ROOT }, () => {
  const dir = tmpDir();
  const locked = path.join(dir, "locked.json");
  fs.writeFileSync(locked, "{}");
  fs.chmodSync(locked, 0o000);
  try {
    for (const read of [readText(locked), readJson(locked, JSON_SHAPE.object), fileDigest(locked), inputAt(locked, "file")]) {
      assert.equal(read.kind, "unusable");
      assert.equal(read.reason, "can't be read (EACCES)");
    }
    for (const read of [readText(path.join(dir, "gone.json")), fileDigest(path.join(dir, "gone.json")), inputAt(path.join(dir, "gone.json"), "file")]) {
      assert.deepEqual(read, { kind: "absent", reason: "does not exist" });
    }
  } finally {
    fs.chmodSync(locked, 0o644);
  }
});

test("a directory a tool must search is unusable once it can't be searched", { skip: AS_ROOT }, () => {
  const dir = tmpDir();
  const locked = path.join(dir, "locked");
  fs.mkdirSync(locked);
  fs.chmodSync(locked, 0o600);
  try {
    assert.equal(inputAt(locked, "dir").reason, "can't be read (EACCES)");
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

test("a link to nowhere, a directory, or a special file is not a file, and says what it is", () => {
  const dir = tmpDir();
  fs.symlinkSync("nowhere.json", path.join(dir, "dangling.json"));
  fs.mkdirSync(path.join(dir, "folder.json"));
  assert.equal(readJson(path.join(dir, "dangling.json"), JSON_SHAPE.object).reason, "is not a file (dangling:nowhere.json)");
  assert.equal(readText(path.join(dir, "folder.json")).reason, "is not a file (dir)");
  assert.equal(inputAt(path.join(dir, "folder.json"), "file").reason, "is not a file (dir)");
  assert.equal(inputAt(path.join(dir, "dangling.json"), "dir", "file").reason, "is not a directory or file (dangling:nowhere.json)");
});

test("readJson drops a leading byte order mark as npm does, and readText keeps it so a rewrite changes only what it means to", () => {
  const file = path.join(tmpDir(), "package.json");
  fs.writeFileSync(file, `﻿{"name":"x"}`);
  assert.deepEqual(readJson(file, JSON_SHAPE.object), { kind: "json", value: { name: "x" } });
  assert.equal(readText(file).text, `﻿{"name":"x"}`);
});

test("readJson names the JSON a file holds when it isn't the shape asked for, and the parse error when it isn't JSON", () => {
  const dir = tmpDir();
  const cases = [
    ["null", JSON_SHAPE.object, "is JSON null, not a JSON object"],
    ["[1]", JSON_SHAPE.object, "is a JSON array, not a JSON object"],
    ["{}", JSON_SHAPE.array, "is a JSON object, not a JSON array"],
    ['"x"', JSON_SHAPE.array, "is a JSON string, not a JSON array"],
  ];
  for (const [text, shape, reason] of cases) {
    fs.writeFileSync(path.join(dir, "f.json"), text);
    assert.equal(readJson(path.join(dir, "f.json"), shape).reason, reason, text);
  }
  fs.writeFileSync(path.join(dir, "f.json"), "{ nope");
  assert.match(readJson(path.join(dir, "f.json"), JSON_SHAPE.object).reason, /^doesn't parse as JSON: /);
});

test("a file past what one string can hold is unusable with node's code, not a crash", () => {
  const file = path.join(tmpDir(), "huge.asar");
  const fd = fs.openSync(file, "w");
  try {
    // Sparse: one NUL byte more than a string holds, almost none of it on disk.
    fs.ftruncateSync(fd, constants.MAX_STRING_LENGTH + 1);
  } finally {
    fs.closeSync(fd);
  }
  try {
    const read = readText(file);
    assert.equal(read.kind, "unusable");
    assert.match(read.reason, /^can't be read \(ERR_STRING_TOO_LONG\)$/);
  } finally {
    fs.rmSync(file);
  }
});

test("fileDigest hashes a file across many reads to the same sha256 as one read", () => {
  const file = path.join(tmpDir(), "multi-chunk.bin");
  const bytes = Buffer.alloc(3 * (1 << 20) + 12345);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31) & 0xff;
  fs.writeFileSync(file, bytes);
  assert.deepEqual(fileDigest(file), { kind: "digest", sha256: createHash("sha256").update(bytes).digest("hex") });
});

test("an error that is no fact about a path is thrown, not reported as one", () => {
  const bug = new TypeError("x is not a function");
  assert.throws(() => pathErrorCode(bug), (error) => error === bug);
  assert.equal(pathErrorCode(Object.assign(new Error("denied"), { code: "EACCES", syscall: "open" })), "EACCES");
});
