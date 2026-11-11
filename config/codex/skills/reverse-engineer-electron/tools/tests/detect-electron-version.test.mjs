import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = path.join(import.meta.dirname, "..", "detect-electron-version.sh");

// An .app with no Electron Framework plist, so detection falls to the extracted package.json.
// The directory name carries a quote, which broke the old splice of the path into JS source.
function appWithPackageJson(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-electron-version-"));
  const appPath = path.join(root, "Demo.app");
  const extractedDir = path.join(root, "it's extracted");
  fs.mkdirSync(appPath, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });
  fs.writeFileSync(path.join(extractedDir, "package.json"), content);
  return spawnSync("bash", [SCRIPT, appPath, extractedDir], { encoding: "utf8" });
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
  assert.match(result.stderr, /failed to parse/);
  assert.doesNotMatch(result.stderr, /Could not determine/);
});

test("a package.json with no electron dependency reports the version as undeterminable", () => {
  const result = appWithPackageJson(JSON.stringify({ name: "x" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not determine Electron version/);
});
