import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = path.join(import.meta.dirname, "..", "detect-electron-version.sh");

// An .app with no Electron Framework plist, so detection falls to the extracted package.json.
// The default directory name carries a quote, which broke the old splice of the path into JS source.
// The extracted dir is passed relative to the temp root, as a user in that directory would type it.
function appWithPackageJson(content, extractedName = "it's extracted") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-electron-version-"));
  const appPath = path.join(root, "Demo.app");
  const extractedDir = path.join(root, extractedName);
  fs.mkdirSync(appPath, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });
  fs.writeFileSync(path.join(extractedDir, "package.json"), content);
  return spawnSync("bash", [SCRIPT, appPath, extractedName], { cwd: root, encoding: "utf8" });
}

test("reads the electron version from package.json in a path containing a quote", () => {
  const result = appWithPackageJson(JSON.stringify({ devDependencies: { electron: "^32.4.1" } }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "32.4.1 32");
});

test("a malformed package.json fails with node's error, not 'could not determine'", () => {
  const result = appWithPackageJson("{ not json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SyntaxError/);
  assert.match(result.stderr, /node could not read the electron version/);
  assert.doesNotMatch(result.stderr, /Could not determine/);
});

test("an extracted dir starting with '-' reaches node as a path, not an option", () => {
  const result = appWithPackageJson(JSON.stringify({ dependencies: { electron: "31.0.2" } }), "-extracted");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "31.0.2 31");
});

test("a package.json with no electron dependency reports the version as undeterminable", () => {
  const result = appWithPackageJson(JSON.stringify({ name: "x" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not determine Electron version/);
});
