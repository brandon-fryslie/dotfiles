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
  "detect-build-dir.sh",
);

function mkTmpDir(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-detect-test-"));
  const appDir = path.join(root, name);
  fs.mkdirSync(appDir, { recursive: true });
  return appDir;
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runDetect(appDir) {
  return spawnSync("bash", [SCRIPT, appDir], { encoding: "utf8" });
}

// stdout contract: last line is the relative build dir (stderr carries the chatter).
function detectedPath(result) {
  const lines = result.stdout.trim().split("\n");
  return lines[lines.length - 1];
}

test("heuristic fallback preserves build paths containing spaces", () => {
  const appDir = mkTmpDir("Visual Studio Code.app");
  writeText(path.join(appDir, "out dir", "a.js"), "console.log(1);\n");
  writeText(path.join(appDir, "out dir", "b.js"), "console.log(2);\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(detectedPath(result), "out dir");
});

test("malformed package.json fails loudly instead of degrading to the heuristic", () => {
  const appDir = mkTmpDir("broken-pkg");
  writeText(path.join(appDir, "package.json"), "{ not valid json !!");
  writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");

  const result = runDetect(appDir);
  assert.notEqual(result.status, 0, "parse failure must not exit 0");
  assert.match(result.stderr, /package\.json/);
});

test("package.json main is honored when the app path contains a single quote", () => {
  const appDir = mkTmpDir("It's An App.app");
  writeText(
    path.join(appDir, "package.json"),
    JSON.stringify({ main: "dist/main.js" }),
  );
  writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");
  // Decoy: heuristic would pick this dir (more .js files) if main parsing breaks.
  writeText(path.join(appDir, "decoy", "a.js"), "1;\n");
  writeText(path.join(appDir, "decoy", "b.js"), "2;\n");
  writeText(path.join(appDir, "decoy", "c.js"), "3;\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(detectedPath(result), "dist");
});

test("package.json main is honored on the plain path", () => {
  const appDir = mkTmpDir("plain-app");
  writeText(
    path.join(appDir, "package.json"),
    JSON.stringify({ main: "dist/main.js" }),
  );
  writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(detectedPath(result), "dist");
});

test("package.json without a main falls through to the heuristic", () => {
  const appDir = mkTmpDir("no-main-app");
  writeText(path.join(appDir, "package.json"), JSON.stringify({ name: "x" }));
  writeText(path.join(appDir, "build", "a.js"), "1;\n");
  writeText(path.join(appDir, "build", "b.js"), "2;\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(detectedPath(result), "build");
});

test("js files at the app root detect as '.'", () => {
  const appDir = mkTmpDir("root-app");
  writeText(path.join(appDir, "a.js"), "1;\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(detectedPath(result), ".");
});

test("no candidates exits 1", () => {
  const appDir = mkTmpDir("empty-app");

  const result = runDetect(appDir);
  assert.equal(result.status, 1);
});
