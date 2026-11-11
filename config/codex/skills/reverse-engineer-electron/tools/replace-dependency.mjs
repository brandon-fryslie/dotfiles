#!/usr/bin/env node
/**
 * replace-dependency.mjs
 *
 * Replace dependency copies under <appDir>/node_modules with root node_modules packages,
 * including near-match auto-trials and deterministic verification.
 *
 * Usage (single package):
 *   node replace-dependency.mjs --pkg <name> [--version <x.y.z>] [--app-dir resources/app]
 *
 * Usage (auto near-match over candidate source):
 *   node replace-dependency.mjs --auto-near-match --candidate-source deps/near-matches.json --app-dir resources/app
 *
 * // [LAW:verifiable-goals] Every attempt is logged with result, rollback state, and verification evidence.
 * // [LAW:one-source-of-truth] deps/replacements.json is the canonical transaction log for dependency swaps.
 * // [LAW:dataflow-not-control-flow] Each candidate executes the same install -> link -> verify -> rollback-on-fail pipeline.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

function parseArgs(argv) {
  const opts = {
    appDir: "resources/app",
    pkg: "",
    version: "",
    npm: "npm",
    mode: "symlink",
    candidateSource: "deps/near-matches.json",
    autoNearMatch: false,
    out: "deps/replacements.json",
    verificationDir: "deps/verification",
    verifyScript: "tools/verify-dependency-swap.mjs",
    threshold: 0.8,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app-dir") opts.appDir = argv[++i] || opts.appDir;
    else if (arg === "--pkg") opts.pkg = argv[++i] || "";
    else if (arg === "--version") opts.version = argv[++i] || "";
    else if (arg === "--npm") opts.npm = argv[++i] || opts.npm;
    else if (arg === "--mode") opts.mode = argv[++i] || opts.mode;
    else if (arg === "--candidate-source") opts.candidateSource = argv[++i] || opts.candidateSource;
    else if (arg === "--out") opts.out = argv[++i] || opts.out;
    else if (arg === "--verification-dir") opts.verificationDir = argv[++i] || opts.verificationDir;
    else if (arg === "--verify-script") opts.verifyScript = argv[++i] || opts.verifyScript;
    else if (arg === "--threshold") opts.threshold = Number(argv[++i] || "0.8");
    else if (arg === "--auto-near-match") opts.autoNearMatch = true;
    else if (arg === "-h" || arg === "--help") return { help: true, opts };
  }

  return { help: false, opts };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function isScoped(name) {
  return name.startsWith("@") && name.includes("/");
}

function pkgPathParts(name) {
  return isScoped(name) ? name.split("/") : [name];
}

function safeNowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeIdPart(text) {
  return text
    .split("/")
    .join("__")
    .split("@")
    .join("at_")
    .split(" ")
    .join("_")
    .toLowerCase();
}

function installExact(npmBin, name, version) {
  const spec = `${name}@${version}`;
  const res = spawnSync(npmBin, ["install", "--silent", "--no-progress", "--save-exact", spec], {
    stdio: "inherit",
  });
  return res.status === 0;
}

function runVerifySwap({ verifyScript, pkgName, beforeDir, afterDir, expectedVersion, threshold, verificationOut }) {
  const args = [
    verifyScript,
    "--pkg",
    pkgName,
    "--before",
    beforeDir,
    "--after",
    afterDir,
    "--expected-version",
    expectedVersion,
    "--threshold",
    String(threshold),
    "--out",
    verificationOut,
  ];

  const result = spawnSync("node", args, {
    stdio: "inherit",
  });
  return result.status === 0;
}

function loadCandidateSource(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const parsed = readJson(filePath);
  if (!parsed || !Array.isArray(parsed.packages)) return null;

  const byName = new Map();
  for (const item of parsed.packages) {
    if (!item?.name) continue;
    const candidateVersions = Array.isArray(item.candidates)
      ? item.candidates.map((candidate) => candidate?.version).filter((version) => typeof version === "string")
      : [];

    byName.set(item.name, {
      observedVersion: typeof item.observedVersion === "string" ? item.observedVersion : null,
      candidateVersions,
      recommendation: item.recommendation || null,
    });
  }

  return {
    raw: parsed,
    byName,
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function defaultLog() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packages: {},
    events: [],
  };
}

function loadLog(filePath) {
  if (!fs.existsSync(filePath)) return defaultLog();
  const parsed = readJson(filePath);
  if (!parsed || typeof parsed !== "object") return defaultLog();
  if (!parsed.packages || typeof parsed.packages !== "object") parsed.packages = {};
  if (!Array.isArray(parsed.events)) parsed.events = [];
  if (!parsed.schemaVersion) parsed.schemaVersion = 1;
  if (!parsed.createdAt) parsed.createdAt = new Date().toISOString();
  parsed.updatedAt = new Date().toISOString();
  return parsed;
}

function appendAttempt(logState, pkgName, attempt) {
  if (!logState.packages[pkgName]) {
    logState.packages[pkgName] = {
      status: "unresolved",
      chosenVersion: null,
      attempts: [],
    };
  }

  logState.packages[pkgName].attempts.push(attempt);
  logState.events.push({
    package: pkgName,
    attemptedVersion: attempt.attemptedVersion,
    result: attempt.result,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    rollback: attempt.rolledBack,
  });
}

function readPkgVersion(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const pkg = readJson(packageJsonPath);
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

function determinePackageList(opts, candidateSource) {
  if (opts.pkg) return [opts.pkg];
  if (opts.autoNearMatch && candidateSource?.byName) {
    return Array.from(candidateSource.byName.keys()).sort((a, b) => a.localeCompare(b));
  }
  return [];
}

function determineCandidatesForPackage(opts, pkgName, candidateSource, onDiskVersion) {
  if (opts.version && opts.pkg === pkgName) return [opts.version];

  const fromSource = candidateSource?.byName?.get(pkgName);
  const candidates = [];

  if (fromSource?.observedVersion) candidates.push(fromSource.observedVersion);
  if (onDiskVersion) candidates.push(onDiskVersion);

  for (const candidate of fromSource?.candidateVersions || []) {
    candidates.push(candidate);
  }

  return unique(candidates);
}

// [LAW:one-source-of-truth] A log status of "resolved" records a swap that already happened, so a rerun must
// not trial the package again (gate.mjs requires exactly one pass per resolved package). Disk has to agree
// with that record; when it doesn't, neither side can be trusted to win, so the run refuses and names the way
// out: the gate forbids a pass under "unresolved" too, so a retrial starts by deleting the package's entry. [LAW:no-silent-failure]
function priorSwap(pkgState, appPkgDir, rootPkgDir, requestedVersion, logPath) {
  if (pkgState?.status !== "resolved") return { kind: "untried" };
  const chosen = pkgState.chosenVersion;
  const backup = pkgState.attempts.find((attempt) => attempt.result === "pass")?.backupPath;
  const restore = `to trial it again, replace the app copy with the original at ${backup} and delete the package's entry from ${logPath}`;
  if (requestedVersion && requestedVersion !== chosen) {
    return { kind: "conflict", reason: `already resolved with ${chosen}; --version ${requestedVersion} is a retrial — ${restore}` };
  }
  const linked =
    fs.existsSync(appPkgDir) &&
    fs.lstatSync(appPkgDir).isSymbolicLink() &&
    fs.existsSync(rootPkgDir) &&
    fs.realpathSync(appPkgDir) === fs.realpathSync(rootPkgDir);
  if (!linked) {
    return { kind: "conflict", reason: `resolved with ${chosen} in the log, but the app copy is not linked to the root package (re-extracted app with an old log?) — to trial this app copy, delete the package's entry from ${logPath}` };
  }
  const rootVersion = readPkgVersion(path.join(rootPkgDir, "package.json"));
  if (rootVersion !== chosen) {
    return { kind: "conflict", reason: `resolved with ${chosen}, but the root package is now ${rootVersion} — reinstall ${chosen} at the root, or ${restore}` };
  }
  return { kind: "resolved", version: chosen };
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help || (!opts.pkg && !opts.autoNearMatch)) {
    console.log("Usage:");
    console.log("  node replace-dependency.mjs --pkg <name> [--version <x.y.z>] [--app-dir resources/app]");
    console.log("  node replace-dependency.mjs --auto-near-match --candidate-source deps/near-matches.json [--app-dir resources/app]");
    process.exit(help ? 0 : 2);
  }

  if (opts.mode !== "symlink") {
    console.error(`Error: unsupported mode ${opts.mode} (only 'symlink' supported)`);
    process.exit(2);
  }

  const projectRoot = process.cwd();
  const appDir = path.resolve(projectRoot, opts.appDir);
  const appNodeModules = path.join(appDir, "node_modules");
  const outPath = path.resolve(projectRoot, opts.out);
  const verificationDir = path.resolve(projectRoot, opts.verificationDir);
  const verifyScript = path.resolve(projectRoot, opts.verifyScript);
  const candidateSourcePath = path.resolve(projectRoot, opts.candidateSource);

  const candidateSource = loadCandidateSource(candidateSourcePath);
  const packageList = determinePackageList(opts, candidateSource);
  if (packageList.length === 0) {
    console.error("No package candidates resolved. Provide --pkg or --auto-near-match with candidate source.");
    process.exit(2);
  }

  const logState = loadLog(outPath);
  const appPkgDirOf = (pkgName) => path.join(appNodeModules, ...pkgPathParts(pkgName));
  const rootPkgDirOf = (pkgName) => path.join(projectRoot, "node_modules", ...pkgPathParts(pkgName));

  const priors = packageList.map((pkgName) => ({
    pkgName,
    prior: priorSwap(logState.packages[pkgName], appPkgDirOf(pkgName), rootPkgDirOf(pkgName), opts.pkg === pkgName ? opts.version : "", outPath),
  }));
  const conflicts = priors.filter(({ prior }) => prior.kind === "conflict");
  if (conflicts.length > 0) {
    for (const { pkgName, prior } of conflicts) console.error(`Error: [${pkgName}] ${prior.reason}`);
    process.exit(2);
  }
  const skipped = priors.filter(({ prior }) => prior.kind === "resolved");
  for (const { pkgName, prior } of skipped) console.log(`[${pkgName}] already resolved with ${prior.version}; skipped`);
  const toTry = priors.filter(({ prior }) => prior.kind === "untried").map(({ pkgName }) => pkgName);

  for (const pkgName of toTry) {
    const appPkgDir = appPkgDirOf(pkgName);
    const appPkgJson = path.join(appPkgDir, "package.json");

    const onDiskVersion = readPkgVersion(appPkgJson);
    const candidates = determineCandidatesForPackage(opts, pkgName, candidateSource, onDiskVersion);

    if (!logState.packages[pkgName]) {
      logState.packages[pkgName] = {
        status: "unresolved",
        chosenVersion: null,
        attempts: [],
      };
    }

    if (!fs.existsSync(appPkgJson)) {
      const startedAt = new Date().toISOString();
      const finishedAt = new Date().toISOString();
      appendAttempt(logState, pkgName, {
        attemptedVersion: null,
        startedAt,
        finishedAt,
        result: "fail",
        reason: "on-disk-package-missing",
        swapApplied: false,
        rolledBack: false,
        verification: { path: null, pass: false },
      });
      continue;
    }

    if (candidates.length === 0) {
      const startedAt = new Date().toISOString();
      const finishedAt = new Date().toISOString();
      appendAttempt(logState, pkgName, {
        attemptedVersion: null,
        startedAt,
        finishedAt,
        result: "fail",
        reason: "no-candidates",
        swapApplied: false,
        rolledBack: false,
        verification: { path: null, pass: false },
      });
      continue;
    }

    let resolved = false;

    for (const version of candidates) {
      const startedAt = new Date().toISOString();
      const attempt = {
        attemptedVersion: version,
        startedAt,
        finishedAt: null,
        result: "fail",
        reason: "unknown",
        swapApplied: false,
        rolledBack: false,
        backupPath: null,
        verification: { path: null, pass: false },
      };

      console.log(`\n[${pkgName}] Trying candidate ${version}`);

      if (!installExact(opts.npm, pkgName, version)) {
        attempt.reason = "npm-install-failed";
        attempt.finishedAt = new Date().toISOString();
        appendAttempt(logState, pkgName, attempt);
        continue;
      }

      const rootPkgDir = rootPkgDirOf(pkgName);
      const rootPkgJson = path.join(rootPkgDir, "package.json");
      if (!fs.existsSync(rootPkgJson)) {
        attempt.reason = "root-package-json-missing";
        attempt.finishedAt = new Date().toISOString();
        appendAttempt(logState, pkgName, attempt);
        continue;
      }

      const installed = readJson(rootPkgJson);
      if (installed?.name !== pkgName || installed?.version !== version) {
        attempt.reason = `installed-package-mismatch:${installed?.name || "?"}@${installed?.version || "?"}`;
        attempt.finishedAt = new Date().toISOString();
        appendAttempt(logState, pkgName, attempt);
        continue;
      }

      // [LAW:types-are-the-program] mkdtemp makes each trial's backup root unique by construction; a bare
      // per-second stamp collided when a retrial landed in the same second as an earlier swap.
      ensureDir(path.join(appNodeModules, ".original"));
      const backupRoot = fs.mkdtempSync(path.join(appNodeModules, ".original", `${safeNowStamp()}-`));
      const backupDir = path.join(backupRoot, ...pkgPathParts(pkgName));
      attempt.backupPath = path.relative(projectRoot, backupDir).split(path.sep).join("/");
      let backupCreated = false;

      try {
        ensureDir(path.dirname(backupDir));
        fs.renameSync(appPkgDir, backupDir);
        backupCreated = true;

        ensureDir(path.dirname(appPkgDir));
        // A relative target resolves from the link's real directory, so both ends resolve their parent directories:
        // --app-dir and cwd can name the same tree through different symlinked prefixes (/var vs /private/var on
        // macOS). The root entry itself stays unresolved, so a workspace or npm-link entry keeps its indirection.
        const linkTarget = path.relative(fs.realpathSync(path.dirname(appPkgDir)), path.join(fs.realpathSync(path.dirname(rootPkgDir)), path.basename(rootPkgDir)));
        fs.symlinkSync(linkTarget, appPkgDir, "dir");
        attempt.swapApplied = true;

        const verificationName = `${safeIdPart(pkgName)}@${version}.json`;
        const verificationOutAbs = path.join(verificationDir, verificationName);
        const verificationOutRel = path.relative(projectRoot, verificationOutAbs).split(path.sep).join("/");

        const verificationPass = runVerifySwap({
          verifyScript,
          pkgName,
          beforeDir: backupDir,
          afterDir: appPkgDir,
          expectedVersion: version,
          threshold: opts.threshold,
          verificationOut: verificationOutAbs,
        });

        attempt.verification = {
          path: verificationOutRel,
          pass: verificationPass,
        };

        if (!verificationPass) {
          fs.rmSync(appPkgDir, { force: true, recursive: true });
          fs.renameSync(backupDir, appPkgDir);
          attempt.reason = "verification-failed";
          attempt.rolledBack = true;
          attempt.finishedAt = new Date().toISOString();
          appendAttempt(logState, pkgName, attempt);
          continue;
        }

        attempt.result = "pass";
        attempt.reason = "verified";
        attempt.finishedAt = new Date().toISOString();
        appendAttempt(logState, pkgName, attempt);

        logState.packages[pkgName].status = "resolved";
        logState.packages[pkgName].chosenVersion = version;
        resolved = true;

        console.log(`[${pkgName}] resolved with ${version}`);
        break;
      } catch (error) {
        if (backupCreated) {
          try {
            if (fs.existsSync(appPkgDir)) {
              fs.rmSync(appPkgDir, { force: true, recursive: true });
            }
          } catch {
            // best-effort rollback cleanup
          }
          try {
            if (fs.existsSync(backupDir) && !fs.existsSync(appPkgDir)) {
              fs.renameSync(backupDir, appPkgDir);
            }
            attempt.rolledBack = true;
          } catch {
            // leave rollback false if restore failed
          }
        }

        attempt.reason = `trial-error:${String(error?.message || error)}`;
        attempt.finishedAt = new Date().toISOString();
        appendAttempt(logState, pkgName, attempt);
      }
    }

    if (!resolved) {
      logState.packages[pkgName].status = "unresolved";
      logState.packages[pkgName].chosenVersion = null;
      console.log(`[${pkgName}] unresolved after ${candidates.length} candidate(s)`);
    }
  }

  logState.updatedAt = new Date().toISOString();
  writeJson(outPath, logState);

  const unresolved = Object.entries(logState.packages)
    .filter(([, state]) => state?.status !== "resolved")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  console.log(`\nWrote ${path.relative(projectRoot, outPath)}`);
  console.log(`- packages tracked: ${Object.keys(logState.packages).length}`);
  console.log(`- already resolved, skipped: ${skipped.length}`);
  console.log(`- unresolved packages: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log(`- unresolved list: ${unresolved.join(", ")}`);
  }

  process.exit(0);
}

main();
