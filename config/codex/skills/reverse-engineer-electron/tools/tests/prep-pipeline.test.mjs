import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-prep-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runNode(scriptPath, args, cwd) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("find-near-match-versions only returns patch-level candidates and ranks exact first", () => {
  const tmp = mkTmpDir();
  const depsPath = path.join(tmp, "deps", "detected-dependencies.json");
  const registryFixturePath = path.join(tmp, "registry.json");
  const outPath = path.join(tmp, "deps", "near-matches.json");

  writeJson(depsPath, {
    onDisk: {
      packages: [{ name: "demo-pkg", version: "1.2.3", path: "node_modules/demo-pkg" }],
    },
    code: {
      bareSpecifiers: {
        "demo-pkg": { count: 3, files: { "main.js": 3 } },
      },
    },
    bundles: [
      {
        modules: [
          {
            package: "demo-pkg",
            version: "1.2.3",
            signal: "license",
            evidence: [{ package: "demo-pkg", signal: "license", detail: "1.2.3" }],
            hashMatchPackages: ["demo-pkg@1.2.3:program"],
          },
        ],
      },
    ],
  });

  writeJson(registryFixturePath, {
    "demo-pkg": ["1.1.9", "1.2.1", "1.2.3", "1.2.5", "1.3.0", "2.0.0"],
  });

  const script = path.resolve("find-near-match-versions.mjs");
  const result = runNode(
    script,
    ["--deps", depsPath, "--app-dir", path.join(tmp, "resources", "app"), "--registry-file", registryFixturePath, "--out", outPath],
    path.resolve("."),
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const output = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const pkg = output.packages.find((item) => item.name === "demo-pkg");

  assert.ok(pkg, "demo-pkg result should exist");
  assert.equal(pkg.bestCandidate.version, "1.2.3");
  assert.ok(pkg.candidates.every((item) => item.version.startsWith("1.2.")), "all versions must be patch-only");
});

test("verify-dependency-swap passes and fails deterministically based on structural coverage", () => {
  const tmp = mkTmpDir();
  const beforeDir = path.join(tmp, "before");
  const afterDir = path.join(tmp, "after");

  writeJson(path.join(beforeDir, "package.json"), { name: "pkg-a", version: "1.2.3" });
  writeJson(path.join(afterDir, "package.json"), { name: "pkg-a", version: "1.2.3" });

  writeText(path.join(beforeDir, "index.js"), "module.exports=function(a){return a+1};\n");
  writeText(path.join(afterDir, "index.js"), "module.exports=function(a){return a+1};\n");

  const passOut = path.join(tmp, "verify-pass.json");
  const script = path.resolve("verify-dependency-swap.mjs");
  const passResult = runNode(
    script,
    [
      "--pkg",
      "pkg-a",
      "--before",
      beforeDir,
      "--after",
      afterDir,
      "--expected-version",
      "1.2.3",
      "--threshold",
      "0.9",
      "--out",
      passOut,
    ],
    path.resolve("."),
  );

  assert.equal(passResult.status, 0, passResult.stderr || passResult.stdout);
  const passArtifact = JSON.parse(fs.readFileSync(passOut, "utf8"));
  assert.equal(passArtifact.pass, true);

  writeText(path.join(afterDir, "index.js"), "module.exports=function(a){const v={x:1};return v.x};\n");
  const failOut = path.join(tmp, "verify-fail.json");
  const failResult = runNode(
    script,
    [
      "--pkg",
      "pkg-a",
      "--before",
      beforeDir,
      "--after",
      afterDir,
      "--expected-version",
      "1.2.3",
      "--threshold",
      "0.9",
      "--out",
      failOut,
    ],
    path.resolve("."),
  );

  assert.equal(failResult.status, 1);
  const failArtifact = JSON.parse(fs.readFileSync(failOut, "utf8"));
  assert.equal(failArtifact.pass, false);
});

test("replace-dependency rolls back failed verified swap and logs transaction", () => {
  const tmp = mkTmpDir();
  const appPkgDir = path.join(tmp, "resources", "app", "node_modules", "demo-pkg");
  const rootPkgDir = path.join(tmp, "node_modules", "demo-pkg");
  const depsDir = path.join(tmp, "deps");
  const logPath = path.join(depsDir, "replacements.json");

  writeJson(path.join(appPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(appPkgDir, "index.js"), "module.exports=function(){return 1};\n");

  writeJson(path.join(rootPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(rootPkgDir, "index.js"), "module.exports=function(){const o={x:2};return o.x};\n");

  writeJson(path.join(depsDir, "near-matches.json"), {
    packages: [
      {
        name: "demo-pkg",
        observedVersion: "1.2.3",
        recommendation: "exact",
        candidates: [{ version: "1.2.3", score: 100, reasons: ["exact"], risk: "low" }],
      },
    ],
  });

  const fakeNpm = path.join(tmp, "fake-npm.sh");
  writeText(fakeNpm, "#!/usr/bin/env bash\nexit 0\n");
  fs.chmodSync(fakeNpm, 0o755);

  const script = path.resolve("replace-dependency.mjs");
  const result = runNode(
    script,
    [
      "--pkg",
      "demo-pkg",
      "--version",
      "1.2.3",
      "--app-dir",
      path.join(tmp, "resources", "app"),
      "--npm",
      fakeNpm,
      "--verify-script",
      path.resolve("verify-dependency-swap.mjs"),
      "--verification-dir",
      path.join(tmp, "deps", "verification"),
      "--out",
      logPath,
      "--threshold",
      "0.99",
    ],
    tmp,
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
  const pkgState = log.packages["demo-pkg"];
  assert.ok(pkgState);
  assert.equal(pkgState.status, "unresolved");
  assert.ok(pkgState.attempts.length >= 1);

  const lastAttempt = pkgState.attempts[pkgState.attempts.length - 1];
  assert.equal(lastAttempt.result, "fail");
  assert.equal(lastAttempt.swapApplied, true);
  assert.equal(lastAttempt.rolledBack, true);

  assert.ok(fs.existsSync(path.join(appPkgDir, "package.json")), "app dependency should be restored after rollback");
});
