import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = path.join(import.meta.dirname, "..", "detect-electron-version.mjs");

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
  return spawnSync(process.execPath, [SCRIPT, appPath, extractedName], { cwd: root, encoding: "utf8" });
}

test("reads the electron version from package.json in a path containing a quote", () => {
  const result = appWithPackageJson(JSON.stringify({ devDependencies: { electron: "32.4.1" } }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "32.4.1 32");
});

test("a malformed package.json fails naming the file and the JSON error, not 'could not determine'", () => {
  const result = appWithPackageJson("{ not json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /it's extracted\/package\.json doesn't parse as JSON: /);
  assert.doesNotMatch(result.stderr, /Could not determine/);
});

test("package.json is read as npm reads it, a leading byte order mark included", () => {
  const result = appWithPackageJson(`\uFEFF${JSON.stringify({ devDependencies: { electron: "33.0.1" } })}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "33.0.1 33");
});

test("prints only a spec that names one version: exact, =exact or vexact, never a range or a tag", () => {
  const cases = [
    ["30.1.2", "30.1.2 30"],
    ["=30.1.2", "30.1.2 30"],
    ["v30.1.2", "30.1.2 30"],
    ["31.0.0-beta.3", "31.0.0-beta.3 31"],
    ["^32.4.1", null],
    ["~32.4.1", null],
    [">=30.0.0 <32", null],
    ["32.x", null],
    ["latest", null],
    [32, null],
  ];
  for (const [spec, printed] of cases) {
    const result = appWithPackageJson(JSON.stringify({ dependencies: { electron: spec } }));
    if (printed === null) {
      assert.equal(result.status, 1, JSON.stringify(spec));
      assert.equal(result.stdout, "", JSON.stringify(spec));
      assert.match(result.stderr, /gives electron .*, which names no one version/, JSON.stringify(spec));
    } else {
      assert.equal(result.status, 0, `${spec}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), printed, JSON.stringify(spec));
    }
  }
});

test("a package.json that is there but can't be used is reported with its path and why, never as no version", () => {
  const cases = [
    ["null", /package\.json is JSON null, not a JSON object/],
    ["[]", /package\.json is a JSON array, not a JSON object/],
  ];
  for (const [content, message] of cases) {
    const result = appWithPackageJson(content);
    assert.equal(result.status, 1, content);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /Could not determine/);
  }
});

test("an Electron Framework Info.plist that is there but isn't a file is reported, not skipped", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-electron-version-"));
  const plist = path.join(root, "Demo.app", "Contents", "Frameworks", "Electron Framework.framework", "Resources", "Info.plist");
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.symlinkSync("nowhere.plist", plist);
  const result = spawnSync(process.execPath, [SCRIPT, path.join(root, "Demo.app")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Info\.plist is not a file \(dangling:nowhere\.plist\)/);
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
