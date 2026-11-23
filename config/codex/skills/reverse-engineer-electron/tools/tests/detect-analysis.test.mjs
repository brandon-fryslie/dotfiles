import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";

const TOOLS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELPER = "var total = 0; for (var i = 0; i < a.length; i++) { if (a[i] > b) { total += a[i] * 2; } else { total -= b; } } return total;";

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// An app shipping vend@1.0.0, whose helper function (at least MIN_FUNCTION_SHAPE_TOKENS long) is in two of its files,
// and a build dir holding the given files.
function project(buildFiles) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ec-detect-analysis-")));
  roots.push(root);
  writeText(path.join(root, "app", "node_modules", "vend", "package.json"), JSON.stringify({ name: "vend", version: "1.0.0" }));
  for (const file of ["index.js", "dist/index.js"]) {
    writeText(path.join(root, "app", "node_modules", "vend", file), `module.exports = function helper(a, b) { ${HELPER} };\n`);
  }
  for (const [name, content] of Object.entries(buildFiles)) writeText(path.join(root, "build", name), content);
  const out = path.join(root, "deps", "detected-dependencies.json");
  const run = (buildDir = path.join(root, "build")) =>
    spawnSync(process.execPath, [path.join(TOOLS_DIR, "detect-dependencies.mjs"), "--app-dir", path.join(root, "app"), "--build-dir", buildDir, "--out", out], { cwd: root, encoding: "utf8" });
  const unbundle = () =>
    spawnSync(process.execPath, [path.join(TOOLS_DIR, "unbundle-index.mjs"), "--build-dir", path.join(root, "build"), "--out", "deps/module-index.json", "--graph-out", "deps/module-graph.json"], { cwd: root, encoding: "utf8" });
  return { root, out, run, unbundle };
}

// A webpack4 bundle. Module 0 is vend's helper body under the factory's own names. Module 1 requires module 0 through
// a require slot that has a default. Module 2 requires module 0, then calls an inner function's own `n`, which is
// not its require. Module 3 exports an asset path through a require slot that has a default.
const BUNDLE = `(function (modules) { return modules; })([
  function (e, t, n) { var total = 0; for (var i = 0; i < e.length; i++) { if (e[i] > t) { total += e[i] * 2; } else { total -= t; } } return total; },
  function (e, t, n = 0) { n(0); },
  function (e, t, n) { n(0); (function (n) { n("x"); })(1); },
  function (e, t, n = 0) { e.exports = n.p + "logo.png"; }
]);
`;

const analyzed = project({
  "main.js": BUNDLE,
  // A syntax error the parser can't recover from.
  "broken.js": "var = ;\n",
  // Code the parser recovers from but an engine rejects: its require is not code the app runs.
  "rejected.js": 'let a = 1; let a = 2; require("react");\n',
});
const result = analyzed.run();
const report = result.status === 0 ? JSON.parse(fs.readFileSync(analyzed.out, "utf8")) : null;
const bundle = report?.bundles.find(({ file }) => file === "build/main.js");
const moduleById = (id) => bundle.modules.find((item) => item.id === id);

test("detect-dependencies finishes over a build dir with unparseable files", () => {
  assert.equal(result.status, 0, result.stderr);
});

test("a bundled module with a package function's shape is credited to that package, though the package ships it in two files", () => {
  assert.deepEqual(moduleById(0).evidence.map(({ signal, package: pkg }) => [signal, pkg]), [["shape-hash", "vend"]]);
  assert.deepEqual(moduleById(0).hashMatchPackages, ["vend@1.0.0"]);
});

test("a factory whose require slot has a default still has the dependencies it requires", () => {
  assert.deepEqual(moduleById(1).dependencyIds, ["0"]);
});

test("a call to an inner binding that shadows the require name is not a dependency", () => {
  assert.deepEqual(moduleById(2).dependencyIds, ["0"]);
});

test("an asset factory is an asset, with no package, whatever its require slot's default", () => {
  assert.deepEqual([moduleById(3).classification, moduleById(3).package, moduleById(3).signal], ["asset", null, "asset-export"]);
  assert.equal(bundle.summary.asset, 1);
});

test("a file that can't be parsed, or that an engine would reject, has its syntax errors once each and is not analyzed", () => {
  const errorsFor = (file) => report.parseErrors.filter((entry) => entry.file === file);
  assert.equal(errorsFor("build/broken.js").length, 1, JSON.stringify(report.parseErrors));
  assert.equal(errorsFor("build/rejected.js").length, 1, JSON.stringify(report.parseErrors));
  assert.ok(!("react" in report.code.bareSpecifiers), "the rejected file's require isn't recorded as code the app runs");
});

test("every scanned file has exactly one outcome", () => {
  const { filesScanned, unreadableFiles, unparsedFiles, plainFiles, bundledFiles } = report.code;
  assert.deepEqual({ filesScanned, unreadableFiles, unparsedFiles, plainFiles, bundledFiles }, { filesScanned: 3, unreadableFiles: 0, unparsedFiles: 2, plainFiles: 0, bundledFiles: 1 });
});

test("unbundle-index finds the same module dependencies detect-dependencies does", () => {
  const indexed = analyzed.unbundle();
  assert.equal(indexed.status, 0, indexed.stderr);
  const moduleIndex = JSON.parse(fs.readFileSync(path.join(analyzed.root, "deps", "module-index.json"), "utf8"));
  const dependencyIds = (modules) => modules.map((item) => [String(item.id), item.dependencyIds]);
  assert.deepEqual(dependencyIds(moduleIndex.bundles.find(({ file }) => file === "build/main.js").modules), dependencyIds(bundle.modules));
});

test("a run that fails leaves no report at --out, not the previous run's", () => {
  const { out, run, root } = project({ "main.js": BUNDLE });
  assert.equal(run().status, 0);
  assert.ok(fs.existsSync(out));
  const failed = run(path.join(root, "no-such-build"));
  assert.notEqual(failed.status, 0, failed.stdout);
  assert.ok(!fs.existsSync(out), "the earlier report is gone, so nothing reads it as this run's");
});
