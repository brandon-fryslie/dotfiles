import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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
// whether the swap verifies (same shape as the app copy) or fails (different shape). With pnpmLink, the app
// path is a relative symlink into the app's own .pnpm store, the way a pnpm-installed app ships it.
const PNPM_TARGET = ".pnpm/demo-pkg@1.2.3/node_modules/demo-pkg";

function swapProject(rootIndexJs, { pnpmLink = false } = {}) {
  const tmp = mkTmpDir();
  const appNodeModules = path.join(tmp, "resources", "app", "node_modules");
  const appPkgDir = path.join(appNodeModules, "demo-pkg");
  const rootPkgDir = path.join(tmp, "node_modules", "demo-pkg");
  const logPath = path.join(tmp, "deps", "replacements.json");

  const appCopyDir = pnpmLink ? path.join(appNodeModules, PNPM_TARGET) : appPkgDir;
  writeJson(path.join(appCopyDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(appCopyDir, "index.js"), "module.exports=function(){return 1};\n");
  if (pnpmLink) fs.symlinkSync(PNPM_TARGET, appPkgDir, "dir");
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

  // A verify script that SIGKILLs replace-dependency mid-verification: the run dies with its link in place and
  // the log exactly as the tool wrote it ahead of the swap.
  const killingVerify = path.join(tmp, "kill-parent.mjs");
  writeText(killingVerify, "process.kill(process.ppid, 'SIGKILL');\n");

  const replaceArgs = (version, verifyScript) => [
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    "--pkg", "demo-pkg",
    "--version", version,
    "--app-dir", path.join(tmp, "resources", "app"),
    "--npm", fakeNpm,
    "--verify-script", verifyScript,
    "--verification-dir", path.join(tmp, "deps", "verification"),
    "--out", logPath,
    "--threshold", "0.99",
  ];
  const replace = (version = "1.2.3", { verifyScript = path.join(TOOLS_DIR, "verify-dependency-swap.mjs") } = {}) => {
    const [script, ...args] = replaceArgs(version, verifyScript);
    return runNode(script, args, tmp);
  };

  // Start a run whose verification holds until release(): resolves once the run is mid-trial, holding its locks.
  // The run is killed when the test ends however it ends, and the hold ends with the run it verifies.
  const startHeld = async (t) => {
    const heldMarker = path.join(tmp, "held");
    const releaseMarker = path.join(tmp, "release");
    const holdingVerify = path.join(tmp, "hold.mjs");
    writeText(holdingVerify, [
      'import fs from "node:fs";',
      `fs.writeFileSync(${JSON.stringify(heldMarker)}, "");`,
      "const pause = new Int32Array(new SharedArrayBuffer(4));",
      "const run = process.ppid;",
      `while (!fs.existsSync(${JSON.stringify(releaseMarker)}) && process.ppid === run) Atomics.wait(pause, 0, 0, 20);`,
      "",
    ].join("\n"));
    const child = spawn("node", replaceArgs("1.2.3", holdingVerify), { cwd: tmp, stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => child.kill("SIGKILL"));
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    // 'close' comes after the output has drained, and it reports a run ended by a signal as well as by a status.
    let ended = null;
    const exited = new Promise((resolve) => child.on("close", (status, signal) => resolve(ended = { status, signal, output })));
    while (!fs.existsSync(heldMarker)) {
      if (ended) assert.fail(`the held run ended early (${ended.status ?? ended.signal}): ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return { pid: child.pid, release: () => { writeText(releaseMarker, ""); return exited; } };
  };
  const readLog = () => JSON.parse(fs.readFileSync(logPath, "utf8"));

  const forgetPackage = () => {
    const log = readLog();
    delete log.packages["demo-pkg"];
    writeJson(logPath, log);
  };

  // Kill a trial mid-verification; returns the in-flight entry the tool wrote ahead of the swap.
  const killMidVerify = () => {
    const killed = replace("1.2.3", { verifyScript: killingVerify });
    assert.equal(killed.signal, "SIGKILL", killed.stderr || killed.stdout);
    const entry = readLog().packages["demo-pkg"];
    assert.equal(entry.status, "in-flight", JSON.stringify(entry));
    return entry;
  };
  const backupOf = (entry) => path.resolve(path.dirname(logPath), entry.inFlight.original.backupPath);

  const gate = (cwd = tmp) => {
    for (const dir of ["baseline", "working"]) writeText(path.join(tmp, dir, "main.js"), "console.log(1);\n");
    const out = path.join(tmp, "gates", "remove-deps.json");
    const result = runNode(
      path.join(TOOLS_DIR, "gate.mjs"),
      ["remove-deps", "--baseline", path.join(tmp, "baseline"), "--working", path.join(tmp, "working"), "--deps-dir", path.join(tmp, "deps"), "--out", out],
      cwd,
    );
    return { status: result.status, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
  };

  return { tmp, appPkgDir, rootPkgDir, logPath, fakeNpm, replace, startHeld, readLog, forgetPackage, killMidVerify, backupOf, gate };
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
  assert.deepEqual(fs.readdirSync(path.join(path.dirname(appPkgDir), ".original")), [], "a rolled-back trial leaves no backup directories");
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

  // A different --version gets the same advice: a re-extracted app has no backup to restore.
  const otherVersion = replace("1.2.4");
  assert.equal(otherVersion.status, 2, otherVersion.stdout);
  assert.match(otherVersion.stderr, /not linked to the root package/);

  forgetPackage();
  const retrial = replace();
  assert.equal(retrial.status, 0, retrial.stderr || retrial.stdout);
  const pkgState = readLog().packages["demo-pkg"];
  assert.equal(pkgState.status, "resolved", JSON.stringify(pkgState.attempts));
});

test("replace-dependency refuses its own link when the log has no resolved swap for it, instead of trialing root against root", () => {
  const { appPkgDir, replace, readLog, forgetPackage } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  // The entry is deleted while our link is still on disk.
  forgetPackage();

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already links to the root package, but \S+ records no resolved swap for it — put the original back over the link first/);
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink(), "the link must be left untouched");
  assert.equal(readLog().packages["demo-pkg"], undefined, "nothing may be recorded resolved");
});

test("replace-dependency refuses a resolved swap whose root package was removed (dangling link)", () => {
  const { rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  fs.rmSync(rootPkgDir, { recursive: true });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /resolved with 1\.2\.3, but the root package is now missing — reinstall 1\.2\.3 at the root/);
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
  const { appPkgDir, replace, readLog, forgetPackage } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  const result = replace("1.2.4");
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already resolved with 1\.2\.3; --version 1\.2\.4 is a retrial/);

  // Follow the message: the original named in it goes back over the link, and the entry goes.
  const backup = result.stderr.match(/the original at (\/\S+) and delete/)?.[1];
  assert.ok(backup && fs.existsSync(path.join(backup, "package.json")), result.stderr);
  fs.rmSync(appPkgDir);
  fs.renameSync(backup, appPkgDir);
  forgetPackage();

  const retrial = replace("1.2.4");
  assert.equal(retrial.status, 0, retrial.stderr || retrial.stdout);
  assert.equal(readLog().packages["demo-pkg"].attempts.at(-1).attemptedVersion, "1.2.4");
});

const interruptedAttempts = (entry) => entry.attempts.filter((attempt) => attempt.reason === "interrupted");

test("replace-dependency recovers a trial killed mid-verification: the original comes back, then the trial reruns", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink(), "the kill leaves our link in place");

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.ok(rerun.stdout.includes(`interrupted trial of 1.2.3: restored the original at ${backupOf(inFlight)}`), rerun.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved", JSON.stringify(entry));
  assert.deepEqual(interruptedAttempts(entry).map((attempt) => attempt.recovery), ["restored"]);
});

test("replace-dependency recovers a trial killed after the rename, before the link", () => {
  const { appPkgDir, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX);
  killMidVerify();
  fs.unlinkSync(appPkgDir);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved");
  assert.deepEqual(interruptedAttempts(entry).map((attempt) => attempt.recovery), ["restored"]);
});

test("replace-dependency records a trial killed before anything moved as original-in-place, then trials it", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.renameSync(backupOf(inFlight), appPkgDir);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /interrupted trial of 1\.2\.3: the original was still in place/);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved");
  assert.deepEqual(interruptedAttempts(entry).map((attempt) => attempt.recovery), ["original-in-place"]);
});

test("replace-dependency refuses an interrupted trial whose backup and app path both hold a directory, naming the backup", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.cpSync(backupOf(inFlight), appPkgDir, { recursive: true });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`left the original at ${backupOf(inFlight)}, but the app path holds a directory too`), result.stderr);
  assert.ok(fs.existsSync(backupOf(inFlight)) && !fs.lstatSync(appPkgDir).isSymbolicLink(), "disk must be left untouched");
  assert.equal(readLog().packages["demo-pkg"].status, "in-flight");
});

test("replace-dependency refuses an interrupted trial whose backup is gone: the original is lost", () => {
  const { appPkgDir, replace, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.rmSync(backupOf(inFlight), { recursive: true });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /which is gone — the original is lost/);
});

test("the remove-deps gate fails on a swap left in flight", () => {
  const { killMidVerify, gate } = swapProject(VERIFYING_INDEX);
  killMidVerify();

  const { status, artifact } = gate();
  assert.equal(status, 1);
  assert.deepEqual(artifact.mismatches.replacementLogErrors.map((error) => error.type), ["swap-in-flight"]);
});

test("the remove-deps gate reads verification paths relative to the log, from any cwd", () => {
  const { replace, gate } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  const { status, artifact } = gate(mkTmpDir());
  assert.equal(status, 0, JSON.stringify(artifact.mismatches));
});

test("replace-dependency trials a foreign link against the files it points at, and puts the same link back on failure", () => {
  const { appPkgDir, replace, readLog } = swapProject(FAILING_INDEX, { pnpmLink: true });

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "unresolved");
  assert.equal(entry.attempts.at(-1).reason, "verification-failed");
  assert.deepEqual(entry.attempts.at(-1).original, { kind: "link", target: PNPM_TARGET });
  assert.equal(fs.readlinkSync(appPkgDir), PNPM_TARGET);
});

// Resolving needs the verification to see the files the link points at; a dangling renamed link fails it.
test("replace-dependency resolves a foreign link, and recovers one killed mid-verification", () => {
  const { appPkgDir, rootPkgDir, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX, { pnpmLink: true });
  killMidVerify();

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.ok(rerun.stdout.includes(`restored a symlink to ${PNPM_TARGET}`), rerun.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved", JSON.stringify(entry));
  assert.deepEqual(entry.attempts.at(-1).original, { kind: "link", target: PNPM_TARGET });
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency and the gate refuse a log the parser rejects, with the same error", () => {
  const cases = [
    ["resolved-success-count", (log) => { log.packages["demo-pkg"].attempts = []; }],
    ["in-flight-record-on-settled", (log) => { log.packages["demo-pkg"].inFlight = { attemptedVersion: "1.2.3" }; }],
    ["schema-version", (log) => { log.schemaVersion = 3; }],
    ["attempt-invalid", (log) => { log.packages["demo-pkg"].attempts[0].rolledBack = true; }],
  ];
  for (const [type, corrupt] of cases) {
    const { logPath, replace, readLog, gate } = swapProject(VERIFYING_INDEX);
    assert.equal(replace().status, 0);
    const log = readLog();
    corrupt(log);
    writeJson(logPath, log);

    const result = replace();
    assert.equal(result.status, 2, `${type}: ${result.stdout}`);
    assert.ok(result.stderr.includes(`"type":"${type}"`), `${type}: ${result.stderr}`);
    const { status, artifact } = gate();
    assert.equal(status, 1, type);
    assert.deepEqual(artifact.mismatches.replacementLogErrors.map((error) => error.type), [type]);
  }
});

test("replace-dependency checks a foreign link before anything is installed at the root", () => {
  const { tmp, replace, readLog } = swapProject(VERIFYING_INDEX, { pnpmLink: true });
  fs.rmSync(path.join(tmp, "node_modules"), { recursive: true });

  // The fake npm installs nothing, so the trial fails after install instead of crashing before it.
  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readLog().packages["demo-pkg"].attempts.at(-1).reason, "root-package-json-missing");
});

test("replace-dependency refuses an interrupted trial whose backup is gone as lost, even under a foreign link", () => {
  const { appPkgDir, replace, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.rmSync(backupOf(inFlight), { recursive: true });
  fs.symlinkSync("elsewhere", appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /which is gone — the original is lost/);
});

test("replace-dependency refuses to delete a backup root outside the app's .original/", () => {
  const { appPkgDir, logPath, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.renameSync(backupOf(inFlight), appPkgDir);
  // A hand edit points the backup at the log's own directory: its root would be deps/ itself.
  const log = readLog();
  log.packages["demo-pkg"].inFlight.original.backupPath = "x";
  writeJson(logPath, log);

  const result = replace();
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /is not under \S+\.original; refusing to delete it/);
  assert.ok(fs.existsSync(logPath), "the log's directory survives");
});

test("replace-dependency settles an interrupted trial of a package it was not asked about, without trialing it", () => {
  const { tmp, appPkgDir, logPath, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX);
  killMidVerify();

  // A second package, requested on its own, with nothing to trial.
  const result = runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    ["--pkg", "other-pkg", "--app-dir", path.join(tmp, "resources", "app"), "--out", logPath],
    tmp,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[demo-pkg\] interrupted trial of 1\.2\.3: restored the original/);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "unresolved", JSON.stringify(entry));
  assert.deepEqual(entry.attempts.map((attempt) => attempt.reason), ["interrupted"]);
  assert.ok(!fs.lstatSync(appPkgDir).isSymbolicLink(), "the original is back at the app path");
  assert.deepEqual(fs.readdirSync(path.join(path.dirname(appPkgDir), ".original")), []);
});

test("replace-dependency removes a backup root that collected stray files once the original is back", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  writeText(path.join(path.dirname(backupOf(inFlight)), ".DS_Store"), "");

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
  // Only the passing trial's backup remains.
  const roots = fs.readdirSync(path.join(path.dirname(appPkgDir), ".original"));
  assert.equal(roots.length, 1, JSON.stringify(roots));
  assert.ok(!roots.includes(path.basename(path.dirname(backupOf(inFlight)))));
});

test("replace-dependency migrates a v1 log, so a package a v1 run resolved stays resolved", () => {
  const { tmp, logPath, replace, readLog, gate } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);
  const v2 = readLog();

  // The same swap as v1 recorded it: backupPath on the attempt, every stored path relative to the run's cwd.
  const fromCwd = (stored) => path.relative(tmp, path.resolve(path.dirname(logPath), stored));
  const v1 = structuredClone(v2);
  v1.schemaVersion = 1;
  for (const attempt of v1.packages["demo-pkg"].attempts) {
    attempt.backupPath = fromCwd(attempt.original.backupPath);
    delete attempt.original;
    attempt.verification.path = fromCwd(attempt.verification.path);
  }
  writeJson(logPath, v1);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /\[demo-pkg\] already resolved with 1\.2\.3; skipped/);
  // Each stored path leads to the same file it did under v2, however the migration spelled it.
  const leadsTo = (stored) => fs.realpathSync(path.resolve(path.dirname(logPath), stored));
  const [migrated] = readLog().packages["demo-pkg"].attempts;
  const [original] = v2.packages["demo-pkg"].attempts;
  assert.equal(readLog().schemaVersion, 2);
  assert.equal(JSON.parse(fs.readFileSync(`${logPath}.v1`, "utf8")).schemaVersion, 1, "the v1 text is kept");
  assert.equal(leadsTo(migrated.original.backupPath), leadsTo(original.original.backupPath));
  assert.equal(leadsTo(migrated.verification.path), leadsTo(original.verification.path));
  assert.equal(gate().status, 0);
});

test("replace-dependency recognises a link to the root package however its target is spelled", () => {
  const { tmp, appPkgDir, replace } = swapProject(VERIFYING_INDEX);
  fs.rmSync(appPkgDir, { recursive: true });
  // os.tmpdir() sits under a symlinked prefix on macOS (/var -> /private/var); the target keeps the unresolved one.
  fs.symlinkSync(path.join(tmp, "node_modules", "demo-pkg"), appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already links to the root package/);
});

test("replace-dependency refuses a second run over an app tree another run is swapping, however it names the tree", async (t) => {
  const { tmp, appPkgDir, fakeNpm, readLog, startHeld } = swapProject(VERIFYING_INDEX);
  const held = await startHeld(t);

  // Another project, its own log, the same app through a symlinked spelling: only the app tree is shared.
  const otherProject = mkTmpDir();
  fs.symlinkSync(path.join(tmp, "resources", "app"), path.join(otherProject, "app"), "dir");
  const otherLog = path.join(otherProject, "deps", "replacements.json");
  const second = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", "app", "--npm", fakeNpm, "--out", otherLog], otherProject);
  assert.equal(second.status, 2, second.stdout);
  assert.ok(second.stderr.includes(path.join(fs.realpathSync(path.dirname(appPkgDir)), ".replace-dependency.lock")), second.stderr);
  assert.ok(second.stderr.includes(`pid ${held.pid},`), second.stderr);
  assert.ok(!fs.existsSync(otherLog), "the refused run writes no log");
  assert.equal(readLog().packages["demo-pkg"].status, "in-flight", "the holder's trial is untouched");

  const first = await held.release();
  assert.equal(first.status, 0, first.output);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
});

test("replace-dependency refuses a second run from the same project over another app tree, naming the project's node_modules", async (t) => {
  const { tmp, rootPkgDir, fakeNpm, readLog, startHeld } = swapProject(VERIFYING_INDEX);
  writeJson(path.join(tmp, "app2", "node_modules", "demo-pkg", "package.json"), { name: "demo-pkg", version: "1.2.3" });
  const held = await startHeld(t);

  const second = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", "app2", "--npm", fakeNpm, "--verification-dir", "deps/app2-verification", "--out", path.join(tmp, "deps", "app2.json")], tmp);
  assert.equal(second.status, 2, second.stdout);
  assert.ok(second.stderr.includes(path.join(fs.realpathSync(tmp), "node_modules", ".replace-dependency.lock")), second.stderr);
  assert.ok(!fs.existsSync(path.join(tmp, "deps", "app2.json")), "the refused run writes no log");
  assert.ok(fs.existsSync(path.join(rootPkgDir, "package.json")), "the root package is untouched");

  const first = await held.release();
  assert.equal(first.status, 0, first.output);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
});

test("replace-dependency refuses a second run writing the verification dir another run is writing, naming it", async (t) => {
  const { tmp, fakeNpm, readLog, startHeld } = swapProject(VERIFYING_INDEX);
  const held = await startHeld(t);

  // Another project and another app: only the verification dir is shared.
  const otherProject = mkTmpDir();
  writeJson(path.join(otherProject, "app", "node_modules", "demo-pkg", "package.json"), { name: "demo-pkg", version: "1.2.3" });
  const verificationDir = path.join(tmp, "deps", "verification");
  const second = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", "app", "--npm", fakeNpm, "--verification-dir", verificationDir], otherProject);
  assert.equal(second.status, 2, second.stdout);
  assert.ok(second.stderr.includes(path.join(fs.realpathSync(verificationDir), ".replace-dependency.lock")), second.stderr);
  assert.ok(!fs.existsSync(path.join(otherProject, "deps", "replacements.json")), "the refused run writes no log");

  const first = await held.release();
  assert.equal(first.status, 0, first.output);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
});

test("replace-dependency is not refused by the locks of a run that was killed", () => {
  const { replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX);
  killMidVerify();
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
});

test("replace-dependency refuses an --app-dir with no node_modules, naming it", () => {
  const tmp = mkTmpDir();
  fs.mkdirSync(path.join(tmp, "app"));
  const result = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", "app"], tmp);
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(path.join(tmp, "app", "node_modules")), result.stderr);
});
