import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { writeText } from "./fixtures.mjs";

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "detect-build-dir.mjs",
);

function mkTmpDir(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-detect-test-"));
  const appDir = path.join(root, name);
  fs.mkdirSync(appDir, { recursive: true });
  return appDir;
}

function runDetect(appDir) {
  return spawnSync(process.execPath, [SCRIPT, appDir], { encoding: "utf8" });
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

test("package.json is read as npm reads it: a leading byte order mark, and a manifest over 300 KB", () => {
  for (const [name, text] of [
    ["bom-app", `\uFEFF${JSON.stringify({ main: "dist/main.js" })}`],
    ["big-app", JSON.stringify({ main: "dist/main.js", description: "x".repeat(400 * 1024) })],
  ]) {
    const appDir = mkTmpDir(name);
    writeText(path.join(appDir, "package.json"), text);
    writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");
    writeText(path.join(appDir, "decoy", "a.js"), "1;\n");
    writeText(path.join(appDir, "decoy", "b.js"), "2;\n");

    const result = runDetect(appDir);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.equal(detectedPath(result), "dist", name);
  }
});

test("a package.json that is there but can't be used is reported with its path and why, never the heuristic", () => {
  for (const [content, message] of [
    ["null", /package\.json is JSON null, not a JSON object/],
    ["[]", /package\.json is a JSON array, not a JSON object/],
  ]) {
    const appDir = mkTmpDir("unusable-pkg");
    writeText(path.join(appDir, "package.json"), content);
    writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");

    const result = runDetect(appDir);
    assert.equal(result.status, 1, content);
    assert.match(result.stderr, message);
  }
  const appDir = mkTmpDir("dangling-pkg");
  fs.symlinkSync("gone.json", path.join(appDir, "package.json"));
  writeText(path.join(appDir, "dist", "main.js"), "console.log(1);\n");
  const result = runDetect(appDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package\.json is not a file \(dangling:gone\.json\)/);
});

test("the build dir holds the file Electron loads: main without an extension, a main directory, index.js for a main that names nothing", () => {
  const cases = [
    [{ main: "out/main" }, { "out/main.js": "1;" }, "out"],
    [{ main: "lib" }, { "lib/index.js": "1;" }, "lib"],
    [{ main: "./src/app.js" }, { "src/app.js": "1;" }, "src"],
    [{ main: "missing.js" }, { "index.js": "1;" }, "."],
  ];
  for (const [manifest, files, expected] of cases) {
    const appDir = mkTmpDir("resolve-app");
    writeText(path.join(appDir, "package.json"), JSON.stringify(manifest));
    for (const [rel, content] of Object.entries(files)) writeText(path.join(appDir, rel), content);
    writeText(path.join(appDir, "decoy", "a.js"), "1;\n");
    writeText(path.join(appDir, "decoy", "b.js"), "2;\n");

    const result = runDetect(appDir);
    assert.equal(result.status, 0, `${JSON.stringify(manifest)}: ${result.stderr}`);
    assert.equal(detectedPath(result), expected, JSON.stringify(manifest));
  }
});

test("a sibling file named after the app dir is never taken for its entry point", () => {
  const appDir = mkTmpDir("app");
  writeText(path.join(appDir, "package.json"), JSON.stringify({ name: "x" }));
  writeText(path.join(appDir, "index.js"), "1;\n");
  writeText(path.join(appDir, "build", "a.js"), "1;\n");
  writeText(path.join(appDir, "build", "b.js"), "2;\n");
  writeText(`${appDir}.js`, "sibling;\n");

  const result = runDetect(appDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(detectedPath(result), ".");
});

test("the heuristic counts only regular files: a JS-named link is named, never read through", () => {
  const appDir = mkTmpDir("linked-app");
  const outside = path.join(path.dirname(appDir), "outside");
  for (const name of ["a.js", "b.js", "c.js"]) writeText(path.join(outside, name), "1;\n");
  writeText(path.join(appDir, "real", "main.js"), "1;\n");
  fs.mkdirSync(path.join(appDir, "links"));
  for (const name of ["a.js", "b.js", "c.js"]) fs.symlinkSync(path.join(outside, name), path.join(appDir, "links", name));
  fs.symlinkSync(outside, path.join(appDir, "vendor"));

  const result = runDetect(appDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(detectedPath(result), "real");
  assert.match(result.stderr, /links\/a\.js is a link to .*outside\/a\.js, so it is not read/);
});
