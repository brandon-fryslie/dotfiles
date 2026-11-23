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
  assert.deepEqual(listFiles(path.join(tmp, "input"), SOURCE_TREE_EXCLUDES), [{ rel: "main.js", kind: "file" }]);
  assert.deepEqual(listFiles(path.join(tmp, "input"), new Set()), [{ rel: "main.js", kind: "file" }, { rel: "node_modules/dep/index.js", kind: "file" }]);
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
  fs.writeFileSync(path.join(depsDir, "replacements.json"), JSON.stringify({ schemaVersion: 4, copies: {} }));

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
  assert.equal(artifact.metrics.baselineEntries, 1);
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

const AS_ROOT = process.getuid?.() === 0 && "root reads everything";

// An app tree with three links: one to a directory inside it, one to a file outside it, and one up to its own root.
function linkedTree() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ec-links-"));
  const input = path.join(tmp, "app");
  fs.mkdirSync(path.join(input, "lib"), { recursive: true });
  fs.writeFileSync(path.join(input, "main.js"), "function main(a){return a+1}");
  fs.writeFileSync(path.join(input, "lib", "x.js"), "function x(b){return b*2}");
  fs.writeFileSync(path.join(tmp, "outside.js"), "function SECRET_OUTSIDE(){return 42}");
  fs.symlinkSync("lib", path.join(input, "zz"));
  fs.symlinkSync("../outside.js", path.join(input, "leak.js"));
  fs.symlinkSync("..", path.join(input, "lib", "up"));
  return { tmp, input };
}

function gatePrepare(tmp, input, prepared) {
  const out = path.join(tmp, "gate.json");
  const gate = runNode("gate.mjs", ["prepare", "--orig", input, "--prepared", prepared, "--manifest", path.join(prepared, "manifest.json"), "--out", out], tmp);
  return { status: gate.status, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
}

// Every regular file's contents under dir, read without following a link.
function regularFileContents(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) return regularFileContents(abs);
    return entry.isFile() ? [fs.readFileSync(abs, "utf8")] : [];
  });
}

test("listFiles reports a link as a link with its target, and never walks through one", () => {
  const { input } = linkedTree();
  assert.deepEqual(listFiles(input, SOURCE_TREE_EXCLUDES), [
    { rel: "leak.js", kind: "link", target: "../outside.js" },
    { rel: "lib/up", kind: "link", target: ".." },
    { rel: "lib/x.js", kind: "file" },
    { rel: "main.js", kind: "file" },
    { rel: "zz", kind: "link", target: "lib" },
  ]);
});

test("prepare writes each link as the same link, never the bytes it leads to, and the prepare gate passes that", () => {
  const { tmp, input } = linkedTree();
  const prepared = path.join(tmp, "prepared");
  const prep = runNode("prepare.mjs", [input, prepared], tmp);
  assert.equal(prep.status, 0, `prepare.mjs failed:\n${prep.stdout}\n${prep.stderr}`);

  assert.equal(fs.readlinkSync(path.join(prepared, "zz")), "lib");
  assert.equal(fs.readlinkSync(path.join(prepared, "leak.js")), "../outside.js");
  assert.equal(fs.readlinkSync(path.join(prepared, "lib", "up")), "..");
  assert.ok(!regularFileContents(prepared).some((text) => text.includes("SECRET_OUTSIDE")), "no outside bytes in the prepared tree");
  const manifest = JSON.parse(fs.readFileSync(path.join(prepared, "manifest.json"), "utf8"));
  assert.deepEqual([...new Set(manifest.map(({ file }) => file))].sort(), ["lib/x.js", "main.js"]);

  const { status, artifact } = gatePrepare(tmp, input, prepared);
  assert.equal(status, 0, JSON.stringify(artifact.mismatches));
  assert.equal(artifact.pass, true);
  assert.equal(artifact.checks.entriesMatch, true);
});

test("the prepare gate fails a prepared tree that holds a copy of what a link leads to in place of the link", () => {
  const { tmp, input } = linkedTree();
  const prepared = path.join(tmp, "prepared");
  assert.equal(runNode("prepare.mjs", [input, prepared], tmp).status, 0);
  fs.rmSync(path.join(prepared, "leak.js"));
  fs.copyFileSync(path.join(tmp, "outside.js"), path.join(prepared, "leak.js"));

  const { status, artifact } = gatePrepare(tmp, input, prepared);
  assert.equal(status, 1);
  assert.equal(artifact.pass, false);
  assert.equal(artifact.checks.entriesMatch, false);
  assert.deepEqual(artifact.mismatches.entryMismatches.map(({ file, expected }) => [file, expected]), [["leak.js", { kind: "link", target: "../outside.js" }]]);
  assert.equal(artifact.mismatches.entryMismatches[0].actual.kind, "file");
});

// A baseline and working tree that remove-deps' gate can compare, with the deps artifacts it requires.
function removeDepsTrees() {
  const tmp = inputTree();
  const baseline = path.join(tmp, "input");
  const working = path.join(tmp, "working");
  fs.cpSync(baseline, working, { recursive: true });
  const depsDir = path.join(tmp, "deps");
  fs.mkdirSync(depsDir);
  fs.writeFileSync(path.join(depsDir, "near-matches.json"), "{}");
  fs.writeFileSync(path.join(depsDir, "replacements.json"), JSON.stringify({ schemaVersion: 4, copies: {} }));
  const gate = () => {
    const out = path.join(tmp, "gate.json");
    const result = runNode("gate.mjs", ["remove-deps", "--baseline", baseline, "--working", working, "--deps-dir", depsDir, "--out", out], tmp);
    return { status: result.status, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
  };
  return { tmp, baseline, working, depsDir, gate };
}

test("the remove-deps gate never passes a file it could not read, however the two sides compare", { skip: AS_ROOT }, () => {
  const { baseline, working, gate } = removeDepsTrees();
  fs.writeFileSync(path.join(working, "main.js"), "function main(a){return a-1}");
  const locked = [path.join(baseline, "main.js"), path.join(working, "main.js")];
  for (const file of locked) fs.chmodSync(file, 0o000);
  try {
    const { status, artifact } = gate();
    assert.equal(status, 1);
    assert.equal(artifact.checks.workingCodeUnchanged, false);
    assert.deepEqual(artifact.mismatches.entryMismatches, [{
      file: "main.js",
      expected: { kind: "unread", reason: "can't be read (EACCES)" },
      actual: { kind: "unread", reason: "can't be read (EACCES)" },
    }]);
  } finally {
    for (const file of locked) fs.chmodSync(file, 0o644);
  }
});

test("the remove-deps gate reports a working link where the baseline has a file as that entry changed, not as missing", () => {
  const { tmp, working, gate } = removeDepsTrees();
  fs.rmSync(path.join(working, "main.js"));
  fs.writeFileSync(path.join(tmp, "elsewhere.js"), "function main(a){return a+1}");
  fs.symlinkSync(path.join(tmp, "elsewhere.js"), path.join(working, "main.js"));

  const { status, artifact } = gate();
  assert.equal(status, 1);
  assert.deepEqual(artifact.mismatches.missingFiles, []);
  assert.deepEqual(artifact.mismatches.entryMismatches.map(({ file, actual }) => [file, actual]), [["main.js", { kind: "link", target: path.join(tmp, "elsewhere.js") }]]);
});

test("the remove-deps gate names a required input that is there but can't be used, apart from one that is missing", () => {
  const { depsDir, gate } = removeDepsTrees();
  fs.rmSync(path.join(depsDir, "near-matches.json"));
  fs.mkdirSync(path.join(depsDir, "near-matches.json"));

  const { status, artifact } = gate();
  assert.equal(status, 1);
  assert.deepEqual(artifact.mismatches.replacementLogErrors, [{ type: "unusable-required", path: path.join(depsDir, "near-matches.json"), reason: "is not a file (dir)" }]);
});

test("prepare names a source file it can't read and leaves it unwritten, and the prepare gate fails on it", { skip: AS_ROOT }, () => {
  const { tmp, input } = linkedTree();
  const locked = path.join(input, "lib", "x.js");
  fs.chmodSync(locked, 0o000);
  try {
    const prepared = path.join(tmp, "prepared");
    const prep = runNode("prepare.mjs", [input, prepared], tmp);
    assert.equal(prep.status, 0, prep.stderr);
    assert.match(prep.stderr, /lib\/x\.js can't be read \(EACCES\), so it is not prepared/);
    assert.ok(!fs.existsSync(path.join(prepared, "lib", "x.js")));

    const { status, artifact } = gatePrepare(tmp, input, prepared);
    assert.equal(status, 1);
    assert.deepEqual(artifact.mismatches.missingFiles, ["lib/x.js"]);
  } finally {
    fs.chmodSync(locked, 0o644);
  }
});
