import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { listFiles, SOURCE_TREE_EXCLUDES } from "../shape.mjs";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

function runNode(scriptPath, args, cwd) {
  return spawnSync("node", [path.join(TOOLS_DIR, scriptPath), ...args], { cwd, encoding: "utf8" });
}

function inputTree() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ec-walk-"));
  fs.mkdirSync(path.join(tmp, "input", "node_modules", "dep"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "input", "main.js"), "function main(a){return a+1}");
  fs.writeFileSync(path.join(tmp, "input", "node_modules", "dep", "index.js"), "function dep(b){return b*2}");
  return tmp;
}

test("listFiles honors the exclude set it is given", () => {
  const tmp = inputTree();
  assert.deepEqual(listFiles(path.join(tmp, "input"), SOURCE_TREE_EXCLUDES), ["main.js"]);
  assert.deepEqual(listFiles(path.join(tmp, "input"), new Set()), ["main.js", "node_modules/dep/index.js"]);
});

// Ticket 67o: gate walked with its own exclude set (only .git), so it demanded
// prepared copies of node_modules files prepare never wrote.
test("gate prepare passes over an input containing node_modules", () => {
  const tmp = inputTree();

  const prep = runNode("prepare.mjs", [path.join(tmp, "input"), path.join(tmp, "prepared")], tmp);
  assert.equal(prep.status, 0, `prepare.mjs failed:\n${prep.stdout}\n${prep.stderr}`);

  const gate = runNode(
    "gate.mjs",
    ["prepare", "--orig", path.join(tmp, "input"), "--prepared", path.join(tmp, "prepared"),
     "--manifest", path.join(tmp, "prepared", "manifest.json"), "--out", path.join(tmp, "gate.json")],
    tmp,
  );
  assert.equal(gate.status, 0, `gate.mjs prepare failed:\n${gate.stdout}\n${gate.stderr}`);
  const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "gate.json"), "utf8"));
  assert.equal(artifact.pass, true);
  assert.deepEqual(artifact.mismatches.missingFiles, []);
  assert.equal(artifact.metrics.filesCompared, 1);
});

test("listFiles throws on an unreadable root instead of returning a shorter inventory", () => {
  const tmp = inputTree();
  assert.throws(() => listFiles(path.join(tmp, "absent"), SOURCE_TREE_EXCLUDES), /ENOENT/);
});

// The remove-deps gate checks the app's own code is unchanged. node_modules is
// what remove-deps changes: replace-dependency swaps a package dir for a symlink,
// which no walk descends, so a walk that listed node_modules reported every
// swapped package's files as missing and failed the gate on its own success.
test("gate remove-deps passes when the only change is a swapped package", () => {
  const tmp = inputTree();
  const baseline = path.join(tmp, "input");
  const working = path.join(tmp, "working");
  fs.cpSync(baseline, working, { recursive: true });
  const swapped = path.join(working, "node_modules", "dep");
  fs.rmSync(swapped, { recursive: true });
  fs.symlinkSync(path.join(baseline, "node_modules", "dep"), swapped, "junction");

  const depsDir = path.join(tmp, "deps");
  fs.mkdirSync(depsDir);
  fs.writeFileSync(path.join(depsDir, "near-matches.json"), "{}");
  fs.writeFileSync(path.join(depsDir, "replacements.json"), JSON.stringify({ packages: {} }));

  const gate = runNode(
    "gate.mjs",
    ["remove-deps", "--baseline", baseline, "--working", working,
     "--deps-dir", depsDir, "--out", path.join(tmp, "gate.json")],
    tmp,
  );
  assert.equal(gate.status, 0, `gate.mjs remove-deps failed:\n${gate.stdout}\n${gate.stderr}`);
  const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "gate.json"), "utf8"));
  assert.equal(artifact.checks.workingCodeUnchanged, true);
  assert.equal(artifact.pass, true);
  assert.equal(artifact.metrics.baselineJsFiles, 1);
});

// The deleted try/catch was per directory: a readable root with one unreadable
// child returned the rest of the tree as if it were the whole tree.
test("listFiles throws on an unreadable subdirectory mid-walk", { skip: process.getuid?.() === 0 && "root reads everything" }, () => {
  const tmp = inputTree();
  const locked = path.join(tmp, "input", "locked");
  fs.mkdirSync(locked);
  fs.chmodSync(locked, 0o000);
  try {
    assert.throws(() => listFiles(path.join(tmp, "input"), SOURCE_TREE_EXCLUDES), /EACCES/);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});
