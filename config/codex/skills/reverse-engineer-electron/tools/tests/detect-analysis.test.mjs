import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "detect-dependencies.mjs");

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

// An app shipping vend@1.0.0, whose one function is >= 20 shape tokens, and a build dir holding main.js.
function project(mainJs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-detect-analysis-"));
  writeText(path.join(root, "app", "node_modules", "vend", "package.json"), JSON.stringify({ name: "vend", version: "1.0.0" }));
  writeText(
    path.join(root, "app", "node_modules", "vend", "index.js"),
    "module.exports = function helper(a, b) { var total = 0; for (var i = 0; i < a.length; i++) { if (a[i] > b) { total += a[i] * 2; } else { total -= b; } } return total; };\n",
  );
  writeText(path.join(root, "build", "main.js"), mainJs);
  const out = path.join(root, "deps", "detected-dependencies.json");
  const run = (buildDir = path.join(root, "build")) =>
    spawnSync(process.execPath, [SCRIPT, "--app-dir", path.join(root, "app"), "--build-dir", buildDir, "--out", out], { cwd: root, encoding: "utf8" });
  return { root, out, run };
}

// A webpack4 bundle: module 0 is vend's helper body under the factory's own names; module 1 requires module 0 through
// a require slot that has a default.
const BUNDLE = `(function (modules) { return modules; })([
  function (e, t, n) { var total = 0; for (var i = 0; i < e.length; i++) { if (e[i] > t) { total += e[i] * 2; } else { total -= t; } } return total; },
  function (e, t, n = 0) { n(0); }
]);
`;

test("a bundled module with a package function's shape is credited to that package, the index and the lookup hashing alike", () => {
  const { out, run } = project(BUNDLE);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const [bundle] = JSON.parse(fs.readFileSync(out, "utf8")).bundles;
  const shaped = bundle.modules.find(({ id }) => id === 0);
  assert.deepEqual(shaped.evidence.map(({ signal, package: pkg }) => [signal, pkg]), [["shape-hash", "vend"]]);
});

test("a factory whose require slot has a default still has the dependencies it requires", () => {
  const { out, run } = project(BUNDLE);
  assert.equal(run().status, 0);
  const [bundle] = JSON.parse(fs.readFileSync(out, "utf8")).bundles;
  assert.deepEqual(bundle.modules.find(({ id }) => id === 1).dependencyIds, ["0"]);
});

test("a run that fails leaves no report at --out, not the previous run's", () => {
  const { out, run, root } = project(BUNDLE);
  assert.equal(run().status, 0);
  assert.ok(fs.existsSync(out));
  const failed = run(path.join(root, "no-such-build"));
  assert.notEqual(failed.status, 0, failed.stdout);
  assert.ok(!fs.existsSync(out), "the earlier report is gone, so nothing reads it as this run's");
});
