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

// A relative link at `at` leading to `target`, the way package managers write them.
function linkTo(target, at) {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(at), target), at, "dir");
}

// An npm that records each call's arguments as a line of npm-calls in dir, then exits with status.
function fakeNpmIn(dir, status) {
  const fakeNpm = path.join(dir, "fake-npm.sh");
  writeText(fakeNpm, `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(path.join(dir, "npm-calls"))}\nexit ${status}\n`);
  fs.chmodSync(fakeNpm, 0o755);
  return fakeNpm;
}

function npmCallsIn(dir) {
  const callsPath = path.join(dir, "npm-calls");
  return fs.existsSync(callsPath) ? fs.readFileSync(callsPath, "utf8").trim().split("\n") : [];
}

// Every path under dir with what it is: a link's text, a file's contents, or "dir".
function treeSnapshot(dir) {
  return listTree(dir).map((rel) => {
    const abs = path.join(dir, rel);
    const stat = fs.lstatSync(abs);
    return [rel, stat.isSymbolicLink() ? `-> ${fs.readlinkSync(abs)}` : stat.isDirectory() ? "dir" : fs.readFileSync(abs, "utf8")];
  });
}

function listTree(dir, rel = "") {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const childRel = path.join(rel, entry.name);
    return entry.isDirectory() ? [childRel, ...listTree(dir, childRel)] : [childRel];
  });
}

// Each layout places the app's copy of the package and the links that reach it, and returns where the copy lives:
// "dir", at the app path; "pnpm", in the app's own .pnpm store, reached by a link at the app path and by a sibling
// consumer's link, the way a pnpm-installed app ships it; "linked", outside the app's node_modules, reached by a link
// at the app path, the way a workspace package is.
const LAYOUTS = {
  dir: ({ appPkgDir }) => appPkgDir,
  pnpm: ({ appPkgDir, storePkgDir, consumerPkgDir }) => {
    linkTo(storePkgDir, appPkgDir);
    linkTo(storePkgDir, consumerPkgDir);
    return storePkgDir;
  },
  linked: ({ tmp, name, appPkgDir }) => {
    const vendorDir = path.join(tmp, "vendor", name);
    linkTo(vendorDir, appPkgDir);
    return vendorDir;
  },
};

// A project with <name>@1.2.3 in the app, laid out as `layout` says, and installed at the root; rootIndexJs decides
// whether the swap verifies (same shape as the app copy) or fails (different shape).
function swapProject(rootIndexJs, { layout = "dir", name = "demo-pkg" } = {}) {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const appPkgDir = path.join(appDir, "node_modules", name);
  // pnpm names a store directory after the package, with a scope's "/" spelled "+".
  const storePkgDir = path.join(appDir, "node_modules", ".pnpm", `${name.replace("/", "+")}@1.2.3`, "node_modules", name);
  const consumerPkgDir = path.join(appDir, "node_modules", ".pnpm", "consumer@1.0.0", "node_modules", name);
  const rootPkgDir = path.join(tmp, "node_modules", name);
  const logPath = path.join(tmp, "deps", "replacements.json");

  const appCopyDir = LAYOUTS[layout]({ tmp, name, appPkgDir, storePkgDir, consumerPkgDir });
  writeJson(path.join(appCopyDir, "package.json"), { name, version: "1.2.3" });
  writeText(path.join(appCopyDir, "index.js"), "module.exports=function(){return 1};\n");
  // The app path's link as the app shipped it, or null for a directory.
  const shippedLink = fs.lstatSync(appPkgDir).isSymbolicLink() ? fs.readlinkSync(appPkgDir) : null;
  writeJson(path.join(rootPkgDir, "package.json"), { name, version: "1.2.3" });
  writeText(path.join(rootPkgDir, "index.js"), rootIndexJs);

  writeJson(path.join(tmp, "deps", "near-matches.json"), {
    packages: [
      {
        name,
        observedVersion: "1.2.3",
        recommendation: "exact",
        candidates: [{ version: "1.2.3", score: 100, reasons: ["exact"], risk: "low" }],
      },
    ],
  });

  const fakeNpm = fakeNpmIn(tmp, 0);

  // A verify script that SIGKILLs replace-dependency mid-verification: the run dies with its link in place and
  // the log exactly as the tool wrote it ahead of the swap.
  const killingVerify = path.join(tmp, "kill-parent.mjs");
  writeText(killingVerify, "process.kill(process.ppid, 'SIGKILL');\n");

  // selectArgs picks the packages: --pkg with a version, or --auto-near-match over deps/near-matches.json.
  const pkgArgs = (version) => ["--pkg", name, "--version", version];
  const replaceArgs = (selectArgs, verifyScript) => [
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    ...selectArgs,
    "--app-dir", appDir,
    "--npm", fakeNpm,
    "--verify-script", verifyScript,
    "--verification-dir", path.join(tmp, "deps", "verification"),
    "--out", logPath,
    "--threshold", "0.99",
  ];
  const replace = (version = "1.2.3", { verifyScript = path.join(TOOLS_DIR, "verify-dependency-swap.mjs") } = {}) => {
    const [script, ...args] = replaceArgs(pkgArgs(version), verifyScript);
    return runNode(script, args, tmp);
  };
  const replaceAuto = () => {
    const [script, ...args] = replaceArgs(["--auto-near-match", "--candidate-source", path.join(tmp, "deps", "near-matches.json")], path.join(TOOLS_DIR, "verify-dependency-swap.mjs"));
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
    const child = spawn("node", replaceArgs(pkgArgs("1.2.3"), holdingVerify), { cwd: tmp, stdio: ["ignore", "pipe", "pipe"] });
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
    delete log.packages[name];
    writeJson(logPath, log);
  };

  // Kill a trial mid-verification; returns the in-flight entry the tool wrote ahead of the swap.
  const killMidVerify = () => {
    const killed = replace("1.2.3", { verifyScript: killingVerify });
    assert.equal(killed.signal, "SIGKILL", killed.stderr || killed.stdout);
    const entry = readLog().packages[name];
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

  return { tmp, appDir, appPkgDir, storePkgDir, consumerPkgDir, rootPkgDir, logPath, shippedLink, fakeNpm, npmCalls: () => npmCallsIn(tmp), replace, replaceAuto, startHeld, readLog, forgetPackage, killMidVerify, backupOf, gate };
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
  assert.ok(result.stderr.includes(`left the original at ${backupOf(inFlight)}, but ${appPkgDir} holds a directory too`), result.stderr);
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
  const { appPkgDir, shippedLink, replace, readLog } = swapProject(FAILING_INDEX, { layout: "linked" });

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "unresolved");
  assert.equal(entry.attempts.at(-1).reason, "verification-failed");
  assert.deepEqual(entry.attempts.at(-1).original, { kind: "link", location: "node_modules/demo-pkg", target: shippedLink });
  assert.equal(fs.readlinkSync(appPkgDir), shippedLink);
});

// Resolving needs the verification to see the files the link points at; a dangling renamed link fails it.
test("replace-dependency resolves a foreign link, and recovers one killed mid-verification", () => {
  const { appPkgDir, rootPkgDir, shippedLink, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX, { layout: "linked" });
  killMidVerify();

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.ok(rerun.stdout.includes(`restored a symlink to ${shippedLink}`), rerun.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved", JSON.stringify(entry));
  assert.deepEqual(entry.attempts.at(-1).original, { kind: "link", location: "node_modules/demo-pkg", target: shippedLink });
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency swaps a pnpm store copy for every consumer, and the remove-deps gate passes", () => {
  const { appDir, appPkgDir, storePkgDir, consumerPkgDir, rootPkgDir, shippedLink, replace, readLog, gate } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const entry = readLog().packages["demo-pkg"];
  assert.equal(entry.status, "resolved", JSON.stringify(entry));
  assert.equal(entry.attempts.at(-1).original.kind, "dir");
  const pass = entry.attempts.at(-1);
  assert.equal(pass.original.location, path.relative(appDir, storePkgDir), "the log names the store copy's location it swapped");
  assert.match(result.stdout, /- locations of resolved packages loading something other than the root package: 0/);
  assert.equal(fs.readlinkSync(appPkgDir), shippedLink, "the app's own pnpm link is left as it shipped");
  assert.ok(fs.lstatSync(storePkgDir).isSymbolicLink());
  for (const consumer of [appPkgDir, consumerPkgDir]) assert.equal(fs.realpathSync(consumer), fs.realpathSync(rootPkgDir));
  assert.equal(gate().status, 0);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /\[demo-pkg\] already resolved with 1\.2\.3; skipped/);
});

test("replace-dependency puts a pnpm store copy back for every consumer when its trial fails", () => {
  const { appPkgDir, storePkgDir, consumerPkgDir, replace, readLog } = swapProject(FAILING_INDEX, { layout: "pnpm" });

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readLog().packages["demo-pkg"].attempts.at(-1).reason, "verification-failed");
  assert.ok(fs.lstatSync(storePkgDir).isDirectory());
  for (const consumer of [appPkgDir, consumerPkgDir]) assert.equal(fs.realpathSync(consumer), fs.realpathSync(storePkgDir));
});

test("replace-dependency recovers a pnpm store copy whose trial was killed mid-verification, or after the rename", () => {
  for (const afterKill of [() => {}, ({ storePkgDir }) => fs.unlinkSync(storePkgDir)]) {
    const project = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
    const inFlight = project.killMidVerify();
    afterKill(project);

    const rerun = project.replace();
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
    assert.ok(rerun.stdout.includes(`interrupted trial of 1.2.3: restored the original at ${project.backupOf(inFlight)}`), rerun.stdout);
    const entry = project.readLog().packages["demo-pkg"];
    assert.equal(entry.status, "resolved", JSON.stringify(entry));
    assert.equal(fs.realpathSync(project.consumerPkgDir), fs.realpathSync(project.rootPkgDir));
  }
});

test("replace-dependency names every other location of a package it resolved: another version, a nested copy, a dangling link", () => {
  const { appDir, rootPkgDir, replace } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
  const nodeModules = path.join(appDir, "node_modules");
  // demo-pkg@2.0.0 in the store too, loaded by its own consumer: a different copy, which 1.2.3's swap leaves alone.
  const otherStoreDir = path.join(nodeModules, ".pnpm", "demo-pkg@2.0.0", "node_modules", "demo-pkg");
  const otherConsumerDir = path.join(nodeModules, ".pnpm", "dep@1.0.0", "node_modules", "demo-pkg");
  writeJson(path.join(otherStoreDir, "package.json"), { name: "demo-pkg", version: "2.0.0" });
  linkTo(otherStoreDir, otherConsumerDir);
  // An npm-style copy nested under another package, and a consumer link whose version was pruned.
  const nestedDir = path.join(nodeModules, "bar", "node_modules", "demo-pkg");
  writeJson(path.join(nestedDir, "package.json"), { name: "demo-pkg", version: "0.9.0" });
  const danglingDir = path.join(nodeModules, ".pnpm", "pruned@1.0.0", "node_modules", "demo-pkg");
  linkTo(path.join(nodeModules, ".pnpm", "demo-pkg@0.1.0", "node_modules", "demo-pkg"), danglingDir);

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /- locations of resolved packages loading something other than the root package: 4/);
  for (const dir of [otherConsumerDir, otherStoreDir, nestedDir]) assert.ok(result.stdout.includes(`[demo-pkg] ${path.relative(appDir, dir)} loads another copy`), result.stdout);
  assert.ok(result.stdout.includes(`[demo-pkg] ${path.relative(appDir, danglingDir)} loads nothing`), result.stdout);
  assert.equal(fs.realpathSync(otherConsumerDir), fs.realpathSync(otherStoreDir), "the other copy is untouched");
  assert.notEqual(fs.realpathSync(otherConsumerDir), fs.realpathSync(rootPkgDir));

  // A rerun reads the same tree and says the same, though it trials nothing.
  const rerun = replace();
  assert.match(rerun.stdout, /- locations of resolved packages loading something other than the root package: 4/);
});

test("replace-dependency swaps a scoped package's pnpm store copy, and puts it back when its trial fails", () => {
  for (const [rootIndexJs, status] of [[VERIFYING_INDEX, "resolved"], [FAILING_INDEX, "unresolved"]]) {
    const { appDir, storePkgDir, consumerPkgDir, rootPkgDir, replace, readLog } = swapProject(rootIndexJs, { layout: "pnpm", name: "@scope/demo-pkg" });
    const result = replace();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readLog().packages["@scope/demo-pkg"].status, status);
    const loaded = status === "resolved" ? rootPkgDir : storePkgDir;
    assert.equal(fs.realpathSync(consumerPkgDir), fs.realpathSync(loaded));
    const backups = fs.readdirSync(path.join(appDir, "node_modules", ".original"));
    assert.equal(backups.length, status === "resolved" ? 1 : 0, JSON.stringify(backups));
  }
});

// Move the app's @scope directory out to <tmp>/shared-scope and link it back, the way a workspace shares its scope.
function linkScopeOut({ tmp, appDir }) {
  const scopeDir = path.join(appDir, "node_modules", "@scope");
  const sharedScope = path.join(tmp, "shared-scope");
  fs.renameSync(scopeDir, sharedScope);
  linkTo(sharedScope, scopeDir);
  return sharedScope;
}

test("replace-dependency records a package past a scope linked out of the app as not trialed, and moves nothing", () => {
  const project = swapProject(VERIFYING_INDEX, { name: "@scope/demo-pkg" });
  const sharedScope = linkScopeOut(project);
  const before = treeSnapshot(sharedScope);

  const result = project.replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[@scope\/demo-pkg\] not trialed: outside-app:node_modules\/@scope\/demo-pkg/);
  const attempt = project.readLog().packages["@scope/demo-pkg"].attempts.at(-1);
  assert.equal(attempt.attemptedVersion, null);
  assert.equal(attempt.reason, "outside-app:node_modules/@scope/demo-pkg");
  assert.deepEqual(project.npmCalls(), [], "npm installs nothing for a package it can't trial");
  assert.deepEqual(treeSnapshot(sharedScope), before);
});

test("replace-dependency refuses a resolved swap whose scope now links out of the app", () => {
  const project = swapProject(VERIFYING_INDEX, { name: "@scope/demo-pkg" });
  assert.equal(project.replace().status, 0);
  assert.equal(project.readLog().packages["@scope/demo-pkg"].status, "resolved");
  const sharedScope = linkScopeOut(project);
  const before = treeSnapshot(sharedScope);
  const backups = treeSnapshot(path.join(project.appDir, "node_modules", ".original"));

  const result = project.replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /\[@scope\/demo-pkg\] the log records the resolved swap at \S+, but that copy can't be swapped \(outside-app:node_modules\/@scope\/demo-pkg\)/);
  assert.deepEqual(treeSnapshot(sharedScope), before);
  assert.deepEqual(treeSnapshot(path.join(project.appDir, "node_modules", ".original")), backups);
});

test("replace-dependency refuses an app whose links to the package loop, naming the loop", () => {
  const { appPkgDir, logPath, replace } = swapProject(VERIFYING_INDEX);
  fs.rmSync(appPkgDir, { recursive: true });
  fs.symlinkSync("demo-pkg", appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /\[demo-pkg\] the app's links loop, so no copy of it loads: \S+demo-pkg -> \S+demo-pkg/);
  assert.ok(!fs.existsSync(logPath), "the refused run writes no log");
});

test("replace-dependency swaps an alias link at the app path, never the other package it leads to", () => {
  const { appDir, appPkgDir, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX);
  const otherDir = path.join(appDir, "node_modules", ".pnpm", "other-pkg@1.0.0", "node_modules", "other-pkg");
  fs.mkdirSync(path.dirname(otherDir), { recursive: true });
  fs.renameSync(appPkgDir, otherDir);
  linkTo(otherDir, appPkgDir);

  const inFlight = killMidVerify();
  assert.equal(inFlight.inFlight.original.location, "node_modules/demo-pkg");
  assert.ok(fs.lstatSync(otherDir).isDirectory(), "other-pkg's own copy never moves");
  assert.equal(replace().status, 0);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
  assert.ok(fs.lstatSync(otherDir).isDirectory());
});

test("replace-dependency refuses a trial in flight once the app path leads to another location than the one it records", () => {
  const { appDir, appPkgDir, storePkgDir, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
  killMidVerify();
  const elsewhere = path.join(appDir, "node_modules", ".pnpm", "demo-pkg@1.2.4", "node_modules", "demo-pkg");
  writeJson(path.join(elsewhere, "package.json"), { name: "demo-pkg", version: "1.2.4" });
  fs.unlinkSync(appPkgDir);
  linkTo(elsewhere, appPkgDir);

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`the log records the in-flight swap at ${path.join(appDir, path.relative(appDir, storePkgDir))}, but ${appPkgDir} now leads to`), result.stderr);
  assert.ok(fs.lstatSync(storePkgDir).isSymbolicLink(), "the store location is left as the kill left it");
  assert.equal(readLog().packages["demo-pkg"].status, "in-flight");
});

test("replace-dependency refuses an --app-dir that is the project root, before npm installs anything", () => {
  const { tmp, logPath } = swapProject(VERIFYING_INDEX);
  const marker = path.join(tmp, "npm-ran");
  const npm = path.join(tmp, "marking-npm.sh");
  writeText(npm, `#!/usr/bin/env bash\ntouch ${JSON.stringify(marker)}\n`);
  fs.chmodSync(npm, 0o755);

  const result = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--version", "1.2.3", "--app-dir", ".", "--npm", npm, "--out", logPath], tmp);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /is the project root, so npm would install over the app's own copies/);
  assert.ok(!fs.existsSync(marker), "npm never ran");
});

test("replace-dependency and the gate refuse a log the parser rejects, with the same error", () => {
  const cases = [
    ["resolved-success-count", (log) => { log.packages["demo-pkg"].attempts = []; }],
    ["in-flight-record-on-settled", (log) => { log.packages["demo-pkg"].inFlight = { attemptedVersion: "1.2.3" }; }],
    ["schema-version", (log) => { log.schemaVersion = 99; }],
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
  const { tmp, replace, readLog } = swapProject(VERIFYING_INDEX, { layout: "linked" });
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

test("replace-dependency and the gate refuse a log an older version wrote, naming the way out", () => {
  const { logPath, replace, readLog, gate } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);
  writeJson(logPath, { ...readLog(), schemaVersion: 2 });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /"type":"schema-version".*put each swapped package's original back over its link/);
  assert.equal(gate().status, 1);
});

test("replace-dependency records a location an app whose node_modules is a symlink can read back, and recovers it", () => {
  const { tmp, appDir, appPkgDir, rootPkgDir, replace, readLog, killMidVerify } = swapProject(VERIFYING_INDEX);
  const sharedDir = path.join(tmp, "shared-node-modules");
  fs.renameSync(path.join(appDir, "node_modules"), sharedDir);
  fs.symlinkSync(sharedDir, path.join(appDir, "node_modules"), "dir");

  assert.equal(killMidVerify().inFlight.original.location, "node_modules/demo-pkg");
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(readLog().packages["demo-pkg"].status, "resolved");
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency refuses an app whose node_modules links to the project's own", () => {
  const { tmp, appDir, fakeNpm, logPath } = swapProject(VERIFYING_INDEX);
  fs.rmSync(path.join(appDir, "node_modules"), { recursive: true });
  fs.symlinkSync(path.join(tmp, "node_modules"), path.join(appDir, "node_modules"), "dir");

  const result = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--version", "1.2.3", "--app-dir", appDir, "--npm", fakeNpm, "--out", logPath], tmp);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /is the project root, so npm would install over the app's own copies/);
});

test("replace-dependency reports a backup root it can't remove as a leftover, once the original is back", (t) => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  const stuckDir = path.join(path.dirname(backupOf(inFlight)), "stuck");
  writeText(path.join(stuckDir, "file"), "");
  fs.chmodSync(stuckDir, 0o555);
  // The rerun removes the root once it is writable again; until then the temp dir's cleanup needs it writable.
  t.after(() => fs.existsSync(stuckDir) && fs.chmodSync(stuckDir, 0o755));

  const result = replace();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /the original is in place, but its backup root \S+ could not be removed/);
  assert.ok(fs.lstatSync(appPkgDir).isDirectory(), "the original is back at the app path");
  assert.equal(readLog().packages["demo-pkg"].status, "in-flight", "the record stays until the leftover is gone");

  fs.chmodSync(stuckDir, 0o755);
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /interrupted trial of 1\.2\.3: the original was still in place/);
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

// Run detect-dependencies over appDir from the project root at tmp, with main.js holding code as the build dir.
function detect(tmp, appDir, code = "console.log(1);\n") {
  writeText(path.join(tmp, "build", "main.js"), code);
  const out = path.join(tmp, "deps", "detected-dependencies.json");
  const result = runNode(path.join(TOOLS_DIR, "detect-dependencies.mjs"), ["--app-dir", appDir, "--build-dir", path.join(tmp, "build"), "--out", out], tmp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { result, report: JSON.parse(fs.readFileSync(out, "utf8")) };
}

// detect-dependencies, then find-near-match-versions against registry (a {name: [versions]} fixture), then
// replace-dependency --auto-near-match with no --pkg over what they found.
function detectAndReplace(project, { code, registry }) {
  const { report } = detect(project.tmp, project.appDir, code);
  const registryPath = path.join(project.tmp, "registry.json");
  writeJson(registryPath, registry);
  const nearMatch = runNode(
    path.join(TOOLS_DIR, "find-near-match-versions.mjs"),
    ["--deps", path.join(project.tmp, "deps", "detected-dependencies.json"), "--app-dir", project.appDir, "--registry-file", registryPath, "--out", path.join(project.tmp, "deps", "near-matches.json")],
    project.tmp,
  );
  assert.equal(nearMatch.status, 0, nearMatch.stderr || nearMatch.stdout);
  const result = project.replaceAuto();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { report, result, log: project.readLog() };
}

// An app whose node_modules top level holds one entry in every state an entry can be in, beside the dot entries
// tooling writes. The two chmod-000 entries are made readable again when the test ends.
function everyStateApp(t) {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const nm = path.join(appDir, "node_modules");
  const pkg = (dir, name, version) => {
    writeJson(path.join(dir, "package.json"), { name, version });
    writeText(path.join(dir, "index.js"), VERIFYING_INDEX);
    return dir;
  };
  const store = (name, version) => pkg(path.join(nm, ".pnpm", `${name.replace("/", "+")}@${version}`, "node_modules", name), name, version);

  pkg(path.join(nm, "plain"), "plain", "1.0.0");
  linkTo(store("pnpm-pkg", "2.0.0"), path.join(nm, "pnpm-pkg"));
  linkTo(store("@scope/pnpm-scoped", "3.0.0"), path.join(nm, "@scope", "pnpm-scoped"));
  linkTo(pkg(path.join(tmp, "vendor", "linked"), "linked", "4.0.0"), path.join(nm, "linked"));
  linkTo(store("real-pkg", "5.0.0"), path.join(nm, "aliased"));
  pkg(path.join(tmp, "workspace", "@ws", "inner"), "@ws/inner", "6.0.0");
  linkTo(path.join(tmp, "workspace", "@ws"), path.join(nm, "@ws"));
  linkTo(store("@back/back", "7.0.0"), path.join(tmp, "shared-back", "back"));
  linkTo(path.join(tmp, "shared-back"), path.join(nm, "@back"));
  fs.symlinkSync("looped", path.join(nm, "looped"), "dir");
  fs.symlinkSync("gone", path.join(nm, "dangling"), "dir");
  writeText(path.join(nm, "afile"), "not a package\n");
  fs.mkdirSync(path.join(nm, "nomanifest"));
  writeText(path.join(nm, "badjson", "package.json"), "{");
  writeJson(path.join(nm, "noversion", "package.json"), { name: "noversion" });
  fs.mkdirSync(path.join(nm, ".bin"));
  writeText(path.join(nm, ".package-lock.json"), "{}");
  const locked = [pkg(path.join(nm, "locked"), "locked", "8.0.0"), path.dirname(pkg(path.join(nm, "@locked-scope", "x"), "@locked-scope/x", "9.0.0"))];
  for (const dir of locked) fs.chmodSync(dir, 0o000);
  t.after(() => { for (const dir of locked) fs.chmodSync(dir, 0o755); });
  return { tmp, appDir };
}

const EVERY_STATE_ON_DISK = {
  nodeModules: { kind: "dir" },
  packages: [
    { name: "@back/back", version: "7.0.0", path: "node_modules/@back/back", location: "node_modules/.pnpm/@back+back@7.0.0/node_modules/@back/back" },
    { name: "@scope/pnpm-scoped", version: "3.0.0", path: "node_modules/@scope/pnpm-scoped", location: "node_modules/.pnpm/@scope+pnpm-scoped@3.0.0/node_modules/@scope/pnpm-scoped" },
    { name: "linked", version: "4.0.0", path: "node_modules/linked", location: "node_modules/linked" },
    { name: "plain", version: "1.0.0", path: "node_modules/plain", location: "node_modules/plain" },
    { name: "pnpm-pkg", version: "2.0.0", path: "node_modules/pnpm-pkg", location: "node_modules/.pnpm/pnpm-pkg@2.0.0/node_modules/pnpm-pkg" },
  ],
  untrialable: [
    { name: "@ws/inner", path: "node_modules/@ws/inner", reason: "outside-app:node_modules/@ws/inner" },
    { name: "aliased", path: "node_modules/aliased", reason: "alias-of:real-pkg" },
    { name: "looped", path: "node_modules/looped", reason: "loop:node_modules/looped -> node_modules/looped" },
  ],
  skipped: [
    { name: "@locked-scope", path: "node_modules/@locked-scope", reason: "not-a-package:unreadable:EACCES" },
    { name: "afile", path: "node_modules/afile", reason: "not-a-package:file" },
    { name: "badjson", path: "node_modules/badjson", reason: "BADJSON" },
    { name: "dangling", path: "node_modules/dangling", reason: "not-a-package:dangling:gone" },
    { name: "locked", path: "node_modules/locked", reason: "not-a-package:unreadable:EACCES" },
    { name: "nomanifest", path: "node_modules/nomanifest", reason: "not-a-package:no-manifest" },
    { name: "noversion", path: "node_modules/noversion", reason: "not-a-package:unusable-manifest:no-name-or-version" },
  ],
};

test("detect-dependencies reports every top-level entry: linked packages with their on-disk version, the rest with why", (t) => {
  const { tmp, appDir } = everyStateApp(t);
  const { result, report } = detect(tmp, appDir);

  const badjson = report.onDisk.skipped.find(({ name }) => name === "badjson");
  assert.match(badjson.reason, /^not-a-package:unusable-manifest:invalid-json \(.+\)$/);
  badjson.reason = "BADJSON";
  assert.deepEqual(report.onDisk, EVERY_STATE_ON_DISK);
  const unlisted = [...EVERY_STATE_ON_DISK.untrialable, ...EVERY_STATE_ON_DISK.skipped];
  assert.equal(report.warnings.length, unlisted.length, JSON.stringify(report.warnings));
  for (const { path: entryPath } of unlisted) {
    assert.equal(report.warnings.filter((warning) => warning.startsWith(`${entryPath}: `)).length, 1, entryPath);
    assert.ok(result.stdout.includes(`  ${entryPath}: `), `the console prints ${entryPath}'s warning`);
  }
});

test("replace-dependency --pkg trials exactly the packages detect-dependencies reports trialable, and records each other with its reason", (t) => {
  const { tmp, appDir } = everyStateApp(t);
  const { report } = detect(tmp, appDir);
  const fakeNpm = fakeNpmIn(tmp, 1);
  const logPath = path.join(tmp, "deps", "replacements.json");
  const outside = ["vendor", "workspace", "shared-back"].map((dir) => path.join(tmp, dir));
  const before = outside.map(treeSnapshot);

  const replace = (name) => runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    ["--pkg", name, "--version", "9.9.9", "--app-dir", appDir, "--npm", fakeNpm, "--out", logPath, "--verification-dir", path.join(tmp, "deps", "verification")],
    tmp,
  );
  const lastAttempt = (name) => JSON.parse(fs.readFileSync(logPath, "utf8")).packages[name].attempts.at(-1);

  for (const { name } of report.onDisk.packages) {
    assert.equal(replace(name).status, 0);
    assert.deepEqual([lastAttempt(name).attemptedVersion, lastAttempt(name).reason], ["9.9.9", "npm-install-failed"], name);
  }
  for (const { name, reason } of [...report.onDisk.untrialable, ...report.onDisk.skipped]) {
    const result = replace(name);
    if (reason.startsWith("loop:")) {
      assert.equal(result.status, 2, result.stdout);
      assert.match(result.stderr, new RegExp(`\\[${name}\\] the app's links loop`));
      continue;
    }
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual([lastAttempt(name).attemptedVersion, lastAttempt(name).reason], [null, reason], name);
  }
  assert.deepEqual(npmCallsIn(tmp), report.onDisk.packages.map(({ name }) => `install --silent --no-progress --save-exact ${name}@9.9.9`));
  assert.deepEqual(outside.map(treeSnapshot), before, "nothing past a link out of the app changes");
});

test("replace-dependency --auto-near-match trials a pnpm app's linked scoped package detect-dependencies found, with no --pkg", () => {
  const project = swapProject(VERIFYING_INDEX, { layout: "pnpm", name: "@scope/demo-pkg" });
  const { report, log } = detectAndReplace(project, { registry: { "@scope/demo-pkg": ["1.2.3"] } });

  assert.deepEqual(report.onDisk.packages.map(({ name, version }) => [name, version]), [["@scope/demo-pkg", "1.2.3"]]);
  assert.equal(log.packages["@scope/demo-pkg"].status, "resolved", JSON.stringify(log));
  assert.equal(fs.realpathSync(project.consumerPkgDir), fs.realpathSync(project.rootPkgDir));
});

test("replace-dependency --auto-near-match trials a package linked from outside node_modules, leaving what it links to alone", () => {
  const project = swapProject(VERIFYING_INDEX, { layout: "linked" });
  const vendor = path.join(project.tmp, "vendor");
  const before = treeSnapshot(vendor);
  const { report, log } = detectAndReplace(project, { registry: { "demo-pkg": ["1.2.3"] } });

  assert.deepEqual(report.onDisk.packages.map(({ name, version }) => [name, version]), [["demo-pkg", "1.2.3"]]);
  assert.equal(log.packages["demo-pkg"].status, "resolved", JSON.stringify(log));
  assert.equal(fs.realpathSync(project.appPkgDir), fs.realpathSync(project.rootPkgDir));
  assert.deepEqual(treeSnapshot(vendor), before);
});

test("replace-dependency --auto-near-match resolves a pnpm package beside a scope linked out of the app, which it doesn't trial", () => {
  const project = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
  const workspace = path.join(project.tmp, "workspace");
  writeJson(path.join(workspace, "@ws", "linked", "package.json"), { name: "@ws/linked", version: "1.0.0" });
  linkTo(path.join(workspace, "@ws"), path.join(project.appDir, "node_modules", "@ws"));
  const before = treeSnapshot(workspace);

  const { report, log } = detectAndReplace(project, {
    code: 'require("demo-pkg");\nrequire("@ws/linked");\n',
    registry: { "demo-pkg": ["1.2.3"], "@ws/linked": ["1.0.0"] },
  });
  const reason = "outside-app:node_modules/@ws/linked";
  assert.deepEqual(report.onDisk.untrialable, [{ name: "@ws/linked", path: "node_modules/@ws/linked", reason }]);
  assert.equal(log.packages["demo-pkg"].status, "resolved", JSON.stringify(log));
  assert.deepEqual(log.packages["@ws/linked"].attempts.map((attempt) => [attempt.attemptedVersion, attempt.reason]), [[null, reason]]);
  assert.deepEqual(project.npmCalls(), ["install --silent --no-progress --save-exact demo-pkg@1.2.3"]);
  assert.deepEqual(treeSnapshot(workspace), before);
});

test("detect-dependencies states that an app ships no node_modules, without a warning", () => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  fs.mkdirSync(appDir, { recursive: true });
  const { report } = detect(tmp, appDir);
  assert.deepEqual(report.onDisk, { nodeModules: { kind: "absent" }, packages: [], untrialable: [], skipped: [] });
  assert.deepEqual(report.warnings, []);
});
