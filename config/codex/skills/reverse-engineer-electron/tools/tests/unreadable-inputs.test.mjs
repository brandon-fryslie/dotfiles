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

// A link at p leading nowhere: an input that is there, but holds nothing a tool can read.
function dangle(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.symlinkSync("gone", p);
  return p;
}

const DANGLING = "is not a file (dangling:gone)";

const restrictsRoot = { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false };

// An app dir whose package.json is text, beside a src/main.js and a decoy dir the heuristic would pick.
function appWithManifest(tmp, text) {
  writeText(path.join(tmp, "app", "package.json"), text);
  writeText(path.join(tmp, "app", "src", "main.js"), "console.log(1);\n");
  writeText(path.join(tmp, "app", "other", "a.js"), "1;\n");
  writeText(path.join(tmp, "app", "other", "b.js"), "2;\n");
  return path.join(tmp, "app");
}

// A package.json larger than a pipe's buffer, which the shell tools once read through a pipe and lost the end of.
const LARGE_PADDING = "x".repeat(300 * 1024);

test("detect-build-dir reads package.json as every tool does: a byte order mark, a file larger than a pipe's buffer", () => {
  for (const text of [`\uFEFF${JSON.stringify({ main: "src/main.js" })}`, JSON.stringify({ description: LARGE_PADDING, main: "src/main.js" })]) {
    const tmp = mkTmpDir();
    const result = node("detect-build-dir.mjs", [appWithManifest(tmp, text)], tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "src");
  }
});

test("detect-build-dir stops at a package.json it can't use, and finds the entrypoint node would load", () => {
  const tmp = mkTmpDir();
  const app = appWithManifest(tmp, "{}");
  const manifest = path.join(app, "package.json");
  writeText(path.join(app, "dist", "index.js"), "1;\n");
  // A file beside the app named after it is one node would load for the app's bare path; the app's main is not it.
  writeText(`${app}.js`, "1;\n");
  const detect = (text) => {
    writeText(manifest, text);
    return node("detect-build-dir.mjs", [app], tmp);
  };
  const resolved = [
    [JSON.stringify({ main: "dist" }), "dist"],
    [JSON.stringify({ main: "src/main" }), "src"],
    [JSON.stringify({ main: "src/main.js" }), "src"],
  ];
  for (const [text, dir] of resolved) {
    const result = detect(text);
    assert.equal(result.status, 0, `${text}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), dir, text);
  }
  // node loads index.js for a main that is unset or not a path; with none, the heuristic guesses, and says why.
  for (const text of [JSON.stringify({ main: "" }), JSON.stringify({ main: null }), JSON.stringify({ main: 5 }), JSON.stringify({ main: "gone.js" })]) {
    const result = detect(text);
    assert.equal(result.status, 0, `${text}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), "other", text);
    assert.match(result.stderr, /node finds no entrypoint/, text);
  }
  writeText(path.join(app, "index.js"), "1;\n");
  assert.equal(detect(JSON.stringify({ main: "" })).stdout.trim(), ".");
  fs.rmSync(path.join(app, "index.js"));

  const nullManifest = detect("null");
  assert.equal(nullManifest.status, 1);
  assert.ok(nullManifest.stderr.includes(`${manifest} is not a JSON object (it holds null)`), nullManifest.stderr);

  fs.rmSync(manifest);
  dangle(manifest);
  const dangling = node("detect-build-dir.mjs", [app], tmp);
  assert.equal(dangling.status, 1);
  assert.ok(dangling.stderr.includes(`${manifest} ${DANGLING}`), dangling.stderr);

  fs.rmSync(manifest);
  dangle(path.join(app, "other", "c.js"));
  dangle(path.join(app, "lib", "a.js"));
  dangle(path.join(app, "lib", "b.js"));
  dangle(path.join(app, "lib", "c.js"));
  const absent = node("detect-build-dir.mjs", [app], tmp);
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.stdout.trim(), "other", "a .js link to nothing is not counted");
  assert.ok(absent.stderr.includes(`${path.join(app, "lib", "a.js")} ${DANGLING}; not counted`), absent.stderr);

  const missingApp = node("detect-build-dir.mjs", [dangle(path.join(tmp, "app-link"))], tmp);
  assert.equal(missingApp.status, 1);
  assert.equal(missingApp.stderr.trim(), `Error: ${path.join(tmp, "app-link")} is not a directory (dangling:gone)`);
  assert.equal(node("detect-build-dir.mjs", [""], tmp).status, 1, "an empty app dir is no app dir");
});

// An .app with no Electron Framework plist beside an extracted dir whose package.json is text.
function electronApp(tmp, text) {
  fs.mkdirSync(path.join(tmp, "App.app"));
  writeText(path.join(tmp, "extracted", "package.json"), text);
  return (extracted = path.join(tmp, "extracted")) => node("detect-electron-version.mjs", [path.join(tmp, "App.app"), extracted], tmp);
}

test("detect-electron-version reads package.json as every tool does: a byte order mark, a file larger than a pipe's buffer", () => {
  for (const text of [`\uFEFF${JSON.stringify({ devDependencies: { electron: "^31.0.2" } })}`, JSON.stringify({ description: LARGE_PADDING, devDependencies: { electron: "^31.0.2" } })]) {
    const result = electronApp(mkTmpDir(), text)();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "31.0.2 31");
  }
});

test("detect-electron-version names a package.json or extracted dir it can't use, and leaves the version undetermined only when package.json isn't there", () => {
  const tmp = mkTmpDir();
  const detect = electronApp(tmp, "null");
  const manifest = path.join(tmp, "extracted", "package.json");
  const cases = [
    ["null", `${manifest} is not a JSON object (it holds null)`],
    [JSON.stringify({ dependencies: [] }), `${manifest} gives dependencies [], which is not an object`],
  ];
  for (const [text, message] of cases) {
    writeText(manifest, text);
    const result = detect();
    assert.equal(result.status, 1, text);
    assert.ok(result.stderr.includes(message), result.stderr);
    assert.doesNotMatch(result.stderr, /Could not determine/);
  }

  fs.rmSync(manifest);
  dangle(manifest);
  const dangling = detect();
  assert.equal(dangling.status, 1);
  assert.ok(dangling.stderr.includes(`${manifest} ${DANGLING}`), dangling.stderr);
  assert.doesNotMatch(dangling.stderr, /Could not determine/);

  fs.rmSync(manifest);
  const absent = detect();
  assert.equal(absent.status, 1);
  assert.match(absent.stderr, /Could not determine Electron version/);

  const typo = detect(path.join(tmp, "extracted-typo"));
  assert.equal(typo.status, 1);
  assert.equal(typo.stderr.trim(), `Error: ${path.join(tmp, "extracted-typo")} is missing`);
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

test("detect-dependencies warns of a module index it was named and can't use, and reads the counts of one it can", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "app", "package.json"), JSON.stringify({ name: "app", version: "1.0.0" }));
  writeText(path.join(tmp, "build", "main.js"), "console.log(1);\n");
  const detect = (moduleIndex) => {
    const out = path.join(tmp, "deps.json");
    const result = node("detect-dependencies.mjs", ["--app-dir", "app", "--build-dir", "build", "--out", out, "--module-index", moduleIndex], tmp);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(out, "utf8"));
    return { moduleIndex: report.moduleIndex, warnings: report.warnings.filter((warning) => warning.includes("module index")) };
  };
  const unread = { file: null, bundlesIndexed: 0, modulesIndexed: 0 };
  assert.deepEqual(detect("deps/typo.json"), { moduleIndex: unread, warnings: ["Could not read module index deps/typo.json: it is missing"] });
  dangle(path.join(tmp, "deps", "module-index.json"));
  assert.deepEqual(detect("deps/module-index.json"), { moduleIndex: unread, warnings: [`Could not read module index deps/module-index.json: it ${DANGLING}`] });
  writeText(path.join(tmp, "deps", "no-summary.json"), "{}");
  assert.deepEqual(detect("deps/no-summary.json"), { moduleIndex: unread, warnings: ["Could not read module index deps/no-summary.json: it has no summary with bundlesDetected and modulesIndexed counts"] });
  writeText(path.join(tmp, "deps", "index.json"), JSON.stringify({ summary: { bundlesDetected: 2, modulesIndexed: 7 } }));
  assert.deepEqual(detect("deps/index.json"), { moduleIndex: { file: "deps/index.json", bundlesIndexed: 2, modulesIndexed: 7 }, warnings: [] });
});

const gateIn = (tmp) => (args) => {
  const out = path.join(tmp, "gate.json");
  const result = node("gate.mjs", [...args, "--out", out], tmp);
  return { status: result.status, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
};

test("the extract and prepare gates name each required input that is there but can't be used, and each missing one", () => {
  const tmp = mkTmpDir();
  const gate = gateIn(tmp);
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

test("the prepare gate fails on a manifest that isn't a JSON array, naming it, however well the trees match", () => {
  const tmp = mkTmpDir();
  const gate = gateIn(tmp);
  writeText(path.join(tmp, "orig", "a.js"), "function f() { return 1; }\n");
  writeText(path.join(tmp, "prepared", "a.js"), "function f() { return 1; }\n");
  const manifest = path.join(tmp, "manifest.json");
  const cases = [
    ["{not json", `doesn't parse as JSON: ${(() => { try { JSON.parse("{not json"); } catch (error) { return error.message; } })()}`],
    [JSON.stringify({ file: "a.js" }), "is not a JSON array (it holds an object)"],
  ];
  for (const [text, reason] of cases) {
    writeText(manifest, text);
    const prepare = gate(["prepare", "--orig", path.join(tmp, "orig"), "--prepared", path.join(tmp, "prepared"), "--manifest", manifest]);
    assert.equal(prepare.status, 1, text);
    assert.equal(prepare.artifact.error, `Required prepare gate input: ${manifest} ${reason}`);
    assert.equal(prepare.artifact.pass, false);
  }
});

test("the prepare gate counts a prepared file that is there but can't be read as unread, never as missing", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "orig", "a.js"), "function f() { return 1; }\n");
  fs.mkdirSync(path.join(tmp, "prepared"));
  const preparedFile = dangle(path.join(tmp, "prepared", "a.js"));
  writeText(path.join(tmp, "manifest.json"), "[]");
  const { status, artifact } = gateIn(tmp)(["prepare", "--orig", path.join(tmp, "orig"), "--prepared", path.join(tmp, "prepared"), "--manifest", path.join(tmp, "manifest.json")]);
  assert.equal(status, 1);
  assert.deepEqual(artifact.mismatches.missingFiles, []);
  assert.deepEqual(artifact.mismatches.parseErrors, [{ file: "a.js", error: `${preparedFile} ${DANGLING}` }]);
});

test("the extract gate names an asar it can stat but not read, before it extracts anything", { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false }, () => {
  const tmp = mkTmpDir();
  const upstream = path.join(tmp, "upstream.asar");
  writeText(upstream, "asar");
  fs.chmodSync(upstream, 0o000);
  writeText(path.join(tmp, "copied.asar"), "asar");
  fs.mkdirSync(path.join(tmp, "extracted"));
  const { status, artifact } = gateIn(tmp)(["extract", "--upstream-asar", upstream, "--copied-asar", path.join(tmp, "copied.asar"), "--extracted-dir", path.join(tmp, "extracted")]);
  assert.equal(status, 1);
  assert.equal(artifact.error, `Required extract gate input: ${upstream} can't be read (EACCES)`);
});

test("report and apply-renames name an input they can't read or that has the wrong shape, instead of crashing", () => {
  const tmp = mkTmpDir();
  const manifest = dangle(path.join(tmp, "prepared", "manifest.json"));
  fs.mkdirSync(path.join(tmp, "demin"));
  const runReport = () => node("report.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin")], tmp);
  const report = runReport();
  assert.equal(report.status, 1);
  assert.equal(report.stderr.trim(), `Error: ${manifest} ${DANGLING}`);
  fs.rmSync(manifest);
  writeText(manifest, JSON.stringify({ file: "x.js" }));
  const objectManifest = runReport();
  assert.equal(objectManifest.status, 1);
  assert.equal(objectManifest.stderr.trim(), `Error: ${manifest} is not a JSON array (it holds an object)`);

  const source = path.join(tmp, "source.js");
  writeText(source, "var a = 1;\n");
  const spec = dangle(path.join(tmp, "spec.json"));
  const renames = node("apply-renames.mjs", [source, spec], tmp);
  assert.equal(renames.status, 1);
  assert.equal(renames.stderr.trim(), `Error: rename spec ${spec} ${DANGLING}`);
  const nullSpec = path.join(tmp, "null-spec.json");
  writeText(nullSpec, "null");
  const nullRenames = node("apply-renames.mjs", [source, nullSpec], tmp);
  assert.equal(nullRenames.status, 1);
  assert.equal(nullRenames.stderr.trim(), `Error: rename spec ${nullSpec} is not a JSON object (it holds null)`);
  writeText(path.join(tmp, "spec-ok.json"), JSON.stringify({ a: "b" }));
  const danglingSource = dangle(path.join(tmp, "dangling-source.js"));
  const sourceRenames = node("apply-renames.mjs", [danglingSource, path.join(tmp, "spec-ok.json")], tmp);
  assert.equal(sourceRenames.status, 1);
  assert.equal(sourceRenames.stderr.trim(), `Error: ${danglingSource} ${DANGLING}`);
});

test("the extract gate stops at a project asar shim it can't run, instead of running another asar in its place", () => {
  const tmp = mkTmpDir();
  dangle(path.join(tmp, "node_modules", ".bin", "asar"));
  // The gate finds the shim from its cwd, which node reports with the temp dir's links resolved.
  const shim = path.join(fs.realpathSync(tmp), "node_modules", ".bin", "asar");
  for (const name of ["upstream.asar", "copied.asar"]) writeText(path.join(tmp, name), "asar");
  fs.mkdirSync(path.join(tmp, "extracted"));
  const { status, artifact } = gateIn(tmp)(["extract", "--upstream-asar", path.join(tmp, "upstream.asar"), "--copied-asar", path.join(tmp, "copied.asar"), "--extracted-dir", path.join(tmp, "extracted")]);
  assert.equal(status, 3);
  assert.equal(artifact.error, `${shim} ${DANGLING}`);
});

const removeDepsGate = (tmp) => {
  writeText(path.join(tmp, "deps", "near-matches.json"), "{}");
  writeText(path.join(tmp, "deps", "replacements.json"), JSON.stringify({ schemaVersion: 4, copies: {} }));
  return gateIn(tmp)(["remove-deps", "--baseline", path.join(tmp, "baseline"), "--working", path.join(tmp, "working"), "--deps-dir", path.join(tmp, "deps")]);
};

test("the remove-deps gate compares a link by the target it names, so a link where the baseline has a file is a mismatch", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "baseline", "main.js"), "console.log(1);\n");
  fs.mkdirSync(path.join(tmp, "working"));
  dangle(path.join(tmp, "working", "main.js"));
  const { status, artifact } = removeDepsGate(tmp);
  assert.equal(status, 1);
  assert.deepEqual(artifact.mismatches.missingFiles, []);
  assert.deepEqual(artifact.mismatches.jsHashMismatches.map(({ file, baseline, working }) => [file, baseline.kind, working]), [["main.js", "sha256", { kind: "link", target: "gone" }]]);
  assert.equal(artifact.checks.workingCodeUnchanged, false);
});

test("the remove-deps gate never takes two files it couldn't read for the same file", restrictsRoot, () => {
  const tmp = mkTmpDir();
  for (const [side, code] of [["baseline", "a();\n"], ["working", "b();\n"]]) {
    writeText(path.join(tmp, side, "main.js"), code);
    fs.chmodSync(path.join(tmp, side, "main.js"), 0o000);
  }
  const { status, artifact } = removeDepsGate(tmp);
  assert.equal(status, 1);
  const unread = { kind: "unread", reason: "can't be read (EACCES)" };
  assert.deepEqual(artifact.mismatches.jsHashMismatches, [{ file: "main.js", baseline: unread, working: unread }]);
  assert.equal(artifact.checks.workingCodeUnchanged, false);
});

test("a tree walk lists a link by its own name and never descends it, so each file keeps the one path it has", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "app", "lib", "x.js"), "function f() { return 1; }\n");
  writeText(path.join(tmp, "app", "main.js"), "require('./lib/x.js');\n");
  fs.symlinkSync("lib", path.join(tmp, "app", "zz"));
  fs.symlinkSync("..", path.join(tmp, "app", "lib", "up"));
  const result = node("prepare.mjs", [path.join(tmp, "app"), path.join(tmp, "out")], tmp);
  assert.equal(result.status, 0, result.stderr);
  const written = fs.readdirSync(path.join(tmp, "out"), { recursive: true }).filter((rel) => rel.endsWith(".js")).sort();
  assert.deepEqual(written, [path.join("lib", "x.js"), "main.js"]);
});

test("apply-renames rewrites only the names it is given, keeping a byte order mark the file starts with", () => {
  const tmp = mkTmpDir();
  const source = path.join(tmp, "source.js");
  writeText(source, "﻿var a = 1;\n");
  writeText(path.join(tmp, "spec.json"), JSON.stringify({ a: "count" }));
  const result = node("apply-renames.mjs", [source, path.join(tmp, "spec.json")], tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(source, "utf8"), "﻿var count = 1;\n");
});

test("detect-dependencies refuses an --app-dir that is not a directory, rather than reporting an app that ships nothing", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "app", "package.json"), JSON.stringify({ name: "app", version: "1.0.0" }));
  writeText(path.join(tmp, "build", "main.js"), "console.log(1);\n");
  const result = node("detect-dependencies.mjs", ["--app-dir", "app/package.json", "--build-dir", "build", "--out", path.join(tmp, "deps.json")], tmp);
  assert.equal(result.status, 2);
  assert.equal(result.stderr.trim(), `Error: --app-dir ${path.join(fs.realpathSync(tmp), "app", "package.json")} is not a directory (file)`);
  assert.equal(fs.existsSync(path.join(tmp, "deps.json")), false);
});

test("detect-electron-version prints only a spec that names one version, and refuses an empty extracted dir", () => {
  const cases = [
    ["^31.0.2", "31.0.2 31"],
    ["~31.2", "31.2 31"],
    ["31.0.0-beta.3", "31.0.0-beta.3 31"],
  ];
  for (const [spec, out] of cases) {
    const result = electronApp(mkTmpDir(), JSON.stringify({ devDependencies: { electron: spec } }))();
    assert.equal(result.status, 0, `${spec}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), out);
  }
  for (const spec of [">=31.0.0 <32", "file:../electron-31.2.0.tgz"]) {
    const tmp = mkTmpDir();
    const result = electronApp(tmp, JSON.stringify({ devDependencies: { electron: spec } }))();
    assert.equal(result.status, 1, spec);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.includes(`gives electron ${JSON.stringify(spec)}, which names no single version`), result.stderr);
  }
  const empty = electronApp(mkTmpDir(), "{}")("");
  assert.equal(empty.status, 1);
  assert.equal(empty.stdout, "");
});
