import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";
import { parseFile } from "../shape.mjs";

const TOOLS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// An app shipping vend@1.0.0, whose helper function (at least MIN_FUNCTION_SHAPE_TOKENS long) is in two of its files
// and whose lib.js is a CommonJS file of its own, and a build dir holding the given files.
function project(buildFiles) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ec-detect-analysis-")));
  roots.push(root);
  writeText(path.join(root, "app", "node_modules", "vend", "package.json"), JSON.stringify({ name: "vend", version: "1.0.0" }));
  for (const file of ["index.js", "dist/index.js"]) {
    writeText(
      path.join(root, "app", "node_modules", "vend", file),
      "module.exports = function helper(a, b) { var total = 0; for (var i = 0; i < a.length; i++) { if (a[i] > b) { total += a[i] * 2; } else { total -= b; } } return total; };\n",
    );
  }
  writeText(path.join(root, "app", "node_modules", "vend", "lib.js"), LIB);
  for (const [name, content] of Object.entries(buildFiles)) writeText(path.join(root, "build", name), content);
  const out = path.join(root, "deps", "detected-dependencies.json");
  const run = (buildDir = path.join(root, "build")) =>
    spawnSync(process.execPath, [path.join(TOOLS_DIR, "detect-dependencies.mjs"), "--app-dir", path.join(root, "app"), "--build-dir", buildDir, "--out", out], { cwd: root, encoding: "utf8" });
  const unbundle = (graphOut = "deps/module-graph.json") =>
    spawnSync(process.execPath, [path.join(TOOLS_DIR, "unbundle-index.mjs"), "--build-dir", path.join(root, "build"), "--out", "deps/module-index.json", "--graph-out", graphOut], { cwd: root, encoding: "utf8" });
  return { root, out, run, unbundle };
}

// vend's lib.js, as a whole file: its statements are what a bundled copy of it has in its factory's body.
const LIB_STATEMENTS = 'var helper = require("./index.js"); module.exports = function wrap(x) { return helper(x, 1) + helper(x, 2) * helper(x, 3) - helper(x, 4); };';
const LIB = `${LIB_STATEMENTS}\n`;
// vend's helper body under a webpack factory's own names.
const VEND = "function (e, t, n) { var total = 0; for (var i = 0; i < e.length; i++) { if (e[i] > t) { total += e[i] * 2; } else { total -= t; } } return total; }";
const webpack4 = (modules, bootstrap = "return m;") => `(function (m) { ${bootstrap} })([\n  ${modules.join(",\n  ")}\n]);\n`;

const analyzed = project({
  // An unrelated `.s` assignment before the bundle, which is not its entry. Module 0 is vend's helper. Module 1
  // requires it through a require slot with a default. Module 2 requires it, then calls an inner function's own
  // `n`, which is not its require. Module 3 exports an asset path through a slot with a default. Module 4 is
  // sloppy-mode code (a legacy octal) that an engine runs as a script. Module 5 is vend's lib.js, its require of
  // ./index.js an id no module in this bundle has.
  "main.js": "var cfg = {}; cfg.s = 7;\n" + webpack4([
    VEND,
    "function (e, t, n = 0) { n(0); }",
    'function (e, t, n) { n(0); (function (n) { n("x"); })(1); }',
    'function (e, t, n = 0) { e.exports = n.p + "logo.png"; }',
    "function (e, t, n) { var mode = 0755; e.exports = mode; }",
    `function (module, exports, require) { ${LIB_STATEMENTS} }`,
  ], "var r = function () {}; return r(r.s = 1);"),
  // A browserify bundle keyed by full paths: module 1 requires vend's index by specifier, through its dependency map.
  "vendor.js": `(function (modules, cache, entries) { return modules; })({
    1: [function (require, module, exports) { module.exports = require("./node_modules/vend/index.js"); }, { "./node_modules/vend/index.js": "/app/node_modules/vend/index.js" }],
    "/app/node_modules/vend/index.js": [function (require, module, exports) { module.exports = 1; }, {}],
    "/app/node_modules/.pnpm/vend@1.0.0/node_modules/vend/x.js": [function (require, module, exports) { module.exports = 2; }, {}],
    "/app/node_modules/host/node_modules/vend/y.js": [function (require, module, exports) { module.exports = 3; }, {}]
  }, {}, [1]);\n`,
  // A bundle of path-keyed factories, read as webpack5.
  "wp5.js": `(function (modules) { return modules; })({
    "./src/a.js": function (module, exports, require) { require("./node_modules/vend/index.js"); },
    "./node_modules/vend/index.js": function (module) { module.exports = 1; },
    "./src/logo.png": (e, t, n) => e.exports = n.p + "logo.png"
  });\n`,
  // Plain ES and CommonJS modules, by their extensions.
  "esm.mjs": 'import vend from "vend";\nexport default vend;\n',
  "cjs.cjs": 'module.exports = require("vend");\n',
  // Four small wrappers, each requiring the next, the last requiring vend's helper, in one module order and its reverse.
  "chain-forward.js": webpack4(["function (e, t, n) { e.exports = n(1); }", "function (e, t, n) { e.exports = n(2); }", "function (e, t, n) { e.exports = n(3); }", "function (e, t, n) { e.exports = n(4); }", VEND]),
  "chain-reverse.js": webpack4([VEND, "function (e, t, n) { e.exports = n(0); }", "function (e, t, n) { e.exports = n(1); }", "function (e, t, n) { e.exports = n(2); }", "function (e, t, n) { e.exports = n(3); }"]),
  // A module too large to need fewer than 6 points, whose one vendor dependency credits it 4.
  "large.js": webpack4([`function (e, t, n) { var pad = "${"x".repeat(1000)}"; e.exports = n(1); }`, VEND]),
  // A syntax error the parser can't recover from.
  "broken.js": "var = ;\n",
  // Code the parser recovers from but an engine rejects: its require is not code the app runs.
  "rejected.js": 'let a = 1; let a = 2; require("react");\n',
});
const result = analyzed.run();
const report = result.status === 0 ? JSON.parse(fs.readFileSync(analyzed.out, "utf8")) : null;
const bundleOf = (file) => report.bundles.find((bundle) => bundle.file === `build/${file}`);
const moduleOf = (file, id) => bundleOf(file).modules.find((item) => item.id === id);

test("detect-dependencies finishes over a build dir with unparseable files", () => {
  assert.equal(result.status, 0, result.stderr);
});

test("a bundled module with a package function's shape is credited to that package, though the package ships it in two files", () => {
  assert.deepEqual(moduleOf("main.js", "0").evidence.map(({ signal, package: pkg }) => [signal, pkg]), [["shape-hash", "vend"]]);
  assert.deepEqual(moduleOf("main.js", "0").hashMatches, [{ package: "vend", version: "1.0.0" }]);
});

test("a bundled copy of a package's CommonJS file is credited to that package by its whole-file shape", () => {
  const lib = moduleOf("main.js", "5");
  assert.deepEqual(lib.evidence.map(({ signal, package: pkg }) => [signal, pkg]), [["shape-hash", "vend"]]);
});

test("a require of an id no module in the bundle has is kept as unresolved, not dropped and not an edge", () => {
  assert.deepEqual([moduleOf("main.js", "5").dependencyIds, moduleOf("main.js", "5").unresolvedDependencyIds], [[], ["./index.js"]]);
});

test("a factory whose require slot has a default still has the dependencies it requires", () => {
  assert.deepEqual(moduleOf("main.js", "1").dependencyIds, ["0"]);
});

test("a call to an inner binding that shadows the require name is not a dependency", () => {
  assert.deepEqual(moduleOf("main.js", "2").dependencyIds, ["0"]);
});

test("an asset factory is an asset, with no package, whatever its require slot's default or its body's form", () => {
  for (const asset of [moduleOf("main.js", "3"), moduleOf("wp5.js", "./src/logo.png")]) {
    assert.deepEqual([asset.classification, asset.package, asset.signal], ["asset", null, "asset-export"]);
  }
  assert.equal(bundleOf("main.js").summary.asset, 1);
});

test("sloppy-mode code an engine runs as a script is analyzed, not reported as a syntax error", () => {
  assert.ok(moduleOf("main.js", "4"), "the module with a legacy octal is in its bundle");
  assert.deepEqual(report.parseErrors.filter(({ file }) => file === "build/main.js"), []);
});

test("a webpack4 bundle's entry is the id its bootstrap assigns to its require's s, not another object's", () => {
  assert.equal(bundleOf("main.js").entryModuleId, "1");
});

test("a browserify module's dependency ids are its dependency map's, and its specifiers the map's keys", () => {
  const vendor = bundleOf("vendor.js");
  assert.deepEqual([vendor.format, vendor.entryModuleId], ["browserify", "1"]);
  assert.deepEqual([moduleOf("vendor.js", "1").dependencyIds, moduleOf("vendor.js", "1").dependencySpecifiers], [["/app/node_modules/vend/index.js"], ["./node_modules/vend/index.js"]]);
});

test("a module keyed by its node_modules path is credited to the package after its last node_modules, in browserify and webpack5 bundles alike", () => {
  const keys = ["/app/node_modules/vend/index.js", "/app/node_modules/.pnpm/vend@1.0.0/node_modules/vend/x.js", "/app/node_modules/host/node_modules/vend/y.js"];
  assert.deepEqual([...keys.map((key) => moduleOf("vendor.js", key).package), moduleOf("wp5.js", "./node_modules/vend/index.js").package], ["vend", "vend", "vend", "vend"]);
  assert.deepEqual([bundleOf("wp5.js").format, moduleOf("wp5.js", "./src/a.js").dependencyIds], ["webpack5", ["./node_modules/vend/index.js"]]);
});

test("vendor credit propagates along a chain of wrappers to every one of them, in either module order", () => {
  const wrappers = (file) => bundleOf(file).modules.map(({ classification, package: pkg }) => [classification, pkg]);
  assert.deepEqual(wrappers("chain-forward.js"), Array(5).fill(["thirdParty", "vend"]));
  assert.deepEqual(wrappers("chain-reverse.js"), Array(5).fill(["thirdParty", "vend"]));
});

test("a module's wrapper credit is counted once, however many rounds propagation takes", () => {
  const large = moduleOf("large.js", "0");
  assert.equal(large.classification, "app");
  assert.deepEqual(large.evidence.map(({ signal, score }) => [signal, score]), [["dep-wrapper", 4]]);
});

test("a file that can't be parsed, or that an engine would reject, has its syntax errors once each and is not analyzed", () => {
  const errorsFor = (file) => report.parseErrors.filter((entry) => entry.file === file);
  assert.equal(errorsFor("build/broken.js").length, 1, JSON.stringify(report.parseErrors));
  assert.equal(errorsFor("build/rejected.js").length, 1, JSON.stringify(report.parseErrors));
  assert.ok(!("react" in report.code.bareSpecifiers), "the rejected file's require isn't recorded as code the app runs");
});

test("every scanned file has exactly one outcome, .mjs and .cjs files among them", () => {
  assert.equal(report.code.filesScanned, 10);
  assert.deepEqual(report.code.files, { unreadable: 0, unparsed: 2, plain: 2, bundled: 6 });
  assert.deepEqual(report.code.bareSpecifiers.vend.files, { "build/cjs.cjs": 1, "build/esm.mjs": 1 });
});

test("a file parses under the goal its extension declares, as an engine reads it", () => {
  const goalOf = (code, file) => parseFile(code, file).program.sourceType;
  assert.equal(goalOf("const data = await readThing();\nexport default data;", "main.mjs"), "module");
  assert.throws(() => parseFile("var mode = 0755;", "main.mjs"), /octal/i);
  assert.throws(() => parseFile("with (o) {}", "main.mts"), /with/i);
  assert.equal(goalOf("var mode = 0755; with (o) {}", "main.cjs"), "script");
  assert.throws(() => parseFile('import x from "y";', "main.cjs"));
});

test("a file whose extension declares no goal is a script if it runs as one, else a module, and rejected if neither", () => {
  const goalOf = (code) => parseFile(code, "main.js").program.sourceType;
  assert.equal(goalOf("var mode = 0755; with (o) {}"), "script");
  assert.equal(goalOf('import x from "y";'), "module");
  assert.equal(goalOf("const data = await readThing();"), "module");
  assert.throws(() => parseFile("let a = 1; let a = 2;", "main.js"), /already been declared/);
  assert.throws(() => parseFile('import x from "y"; var mode = 0755;', "main.js"), /octal/i);
});

test("unbundle-index finds the same modules and dependencies detect-dependencies does", () => {
  const indexed = analyzed.unbundle();
  assert.equal(indexed.status, 0, indexed.stderr);
  const moduleIndex = JSON.parse(fs.readFileSync(path.join(analyzed.root, "deps", "module-index.json"), "utf8"));
  const graph = (modules) => modules.map(({ id, dependencyIds, unresolvedDependencyIds, dependencySpecifiers }) => [id, dependencyIds, unresolvedDependencyIds, dependencySpecifiers]);
  for (const { file, modules } of report.bundles) {
    assert.deepEqual(graph(moduleIndex.bundles.find((bundle) => bundle.file === file).modules), graph(modules), file);
  }
});

test("a run that fails leaves no report at --out, not the previous run's", () => {
  const { out, run, root } = project({ "main.js": webpack4([VEND]) });
  assert.equal(run().status, 0);
  assert.ok(fs.existsSync(out));
  const failed = run(path.join(root, "no-such-build"));
  assert.notEqual(failed.status, 0, failed.stdout);
  assert.ok(!fs.existsSync(out), "the earlier report is gone, so nothing reads it as this run's");
});

test("an unbundle-index run that fails leaves neither of its artifacts from the previous run", () => {
  const { root, unbundle } = project({ "main.js": webpack4([VEND]) });
  assert.equal(unbundle().status, 0);
  fs.rmSync(path.join(root, "build"), { recursive: true });
  assert.notEqual(unbundle().status, 0);
  assert.deepEqual(["module-index.json", "module-graph.json"].filter((file) => fs.existsSync(path.join(root, "deps", file))), []);
});

test("an unbundle-index run whose graph can't be written leaves no index either, nor a partial one", () => {
  const { root, unbundle } = project({ "main.js": webpack4([VEND]) });
  const graphDir = path.join(root, "graph");
  fs.mkdirSync(graphDir);
  fs.chmodSync(graphDir, 0o555);
  try {
    assert.notEqual(unbundle("graph/module-graph.json").status, 0);
    assert.deepEqual([fs.readdirSync(path.join(root, "deps")), fs.readdirSync(graphDir)], [[], []]);
  } finally {
    fs.chmodSync(graphDir, 0o755);
  }
});

test("a file minified and read back keeps its goal: sloppy code an engine runs as a script is compared, not rejected", () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "compare-")));
  after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sloppy = "function pick(a, a) { return a + arguments.length * 2 - 1; }\nmodule.exports = pick;\n";
  for (const side of ["a", "b"]) writeText(path.join(dir, side, "pick.cjs"), sloppy);
  const run = spawnSync(process.execPath, [path.join(TOOLS_DIR, "compare.mjs"), path.join(dir, "a"), path.join(dir, "b")], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
});
