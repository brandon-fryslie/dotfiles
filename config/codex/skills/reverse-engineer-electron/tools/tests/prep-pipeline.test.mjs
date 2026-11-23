import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { writeText } from "./fixtures.mjs";
import { appAt, copiesOf, replacementOf, walkStarts } from "../node-modules.mjs";
import { fromLogPath } from "../replacement-log.mjs";

const TOOLS_DIR = path.join(import.meta.dirname, "..");

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-prep-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
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
      nodeModules: { kind: "listed" },
      packages: [{ name: "demo-pkg", version: "1.2.3", location: "node_modules/demo-pkg", paths: ["node_modules/demo-pkg"] }],
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
            hashMatches: [{ package: "demo-pkg", version: "1.2.3" }],
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

test("find-near-match-versions refuses a report whose on-disk packages it can't read, instead of proposing none from disk", () => {
  const tmp = mkTmpDir();
  const depsPath = path.join(tmp, "deps", "detected-dependencies.json");
  const run = (report) => {
    writeJson(depsPath, report);
    return runNode(path.join(TOOLS_DIR, "find-near-match-versions.mjs"), ["--deps", depsPath, "--app-dir", tmp, "--out", path.join(tmp, "near.json")], TOOLS_DIR);
  };
  const cases = [
    [{ code: {} }, /has no onDisk\.packages list/],
    [{ onDisk: { nodeModules: { kind: "listed" }, packages: [{ name: "", version: "1.0.0", location: "node_modules/x" }] } }, /has no onDisk\.packages list/],
    [{ onDisk: { nodeModules: { kind: "listed" }, packages: [{ name: "x", version: "1.0.0" }] } }, /has no onDisk\.packages list of \{ name, version, location \}/],
    [{ onDisk: { nodeModules: { kind: "incomplete", reason: "node_modules is not a directory (dangling:gone)" }, packages: [] } }, /node_modules is not a directory \(dangling:gone\) — fix it/],
    [{ onDisk: { nodeModules: { kind: "dir" }, packages: [] } }, /its node_modules verdict is \{"kind":"dir"\}/],
  ];
  for (const [report, message] of cases) {
    const result = run(report);
    assert.equal(result.status, 2, JSON.stringify(report));
    assert.match(result.stderr, message);
  }
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
  const fails = status === 0 ? "" : `echo "npm error 404 Not Found" >&2\n`;
  writeText(fakeNpm, `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(path.join(dir, "npm-calls"))}\n${fails}exit ${status}\n`);
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
// "dir", at the app path; "pnpm", in the app's own .pnpm store, reached by a link at the app path and by the store's
// hoisted link every store package resolves through, the way a pnpm-installed app ships it; "linked", outside the app's node_modules, reached by a link
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

// A project with <name>@1.2.3 in the app, laid out as `layout` says, and its replacement installed at the root (the
// fake npm installs nothing); rootIndexJs decides whether the swap verifies (same shape as the app copy) or fails
// (different shape). location is the copy's swap location, the key of its entry in the log.
function swapProject(rootIndexJs, { layout = "dir", name = "demo-pkg" } = {}) {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const appPkgDir = path.join(appDir, "node_modules", name);
  // pnpm names a store directory after the package, with a scope's "/" spelled "+".
  const storePkgDir = path.join(appDir, "node_modules", ".pnpm", `${name.replace("/", "+")}@1.2.3`, "node_modules", name);
  const consumerPkgDir = path.join(appDir, "node_modules", ".pnpm", "node_modules", name);
  const rootPkgDir = replacementOf(tmp, name, "1.2.3").dir;
  const logPath = path.join(tmp, "deps", "replacements.json");

  const appCopyDir = LAYOUTS[layout]({ tmp, name, appPkgDir, storePkgDir, consumerPkgDir });
  const location = path.relative(appDir, layout === "pnpm" ? storePkgDir : appPkgDir);
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
        onDiskVersion: "1.2.3",
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
  const replaceWith = (selectArgs) => {
    const [script, ...args] = replaceArgs(selectArgs, path.join(TOOLS_DIR, "verify-dependency-swap.mjs"));
    return runNode(script, args, tmp);
  };
  const replaceAuto = () => replaceWith(["--auto-near-match", "--candidate-source", path.join(tmp, "deps", "near-matches.json")]);

  // Start a run whose verification holds until release(): resolves once the run is mid-trial, holding its locks.
  // The run is killed when the test ends however it ends, and the hold ends with the run it verifies.
  const startHeld = async (t) => {
    const heldMarker = path.join(tmp, "held");
    const releaseMarker = path.join(tmp, "release");
    const holdingVerify = path.join(tmp, "hold.mjs");
    writeText(holdingVerify, [
      'import fs from "node:fs";',
      'import path from "node:path";',
      `fs.writeFileSync(${JSON.stringify(heldMarker)}, "");`,
      "const pause = new Int32Array(new SharedArrayBuffer(4));",
      "const run = process.ppid;",
      `while (!fs.existsSync(${JSON.stringify(releaseMarker)}) && process.ppid === run) Atomics.wait(pause, 0, 0, 20);`,
      'const out = process.argv[process.argv.indexOf("--out") + 1];',
      'fs.mkdirSync(path.dirname(out), { recursive: true });',
      "fs.writeFileSync(out, JSON.stringify({ pass: true }));",
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
  const entry = () => readLog().copies[location];

  const forgetCopy = () => {
    const log = readLog();
    delete log.copies[location];
    writeJson(logPath, log);
  };

  // Kill a trial mid-verification; returns the in-flight entry the tool wrote ahead of the swap.
  const killMidVerify = () => {
    const killed = replace("1.2.3", { verifyScript: killingVerify });
    assert.equal(killed.signal, "SIGKILL", killed.stderr || killed.stdout);
    assert.equal(entry().status, "in-flight", JSON.stringify(readLog()));
    return entry();
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

  return { tmp, appDir, appPkgDir, storePkgDir, consumerPkgDir, rootPkgDir, location, logPath, shippedLink, fakeNpm, npmCalls: () => npmCallsIn(tmp), replace, replaceWith, replaceAuto, startHeld, readLog, entry, forgetCopy, killMidVerify, backupOf, gate };
}

const VERIFYING_INDEX = "module.exports=function(){return 1};\n";
const FAILING_INDEX = "module.exports=function(){const o={x:2};return o.x};\n";

test("replace-dependency rolls back failed verified swap and logs transaction", () => {
  const { appPkgDir, replace, readLog, entry } = swapProject(FAILING_INDEX);
  const result = replace();

  assert.equal(result.status, 3, result.stderr || result.stdout);

  const pkgState = entry();
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

test("replace-dependency links the app copy to its replacement", () => {
  const { appPkgDir, rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  const result = replace();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink());
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency rerun on a resolved package is skipped and the remove-deps gate passes", () => {
  const { tmp, replace, readLog, entry } = swapProject(VERIFYING_INDEX);
  for (const dir of ["baseline", "working"]) writeText(path.join(tmp, dir, "main.js"), "console.log(1);\n");

  const first = replace();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = replace();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /\[demo-pkg node_modules\/demo-pkg\] already resolved with 1\.2\.3; skipped/);

  const pkgState = entry();
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
  const { appPkgDir, replace, readLog, forgetCopy, entry } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  // A re-extracted app puts a real directory back under the old log.
  fs.rmSync(appPkgDir);
  writeJson(path.join(appPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.3" });
  writeText(path.join(appPkgDir, "index.js"), VERIFYING_INDEX);

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /not linked to its replacement/);
  assert.match(result.stderr, /delete the copy's entry \(node_modules\/demo-pkg\) from \/\S+\/deps\/replacements\.json$/m);
  assert.ok(!fs.lstatSync(appPkgDir).isSymbolicLink(), "app copy must be left untouched");

  // A different --version gets the same advice: a re-extracted app has no backup to restore.
  const otherVersion = replace("1.2.4");
  assert.equal(otherVersion.status, 2, otherVersion.stdout);
  assert.match(otherVersion.stderr, /not linked to its replacement/);

  forgetCopy();
  const retrial = replace();
  assert.equal(retrial.status, 0, retrial.stderr || retrial.stdout);
  const pkgState = entry();
  assert.equal(pkgState.status, "resolved", JSON.stringify(pkgState.attempts));
});

test("replace-dependency refuses its own link when the log has no resolved swap for it, instead of trialing root against root", () => {
  const { appPkgDir, replace, readLog, forgetCopy, entry } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  // The entry is deleted while our link is still on disk.
  forgetCopy();

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already links to a replacement, but \S+ records no resolved swap for it — put the original back over the link first/);
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink(), "the link must be left untouched");
  assert.equal(entry(), undefined, "nothing may be recorded resolved");
});

test("replace-dependency refuses a resolved swap whose replacement was removed (dangling link)", () => {
  const { rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  fs.rmSync(rootPkgDir, { recursive: true });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /resolved with 1\.2\.3, but its replacement \S+ is now absent — reinstall it \(npm install @replace-dependency\/demo-pkg__1\.2\.3@npm:demo-pkg@1\.2\.3\)/);
});

test("replace-dependency refuses a resolved package whose root copy drifted from the verified version", () => {
  const { rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  writeJson(path.join(rootPkgDir, "package.json"), { name: "demo-pkg", version: "1.2.4" });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /resolved with 1\.2\.3, but its replacement \S+ is now demo-pkg@1\.2\.4/);
});

test("replace-dependency refuses an explicit --version that differs from the resolved one, until the original is restored", () => {
  const { appPkgDir, replace, readLog, forgetCopy, entry } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);

  const result = replace("1.2.4");
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already resolved with 1\.2\.3; --version 1\.2\.4 is a retrial/);

  // Follow the message: the original named in it goes back over the link, and the entry goes.
  const backup = result.stderr.match(/the original at (\/\S+) and delete/)?.[1];
  assert.ok(backup && fs.existsSync(path.join(backup, "package.json")), result.stderr);
  fs.rmSync(appPkgDir);
  fs.renameSync(backup, appPkgDir);
  forgetCopy();

  const retrial = replace("1.2.4");
  assert.equal(retrial.status, 3, retrial.stderr || retrial.stdout);
  assert.equal(entry().attempts.at(-1).attemptedVersion, "1.2.4");
});

const interruptedAttempts = (entry) => entry.attempts.filter((attempt) => attempt.reason === "interrupted");

test("replace-dependency recovers a trial killed mid-verification: the original comes back, then the trial reruns", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf, entry } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  assert.ok(fs.lstatSync(appPkgDir).isSymbolicLink(), "the kill leaves our link in place");

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.ok(rerun.stdout.includes(`interrupted trial of 1.2.3: restored the original at ${backupOf(inFlight)}`), rerun.stdout);
  const copy = entry();
  assert.equal(copy.status, "resolved", JSON.stringify(copy));
  assert.deepEqual(interruptedAttempts(copy).map((attempt) => attempt.recovery), ["restored"]);
});

test("replace-dependency recovers a trial killed after the rename, before the link", () => {
  const { appPkgDir, replace, readLog, killMidVerify, entry } = swapProject(VERIFYING_INDEX);
  killMidVerify();
  fs.unlinkSync(appPkgDir);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  const copy = entry();
  assert.equal(copy.status, "resolved");
  assert.deepEqual(interruptedAttempts(copy).map((attempt) => attempt.recovery), ["restored"]);
});

test("replace-dependency records a trial killed before anything moved as original-in-place, then trials it", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf, entry } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.renameSync(backupOf(inFlight), appPkgDir);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /interrupted trial of 1\.2\.3: the original was still in place/);
  const copy = entry();
  assert.equal(copy.status, "resolved");
  assert.deepEqual(interruptedAttempts(copy).map((attempt) => attempt.recovery), ["original-in-place"]);
});

test("replace-dependency refuses an interrupted trial whose backup and app path both hold a directory, naming the backup", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf, entry } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.cpSync(backupOf(inFlight), appPkgDir, { recursive: true });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`left the original at ${backupOf(inFlight)}, but ${appPkgDir} holds a directory too`), result.stderr);
  assert.ok(fs.existsSync(backupOf(inFlight)) && !fs.lstatSync(appPkgDir).isSymbolicLink(), "disk must be left untouched");
  assert.equal(entry().status, "in-flight");
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
  const { appPkgDir, shippedLink, replace, readLog, entry } = swapProject(FAILING_INDEX, { layout: "linked" });

  const result = replace();
  assert.equal(result.status, 3, result.stderr || result.stdout);
  const copy = entry();
  assert.equal(copy.status, "unresolved");
  assert.equal(copy.attempts.at(-1).reason, "verification-failed");
  assert.deepEqual(copy.attempts.at(-1).original, { kind: "link", target: shippedLink });
  assert.equal(fs.readlinkSync(appPkgDir), shippedLink);
});

// Resolving needs the verification to see the files the link points at; a dangling renamed link fails it.
test("replace-dependency resolves a foreign link, and recovers one killed mid-verification", () => {
  const { appPkgDir, rootPkgDir, shippedLink, replace, readLog, killMidVerify, entry } = swapProject(VERIFYING_INDEX, { layout: "linked" });
  killMidVerify();

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.ok(rerun.stdout.includes(`restored a symlink to ${shippedLink}`), rerun.stdout);
  const copy = entry();
  assert.equal(copy.status, "resolved", JSON.stringify(copy));
  assert.deepEqual(copy.attempts.at(-1).original, { kind: "link", target: shippedLink });
  assert.equal(fs.realpathSync(appPkgDir), fs.realpathSync(rootPkgDir));
});

test("replace-dependency swaps a pnpm store copy for every consumer, and the remove-deps gate passes", () => {
  const { appDir, appPkgDir, storePkgDir, consumerPkgDir, rootPkgDir, shippedLink, replace, readLog, gate, entry } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const copy = entry();
  assert.equal(copy.status, "resolved", JSON.stringify(copy));
  assert.equal(copy.attempts.at(-1).original.kind, "dir");
  const pass = copy.attempts.at(-1);
  assert.deepEqual(Object.keys(readLog().copies), [path.relative(appDir, storePkgDir)], "the log keys the swap by the store copy's location");
  assert.match(result.stdout, /- locations of requested packages loading something other than a replacement: 0/);
  assert.equal(fs.readlinkSync(appPkgDir), shippedLink, "the app's own pnpm link is left as it shipped");
  assert.ok(fs.lstatSync(storePkgDir).isSymbolicLink());
  for (const consumer of [appPkgDir, consumerPkgDir]) assert.equal(fs.realpathSync(consumer), fs.realpathSync(rootPkgDir));
  assert.equal(gate().status, 0);

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /\[demo-pkg node_modules\/\.pnpm\/demo-pkg@1\.2\.3\/node_modules\/demo-pkg\] already resolved with 1\.2\.3; skipped/);
});

test("replace-dependency puts a pnpm store copy back for every consumer when its trial fails", () => {
  const { appPkgDir, storePkgDir, consumerPkgDir, replace, readLog, entry } = swapProject(FAILING_INDEX, { layout: "pnpm" });

  const result = replace();
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.equal(entry().attempts.at(-1).reason, "verification-failed");
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
    const entry = project.entry();
    assert.equal(entry.status, "resolved", JSON.stringify(entry));
    assert.equal(fs.realpathSync(project.consumerPkgDir), fs.realpathSync(project.rootPkgDir));
  }
});

test("replace-dependency swaps a scoped package's pnpm store copy, and puts it back when its trial fails", () => {
  for (const [rootIndexJs, status] of [[VERIFYING_INDEX, "resolved"], [FAILING_INDEX, "unresolved"]]) {
    const { appDir, storePkgDir, consumerPkgDir, rootPkgDir, replace, readLog, entry } = swapProject(rootIndexJs, { layout: "pnpm", name: "@scope/demo-pkg" });
    const result = replace();
    assert.equal(result.status, status === "resolved" ? 0 : 3, result.stderr || result.stdout);
    assert.equal(entry().status, status);
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
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.match(result.stdout, /\[@scope\/demo-pkg node_modules\/@scope\/demo-pkg\] not trialed: outside-app:node_modules\/@scope\/demo-pkg/);
  const attempt = project.entry().attempts.at(-1);
  assert.equal(attempt.attemptedVersion, null);
  assert.equal(attempt.reason, "outside-app:node_modules/@scope/demo-pkg");
  assert.deepEqual(project.npmCalls(), [], "npm installs nothing for a package it can't trial");
  assert.deepEqual(treeSnapshot(sharedScope), before);
});

test("replace-dependency refuses a resolved swap whose scope now links out of the app", () => {
  const project = swapProject(VERIFYING_INDEX, { name: "@scope/demo-pkg" });
  assert.equal(project.replace().status, 0);
  assert.equal(project.entry().status, "resolved");
  const sharedScope = linkScopeOut(project);
  const before = treeSnapshot(sharedScope);
  const backups = treeSnapshot(path.join(project.appDir, "node_modules", ".original"));

  const result = project.replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /\[@scope\/demo-pkg node_modules\/@scope\/demo-pkg\] the log records the resolved swap at \S+, but that copy can't be swapped \(outside-app:node_modules\/@scope\/demo-pkg\)/);
  assert.deepEqual(treeSnapshot(sharedScope), before);
  assert.deepEqual(treeSnapshot(path.join(project.appDir, "node_modules", ".original")), backups);
});

test("replace-dependency records a package whose links loop as not trialed, naming the loop, and goes on", () => {
  const { appPkgDir, replace, readLog, npmCalls, entry } = swapProject(VERIFYING_INDEX);
  fs.rmSync(appPkgDir, { recursive: true });
  fs.symlinkSync("demo-pkg", appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 3, result.stderr || result.stdout);
  const reason = "loop:node_modules/demo-pkg -> node_modules/demo-pkg";
  assert.match(result.stdout, /\[demo-pkg node_modules\/demo-pkg\] not trialed: loop:node_modules\/demo-pkg -> node_modules\/demo-pkg/);
  assert.deepEqual(entry().attempts.map((attempt) => [attempt.attemptedVersion, attempt.reason]), [[null, reason]]);
  assert.deepEqual(npmCalls(), [], "npm installs nothing for a package it can't trial");
});

test("replace-dependency refuses a resolved swap whose app path now loops", () => {
  const { appPkgDir, replace, readLog, entry } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);
  fs.rmSync(appPkgDir);
  fs.symlinkSync("demo-pkg", appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /\[demo-pkg node_modules\/demo-pkg\] resolved with 1\.2\.3 in the log, but \S+ is not linked to its replacement \(loop:node_modules\/demo-pkg -> node_modules\/demo-pkg\)/);
  assert.equal(entry().status, "resolved");
});

test("replace-dependency reads each copy as its trial starts: a copy its container's swap took out of the app is named, not trialed", () => {
  const { tmp, appDir, appPkgDir, logPath, readLog, fakeNpm, npmCalls } = swapProject(VERIFYING_INDEX);
  // inner's app path links into demo-pkg's own node_modules, so swapping demo-pkg first takes inner's copy with it.
  writeJson(path.join(appPkgDir, "node_modules", "inner", "package.json"), { name: "inner", version: "1.0.0" });
  linkTo(path.join(appPkgDir, "node_modules", "inner"), path.join(appDir, "node_modules", "inner"));
  const candidateSource = path.join(tmp, "deps", "both.json");
  writeJson(candidateSource, {
    packages: ["demo-pkg@1.2.3", "inner@1.0.0"].map((spec) => {
      const [name, version] = spec.split("@");
      return { name, onDiskVersion: version, observedVersion: version, recommendation: "exact", candidates: [{ version, score: 100, reasons: ["exact"], risk: "low" }] };
    }),
  });

  const result = runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    ["--auto-near-match", "--candidate-source", candidateSource, "--app-dir", appDir, "--npm", fakeNpm, "--out", logPath, "--verification-dir", path.join(tmp, "deps", "verification"),
      "--verify-script", path.join(TOOLS_DIR, "verify-dependency-swap.mjs"), "--threshold", "0.99"],
    tmp,
  );
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.deepEqual(Object.keys(readLog().copies), ["node_modules/demo-pkg"], "inner's copy left with demo-pkg's original, so it has no entry");
  assert.equal(readLog().copies["node_modules/demo-pkg"].status, "resolved");
  assert.ok(result.stdout.includes("[inner node_modules/demo-pkg/node_modules/inner] replaced with its container"), result.stdout);
  assert.match(result.stdout, /- replaced with their container: 1\n/);
  assert.match(result.stdout, /\[inner\] node_modules\/inner loads nothing \(not-a-package:dangling:/, "the app path that led to it is named, broken");
  assert.equal(npmCalls().length, 1, "only demo-pkg's replacement is installed");
});

test("replace-dependency swaps the copy an alias link leads to, so every path to it loads the replacement", () => {
  const { tmp, appDir, appPkgDir, replace, readLog } = swapProject(VERIFYING_INDEX);
  const storeDir = path.join(appDir, "node_modules", ".pnpm", "demo-pkg@1.2.3", "node_modules", "demo-pkg");
  fs.mkdirSync(path.dirname(storeDir), { recursive: true });
  fs.renameSync(appPkgDir, storeDir);
  linkTo(storeDir, appPkgDir);
  const aliasDir = path.join(appDir, "node_modules", "aliased");
  linkTo(storeDir, aliasDir);

  assert.equal(replace().status, 0);
  const store = "node_modules/.pnpm/demo-pkg@1.2.3/node_modules/demo-pkg";
  assert.deepEqual(Object.keys(readLog().copies), [store], "the alias and the top-level link are paths to one copy");
  const replacement = fs.realpathSync(replacementOf(tmp, "demo-pkg", "1.2.3").dir);
  for (const dir of [storeDir, appPkgDir, aliasDir]) assert.equal(fs.realpathSync(dir), replacement, dir);
});

test("replace-dependency recovers a trial in flight at its own location after the app path moved to another copy, then refuses an ambiguous --version", () => {
  const { appDir, appPkgDir, storePkgDir, location, replace, entry, killMidVerify } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
  killMidVerify();
  const elsewhere = path.join(appDir, "node_modules", ".pnpm", "demo-pkg@1.2.4", "node_modules", "demo-pkg");
  writeJson(path.join(elsewhere, "package.json"), { name: "demo-pkg", version: "1.2.4" });
  fs.unlinkSync(appPkgDir);
  linkTo(elsewhere, appPkgDir);

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stdout.includes(`[demo-pkg ${location}] interrupted trial of 1.2.3: restored the original`), result.stdout);
  assert.ok(fs.lstatSync(storePkgDir).isDirectory(), "the store copy is back at its own location");
  assert.deepEqual(entry().attempts.map((attempt) => attempt.reason), ["interrupted"]);
  assert.ok(result.stderr.includes(`--version 1.2.3 names one version, but demo-pkg's copies are ${location} (1.2.3), ${path.relative(appDir, elsewhere)} (1.2.4) — choose one with --location`), result.stderr);
});

test("replace-dependency refuses a trial in flight whose location now links on to another copy, leaving it as the kill left it", () => {
  const { appDir, storePkgDir, location, replace, entry, killMidVerify } = swapProject(VERIFYING_INDEX, { layout: "pnpm" });
  killMidVerify();
  const elsewhere = path.join(appDir, "node_modules", ".pnpm", "demo-pkg@1.2.4", "node_modules", "demo-pkg");
  writeJson(path.join(elsewhere, "package.json"), { name: "demo-pkg", version: "1.2.4" });
  fs.unlinkSync(storePkgDir);
  linkTo(elsewhere, storePkgDir);

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  // An interrupted trial is judged by what sits at its own location: a link this tool did not put there.
  assert.ok(result.stderr.includes(`[demo-pkg ${location}] an interrupted trial of 1.2.3 left the original at `), result.stderr);
  assert.ok(result.stderr.includes(`but ${storePkgDir} holds a link to ${path.relative(path.dirname(storePkgDir), elsewhere)} this tool did not put there`), result.stderr);
  assert.equal(fs.readlinkSync(storePkgDir), path.relative(path.dirname(storePkgDir), elsewhere), "the location is left as it was found");
  assert.equal(entry().status, "in-flight");
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
    ["resolved-success-count", (log, location) => { log.copies[location].attempts = []; }],
    ["in-flight-record-on-settled", (log, location) => { log.copies[location].inFlight = { attemptedVersion: "1.2.3" }; }],
    ["schema-version", (log) => { log.schemaVersion = 99; }],
    ["attempt-invalid", (log, location) => { log.copies[location].attempts[0].rolledBack = true; }],
    ["copy-name-invalid", (log, location) => { delete log.copies[location].name; }],
    ["location-invalid", (log, location) => { log.copies["../escape"] = log.copies[location]; delete log.copies[location]; }],
    // A path inside a package's own files is no location a copy can be at.
    ["location-invalid", (log, location) => { log.copies["node_modules/demo-pkg/lib"] = log.copies[location]; delete log.copies[location]; }],
    ["attempts-missing", (log, location) => { Object.assign(log.copies[location], { status: "unresolved", chosenVersion: null, attempts: [] }); }],
    ["copy-name-invalid", (log, location) => { log.copies[location].version = null; }],
  ];
  for (const [type, corrupt] of cases) {
    const { logPath, location, replace, readLog, gate } = swapProject(VERIFYING_INDEX);
    assert.equal(replace().status, 0);
    const log = readLog();
    corrupt(log, location);
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
  const { tmp, replace, readLog, entry } = swapProject(VERIFYING_INDEX, { layout: "linked" });
  fs.rmSync(path.join(tmp, "node_modules"), { recursive: true });

  // The fake npm installs nothing, so the trial fails after install instead of crashing before it.
  const result = replace();
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.equal(entry().attempts.at(-1).reason, "installed-package-mismatch:absent");
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
  const { appPkgDir, location, logPath, replace, readLog, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  fs.unlinkSync(appPkgDir);
  fs.renameSync(backupOf(inFlight), appPkgDir);
  // A hand edit points the backup at the log's own directory: its root would be deps/ itself.
  const log = readLog();
  log.copies[location].inFlight.original.backupPath = "x";
  writeJson(logPath, log);

  const result = replace();
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /is not under \S+\.original; refusing to delete it/);
  assert.ok(fs.existsSync(logPath), "the log's directory survives");
});

test("replace-dependency settles an interrupted trial of a package it was not asked about, without trialing it", () => {
  const { tmp, appPkgDir, logPath, replace, readLog, killMidVerify, entry } = swapProject(VERIFYING_INDEX);
  killMidVerify();

  // A second package, requested on its own, with no copy: the run settles the interrupted trial, names the package,
  // and asks for nothing, since nothing in the app loads it.
  const result = runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    ["--pkg", "other-pkg", "--app-dir", path.join(tmp, "resources", "app"), "--out", logPath],
    tmp,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /- requested packages with no copy in the directories it could list: 1\n {2}other-pkg\n/);
  assert.match(result.stdout, /\[demo-pkg node_modules\/demo-pkg\] interrupted trial of 1\.2\.3: restored the original/);
  const copy = entry();
  assert.equal(copy.status, "unresolved", JSON.stringify(copy));
  assert.deepEqual(copy.attempts.map((attempt) => attempt.reason), ["interrupted"]);
  assert.ok(!fs.lstatSync(appPkgDir).isSymbolicLink(), "the original is back at the app path");
  assert.deepEqual(fs.readdirSync(path.join(path.dirname(appPkgDir), ".original")), []);
});

test("replace-dependency removes a backup root that collected stray files once the original is back", () => {
  const { appPkgDir, replace, readLog, killMidVerify, backupOf, entry } = swapProject(VERIFYING_INDEX);
  const inFlight = killMidVerify();
  writeText(path.join(path.dirname(backupOf(inFlight)), ".DS_Store"), "");

  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(entry().status, "resolved");
  // Only the passing trial's backup remains.
  const roots = fs.readdirSync(path.join(path.dirname(appPkgDir), ".original"));
  assert.equal(roots.length, 1, JSON.stringify(roots));
  assert.ok(!roots.includes(path.basename(path.dirname(backupOf(inFlight)))));
});

test("replace-dependency and the gate refuse a log an older version wrote, naming the way out", () => {
  const { logPath, replace, readLog, gate } = swapProject(VERIFYING_INDEX);
  assert.equal(replace().status, 0);
  writeJson(logPath, { ...readLog(), schemaVersion: 3 });

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /"type":"schema-version".*put each swapped copy's original back over its link/);
  assert.equal(gate().status, 1);
});

test("replace-dependency records a location an app whose node_modules is a symlink can read back, and recovers it", () => {
  const { tmp, appDir, appPkgDir, rootPkgDir, replace, readLog, killMidVerify, entry } = swapProject(VERIFYING_INDEX);
  const sharedDir = path.join(tmp, "shared-node-modules");
  fs.renameSync(path.join(appDir, "node_modules"), sharedDir);
  fs.symlinkSync(sharedDir, path.join(appDir, "node_modules"), "dir");

  killMidVerify();
  assert.deepEqual(Object.keys(readLog().copies), ["node_modules/demo-pkg"]);
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(entry().status, "resolved");
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
  const { appPkgDir, replace, readLog, killMidVerify, backupOf, entry } = swapProject(VERIFYING_INDEX);
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
  assert.equal(entry().status, "in-flight", "the record stays until the leftover is gone");

  fs.chmodSync(stuckDir, 0o755);
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /interrupted trial of 1\.2\.3: the original was still in place/);
});

test("replace-dependency recognises a link to a replacement however its target is spelled", () => {
  const { appPkgDir, rootPkgDir, replace } = swapProject(VERIFYING_INDEX);
  fs.rmSync(appPkgDir, { recursive: true });
  // os.tmpdir() sits under a symlinked prefix on macOS (/var -> /private/var); the target keeps the unresolved one.
  fs.symlinkSync(rootPkgDir, appPkgDir, "dir");

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /already links to a replacement/);
});

test("replace-dependency refuses a second run over an app tree another run is swapping, however it names the tree", async (t) => {
  const { tmp, appPkgDir, fakeNpm, readLog, startHeld, entry } = swapProject(VERIFYING_INDEX);
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
  assert.equal(entry().status, "in-flight", "the holder's trial is untouched");

  const first = await held.release();
  assert.equal(first.status, 0, first.output);
  assert.equal(entry().status, "resolved");
});

test("replace-dependency refuses a second run from the same project over another app tree, naming the project's node_modules", async (t) => {
  const { tmp, rootPkgDir, fakeNpm, readLog, startHeld, entry } = swapProject(VERIFYING_INDEX);
  writeJson(path.join(tmp, "app2", "node_modules", "demo-pkg", "package.json"), { name: "demo-pkg", version: "1.2.3" });
  const held = await startHeld(t);

  const second = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", "app2", "--npm", fakeNpm, "--verification-dir", "deps/app2-verification", "--out", path.join(tmp, "deps", "app2.json")], tmp);
  assert.equal(second.status, 2, second.stdout);
  assert.ok(second.stderr.includes(path.join(fs.realpathSync(tmp), "node_modules", ".replace-dependency.lock")), second.stderr);
  assert.ok(!fs.existsSync(path.join(tmp, "deps", "app2.json")), "the refused run writes no log");
  assert.ok(fs.existsSync(path.join(rootPkgDir, "package.json")), "the replacement is untouched");

  const first = await held.release();
  assert.equal(first.status, 0, first.output);
  assert.equal(entry().status, "resolved");
});

test("replace-dependency refuses a second run writing the verification dir another run is writing, naming it", async (t) => {
  const { tmp, fakeNpm, readLog, startHeld, entry } = swapProject(VERIFYING_INDEX);
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
  assert.equal(entry().status, "resolved");
});

test("replace-dependency is not refused by the locks of a run that was killed", () => {
  const { replace, readLog, killMidVerify, entry } = swapProject(VERIFYING_INDEX);
  killMidVerify();
  const rerun = replace();
  assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  assert.equal(entry().status, "resolved");
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
// replace-dependency --auto-near-match with no --pkg over what they found, which exits with `status`.
function detectAndReplace(project, { code, registry, status }) {
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
  assert.equal(result.status, status, result.stderr || result.stdout);
  return { report, result, log: project.readLog() };
}

// An app whose node_modules top level holds one entry in every state an entry can be in, beside the dot entries
// tooling writes. Two directories are chmod 000 (nothing can be read through them) and two chmod 311 (node loads
// through them, but nothing can list them); all four are made readable again when the test ends.
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
  linkTo(path.join(nm, ".pnpm", "real-pkg@5.0.0", "node_modules", "real-pkg"), path.join(nm, "real-pkg"));
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
  writeJson(path.join(nm, "badname", "package.json"), { name: "../../evil", version: "1.0.0" });
  fs.mkdirSync(path.join(nm, ".bin"));
  writeText(path.join(nm, ".package-lock.json"), "{}");
  const locked = [pkg(path.join(nm, "locked"), "locked", "8.0.0"), path.dirname(pkg(path.join(nm, "@locked-scope", "x"), "@locked-scope/x", "9.0.0"))];
  const searchOnly = [pkg(path.join(nm, "searchable"), "searchable", "10.0.0"), path.dirname(pkg(path.join(nm, "@search-scope", "x"), "@search-scope/x", "11.0.0"))];
  // A scope linked into a directory nothing can read through: its packages, if any, can't be named.
  fs.symlinkSync(path.join("locked", "scope"), path.join(nm, "@hidden"), "dir");
  for (const dir of locked) fs.chmodSync(dir, 0o000);
  for (const dir of searchOnly) fs.chmodSync(dir, 0o311);
  t.after(() => { for (const dir of [...locked, ...searchOnly]) fs.chmodSync(dir, 0o755); });
  return { tmp, appDir };
}

// chmod bits bind every user but root, so the every-state fixture's unreadable entries exist only for a non-root run.
const EVERY_STATE_SKIP = process.getuid?.() === 0 ? "chmod 000 and 311 don't restrict root, so the fixture's unreadable entries would read fine" : false;

const invalidJsonMessage = (text) => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error.message;
  }
  throw new Error(`${text} parses`);
};

const pnpmPaths = (store, name) => [`node_modules/.pnpm/${store}/node_modules/${name}`, `node_modules/${name}`];
const EVERY_STATE_ON_DISK = {
  nodeModules: { kind: "incomplete", reason: "couldn't list node_modules/@hidden (EACCES), node_modules/@locked-scope (EACCES), node_modules/@search-scope (EACCES), node_modules/locked/node_modules (EACCES), so the packages inside aren't detected" },
  packages: [
    { name: "@back/back", version: "7.0.0", location: "node_modules/.pnpm/@back+back@7.0.0/node_modules/@back/back", paths: pnpmPaths("@back+back@7.0.0", "@back/back") },
    { name: "@scope/pnpm-scoped", version: "3.0.0", location: "node_modules/.pnpm/@scope+pnpm-scoped@3.0.0/node_modules/@scope/pnpm-scoped", paths: pnpmPaths("@scope+pnpm-scoped@3.0.0", "@scope/pnpm-scoped") },
    { name: "linked", version: "4.0.0", location: "node_modules/linked", paths: ["node_modules/linked"] },
    { name: "plain", version: "1.0.0", location: "node_modules/plain", paths: ["node_modules/plain"] },
    { name: "pnpm-pkg", version: "2.0.0", location: "node_modules/.pnpm/pnpm-pkg@2.0.0/node_modules/pnpm-pkg", paths: pnpmPaths("pnpm-pkg@2.0.0", "pnpm-pkg") },
    // An npm alias's link is one more path to the copy it leads to.
    { name: "real-pkg", version: "5.0.0", location: "node_modules/.pnpm/real-pkg@5.0.0/node_modules/real-pkg", paths: [...pnpmPaths("real-pkg@5.0.0", "real-pkg"), "node_modules/aliased"].sort() },
    { name: "searchable", version: "10.0.0", location: "node_modules/searchable", paths: ["node_modules/searchable"] },
  ],
  untrialable: [
    ["@ws/inner", "outside-app:node_modules/@ws/inner", { name: "@ws/inner", version: "6.0.0" }],
    ["afile", "not-a-package:file", null],
    ["badjson", `not-a-package:unusable-manifest:invalid-json:${invalidJsonMessage("{")}`, null],
    ["badname", "not-a-package:unusable-manifest:invalid-name", null],
    // A link leads to the location it names, here one that is absent.
    ["dangling", "not-a-package:absent", null, "node_modules/gone"],
    ["locked", "not-a-package:unusable-manifest:unreadable:EACCES", null],
    ["looped", "loop:node_modules/looped -> node_modules/looped", null],
    ["nomanifest", "not-a-package:no-manifest", null],
    ["noversion", "not-a-package:unusable-manifest:no-name-or-version", null],
  ].map(([name, reason, loads, location = `node_modules/${name}`]) => ({ name, location, reason, loads, paths: [`node_modules/${name}`] })),
  unlisted: [
    { path: "node_modules/@hidden", code: "EACCES" },
    { path: "node_modules/@locked-scope", code: "EACCES" },
    { path: "node_modules/@search-scope", code: "EACCES" },
    { path: "node_modules/locked/node_modules", code: "EACCES" },
  ],
};

test("detect-dependencies reports every top-level entry: linked packages with their on-disk version, the rest with why", { skip: EVERY_STATE_SKIP }, (t) => {
  const { tmp, appDir } = everyStateApp(t);
  const { result, report } = detect(tmp, appDir);

  assert.deepEqual(report.onDisk, EVERY_STATE_ON_DISK);
  const treeWarning = `node_modules can't be fully read: ${EVERY_STATE_ON_DISK.nodeModules.reason}`;
  assert.deepEqual(report.warnings.filter((warning) => warning === treeWarning), [treeWarning]);
  assert.equal(report.warnings.length, EVERY_STATE_ON_DISK.untrialable.length + 1, JSON.stringify(report.warnings));
  for (const { location } of EVERY_STATE_ON_DISK.untrialable) {
    assert.equal(report.warnings.filter((warning) => warning.startsWith(`${location}: `)).length, 1, location);
    assert.ok(result.stdout.includes(`  ${location}: `), `the console prints ${location}'s warning`);
  }
  // aliased and real-pkg reach one store copy: it is one package on disk, real-pkg, not two.
  assert.equal(report.summary.externalCopiesOnDisk, 8);
  const unreadPackages = report.parseErrors.filter(({ file }) => file.endsWith("node_modules/searchable"));
  assert.equal(unreadPackages.length, 1, `a loaded package whose files can't be listed is a parse error: ${JSON.stringify(report.parseErrors)}`);
  assert.match(unreadPackages[0].error, /EACCES/);
});

test("replace-dependency --pkg trials exactly the packages detect-dependencies reports trialable, and records each other with its reason", { skip: EVERY_STATE_SKIP }, (t) => {
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
  // Read at the location detect-dependencies reports, so the two tools must agree on where each copy is.
  const lastAttempt = (location) => JSON.parse(fs.readFileSync(logPath, "utf8")).copies[location].attempts.at(-1);

  // The tree holds directories nothing can list, so every run ends with exit 3, its tree unread in full.
  for (const { name, location } of report.onDisk.packages) {
    assert.equal(replace(name).status, 3);
    assert.deepEqual([lastAttempt(location).attemptedVersion, lastAttempt(location).reason], ["9.9.9", "npm-install-failed:npm error 404 Not Found"], name);
  }
  for (const { name, location, reason } of report.onDisk.untrialable) {
    const result = replace(name);
    assert.equal(result.status, 3, result.stderr || result.stdout);
    assert.deepEqual([lastAttempt(location).attemptedVersion, lastAttempt(location).reason], [null, reason], name);
  }
  assert.deepEqual(npmCallsIn(tmp), report.onDisk.packages.map(({ name }) => `install --loglevel=error --no-progress --save-exact ${replacementOf(tmp, name, "9.9.9").spec}`));
  assert.deepEqual(outside.map(treeSnapshot), before, "nothing past a link out of the app changes");

  // A scope detection can't list still has names replace-dependency can be asked for: under a scope nothing can read
  // through, the name is recorded as not trialed; under one node loads through, it is trialed.
  assert.equal(replace("@locked-scope/x").status, 3);
  const locked = lastAttempt("node_modules/@locked-scope/x");
  assert.deepEqual([locked.attemptedVersion, locked.reason], [null, "not-a-package:unreadable:EACCES"]);
  assert.equal(replace("@search-scope/x").status, 3);
  const searched = lastAttempt("node_modules/@search-scope/x");
  assert.deepEqual([searched.attemptedVersion, searched.reason], ["9.9.9", "npm-install-failed:npm error 404 Not Found"]);

  const summary = replace("plain").stdout;
  assert.match(summary, /not counting any inside the 4 directories it couldn't list\n/);
  for (const { path: dir } of EVERY_STATE_ON_DISK.unlisted) {
    assert.ok(summary.includes(`  ${path.join(appDir, dir)} (EACCES)`), `the run names ${dir}, which it couldn't list`);
  }
});

test("replace-dependency --auto-near-match trials a pnpm app's linked scoped package detect-dependencies found, with no --pkg", () => {
  const project = swapProject(VERIFYING_INDEX, { layout: "pnpm", name: "@scope/demo-pkg" });
  const { report, log } = detectAndReplace(project, { registry: { "@scope/demo-pkg": ["1.2.3"] }, status: 0 });

  assert.deepEqual(report.onDisk.packages.map(({ name, version }) => [name, version]), [["@scope/demo-pkg", "1.2.3"]]);
  assert.equal(log.copies[project.location].status, "resolved", JSON.stringify(log));
  assert.equal(fs.realpathSync(project.consumerPkgDir), fs.realpathSync(project.rootPkgDir));
});

test("replace-dependency --auto-near-match trials a package linked from outside node_modules, leaving what it links to alone", () => {
  const project = swapProject(VERIFYING_INDEX, { layout: "linked" });
  const vendor = path.join(project.tmp, "vendor");
  const before = treeSnapshot(vendor);
  const { report, log } = detectAndReplace(project, { registry: { "demo-pkg": ["1.2.3"] }, status: 0 });

  assert.deepEqual(report.onDisk.packages.map(({ name, version }) => [name, version]), [["demo-pkg", "1.2.3"]]);
  assert.equal(log.copies[project.location].status, "resolved", JSON.stringify(log));
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
    // The workspace copy can't be swapped, so the run ends with it still loaded.
    status: 3,
  });
  const reason = "outside-app:node_modules/@ws/linked";
  assert.deepEqual(report.onDisk.untrialable, [{ name: "@ws/linked", location: "node_modules/@ws/linked", reason, loads: { name: "@ws/linked", version: "1.0.0" }, paths: ["node_modules/@ws/linked"] }]);
  assert.equal(log.copies[project.location].status, "resolved", JSON.stringify(log));
  assert.deepEqual(log.copies["node_modules/@ws/linked"].attempts.map((attempt) => [attempt.attemptedVersion, attempt.reason]), [[null, reason]]);
  assert.deepEqual(project.npmCalls(), [`install --loglevel=error --no-progress --save-exact ${replacementOf(project.tmp, "demo-pkg", "1.2.3").spec}`]);
  assert.deepEqual(treeSnapshot(workspace), before);
});

test("detect-dependencies states that an app ships no node_modules, without a warning", () => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  fs.mkdirSync(appDir, { recursive: true });
  const { report } = detect(tmp, appDir);
  assert.deepEqual(report.onDisk, { nodeModules: { kind: "absent" }, packages: [], untrialable: [], unlisted: [] });
  assert.deepEqual(report.warnings, []);
});

test("detect-dependencies credits an alias's copy to the package it is", () => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const store = path.join(appDir, "node_modules", ".pnpm", "real-pkg@5.0.0", "node_modules", "real-pkg");
  writeJson(path.join(store, "package.json"), { name: "real-pkg", version: "5.0.0" });
  linkTo(store, path.join(appDir, "node_modules", "aliased"));
  const { report } = detect(tmp, appDir, 'require("real-pkg");\n');
  assert.equal(report.summary.externalCopiesOnDisk, 1);
  assert.equal(report.summary.externalPackagesInCodeMissingOnDisk, 0, "real-pkg ships, under the alias's name");
});

test("a node_modules detect-dependencies can search but not list is an incomplete report, which find-near-match-versions refuses", { skip: EVERY_STATE_SKIP }, (t) => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const nm = path.join(appDir, "node_modules");
  writeJson(path.join(nm, "demo-pkg", "package.json"), { name: "demo-pkg", version: "1.2.3" });
  fs.chmodSync(nm, 0o311);
  t.after(() => fs.chmodSync(nm, 0o755));

  const { report } = detect(tmp, appDir, 'require("demo-pkg");\n');
  const reason = "couldn't list node_modules (EACCES), so the packages inside aren't detected";
  assert.deepEqual(report.onDisk, { nodeModules: { kind: "incomplete", reason }, packages: [], untrialable: [], unlisted: [{ path: "node_modules", code: "EACCES" }] });
  const nearMatch = runNode(
    path.join(TOOLS_DIR, "find-near-match-versions.mjs"),
    ["--deps", path.join(tmp, "deps", "detected-dependencies.json"), "--app-dir", appDir, "--out", path.join(tmp, "deps", "near-matches.json")],
    tmp,
  );
  assert.equal(nearMatch.status, 2, nearMatch.stdout);
  assert.ok(nearMatch.stderr.includes(reason), nearMatch.stderr);
});

// An app shipping every kind of copy of foo, each with what reaches it: foo@1.0.0 and foo@2.0.0 in the pnpm store, each
// a dependency of a store package the app depends on, c1 and c2 (and 1.0.0 at the top-level path too); foo@3.0.0 nested under bar, the npm way; a second foo@1.0.0
// nested under quux; foo@4.0.0 behind a symlinked nested node_modules, reached through baz and baz2; qux, a pnpm
// dependency of foo@1.0.0 never hoisted to the top level; and a foo inside bar's own test fixtures, which node never
// loads. Each name@version in `replacements` is installed at the project root (the fake npm installs nothing), verifying
// unless it is in `failing`.
function multiCopyApp({ replacements = [], failing = [] } = {}) {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const nm = path.join(appDir, "node_modules");
  const pkg = (dir, name, version) => {
    writeJson(path.join(dir, "package.json"), { name, version });
    writeText(path.join(dir, "index.js"), VERIFYING_INDEX);
    return dir;
  };
  const store = (name, version) => pkg(path.join(nm, ".pnpm", `${name}@${version}`, "node_modules", name), name, version);
  const at = (...parts) => path.join(nm, ...parts);

  // A store package the app depends on, with its dependency's link beside it in its store entry.
  const consumer = (name, dependency) => {
    linkTo(store(name, "1.0.0"), at(name));
    linkTo(dependency, at(".pnpm", `${name}@1.0.0`, "node_modules", path.basename(dependency)));
  };
  const foo1 = store("foo", "1.0.0");
  linkTo(foo1, at("foo"));
  consumer("c1", foo1);
  const foo2 = store("foo", "2.0.0");
  consumer("c2", foo2);
  pkg(at("bar"), "bar", "1.0.0");
  const foo3 = pkg(at("bar", "node_modules", "foo"), "foo", "3.0.0");
  pkg(at("bar", "test", "fixtures", "node_modules", "foo"), "foo", "9.9.9");
  pkg(at("quux"), "quux", "1.0.0");
  const quuxFoo = pkg(at("quux", "node_modules", "foo"), "foo", "1.0.0");
  const foo4 = pkg(at(".deps", "baz", "node_modules", "foo"), "foo", "4.0.0");
  for (const name of ["baz", "baz2"]) {
    pkg(at(name), name, "1.0.0");
    linkTo(at(".deps", "baz", "node_modules"), at(name, "node_modules"));
  }
  const qux = store("qux", "1.0.0");
  linkTo(qux, at(".pnpm", "foo@1.0.0", "node_modules", "qux"));

  for (const spec of replacements) {
    const [name, version] = spec.split("@");
    const dir = replacementOf(tmp, name, version).dir;
    writeJson(path.join(dir, "package.json"), { name, version });
    writeText(path.join(dir, "index.js"), failing.includes(spec) ? FAILING_INDEX : VERIFYING_INDEX);
  }

  const rel = (dir) => path.relative(appDir, dir);
  const fakeNpm = fakeNpmIn(tmp, 0);
  const logPath = path.join(tmp, "deps", "replacements.json");
  const replace = (args, { verifyScript = path.join(TOOLS_DIR, "verify-dependency-swap.mjs") } = {}) => runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    [...args, "--app-dir", appDir, "--npm", fakeNpm, "--out", logPath, "--verification-dir", path.join(tmp, "deps", "verification"), "--verify-script", verifyScript, "--threshold", "0.99"],
    tmp,
  );
  const project = { tmp, appDir, logPath, replaceAuto: () => replace(["--auto-near-match", "--candidate-source", path.join(tmp, "deps", "near-matches.json")]), readLog: () => JSON.parse(fs.readFileSync(logPath, "utf8")) };
  const copies = {
    foo1: rel(foo1), foo2: rel(foo2), foo3: rel(foo3), quuxFoo: rel(quuxFoo), foo4: rel(foo4), qux: rel(qux),
  };
  return { ...project, nm, at, copies, consumer, replace, npmCalls: () => npmCallsIn(tmp) };
}

const FOO_COPIES = { foo1: "1.0.0", foo2: "2.0.0", foo3: "3.0.0", quuxFoo: "1.0.0", foo4: "4.0.0" };
const ALL_REPLACEMENTS = ["foo@1.0.0", "foo@2.0.0", "foo@3.0.0", "foo@4.0.0", "qux@1.0.0"];
const MULTI_REGISTRY = { foo: ["1.0.0", "2.0.0", "3.0.0", "4.0.0"], qux: ["1.0.0"], bar: ["1.0.0"], baz: ["1.0.0"], baz2: ["1.0.0"], quux: ["1.0.0"], c1: ["1.0.0"], c2: ["1.0.0"] };
const MULTI_CODE = 'require("foo");\nrequire("bar");\nrequire("baz");\nrequire("baz2");\nrequire("quux");\n';

test("the walk finds every copy node can load: store copies with all their consumers, nested copies, one copy behind two symlinked node_modules, and no package's own fixtures", () => {
  const { nm, tmp, copies } = multiCopyApp();
  const app = appAt(nm, tmp);
  const foo = copiesOf(app, walkStarts(app).starts).filter(({ name }) => name === "foo");
  assert.deepEqual(foo.map(({ location, paths }) => [location, paths]), [
    [copies.foo1, ["node_modules/.pnpm/c1@1.0.0/node_modules/foo", copies.foo1, "node_modules/foo"]],
    [copies.foo2, ["node_modules/.pnpm/c2@1.0.0/node_modules/foo", copies.foo2]],
    [copies.foo4, [copies.foo4, "node_modules/baz/node_modules/foo", "node_modules/baz2/node_modules/foo"]],
    [copies.foo3, [copies.foo3]],
    [copies.quuxFoo, [copies.quuxFoo]],
  ].sort(([a], [b]) => (a < b ? -1 : 1)));
  assert.ok(foo.every(({ outcome }) => outcome.kind === "trialable"));
});

test("replace-dependency trials every copy an app ships against its own version in one run, and each consumer loads its own version's replacement", () => {
  const project = multiCopyApp({ replacements: ALL_REPLACEMENTS });
  const { report, result, log } = detectAndReplace(project, { code: MULTI_CODE, registry: MULTI_REGISTRY, status: 3 });

  const reported = report.onDisk.packages.filter(({ name }) => name === "foo" || name === "qux");
  assert.deepEqual(reported.map(({ location, version }) => [location, version]).sort(), [...Object.entries(FOO_COPIES).map(([key, version]) => [project.copies[key], version]), [project.copies.qux, "1.0.0"]].sort());
  assert.ok(!JSON.stringify(report).includes("9.9.9"), "bar's test fixture is no copy");
  assert.ok(!JSON.stringify(report).includes("not-a-package:absent"), "the non-hoisted qux is a copy, not a missing package");

  for (const [key, version] of [...Object.entries(FOO_COPIES), ["qux", "1.0.0"]]) {
    const entry = log.copies[project.copies[key]];
    assert.deepEqual([entry.status, entry.version, entry.chosenVersion], ["resolved", version, version], `${key}: ${JSON.stringify(entry)}`);
  }
  const evidence = (key) => log.copies[project.copies[key]].attempts.at(-1).verification.path;
  assert.notEqual(evidence("foo1"), evidence("quuxFoo"), "two copies of one version keep their own evidence");

  const loads = (...parts) => fs.realpathSync(project.at(...parts));
  const replacement = (name, version) => fs.realpathSync(replacementOf(project.tmp, name, version).dir);
  assert.equal(loads("foo"), replacement("foo", "1.0.0"));
  assert.equal(loads(".pnpm", "c1@1.0.0", "node_modules", "foo"), replacement("foo", "1.0.0"));
  assert.equal(loads(".pnpm", "c2@1.0.0", "node_modules", "foo"), replacement("foo", "2.0.0"));
  assert.equal(loads("bar", "node_modules", "foo"), replacement("foo", "3.0.0"));
  assert.equal(loads("quux", "node_modules", "foo"), replacement("foo", "1.0.0"));
  assert.equal(loads("baz", "node_modules", "foo"), replacement("foo", "4.0.0"));
  assert.equal(loads("baz2", "node_modules", "foo"), replacement("foo", "4.0.0"));
  assert.equal(loads(".pnpm", "foo@1.0.0", "node_modules", "qux"), replacement("qux", "1.0.0"));

  assert.doesNotMatch(result.stdout, /^ {2}\[(foo|qux)\] /m, "no location of foo or qux loads anything but a replacement");
  assert.match(result.stdout, /- replaced with their container: 0\n/);

  for (const dir of ["baseline", "working"]) writeText(path.join(project.tmp, dir, "main.js"), "console.log(1);\n");
  const gateOut = path.join(project.tmp, "gates", "remove-deps.json");
  const gate = runNode(path.join(TOOLS_DIR, "gate.mjs"), ["remove-deps", "--baseline", "baseline", "--working", "working", "--deps-dir", "deps", "--out", gateOut], project.tmp);
  const artifact = JSON.parse(fs.readFileSync(gateOut, "utf8"));
  assert.equal(gate.status, 0, JSON.stringify(artifact.mismatches));
  assert.equal(artifact.metrics.copiesTracked, Object.keys(log.copies).length);
});

test("replace-dependency records a copy that fails on its own: the others stay replaced, and its consumers are named as loading the app's copy", () => {
  const project = multiCopyApp({ replacements: ALL_REPLACEMENTS, failing: ["foo@2.0.0"] });
  const { result, log } = detectAndReplace(project, { code: MULTI_CODE, registry: MULTI_REGISTRY, status: 3 });

  assert.equal(log.copies[project.copies.foo2].status, "unresolved");
  assert.equal(log.copies[project.copies.foo2].attempts.at(-1).reason, "verification-failed");
  assert.ok(fs.lstatSync(project.at(".pnpm", "foo@2.0.0", "node_modules", "foo")).isDirectory(), "the failed copy is back where it was");
  for (const key of ["foo1", "foo3", "quuxFoo", "foo4"]) assert.equal(log.copies[project.copies[key]].status, "resolved", key);
  assert.ok(result.stdout.includes(`  [foo ${project.copies.foo2}] verification-failed`), result.stdout);
  for (const start of ["node_modules/.pnpm/c2@1.0.0/node_modules/foo", project.copies.foo2]) {
    assert.ok(result.stdout.includes(`  [foo] ${start} loads the app's copy at ${project.copies.foo2}`), result.stdout);
  }
  assert.equal(result.stdout.match(/^ {2}\[foo\] /gm).length, 2, "only foo@2.0.0's locations are left");
});

test("replace-dependency names each copy it can't swap with its location and reason, and installs nothing for it", () => {
  const project = multiCopyApp();
  // A consumer's link into a store copy that was pruned: the copy it leads to is the store location, which is absent.
  const pruned = project.at(".pnpm", "foo@0.1.0", "node_modules", "foo");
  project.consumer("pruned", pruned);
  const dangling = project.at(".pnpm", "pruned@1.0.0", "node_modules", "foo");

  const result = project.replace(["--pkg", "foo", "--location", path.relative(project.appDir, dangling)]);
  assert.equal(result.status, 3, result.stderr || result.stdout);
  const log = project.readLog();
  const reasons = Object.fromEntries(Object.entries(log.copies).map(([location, entry]) => [location, [entry.attempts.at(-1).attemptedVersion, entry.attempts.at(-1).reason]]));
  assert.deepEqual(reasons, { [path.relative(project.appDir, pruned)]: [null, "not-a-package:absent"] });
  assert.ok(result.stdout.includes(`  [foo ${path.relative(project.appDir, pruned)}] not-a-package:absent`), result.stdout);
  assert.deepEqual(project.npmCalls(), []);
});

test("replace-dependency counts a copy as the package it holds, and as one of every name that reaches it", () => {
  const project = multiCopyApp({ replacements: ["qux@1.0.0"] });
  // c3 requires foo, and what it finds there is a copy of qux.
  const alias = project.at(".pnpm", "c3@1.0.0", "node_modules", "foo");
  project.consumer("c3", project.at(".pnpm", "qux@1.0.0", "node_modules", "qux"));
  fs.renameSync(project.at(".pnpm", "c3@1.0.0", "node_modules", "qux"), alias);

  const { report } = detect(project.tmp, project.appDir);
  const qux = report.onDisk.packages.find(({ location }) => location === project.copies.qux);
  assert.equal(qux.name, "qux");
  assert.ok(qux.paths.includes(path.relative(project.appDir, alias)), JSON.stringify(qux));

  const asFoo = project.replace(["--pkg", "foo", "--location", path.relative(project.appDir, alias)]);
  assert.equal(asFoo.status, 0, asFoo.stderr || asFoo.stdout);
  const entry = project.readLog().copies[project.copies.qux];
  assert.deepEqual([entry.name, entry.status, entry.chosenVersion], ["qux", "resolved", "1.0.0"]);
});

test("replace-dependency trials a copy nested in another at the location it has as its trial starts", () => {
  const candidates = (project) => {
    writeJson(path.join(project.tmp, "deps", "near-matches.json"), {
      packages: [["bar", "1.0.0"], ["foo", "3.0.0"]].map(([name, version]) => ({ name, onDiskVersion: version, observedVersion: version, candidates: [{ version }] })),
    });
  };
  // bar is trialed first. Replaced, it takes its nested foo out of the app with it; put back, foo is trialed where it is.
  for (const [failing, fooOutcome] of [[[], "retired"], [["bar@1.0.0"], "resolved"]]) {
    const project = multiCopyApp({ replacements: ["bar@1.0.0", "foo@3.0.0"], failing });
    candidates(project);
    const result = project.replaceAuto();
    assert.equal(result.status, 3, result.stderr || result.stdout);
    const log = project.readLog();
    assert.equal(log.copies["node_modules/bar"].status, failing.length ? "unresolved" : "resolved");
    if (fooOutcome === "retired") {
      assert.equal(log.copies[project.copies.foo3], undefined, "a copy that left the app with its container has no entry");
      assert.ok(result.stdout.includes(`[foo ${project.copies.foo3}] replaced with its container`), result.stdout);
    } else {
      assert.equal(log.copies[project.copies.foo3].status, "resolved");
      assert.equal(fs.realpathSync(project.at("bar", "node_modules", "foo")), fs.realpathSync(replacementOf(project.tmp, "foo", "3.0.0").dir));
    }
    const rerun = project.replaceAuto();
    assert.equal(rerun.status, 3, rerun.stderr || rerun.stdout);
  }
});

test("replace-dependency recovers a killed container's trial, then trials the copy nested in it in the same run", () => {
  const project = multiCopyApp({ replacements: ["bar@1.0.0", "foo@3.0.0"], failing: ["bar@1.0.0"] });
  const killingVerify = path.join(project.tmp, "kill-parent.mjs");
  writeText(killingVerify, "process.kill(process.ppid, 'SIGKILL');\n");
  assert.equal(project.replace(["--pkg", "bar"], { verifyScript: killingVerify }).signal, "SIGKILL");
  assert.equal(project.readLog().copies["node_modules/bar"].status, "in-flight");

  writeJson(path.join(project.tmp, "deps", "near-matches.json"), {
    packages: [["bar", "1.0.0"], ["foo", "3.0.0"]].map(([name, version]) => ({ name, onDiskVersion: version, observedVersion: version, candidates: [{ version }] })),
  });
  const rerun = project.replaceAuto();
  assert.equal(rerun.status, 3, rerun.stderr || rerun.stdout);
  assert.match(rerun.stdout, /\[bar node_modules\/bar\] interrupted trial of 1\.0\.0: restored the original/);
  assert.equal(project.readLog().copies[project.copies.foo3].status, "resolved", "the nested copy recovery put back is trialed");
});

test("replace-dependency trials one copy by --location, and refuses a --version over several versions or a location with no copy", () => {
  const project = multiCopyApp({ replacements: ["foo@2.0.0"] });
  const ambiguous = project.replace(["--pkg", "foo", "--version", "1.0.1"]);
  assert.equal(ambiguous.status, 2, ambiguous.stdout);
  assert.match(ambiguous.stderr, /--version 1\.0\.1 names one version, but foo's copies are .*\(2\.0\.0\).* — choose one with --location/);
  assert.deepEqual(project.npmCalls(), []);

  const unknown = project.replace(["--pkg", "foo", "--location", "node_modules/nowhere/node_modules/foo"]);
  assert.equal(unknown.status, 2, unknown.stdout);
  assert.match(unknown.stderr, /--location node_modules\/nowhere\/node_modules\/foo is not where any copy of foo is reached/);

  // A consumer's path names the copy it reaches.
  const one = project.replace(["--pkg", "foo", "--location", "node_modules/.pnpm/c2@1.0.0/node_modules/foo", "--version", "2.0.0"]);
  assert.equal(one.status, 0, one.stderr || one.stdout);
  assert.deepEqual(Object.keys(project.readLog().copies), [project.copies.foo2]);
  assert.equal(project.readLog().copies[project.copies.foo2].status, "resolved");
});

test("replacementOf gives every name@version its own valid npm alias", () => {
  const specs = [["foo", "1.0.0"], ["@scope/foo", "1.0.0"], ["scope_foo", "1.0.0"], ["foo", "1.2.3-RC.1+build.5"], ["foo", "1.2.3-rc.1+build.5"], ["foo-1.0.0", "1.0.0"]];
  const aliases = specs.map(([name, version]) => replacementOf("/project", name, version).alias);
  assert.equal(new Set(aliases).size, aliases.length, aliases.join(" "));
  for (const alias of aliases) assert.match(alias, /^@replace-dependency\/[a-z0-9._-]+$/);
  assert.equal(replacementOf("/project", "@scope/foo", "1.0.0").spec, "@replace-dependency/_40scope_2ffoo__1.0.0@npm:@scope/foo@1.0.0");
  // An "@" in either part is encoded inside that part, never read as the join.
  assert.notEqual(replacementOf("/project", "a", "1.0@x").alias, replacementOf("/project", "a@1.0", "x").alias);
});

test("find-near-match-versions keys each copy by its exact on-disk version, so a prerelease and its release stay apart", () => {
  const tmp = mkTmpDir();
  const depsPath = path.join(tmp, "deps", "detected-dependencies.json");
  writeJson(depsPath, {
    onDisk: {
      nodeModules: { kind: "listed" },
      packages: [["5.0.0", "node_modules/foo"], ["5.0.0-rc.1", "node_modules/bar/node_modules/foo"]].map(([version, location]) => ({ name: "foo", version, location, paths: [location] })),
    },
  });
  writeJson(path.join(tmp, "registry.json"), { foo: ["5.0.0", "5.0.1"] });
  const out = path.join(tmp, "near.json");
  const result = runNode(path.join(TOOLS_DIR, "find-near-match-versions.mjs"), ["--deps", depsPath, "--app-dir", tmp, "--registry-file", path.join(tmp, "registry.json"), "--out", out], tmp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const packages = JSON.parse(fs.readFileSync(out, "utf8")).packages;
  assert.deepEqual(packages.map(({ name, onDiskVersion }) => [name, onDiskVersion]), [["foo", "5.0.0"], ["foo", "5.0.0-rc.1"]]);
  assert.ok(packages.every(({ candidates }) => candidates.length > 0));
});

test("replace-dependency recovers a kill at one copy's location only, then trials both copies of the name", () => {
  const project = multiCopyApp({ replacements: ["foo@1.0.0", "foo@2.0.0"] });
  const killingVerify = path.join(project.tmp, "kill-parent.mjs");
  writeText(killingVerify, "process.kill(process.ppid, 'SIGKILL');\n");
  const killed = project.replace(["--pkg", "foo", "--location", project.copies.foo2, "--version", "2.0.0"], { verifyScript: killingVerify });
  assert.equal(killed.signal, "SIGKILL");
  assert.deepEqual(Object.keys(project.readLog().copies), [project.copies.foo2]);

  writeJson(path.join(project.tmp, "deps", "near-matches.json"), {
    packages: ["1.0.0", "2.0.0"].map((version) => ({ name: "foo", onDiskVersion: version, observedVersion: version, candidates: [{ version }] })),
  });
  const rerun = project.replaceAuto();
  assert.equal(rerun.status, 3, rerun.stderr || rerun.stdout);
  assert.deepEqual(rerun.stdout.match(/interrupted trial of [^:]+/g), ["interrupted trial of 2.0.0"]);
  assert.ok(rerun.stdout.includes(`[foo ${project.copies.foo2}] interrupted trial of 2.0.0: restored the original`), rerun.stdout);
  const log = project.readLog();
  assert.deepEqual(log.copies[project.copies.foo2].attempts.map(({ reason }) => reason), ["interrupted", "verified"]);
  for (const key of ["foo1", "foo2", "foo3", "quuxFoo", "foo4"].filter((key) => ["1.0.0", "2.0.0"].includes(FOO_COPIES[key]))) {
    assert.equal(log.copies[project.copies[key]].status, "resolved", key);
  }
});

test("replace-dependency refuses a flag with no value, an unknown flag, and flags that need --pkg, before it locks anything", () => {
  const { tmp, logPath } = swapProject(VERIFYING_INDEX);
  const run = (args) => runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), [...args, "--out", logPath], tmp);
  for (const [args, message] of [
    [["--pkg", "demo-pkg", "--location"], "--location needs a value"],
    [["--pkg", "demo-pkg", "--verison", "1.2.3"], "unknown argument --verison"],
    [["--auto-near-match", "--version", "1.2.3"], "--location and --version choose among --pkg's copies, so they need --pkg"],
    [["--pkg", "demo-pkg", "--auto-near-match"], "give exactly one of --pkg <name> and --auto-near-match"],
    [["--pkg", "demo-pkg", "--pkg", "other-pkg"], "--pkg is given twice"],
    [["--pkg", ".."], "--pkg .. is not a package name"],
    [["--pkg", "demo-pkg", "--bogus", "--help"], "unknown argument --bogus"],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.ok(result.stderr.includes(`Error: ${message}`), result.stderr);
  }
  assert.ok(!fs.existsSync(logPath), "nothing was read or written");
});

test("replace-dependency refuses a candidate source an older find-near-match-versions wrote, and one that isn't there in auto mode", () => {
  const project = swapProject(VERIFYING_INDEX);
  const source = path.join(project.tmp, "deps", "near-matches.json");
  writeJson(source, { packages: [{ name: "demo-pkg", observedVersion: "1.2.3", candidates: [{ version: "1.2.3" }] }] });
  const stale = project.replaceAuto();
  assert.equal(stale.status, 2, stale.stdout);
  assert.match(stale.stderr, /which is not \{ name, onDiskVersion \(a version or null\), candidates: \[\{ version \}\] \} — rerun find-near-match-versions\.mjs/);

  fs.rmSync(source);
  const absent = project.replaceAuto();
  assert.equal(absent.status, 2, absent.stdout);
  assert.match(absent.stderr, /there is no file there — run find-near-match-versions\.mjs to write it/);
  assert.deepEqual(project.npmCalls(), []);
});

test("replace-dependency stops at an npm it can't run, and at a verifier that gives no verdict, putting the original back", () => {
  const project = swapProject(VERIFYING_INDEX);
  const noNpm = runNode(path.join(TOOLS_DIR, "replace-dependency.mjs"), ["--pkg", "demo-pkg", "--app-dir", project.appDir, "--npm", path.join(project.tmp, "no-such-npm"), "--out", project.logPath], project.tmp);
  assert.equal(noNpm.status, 1, noNpm.stdout);
  assert.match(noNpm.stderr, /could not run .*no-such-npm install/);
  assert.ok(fs.lstatSync(project.appPkgDir).isDirectory(), "nothing moved");

  const silentVerify = path.join(project.tmp, "silent-verify.mjs");
  writeText(silentVerify, "process.exit(0);\n");
  const silent = project.replace("1.2.3", { verifyScript: silentVerify });
  assert.equal(silent.status, 1, silent.stdout);
  assert.match(silent.stderr, /gave no verdict on 1\.2\.3: exit 0 with no verdict: .*verification.* is missing/);
  assert.equal(project.entry().status, "unresolved");
  assert.match(project.entry().attempts.at(-1).reason, /^verifier-error:/);
  assert.ok(fs.lstatSync(project.appPkgDir).isDirectory(), "the original is back");
});

test("replace-dependency lists a copy logged before its container was swapped as replaced with its container, not unresolved", () => {
  const project = multiCopyApp({ replacements: ["bar@1.0.0"] });
  const first = project.replace(["--pkg", "foo", "--location", project.copies.foo3]);
  assert.equal(first.status, 3, first.stdout);
  assert.equal(project.readLog().copies[project.copies.foo3].status, "unresolved");

  const second = project.replace(["--pkg", "bar"]);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, new RegExp(`- replaced with their container: 1\n {2}\\[foo ${project.copies.foo3}\\]\n`));
  assert.doesNotMatch(second.stdout, new RegExp(`- unresolved copies: [^\n]*\n(?: {2}.*\n)* {2}\\[foo ${project.copies.foo3}\\]`));
});

test("detect-dependencies reports a copy already linked to a replacement as one replace-dependency can't trial", () => {
  const project = swapProject(VERIFYING_INDEX);
  assert.equal(project.replace().status, 0);
  const { report } = detect(project.tmp, project.appDir);
  const alias = replacementOf(project.tmp, "demo-pkg", "1.2.3").alias;
  assert.deepEqual(report.onDisk.untrialable.map(({ location, reason }) => [location, reason]), [[project.location, `replacement:${alias}`]]);
  assert.deepEqual(report.onDisk.packages, []);
});

test("the walk finds a pnpm store's copies by node's lookup paths, whatever the store directory is named", () => {
  const tmp = mkTmpDir();
  const nm = path.join(tmp, "app", "node_modules");
  const storeCopy = (name) => {
    const dir = path.join(nm, ".vstore", `${name}@1.0.0`, "node_modules", name);
    writeJson(path.join(dir, "package.json"), { name, version: "1.0.0" });
    return dir;
  };
  linkTo(storeCopy("top"), path.join(nm, "top"));
  linkTo(storeCopy("hidden"), path.join(nm, ".vstore", "top@1.0.0", "node_modules", "hidden"));
  const app = appAt(nm, tmp);
  const walked = walkStarts(app);
  assert.deepEqual(walked.verdict, { kind: "listed" });
  assert.deepEqual(copiesOf(app, walked.starts).map(({ name, location }) => [name, location]), [
    ["hidden", "node_modules/.vstore/hidden@1.0.0/node_modules/hidden"],
    ["top", "node_modules/.vstore/top@1.0.0/node_modules/top"],
  ]);
});

test("find-near-match-versions offers a prerelease copy only published versions, and is exact only against the copy's own", () => {
  const tmp = mkTmpDir();
  const depsPath = path.join(tmp, "deps", "detected-dependencies.json");
  writeJson(depsPath, {
    onDisk: {
      nodeModules: { kind: "listed" },
      packages: [["2.1.0-rc.1", "node_modules/foo"], ["5.0.0-rc.1", "node_modules/bar"]].map(([version, location]) => ({ name: path.basename(location), version, location, paths: [location] })),
    },
  });
  const registry = { foo: ["2.1.0", "2.1.1-rc.1"], bar: ["5.0.0"] };
  writeJson(path.join(tmp, "registry.json"), registry);
  const out = path.join(tmp, "near.json");
  const result = runNode(path.join(TOOLS_DIR, "find-near-match-versions.mjs"), ["--deps", depsPath, "--app-dir", tmp, "--registry-file", path.join(tmp, "registry.json"), "--out", out], tmp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const pkg of JSON.parse(fs.readFileSync(out, "utf8")).packages) {
    const offered = pkg.candidates.map(({ version }) => version);
    assert.deepEqual(offered.filter((version) => version !== pkg.onDiskVersion && !registry[pkg.name].includes(version)), [], `${pkg.name}: ${offered}`);
    assert.equal(pkg.bestCandidate.version, pkg.onDiskVersion, pkg.name);
    assert.equal(pkg.recommendation, "exact", pkg.name);
  }
});

test("replace-dependency reads a container's swap off the tree, so a nested copy whose container's original is back is trialed", () => {
  const project = multiCopyApp({ replacements: ["bar@1.0.0", "foo@3.0.0"] });
  assert.equal(project.replace(["--pkg", "bar"]).status, 0);
  // The container's original put back by hand, as a refusal tells a user to: its log entry still says resolved.
  const bar = project.at("bar");
  fs.rmSync(bar);
  fs.renameSync(fromLogPath(project.logPath, project.readLog().copies["node_modules/bar"].attempts.at(-1).original.backupPath), bar);

  const result = project.replace(["--pkg", "foo", "--location", project.copies.foo3]);
  assert.doesNotMatch(result.stdout, /replaced with its container/);
  assert.match(result.stdout, new RegExp(`\\[foo ${project.copies.foo3}\\] resolved with 3\\.0\\.0`));
  assert.equal(project.readLog().copies[project.copies.foo3].status, "resolved");
});

test("replace-dependency says when the candidate source lists no candidates for a copy's version", () => {
  const project = swapProject(VERIFYING_INDEX);
  writeJson(path.join(project.tmp, "deps", "near-matches.json"), { packages: [{ name: "demo-pkg", onDiskVersion: "1.2.2", candidates: [{ version: "1.2.3" }] }] });
  const result = project.replaceAuto();
  assert.match(result.stdout, /the candidate source lists no candidates for demo-pkg@1\.2\.3, so it is trialed against its own version only/);
});

// The report detect-dependencies writes for an app whose package-lock.json holds lock.
function detectLockfile(lock) {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  fs.mkdirSync(appDir, { recursive: true });
  if (lock !== null) writeText(path.join(appDir, "package-lock.json"), lock);
  return detect(tmp, appDir).report;
}

test("detect-dependencies reports the lockfile's packages under the file it read", () => {
  const report = detectLockfile(JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/foo": { version: "1.0.0" }, "node_modules/foo/node_modules/bar": { version: "2.0.0" } } }));
  assert.equal(report.lockfile.file, path.join(report.appDir, "package-lock.json"));
  assert.deepEqual(report.lockfile.packages, [
    { name: "bar", version: "2.0.0", location: "node_modules/foo/node_modules/bar" },
    { name: "foo", version: "1.0.0", location: "node_modules/foo" },
  ]);
  assert.deepEqual(report.warnings, []);
});

test("detect-dependencies warns of a package-lock.json it can't use or fully read, and still writes its report", () => {
  const cases = [
    { lock: "null", reason: "it is not a JSON object (it holds null)" },
    { lock: JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/foo": {} } }), reason: "node_modules/foo records no version" },
  ];
  for (const { lock, reason } of cases) {
    const report = detectLockfile(lock);
    assert.deepEqual(report.lockfile.verdict, { kind: "incomplete", reason }, reason);
    assert.deepEqual(report.warnings, [`${report.lockfile.file} can't be fully read: ${reason}`], reason);
  }
});

test("detect-dependencies states that an app has no package-lock.json, without a warning", () => {
  const report = detectLockfile(null);
  assert.deepEqual(report.lockfile.verdict, { kind: "absent" });
  assert.deepEqual(report.warnings, []);
});

test("find-near-match-versions offers a released copy only releases, never a prerelease of its major.minor", () => {
  const tmp = mkTmpDir();
  const depsPath = path.join(tmp, "deps", "detected-dependencies.json");
  writeJson(depsPath, { onDisk: { nodeModules: { kind: "listed" }, packages: [{ name: "foo", version: "1.2.3", location: "node_modules/foo", paths: ["node_modules/foo"] }] } });
  writeJson(path.join(tmp, "registry.json"), { foo: ["1.2.3-rc.0", "1.2.3", "1.2.4-beta.0", "1.2.4"] });
  const out = path.join(tmp, "near.json");
  const result = runNode(path.join(TOOLS_DIR, "find-near-match-versions.mjs"), ["--deps", depsPath, "--app-dir", tmp, "--registry-file", path.join(tmp, "registry.json"), "--out", out], tmp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [foo] = JSON.parse(fs.readFileSync(out, "utf8")).packages;
  assert.deepEqual(foo.candidates.map(({ version }) => version), ["1.2.3", "1.2.4"]);
});

test("replace-dependency lists a resolved copy whose replacement is gone as left, the same copy it refuses on the next run", () => {
  const project = multiCopyApp({ replacements: ALL_REPLACEMENTS });
  assert.equal(project.replace(["--pkg", "foo", "--location", project.copies.foo3]).status, 0);
  fs.rmSync(replacementOf(project.tmp, "foo", "3.0.0").dir, { recursive: true });

  // --location asks for quuxFoo alone, so the run exits 0, and still names foo3 as loading no replacement.
  const next = project.replace(["--pkg", "foo", "--location", project.copies.quuxFoo]);
  assert.equal(next.status, 0, next.stdout);
  assert.ok(next.stdout.includes(`  [foo] ${project.copies.foo3} loads `), next.stdout);
  const refused = project.replace(["--pkg", "foo", "--location", project.copies.foo3]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /its replacement .* is now /);
});

test("replace-dependency --pkg with an alias's name trials the copy that name reaches, as the package it holds", () => {
  const { tmp, appDir, appPkgDir, replaceWith, readLog } = swapProject(VERIFYING_INDEX);
  const aliasDir = path.join(appDir, "node_modules", "bar");
  fs.renameSync(appPkgDir, aliasDir);

  const result = replaceWith(["--pkg", "bar"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const entry = readLog().copies["node_modules/bar"];
  assert.deepEqual([entry.name, entry.status, entry.chosenVersion], ["demo-pkg", "resolved", "1.2.3"], JSON.stringify(entry));
  assert.equal(fs.realpathSync(aliasDir), fs.realpathSync(replacementOf(tmp, "demo-pkg", "1.2.3").dir));
});

// Replace whatever is at p with a link leading nowhere, keeping nothing of what was there.
function dangle(p) {
  fs.rmSync(p, { recursive: true, force: true });
  fs.symlinkSync("gone", p);
}

test("replace-dependency and the gate refuse a swap log that is there but can't be read, and the log is left as it was", () => {
  const cases = [
    ["a dangling link", dangle, "is not a file (dangling:gone)", (logPath) => assert.equal(fs.readlinkSync(logPath), "gone")],
    ["a directory", (logPath) => { fs.rmSync(logPath); fs.mkdirSync(logPath); }, "is not a file (dir)", (logPath) => assert.ok(fs.lstatSync(logPath).isDirectory())],
  ];
  for (const [what, makeUnreadable, reason, unchanged] of cases) {
    // A failed trial leaves the original in place and an unresolved entry, so nothing on disk stops a run that
    // mistakes the log for an empty one from trialing again and writing a new log over it.
    const { logPath, replace, npmCalls, gate, entry } = swapProject(FAILING_INDEX);
    replace();
    assert.equal(entry().status, "unresolved");
    const callsBefore = npmCalls().length;
    makeUnreadable(logPath);

    const result = replace();
    assert.equal(result.status, 2, `${what}: ${result.stdout}`);
    assert.ok(result.stderr.includes(`Error: ${logPath} ${reason} — the record of earlier swaps is in it`), `${what}: ${result.stderr}`);
    assert.equal(npmCalls().length, callsBefore, `${what}: nothing is trialed`);
    unchanged(logPath);

    const { status, artifact } = gate();
    assert.equal(status, 1, what);
    assert.equal(artifact.checks.artifactsPresent, false, what);
    assert.deepEqual(artifact.mismatches.replacementLogErrors, [{ type: "unusable-required", inputs: [{ path: logPath, reason }] }], what);
  }
});

test("replace-dependency refuses a candidate source that is there but can't be read, before it trials or writes anything", () => {
  const project = swapProject(VERIFYING_INDEX);
  const source = path.join(project.tmp, "elsewhere", "near-matches.json");
  fs.mkdirSync(path.dirname(source));
  dangle(source);
  const result = project.replaceWith(["--auto-near-match", "--candidate-source", source]);
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`${source} is not a file (dangling:gone)`), result.stderr);
  assert.deepEqual(project.npmCalls(), []);
  assert.equal(fs.existsSync(project.logPath), false);
});

test("replace-dependency refuses a lock it can't open, naming it and why", { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false }, (t) => {
  const project = swapProject(VERIFYING_INDEX);
  const depsDir = path.dirname(project.logPath);
  fs.chmodSync(depsDir, 0o000);
  t.after(() => fs.chmodSync(depsDir, 0o755));
  const result = project.replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /the lock .*replacements\.json\.lock can't be created or opened \(EACCES\)/);
  assert.deepEqual(project.npmCalls(), []);
});

test("replace-dependency refuses an app node_modules that is there but isn't a directory it can read, naming why", () => {
  const { appDir, replace, npmCalls } = swapProject(VERIFYING_INDEX);
  dangle(path.join(appDir, "node_modules"));
  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`${path.join(appDir, "node_modules")} is not a directory (dangling:gone)`), result.stderr);
  assert.deepEqual(npmCalls(), []);
});

test("replace-dependency refuses an interrupted trial whose backup is there but can't be read, not as a lost original", () => {
  const { replace, killMidVerify, backupOf } = swapProject(VERIFYING_INDEX);
  const backup = backupOf(killMidVerify());
  dangle(backup);
  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.ok(result.stderr.includes(`${backup}, which is not a directory (dangling:gone)`), result.stderr);
  assert.doesNotMatch(result.stderr, /the original is lost/);
});

test("the remove-deps gate names a required input or verification artifact that is there but can't be read, apart from one that is missing", () => {
  const project = swapProject(VERIFYING_INDEX);
  assert.equal(project.replace().status, 0);
  const verificationPath = fromLogPath(project.logPath, project.entry().attempts.find((attempt) => attempt.verification?.pass).verification.path);
  const nearMatches = path.join(project.tmp, "deps", "near-matches.json");
  dangle(verificationPath);
  dangle(nearMatches);

  const { status, artifact } = project.gate();
  assert.equal(status, 1);
  assert.equal(artifact.checks.artifactsPresent, false);
  const errors = artifact.mismatches.replacementLogErrors;
  assert.deepEqual(errors.find((error) => error.type === "unusable-required").inputs, [{ path: nearMatches, reason: "is not a file (dangling:gone)" }]);
  assert.equal(errors.find((error) => error.type === "verification-read").error, "is not a file (dangling:gone)");
  assert.equal(errors.some((error) => error.type === "missing-required"), false);
  assert.deepEqual(artifact.mismatches.missingVerificationArtifacts, []);
});

// verify-dependency-swap over before/ and after/ copies of pkg-a@1.2.3 under a new tmp dir, each laid out by its
// function, and the artifact it writes.
function verifyBetween(layBefore, layAfter) {
  const tmp = mkTmpDir();
  const [beforeDir, afterDir] = [path.join(tmp, "before"), path.join(tmp, "after")];
  layBefore(beforeDir);
  layAfter(afterDir);
  const out = path.join(tmp, "verify.json");
  const result = runNode(path.join(TOOLS_DIR, "verify-dependency-swap.mjs"), ["--pkg", "pkg-a", "--before", beforeDir, "--after", afterDir, "--expected-version", "1.2.3", "--threshold", "0.9", "--out", out], tmp);
  return { result, beforeDir, afterDir, artifact: JSON.parse(fs.readFileSync(out, "utf8")) };
}

const pkgA = (manifestText) => (dir) => {
  writeText(path.join(dir, "package.json"), manifestText);
  writeText(path.join(dir, "index.js"), "module.exports=function(a){return a+1};\n");
};
const PKG_A = JSON.stringify({ name: "pkg-a", version: "1.2.3" });

test("verify-dependency-swap reads a package.json that begins with a byte order mark as npm does", () => {
  const { result, artifact } = verifyBetween(pkgA(`﻿${PKG_A}`), pkgA(`﻿${PKG_A}`));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(artifact.pass, true);
});

test("verify-dependency-swap names an input that is there but can't be read, and a missing one as missing", () => {
  const dangling = verifyBetween(pkgA(PKG_A), (dir) => { pkgA(PKG_A)(dir); dangle(path.join(dir, "package.json")); });
  assert.equal(dangling.result.status, 1);
  assert.deepEqual(dangling.artifact.mismatches.package, [`${path.join(dangling.afterDir, "package.json")} is not a file (dangling:gone)`]);

  const nullManifest = verifyBetween(pkgA(PKG_A), pkgA("null"));
  assert.equal(nullManifest.result.status, 1, nullManifest.result.stderr);
  assert.deepEqual(nullManifest.artifact.mismatches.package, [`${path.join(nullManifest.afterDir, "package.json")} is not a JSON object (it holds null)`]);

  const missing = verifyBetween(pkgA(PKG_A), () => {});
  assert.equal(missing.result.status, 1);
  assert.deepEqual(missing.artifact.mismatches.package, [`${missing.afterDir} is missing`]);
});

test("verify-dependency-swap names a reachable after-side file that is there but can't be read, instead of counting it missing", () => {
  const { result, artifact } = verifyBetween(pkgA(PKG_A), (dir) => { pkgA(PKG_A)(dir); dangle(path.join(dir, "index.js")); });
  assert.equal(result.status, 1);
  assert.equal(artifact.pass, false);
  assert.deepEqual(artifact.mismatches.missingFiles, []);
  assert.deepEqual(artifact.mismatches.unreadableFiles, [{ file: "index.js", side: "after", reason: "is not a file (dangling:gone)" }]);
  assert.equal(artifact.checks.reachableFilesRead, false);
  assert.equal(artifact.metrics.fileCoverage, 0, "a file never compared covers nothing");
});

test("verify-dependency-swap counts a reachable file that doesn't parse as uncompared", () => {
  const { result, artifact } = verifyBetween(pkgA(PKG_A), (dir) => { pkgA(PKG_A)(dir); writeText(path.join(dir, "index.js"), "module.exports = (;\n"); });
  assert.equal(result.status, 1);
  assert.equal(artifact.mismatches.parseErrors.length, 1);
  assert.equal(artifact.metrics.fileCoverage, 0);
});

test("verify-dependency-swap refuses a package.json that names no package, as replace-dependency does", () => {
  const { result, afterDir, artifact } = verifyBetween(pkgA(PKG_A), pkgA(JSON.stringify({ name: "pkg-a" })));
  assert.equal(result.status, 1);
  assert.deepEqual(artifact.mismatches.package, [`${path.join(afterDir, "package.json")} unusable-manifest:no-name-or-version`]);
});
