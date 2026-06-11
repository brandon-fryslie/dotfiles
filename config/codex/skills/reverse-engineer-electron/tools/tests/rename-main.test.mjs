import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "rename-main.mjs",
);

// The script reads/writes app/main.js relative to its cwd.
function mkWorkspace(name, mainJs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-rename-test-"));
  const workDir = path.join(root, name);
  fs.mkdirSync(path.join(workDir, "app"), { recursive: true });
  fs.writeFileSync(path.join(workDir, "app", "main.js"), mainJs);
  return workDir;
}

function runRename(workDir) {
  return spawnSync("node", [SCRIPT], { cwd: workDir, encoding: "utf8" });
}

const VALID_MAIN = [
  'var i = require("electron");',
  "module.exports = function (d, l, g) {",
  "  console.log(d, l, g);",
  "};",
  "",
].join("\n");

const INVALID_MAIN = [
  "module.exports = function (d, l, g) {",
  "  console.log(d, l, g);",
  "", // missing closing brace: stays a syntax error after renames
].join("\n");

test("successful rename passes the syntax check when cwd contains a space", () => {
  const workDir = mkWorkspace("dir with space", VALID_MAIN);

  const result = runRename(workDir);
  assert.equal(
    result.status,
    0,
    `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /Syntax check PASSED/);

  const renamed = fs.readFileSync(
    path.join(workDir, "app", "main.js"),
    "utf8",
  );
  assert.match(renamed, /module\.exports = function \(appPath, updater, isDev\)/);
});

test("successful rename passes the syntax check on a plain path", () => {
  const workDir = mkWorkspace("plain", VALID_MAIN);

  const result = runRename(workDir);
  assert.equal(
    result.status,
    0,
    `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /Syntax check PASSED/);
});

test("genuinely broken output still fails the syntax check under a spaced cwd", () => {
  const workDir = mkWorkspace("broken with space", INVALID_MAIN);

  const result = runRename(workDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SYNTAX ERROR/);
  // The failure must come from parsing the file, not from node failing to find it.
  assert.doesNotMatch(result.stderr, /Cannot find module|MODULE_NOT_FOUND/);
});

test("missing exported function exits 1 without writing", () => {
  const workDir = mkWorkspace("no-export", "var x = 1;\n");

  const result = runRename(workDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exported function/);
});
