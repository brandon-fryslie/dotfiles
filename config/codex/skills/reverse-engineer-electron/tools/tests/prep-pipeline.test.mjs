import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const TOOLS_DIR = path.join(import.meta.dirname, "..");

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

  const script = path.join(TOOLS_DIR, "find-near-match-versions.mjs");
  const result = runNode(
    script,
    ["--deps", depsPath, "--app-dir", path.join(tmp, "resources", "app"), "--registry-file", registryFixturePath, "--out", outPath],
    TOOLS_DIR,
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
  const script = path.join(TOOLS_DIR, "verify-dependency-swap.mjs");
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
    TOOLS_DIR,
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
    TOOLS_DIR,
  );

  assert.equal(failResult.status, 1);
  const failArtifact = JSON.parse(fs.readFileSync(failOut, "utf8"));
  assert.equal(failArtifact.pass, false);
});

// A project with demo-pkg@1.2.3 copied into the app and installed at the root; rootIndexJs decides
// whether the swap verifies (same shape as the app copy) or fails (different shape).
function swapProject(rootIndexJs) {
  const tmp = mkTmpDir();
  const appPkgDir = path.join(tmp, "resources", "app", "node_modules", "demo-pkg");
  const rootPkgDir = path.join(tmp, "node_modules", "demo-pkg");
  const logPath = path.join(tmp, "deps", "replacements.json");

  writeJson(path.join(appPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(appPkgDir, "index.js"), "module.exports=function(){return 1};\n");
  writeJson(path.join(rootPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(rootPkgDir, "index.js"), rootIndexJs);

  writeJson(path.join(tmp, "deps", "near-matches.json"), {
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

  const replace = (version = "1.2.3") =>
    runNode(
      path.join(TOOLS_DIR, "replace-dependency.mjs"),
      [
        "--pkg", "demo-pkg",
        "--version", version,
        "--app-dir", path.join(tmp, "resources", "app"),
        "--npm", fakeNpm,
        "--verify-script", path.join(TOOLS_DIR, "verify-dependency-swap.mjs"),
        "--verification-dir", path.join(tmp, "deps", "verification"),
        "--out", logPath,
        "--threshold", "0.99",
      ],
      tmp,
    );
  const readLog = () => JSON.parse(fs.readFileSync(logPath, "utf8"));

  const forgetPackage = () => {
    const log = readLog();
    delete log.packages["demo-pkg"];
    writeJson(logPath, log);
  };

  return { tmp, appPkgDir, rootPkgDir, replace, readLog, forgetPackage };
}

const VERIFYING_INDEX = "module.exports=function(){return 1};\n";
const FAILING_INDEX = "module.exports=function(){const o={x:2};return o.x};\n";

test("replace-dependency rolls back failed verified swap and logs transaction", () => {
  const { appPkgDir, replace, readLog } = swapProject(FAILING_INDEX);
  const result = replace();

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const pkgState = readLog().packages["demo-pkg"];
  assert.ok(pkgState);
  assert.equal(pkgState.status, "unresolved");
  assert.ok(pkgState.attempts.length >= 1);

  const lastAttempt = pkgState.attempts[pkgState.attempts.length - 1];
  assert.equal(lastAttempt.result, "fail");
  assert.equal(lastAttempt.swapApplied, true);
  assert.equal(lastAttempt.rolledBack, true);

  assert.ok(fs.existsSync(path.join(appPkgDir, "package.json")), "app dependency should be restored after rollback");
});

test("replace-dependency links the app copy to the root package", () => {
  const { appPkgDir, rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  const result = replace();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink());
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency rerun on a resolved package is skipped and the remove-deps gate passes", () => {
  const { tmp, replace, readLog } = swapProject(VERIFYING_INDEX);
  for (const dir of ["baseline", "working"]) writeText(path.join(tmp, dir, "main.js"), "console.log(1);\n");

  const first = replace();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = replace();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /\[demo-pkg\] already resolved with 1\.2\.3; skipped/);

  const pkgState = readLog().packages["demo-pkg"];
  assert.equal(pkgState.status, "resolved");
  assert.equal(pkgState.attempts.filter((attempt) => attempt.result === "pass").length, 1);

  const gateOut = path.join(tmp, "gates", "remove-deps.json");
  const gate = runNode(
    path.join(TOOLS_DIR, "gate.mjs"),
    ["remove-deps", "--baseline", "baseline", "--working", "working", "--deps-dir", "deps", "--out", gateOut],
    tmp,
  );
  assert.equal(gate.status, 0, fs.existsSync(gateOut) ? fs.readFileSync(gateOut, "utf8") : gate.stderr);
});

test("replace-dependency refuses when the log says resolved but the app copy is not linked, until the entry is deleted", () => {
  const { appPkgDir, replace, readLog, forgetPackage } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  // A re-extracted app puts a real directory back under the old log.
  fs.rmSync(appPkgDir);
  writeJson(path.join(appPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(appPkgDir, "index.js"), VERIFYING_INDEX);

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /not linked to the root package/);
  assert.match(result.stderr, /delete the package's entry from \/\S+\/deps\/replacements\.json$/m);
  assert.ok(!fs.lstatSync(appPkgDir).isSymbolicLink(), "app copy must be left untouched");

  forgetPackage();
  const retrial = replace();
  assert.equal(retrial.status, 0, retrial.stderr || retrial.stdout);
  const pkgState = readLog().packages["demo-pkg"];
  assert.equal(pkgState.status, "resolved", JSON.stringify(pkgState.attempts));
});

test("replace-dependency refuses a resolved package whose root copy drifted from the verified version", () => {
  const { rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  writeJson(path.join(rootPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.4" });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /resolved with 1\.2\.3, but the root package is now 1\.2\.4/);
});

test("replace-dependency refuses an explicit --version that differs from the resolved one, until the original is restored", () => {
  const { tmp, appPkgDir, replace, readLog, forgetPackage } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  const result = replace("1.2.4");
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already resolved with 1\.2\.3; --version 1\.2\.4 is a retrial/);

  // Follow the message: the original named in it goes back over the link, and the entry goes.
  const backup = readLog().packages["demo-pkg"].attempts.find((attempt) => attempt.result === "pass").backupPath;
  assert.ok(result.stderr.includes(backup), result.stderr);
  fs.rmSync(appPkgDir);
  fs.renameSync(path.join(tmp, backup), appPkgDir);
  forgetPackage();

  const retrial = replace("1.2.4");
  assert.equal(retrial.status, 0, retrial.stderr || retrial.stdout);
  assert.equal(readLog().packages["demo-pkg"].attempts.at(-1).attemptedVersion, "1.2.4");
});
