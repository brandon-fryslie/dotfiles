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

  const fakeNpm = path.join(tmp, "fake-npm.sh");
  writeText(fakeNpm, "#!/usr/bin/env bash\nexit 0\n");
  fs.chmodSync(fakeNpm, 0o755);

  // A verify script that SIGKILLs replace-dependency mid-verification: the run dies with its link in place and
  // the log exactly as the tool wrote it ahead of the swap.
  const killingVerify = path.join(tmp, "kill-parent.mjs");
  writeText(killingVerify, "process.kill(process.ppid, 'SIGKILL');\n");

  const replaceArgs = (version, verifyScript) => [
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    "--pkg", name,
    "--version", version,
    "--app-dir", appDir,
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

  return { tmp, appDir, appPkgDir, storePkgDir, consumerPkgDir, rootPkgDir, logPath, shippedLink, fakeNpm, replace, startHeld, readLog, forgetPackage, killMidVerify, backupOf, gate };
}

const VERIFYING_INDEX = "module.exports=function(){return 1};\n";
const FAILING_INDEX = "module.exports=function(){const o={x:2};return o.x};\n";

// Run detect-dependencies over an app whose build is one trivial file: the report it wrote, and where.
function detect(tmp, appDir) {
  writeText(path.join(tmp, "app", "main.js"), "console.log(1);\n");
  const out = path.join(tmp, "deps", "detected-dependencies.json");
  const result = runNode(
    path.join(TOOLS_DIR, "detect-dependencies.mjs"),
    ["--app-dir", appDir, "--build-dir", path.join(tmp, "app"), "--out", out],
    tmp,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { report: JSON.parse(fs.readFileSync(out, "utf8")), out, stdout: result.stdout };
}

function placePackage(dir, manifest) {
  writeJson(path.join(dir, "package.json"), manifest);
  return dir;
}

test("detect-dependencies lists every top-level package, through a link or not, with the version it has on disk", (t) => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "resources", "app");
  const nm = path.join(appDir, "node_modules");
  const at = (...parts) => path.join("node_modules", ...parts);
  placePackage(path.join(nm, "plain-pkg"), { name: "plain-pkg", version: "1.0.0" });
  linkTo(placePackage(path.join(nm, ".pnpm", "pnpm-pkg@2.0.0", "node_modules", "pnpm-pkg"), { name: "pnpm-pkg", version: "2.0.0" }), path.join(nm, "pnpm-pkg"));
  const scopedStore = path.join(nm, ".pnpm", "@scope+scoped-pkg@3.0.0", "node_modules", "@scope", "scoped-pkg");
  linkTo(placePackage(scopedStore, { name: "@scope/scoped-pkg", version: "3.0.0" }), path.join(nm, "@scope", "scoped-pkg"));
  linkTo(placePackage(path.join(tmp, "packages", "workspace-pkg"), { name: "workspace-pkg", version: "4.0.0" }), path.join(nm, "workspace-pkg"));
  // A scope that is itself a link, as a workspace scope can be.
  placePackage(path.join(tmp, "packages", "@linked", "pkg"), { name: "@linked/pkg", version: "5.0.0" });
  linkTo(path.join(tmp, "packages", "@linked"), path.join(nm, "@linked"));

  // Entries that load no package this pipeline can trial, each a different reason.
  linkTo(path.join(tmp, "gone"), path.join(nm, "gone-pkg"));
  linkTo(path.join(tmp, "gone-scoped"), path.join(nm, "@scope", "gone-pkg"));
  linkTo(path.join(nm, "loop-pkg"), path.join(nm, "loop-pkg"));
  const lockedDir = path.join(tmp, "locked");
  placePackage(path.join(lockedDir, "locked-pkg"), { name: "locked-pkg", version: "1.0.0" });
  linkTo(path.join(lockedDir, "locked-pkg"), path.join(nm, "locked-pkg"));
  fs.chmodSync(lockedDir, 0o000);
  t.after(() => fs.chmodSync(lockedDir, 0o755));
  writeText(path.join(nm, "stray-file"), "");
  fs.mkdirSync(path.join(nm, "bare-dir"));
  writeText(path.join(nm, "broken-json", "package.json"), "{bad");
  placePackage(path.join(nm, "versionless"), { name: "versionless" });
  placePackage(path.join(nm, "empty-version"), { name: "empty-version", version: "" });
  const lockedScope = path.join(nm, "@locked-scope");
  placePackage(path.join(lockedScope, "pkg"), { name: "@locked-scope/pkg", version: "1.0.0" });
  fs.chmodSync(lockedScope, 0o000);
  t.after(() => fs.chmodSync(lockedScope, 0o755));
  linkTo(placePackage(path.join(nm, ".pnpm", "real-name@6.0.0", "node_modules", "real-name"), { name: "real-name", version: "6.0.0" }), path.join(nm, "alias-name"));

  const { report, stdout } = detect(tmp, appDir);

  assert.deepEqual(
    report.onDisk.packages.map(({ name, version, path: where }) => ({ name, version, path: where })),
    [
      { name: "@scope/scoped-pkg", version: "3.0.0", path: at("@scope", "scoped-pkg") },
      { name: "plain-pkg", version: "1.0.0", path: at("plain-pkg") },
      { name: "pnpm-pkg", version: "2.0.0", path: at("pnpm-pkg") },
      { name: "workspace-pkg", version: "4.0.0", path: at("workspace-pkg") },
    ],
  );
  const skipped = Object.fromEntries(report.onDisk.skipped.map(({ path: where, ...detail }) => [where, detail]));
  assert.deepEqual(skipped, {
    [at("gone-pkg")]: { kind: "dangling", target: path.relative(nm, path.join(tmp, "gone")) },
    [at("@scope", "gone-pkg")]: { kind: "dangling", target: path.relative(path.join(nm, "@scope"), path.join(tmp, "gone-scoped")) },
    [at("loop-pkg")]: { kind: "unreadable", code: "ELOOP" },
    [at("locked-pkg")]: { kind: "unreadable", code: "EACCES" },
    [at("stray-file")]: { kind: "file" },
    [at("bare-dir")]: { kind: "no-manifest" },
    [at("broken-json")]: { kind: "invalid-manifest", reason: skipped[at("broken-json")].reason },
    [at("versionless")]: { kind: "invalid-manifest", reason: "name and version must be non-empty strings" },
    [at("empty-version")]: { kind: "invalid-manifest", reason: "name and version must be non-empty strings" },
    [at("@locked-scope")]: { kind: "unreadable", code: "EACCES" },
  });
  assert.deepEqual(report.onDisk.untrialable, [
    { name: "@linked/pkg", packageName: "@linked/pkg", version: "5.0.0", path: at("@linked", "pkg"), reason: "outside-app", livesIn: fs.realpathSync(path.join(tmp, "packages", "@linked")) },
    { name: "alias-name", packageName: "real-name", version: "6.0.0", path: at("alias-name"), reason: "alias" },
  ]);
  assert.match(skipped[at("broken-json")].reason, /JSON/);
  assert.equal(report.onDisk.nodeModules, "directory");
  for (const where of [...Object.keys(skipped), at("@linked", "pkg"), at("alias-name")]) {
    assert.ok(report.warnings.some((warning) => warning.startsWith(where)), `${where} is warned: ${JSON.stringify(report.warnings)}`);
    assert.ok(stdout.includes(`  - ${where}`), `${where} is printed: ${stdout}`);
  }
});

test("detect-dependencies tells an app with no node_modules apart from one whose node_modules can't be read", () => {
  const tmp = mkTmpDir();
  const bundled = path.join(tmp, "bundled");
  fs.mkdirSync(bundled, { recursive: true });
  const absent = detect(tmp, bundled).report;
  assert.equal(absent.onDisk.nodeModules, "absent");
  assert.deepEqual(absent.onDisk.skipped, []);
  assert.deepEqual(absent.warnings, []);

  const broken = path.join(tmp, "broken");
  linkTo(path.join(tmp, "gone"), path.join(broken, "node_modules"));
  const dangling = detect(tmp, broken).report;
  assert.equal(dangling.onDisk.nodeModules, "dangling");
  assert.deepEqual(dangling.onDisk.skipped, [{ path: "node_modules", kind: "dangling", target: path.relative(broken, path.join(tmp, "gone")) }]);
  assert.equal(dangling.warnings.length, 1);
});

test("detect-dependencies reports a node_modules it can't list, and still writes its report", (t) => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "locked");
  const nm = path.join(appDir, "node_modules");
  placePackage(path.join(nm, "pkg"), { name: "pkg", version: "1.0.0" });
  fs.chmodSync(nm, 0o000);
  t.after(() => fs.chmodSync(nm, 0o755));
  const { report } = detect(tmp, appDir);
  assert.equal(report.onDisk.nodeModules, "unreadable");
  assert.deepEqual(report.onDisk.skipped, [{ path: "node_modules", kind: "unreadable", code: "EACCES" }]);
});

test("detect-dependencies reads top-level lockfile versions and reports a lockfile it can't parse", () => {
  const tmp = mkTmpDir();
  const appDir = path.join(tmp, "app-dir");
  const lockPath = path.join(appDir, "package-lock.json");
  writeJson(lockPath, {
    packages: {
      "": { name: "app" },
      "node_modules/a": { version: "1.0.0" },
      "node_modules/@scope/b": { version: "2.0.0" },
      "node_modules/a/node_modules/nested": { version: "3.0.0" },
      "node_modules/linked": { link: true, resolved: "packages/linked" },
      "node_modules/versionless": {},
    },
    dependencies: { a: { version: "0.9.0" } },
  });
  const read = detect(tmp, appDir).report;
  assert.deepEqual(read.lockfile.packages, [
    { name: "@scope/b", version: "2.0.0", path: "package-lock.json" },
    { name: "a", version: "1.0.0", path: "package-lock.json" },
  ]);
  assert.deepEqual(read.warnings, ["package-lock.json records node_modules/versionless with no version"]);

  writeJson(lockPath, { lockfileVersion: 1, dependencies: { a: { version: "0.9.0" } } });
  assert.deepEqual(detect(tmp, appDir).report.lockfile.packages, [{ name: "a", version: "0.9.0", path: "package-lock.json" }]);

  for (const [content, warning] of [
    ["{truncated", /^package-lock\.json could not be read/],
    ["null", /^package-lock\.json is not a JSON object/],
    ["[]", /^package-lock\.json is not a JSON object/],
  ]) {
    writeText(lockPath, content);
    const unusable = detect(tmp, appDir).report;
    assert.deepEqual(unusable.lockfile.packages, []);
    assert.equal(unusable.warnings.length, 1);
    assert.match(unusable.warnings[0], warning);
  }

  fs.rmSync(lockPath);
  linkTo(path.join(tmp, "gone.json"), lockPath);
  const dangling = detect(tmp, appDir).report;
  assert.equal(dangling.warnings.length, 1);
  assert.match(dangling.warnings[0], /^package-lock\.json could not be read \(ENOENT/);
});

for (const [layout, name] of [["pnpm", "@scope/demo-pkg"], ["linked", "demo-pkg"]]) {
  test(`replace-dependency --auto-near-match trials a ${layout} package that detection found, with no --pkg`, () => {
    const { tmp, appDir, fakeNpm, logPath, readLog } = swapProject(VERIFYING_INDEX, { layout, name });
    const depsDir = path.join(tmp, "deps");
    const { out: detected } = detect(tmp, appDir);
    const nearMatches = path.join(depsDir, "detected-near-matches.json");
    writeJson(path.join(tmp, "registry.json"), { [name]: ["1.2.3"] });
    const near = runNode(
      path.join(TOOLS_DIR, "find-near-match-versions.mjs"),
      ["--deps", detected, "--app-dir", appDir, "--registry-file", path.join(tmp, "registry.json"), "--out", nearMatches],
      tmp,
    );
    assert.equal(near.status, 0, near.stderr || near.stdout);

    const result = runNode(
      path.join(TOOLS_DIR, "replace-dependency.mjs"),
      [
        "--auto-near-match", "--candidate-source", nearMatches,
        "--app-dir", appDir,
        "--npm", fakeNpm,
        "--verify-script", path.join(TOOLS_DIR, "verify-dependency-swap.mjs"),
        "--verification-dir", path.join(depsDir, "verification"),
        "--out", logPath,
        "--threshold", "0.99",
      ],
      tmp,
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const entry = readLog().packages[name];
    assert.equal(entry.status, "resolved", JSON.stringify(entry));
    assert.equal(entry.attempts.at(-1).attemptedVersion, "1.2.3");
  });
}

test("an app with a scope linked out of it still has its other packages trialed by --auto-near-match, and the linked one is left alone", () => {
  const name = "@scope/demo-pkg";
  const { tmp, appDir, fakeNpm, logPath, readLog } = swapProject(VERIFYING_INDEX, { layout: "pnpm", name });
  const workspacePkg = placePackage(path.join(tmp, "packages", "@ws", "pkg"), { name: "@ws/pkg", version: "1.2.3" });
  writeText(path.join(workspacePkg, "index.js"), VERIFYING_INDEX);
  linkTo(path.join(tmp, "packages", "@ws"), path.join(appDir, "node_modules", "@ws"));
  const depsDir = path.join(tmp, "deps");
  const { report, out: detected } = detect(tmp, appDir);
  assert.deepEqual(report.onDisk.untrialable.map(({ name: untrialable, reason }) => ({ name: untrialable, reason })), [{ name: "@ws/pkg", reason: "outside-app" }]);

  const nearMatches = path.join(depsDir, "detected-near-matches.json");
  writeJson(path.join(tmp, "registry.json"), { [name]: ["1.2.3"], "@ws/pkg": ["1.2.3"] });
  const near = runNode(
    path.join(TOOLS_DIR, "find-near-match-versions.mjs"),
    ["--deps", detected, "--app-dir", appDir, "--registry-file", path.join(tmp, "registry.json"), "--out", nearMatches],
    tmp,
  );
  assert.equal(near.status, 0, near.stderr || near.stdout);
  const result = runNode(
    path.join(TOOLS_DIR, "replace-dependency.mjs"),
    [
      "--auto-near-match", "--candidate-source", nearMatches,
      "--app-dir", appDir,
      "--npm", fakeNpm,
      "--verify-script", path.join(TOOLS_DIR, "verify-dependency-swap.mjs"),
      "--verification-dir", path.join(depsDir, "verification"),
      "--out", logPath,
      "--threshold", "0.99",
    ],
    tmp,
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readLog().packages[name].status, "resolved");
  assert.equal(readLog().packages["@ws/pkg"], undefined, "the linked scope's package is never trialed");
  assert.ok(!fs.lstatSync(workspacePkg).isSymbolicLink(), "the workspace's package stays where it lives");
});

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

// Move the app's @scope directory out of the app and link it back in, the way a workspace's own scope is linked.
function linkScopeOut(tmp, appDir) {
  const sharedScope = path.join(tmp, "shared-scope");
  fs.renameSync(path.join(appDir, "node_modules", "@scope"), sharedScope);
  linkTo(sharedScope, path.join(appDir, "node_modules", "@scope"));
  return sharedScope;
}

test("replace-dependency records a scoped package whose scope directory links out of the app as not trialed, moving nothing", () => {
  const { tmp, appDir, replace, readLog } = swapProject(VERIFYING_INDEX, { name: "@scope/demo-pkg" });
  const sharedScope = linkScopeOut(tmp, appDir);

  const result = replace();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[@scope\/demo-pkg\] not trialed: \S+demo-pkg is reached through a link out of the app's node_modules \(it lives in \S+shared-scope\)/);
  const entry = readLog().packages["@scope/demo-pkg"];
  assert.equal(entry.status, "unresolved", JSON.stringify(entry));
  assert.equal(entry.attempts.at(-1).reason, "swap-location-outside-app");
  assert.ok(!fs.lstatSync(path.join(sharedScope, "demo-pkg")).isSymbolicLink(), "the package stays where it lives");
});

test("replace-dependency refuses a recorded swap whose location now lies past a scope linked out of the app", () => {
  const { tmp, appDir, logPath, replace } = swapProject(VERIFYING_INDEX, { name: "@scope/demo-pkg" });
  assert.equal(replace().status, 0);
  const sharedScope = linkScopeOut(tmp, appDir);
  const linkBefore = fs.readlinkSync(path.join(sharedScope, "demo-pkg"));

  const result = replace();
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /\[@scope\/demo-pkg\] the log records a resolved swap at \S+demo-pkg, but \S+demo-pkg is reached through a link out of the app's node_modules/);
  assert.equal(fs.readlinkSync(path.join(sharedScope, "demo-pkg")), linkBefore, "the refused run changes nothing there");
  assert.ok(fs.existsSync(logPath));
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
