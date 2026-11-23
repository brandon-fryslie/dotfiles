// Each tool tells an input that isn't there from one that is there but can't be read, and names the second with its
// path and why; and every tool reads a JSON input the same way, a leading byte order mark included.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";

const TOOLS_DIR = path.join(import.meta.dirname, "..");

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function mkTmpDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-unreadable-"));
  roots.push(root);
  return root;
}

const node = (script, args, cwd) => spawnSync(process.execPath, [path.join(TOOLS_DIR, script), ...args], { cwd, encoding: "utf8" });
const bash = (script, args, cwd) => spawnSync("bash", [path.join(TOOLS_DIR, script), ...args], { cwd, encoding: "utf8" });

// A link at p leading nowhere: an input that is there, but holds nothing a tool can read.
function dangle(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.symlinkSync("gone", p);
  return p;
}

const DANGLING = "is not a file (dangling:gone)";

test("read-json gives a file's JSON value as npm reads it, exits 3 when nothing is there, and names a file it can't read", () => {
  const tmp = mkTmpDir();
  const file = path.join(tmp, "package.json");
  writeText(file, '﻿{"main":"index.js"}');
  const read = node("read-json.mjs", [file], tmp);
  assert.equal(read.status, 0, read.stderr);
  assert.deepEqual(JSON.parse(read.stdout), { main: "index.js" });

  assert.equal(node("read-json.mjs", [path.join(tmp, "absent.json")], tmp).status, 3);

  const dangling = node("read-json.mjs", [dangle(path.join(tmp, "dangling.json"))], tmp);
  assert.equal(dangling.status, 1);
  assert.equal(dangling.stderr.trim(), `Error: ${path.join(tmp, "dangling.json")} ${DANGLING}`);
});

test("detect-build-dir reads a package.json that begins with a byte order mark, and stops at one it can't read instead of guessing", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "app", "package.json"), `﻿${JSON.stringify({ main: "src/main.js" })}`);
  writeText(path.join(tmp, "app", "src", "main.js"), "console.log(1);\n");
  writeText(path.join(tmp, "app", "other", "a.js"), "1;\n");
  writeText(path.join(tmp, "app", "other", "b.js"), "2;\n");
  const bom = bash("detect-build-dir.sh", [path.join(tmp, "app")], tmp);
  assert.equal(bom.status, 0, bom.stderr);
  assert.equal(bom.stdout.trim(), "src");

  fs.rmSync(path.join(tmp, "app", "package.json"));
  const manifest = dangle(path.join(tmp, "app", "package.json"));
  const dangling = bash("detect-build-dir.sh", [path.join(tmp, "app")], tmp);
  assert.equal(dangling.status, 1);
  assert.ok(dangling.stderr.includes(`${manifest} ${DANGLING}`), dangling.stderr);
  assert.equal(dangling.stdout, "");
});

test("detect-electron-version reads a package.json that begins with a byte order mark, and names one it can't read", () => {
  const tmp = mkTmpDir();
  fs.mkdirSync(path.join(tmp, "App.app"));
  writeText(path.join(tmp, "extracted", "package.json"), `﻿${JSON.stringify({ devDependencies: { electron: "^31.0.2" } })}`);
  const bom = bash("detect-electron-version.sh", [path.join(tmp, "App.app"), path.join(tmp, "extracted")], tmp);
  assert.equal(bom.status, 0, bom.stderr);
  assert.equal(bom.stdout.trim(), "31.0.2 31");

  fs.rmSync(path.join(tmp, "extracted", "package.json"));
  const manifest = dangle(path.join(tmp, "extracted", "package.json"));
  const dangling = bash("detect-electron-version.sh", [path.join(tmp, "App.app"), path.join(tmp, "extracted")], tmp);
  assert.equal(dangling.status, 1);
  assert.ok(dangling.stderr.includes(`${manifest} ${DANGLING}`), dangling.stderr);
  assert.doesNotMatch(dangling.stderr, /Could not determine/);
});

test("find-near-match-versions names a dependency report it can't read, and one that isn't there as missing", () => {
  const tmp = mkTmpDir();
  const run = (deps) => node("find-near-match-versions.mjs", ["--deps", deps, "--app-dir", tmp, "--out", path.join(tmp, "near.json")], tmp);
  const dangling = run(dangle(path.join(tmp, "deps.json")));
  assert.equal(dangling.status, 2);
  assert.equal(dangling.stderr.trim(), `Dependency report ${path.join(tmp, "deps.json")} ${DANGLING}`);
  const missing = run(path.join(tmp, "absent.json"));
  assert.equal(missing.status, 2);
  assert.equal(missing.stderr.trim(), `Dependency report ${path.join(tmp, "absent.json")} is missing`);
});

test("unbundle-index and analyze name a build dir that is there but isn't a directory, and one that isn't there as missing", () => {
  const tmp = mkTmpDir();
  const file = path.join(tmp, "build-file");
  writeText(file, "");
  const dangling = dangle(path.join(tmp, "build-link"));
  const absent = path.join(tmp, "absent");
  const cases = [[file, "is not a directory (file)"], [dangling, "is not a directory (dangling:gone)"], [absent, "is missing"]];
  for (const [buildDir, reason] of cases) {
    const unbundle = node("unbundle-index.mjs", ["--build-dir", buildDir, "--out", path.join(tmp, "index.json"), "--graph-out", path.join(tmp, "graph.json")], tmp);
    assert.equal(unbundle.status, 2, reason);
    assert.equal(unbundle.stderr.trim(), `Build directory ${buildDir} ${reason}`);
    const analyze = node("analyze.mjs", [buildDir, "--out", path.join(tmp, "analysis.json")], tmp);
    assert.equal(analyze.status, 1, reason);
    assert.equal(analyze.stderr.trim(), `Error: ${buildDir} ${reason}`);
  }
});

test("detect-dependencies warns of a module index it can't read, and skips one that isn't there without a word", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "app", "package.json"), JSON.stringify({ name: "app", version: "1.0.0" }));
  writeText(path.join(tmp, "build", "main.js"), "console.log(1);\n");
  const detect = (moduleIndex) => {
    const out = path.join(tmp, "deps.json");
    const result = node("detect-dependencies.mjs", ["--app-dir", "app", "--build-dir", "build", "--out", out, "--module-index", moduleIndex], tmp);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(fs.readFileSync(out, "utf8")).warnings.filter((warning) => warning.includes("module index"));
  };
  assert.deepEqual(detect("deps/absent.json"), []);
  dangle(path.join(tmp, "deps", "module-index.json"));
  assert.deepEqual(detect("deps/module-index.json"), [`Could not read module index deps/module-index.json: it ${DANGLING}`]);
});

test("the extract and prepare gates name each required input that is there but can't be read, and each missing one", () => {
  const tmp = mkTmpDir();
  const gate = (args) => {
    const out = path.join(tmp, "gate.json");
    const result = node("gate.mjs", [...args, "--out", out], tmp);
    return { status: result.status, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
  };
  const upstream = dangle(path.join(tmp, "upstream.asar"));
  const copied = path.join(tmp, "copied.asar");
  const extracted = path.join(tmp, "extracted");
  const extract = gate(["extract", "--upstream-asar", upstream, "--copied-asar", copied, "--extracted-dir", extracted]);
  assert.equal(extract.status, 1);
  assert.equal(extract.artifact.error, `Required extract gate input: ${upstream} ${DANGLING}; ${copied} is missing; ${extracted} is missing`);

  const orig = path.join(tmp, "orig");
  fs.mkdirSync(orig);
  const prepared = dangle(path.join(tmp, "prepared"));
  const manifest = path.join(tmp, "manifest.json");
  const prepare = gate(["prepare", "--orig", orig, "--prepared", prepared, "--manifest", manifest]);
  assert.equal(prepare.status, 1);
  assert.equal(prepare.artifact.error, `Required prepare gate input: ${prepared} is not a directory (dangling:gone); ${manifest} is missing`);
});

test("report and apply-renames name a JSON input they can't read, instead of crashing", () => {
  const tmp = mkTmpDir();
  const manifest = dangle(path.join(tmp, "prepared", "manifest.json"));
  fs.mkdirSync(path.join(tmp, "demin"));
  const report = node("report.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin")], tmp);
  assert.equal(report.status, 1);
  assert.equal(report.stderr.trim(), `Error: ${manifest} ${DANGLING}`);

  writeText(path.join(tmp, "source.js"), "var a = 1;\n");
  const spec = dangle(path.join(tmp, "spec.json"));
  const renames = node("apply-renames.mjs", [path.join(tmp, "source.js"), spec], tmp);
  assert.equal(renames.status, 1);
  assert.equal(renames.stderr.trim(), `Error: rename spec ${spec} ${DANGLING}`);
});
