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
 * // [LAW:one-source-of-truth] deps/replacements.json is the canonical transaction log for dependency swaps; its
 * //   shape is replacement-log.mjs's, and each trial is written there before the original moves.
 * // [LAW:dataflow-not-control-flow] Each candidate executes the same install -> link -> verify -> rollback-on-fail pipeline.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { emptyLog, fromLogPath, migrateV1, parseLog, serializeLog, toLogPath } from "./replacement-log.mjs";

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

// Write-then-rename: an interrupted write leaves the previous file whole, never a truncated one.
function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, filePath);
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

// A v1 log is migrated on load; its text is kept beside the log, because the migration takes cwd to be the v1 run's.
function loadLog(logPath, cwd) {
  if (!fs.existsSync(logPath)) return emptyLog();
  const text = fs.readFileSync(logPath, "utf8");
  const migrated = migrateV1(text, logPath, cwd);
  const parsed = parseLog(migrated ?? text, logPath);
  if (parsed.ok && migrated !== null) {
    fs.writeFileSync(`${logPath}.v1`, text);
    writeLog(logPath, parsed.log);
    console.log(`Migrated ${logPath} to schema v${parsed.log.schemaVersion} (v1 text kept at ${logPath}.v1)`);
  }
  if (parsed.ok) return parsed.log;
  for (const error of parsed.errors) console.error(`Error: ${logPath}: ${JSON.stringify(error)}`);
  process.exit(2);
}

function writeLog(logPath, logState) {
  writeJson(logPath, serializeLog(logState));
}

// [LAW:one-source-of-truth] One write appends the attempt and moves the entry to the status it implies, replacing
// any in-flight record — so the log never shows a finished trial still in flight.
function recordAttempt(logState, pkgName, attempt, logPath) {
  const attempts = [...(logState.packages[pkgName]?.attempts ?? []), attempt];
  logState.packages[pkgName] = attempt.result === "pass"
    ? { status: "resolved", attempts, chosenVersion: attempt.attemptedVersion, pass: attempt }
    : { status: "unresolved", attempts };
  logState.events.push({
    package: pkgName,
    attemptedVersion: attempt.attemptedVersion,
    result: attempt.result,
    reason: attempt.reason,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
  });
  writeLog(logPath, logState);
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

// What sits at a package's path in the app: nothing, a directory, or a symlink with its readlink text.
function appPathState(appPkgDir) {
  const stat = fs.lstatSync(appPkgDir, { throwIfNoEntry: false });
  if (!stat) return { kind: "absent" };
  if (stat.isSymbolicLink()) return { kind: "link", target: fs.readlinkSync(appPkgDir) };
  return { kind: "dir" };
}

// An entry path in canonical form: its parent directories resolved through symlinks as far as they exist, so --app-dir
// and cwd naming one tree through different symlinked prefixes (/var vs /private/var on macOS) agree, and a path into
// a root scope nothing has been installed into yet still compares. The entry itself stays unresolved, so a workspace
// or npm-link entry keeps its indirection and a link left dangling by a removed root package is still recognised.
function canonicalEntry(entryPath) {
  return path.join(realExisting(path.dirname(entryPath)), path.basename(entryPath));
}

function realExisting(dir) {
  return fs.existsSync(dir) ? fs.realpathSync(dir) : path.join(realExisting(path.dirname(dir)), path.basename(dir));
}

// Where a symlink at appPkgDir with this readlink text leads: a relative target resolves from the link's real directory.
function linkDestination(appPkgDir, target) {
  return canonicalEntry(path.resolve(fs.realpathSync(path.dirname(appPkgDir)), target));
}

// The link this tool writes at appPkgDir.
function rootLinkTarget(appPkgDir, rootPkgDir) {
  return path.relative(fs.realpathSync(path.dirname(appPkgDir)), canonicalEntry(rootPkgDir));
}

// [LAW:one-source-of-truth] Whether the app path is our link is read off disk, one way for every log status: it is
// ours exactly when it leads to the root entry this tool links to.
function isOurLink(app, { appPkgDir, rootPkgDir }) {
  return app.kind === "link" && linkDestination(appPkgDir, app.target) === canonicalEntry(rootPkgDir);
}

// Decided before anything moves, and written into the log as the trial's in-flight record. Nothing is created here:
// setAside makes the backup's directories, so a trial that never moves the original leaves nothing under .original/.
function originalOf(appPkgDir, appNodeModules, pkgName, logPath) {
  const app = appPathState(appPkgDir);
  if (app.kind === "link") return { kind: "link", target: app.target };
  // [LAW:types-are-the-program] The UUID makes each trial's backup root unique by construction; a bare per-second
  // stamp collided when a retrial landed in the same second as an earlier swap.
  const backupRoot = path.join(appNodeModules, ".original", `${safeNowStamp()}-${randomUUID()}`);
  return { kind: "dir", backupPath: toLogPath(logPath, path.join(backupRoot, ...pkgPathParts(pkgName))) };
}

// The directory holding the original's files. A link original is never moved, so it is read where it points.
function originalDir(appPkgDir, original, logPath) {
  if (original.kind === "dir") return fromLogPath(logPath, original.backupPath);
  return linkDestination(appPkgDir, original.target);
}

function describeOriginal(original, logPath) {
  if (original.kind === "dir") return `the original at ${fromLogPath(logPath, original.backupPath)}`;
  return `a symlink to ${original.target}`;
}

function setAside(appPkgDir, original, logPath) {
  if (original.kind === "dir") {
    const backupDir = fromLogPath(logPath, original.backupPath);
    ensureDir(path.dirname(backupDir));
    fs.renameSync(appPkgDir, backupDir);
  } else {
    fs.unlinkSync(appPkgDir);
  }
}

// [LAW:single-enforcer] The one undo, for a failed verification, a trial error, and an interrupted run alike. The
// app path holds our link or nothing; rmSync without `recursive` throws on a directory instead of deleting it.
// [LAW:no-silent-failure] Every caller reaches here with the package's entry in flight on disk, so an undo that
// fails stops the run and leaves that record for the next run to recover from.
function restoreOriginal(pkgName, appPkgDir, original, logPath) {
  try {
    fs.rmSync(appPkgDir, { force: true });
    if (original.kind === "dir") fs.renameSync(fromLogPath(logPath, original.backupPath), appPkgDir);
    else fs.symlinkSync(original.target, appPkgDir, "dir");
  } catch (error) {
    console.error(`Error: [${pkgName}] could not restore ${describeOriginal(original, logPath)} to ${appPkgDir}: ${error.message} — ${logPath} keeps the trial in flight; fix the cause and rerun to recover`);
    process.exit(1);
  }
  removeBackupRoot(pkgName, appPkgDir, original, logPath);
}

// A dir original's backup root under .original/ belongs to its one trial, so once the original is out of it (or
// never went in) the root holds nothing worth keeping — empty directories, or a .DS_Store Finder dropped there.
// The recursive delete is driven by log data, so it refuses any root that is not a direct child of the app's
// .original/ — a hand-edited backupPath must never reach the log's own directory.
function removeBackupRoot(pkgName, appPkgDir, original, logPath) {
  if (original.kind !== "dir") return;
  const up = pkgPathParts(pkgName).map(() => "..");
  const backupsDir = path.join(appPkgDir, ...up, ".original");
  const root = path.join(fromLogPath(logPath, original.backupPath), ...up);
  if (path.dirname(root) !== backupsDir) throw new Error(`[${pkgName}] backup root ${root} is not under ${backupsDir}; refusing to delete it`);
  fs.rmSync(root, { recursive: true, force: true });
}

// An in-flight entry, read against disk. "original-in-place": the original never moved, or was already put back.
// "restored": the original is set aside and restorable. Anything else can't be undone safely, so the run refuses.
function classifyInterrupted(inFlight, app, ours, ctx) {
  const { original } = inFlight;
  const trial = `an interrupted trial of ${inFlight.attemptedVersion}`;
  const interrupted = (recovery) => ({ kind: "interrupted", recovery, inFlight });
  const conflict = (reason) => ({ kind: "conflict", reason });

  if (original.kind === "dir") {
    const backup = fromLogPath(ctx.logPath, original.backupPath);
    const backupPresent = fs.existsSync(backup);
    if (app.kind === "dir") {
      if (!backupPresent) return interrupted("original-in-place");
      return conflict(`${trial} left the original at ${backup}, but the app path holds a directory too — keep the original at the app path, remove the other copy, then ${ctx.deleteEntry}`);
    }
    if (!backupPresent) return conflict(`${trial} moved the original to ${backup}, which is gone — the original is lost; re-extract the app, then ${ctx.deleteEntry}`);
    if (app.kind === "absent" || ours) return interrupted("restored");
    return conflict(`${trial} left the original at ${backup}, but the app path is a link this tool did not make (-> ${app.target}) — put the original back at the app path, then ${ctx.deleteEntry}`);
  }
  if (app.kind === "link" && app.target === original.target) return interrupted("original-in-place");
  if (app.kind === "absent" || ours) return interrupted("restored");
  const found = app.kind === "dir" ? "a directory" : `a link to ${app.target}`;
  return conflict(`${trial} set aside the app's link to ${original.target}, but the app path now holds ${found} — put the link back, then ${ctx.deleteEntry}`);
}

// [LAW:one-source-of-truth] A log status of "resolved" records a swap that already happened, so a rerun must
// not trial the package again (the log allows exactly one pass per resolved package). Disk has to agree with the
// record in both directions; when it doesn't, neither side can be trusted to win, so the run refuses and names the
// way out. [LAW:no-silent-failure]
function priorSwap(entry, ctx, requestedVersion) {
  const app = appPathState(ctx.appPkgDir);
  const ours = isOurLink(app, ctx);
  const status = entry?.status ?? "unresolved";

  if (status === "in-flight") return classifyInterrupted(entry.inFlight, app, ours, ctx);
  if (status === "unresolved") {
    if (!ours) return { kind: "untried" };
    // Trialing our own link would verify the root package against itself and record a made-up original.
    return { kind: "conflict", reason: `the app copy already links to the root package, but ${ctx.logPath} records no resolved swap for it — put the original back over the link first (earlier backups are under ${ctx.backupsDir}), then rerun` };
  }

  const chosen = entry.chosenVersion;
  if (!ours) {
    return { kind: "conflict", reason: `resolved with ${chosen} in the log, but the app copy is not linked to the root package (re-extracted app with an old log?) — to trial this app copy, ${ctx.deleteEntry}` };
  }
  const restore = `to trial it again, replace the app link with ${describeOriginal(entry.pass.original, ctx.logPath)} and ${ctx.deleteEntry}`;
  if (requestedVersion && requestedVersion !== chosen) {
    return { kind: "conflict", reason: `already resolved with ${chosen}; --version ${requestedVersion} is a retrial — ${restore}` };
  }
  const rootVersion = readPkgVersion(path.join(ctx.rootPkgDir, "package.json"));
  if (rootVersion !== chosen) {
    return { kind: "conflict", reason: `resolved with ${chosen}, but the root package is now ${rootVersion ?? "missing"} — reinstall ${chosen} at the root, or ${restore}` };
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

  // The log is loaded first, so a v1 log migrates even on a run that finds nothing to trial.
  const logState = loadLog(outPath, projectRoot);

  const candidateSource = loadCandidateSource(candidateSourcePath);
  const packageList = determinePackageList(opts, candidateSource);
  if (packageList.length === 0) {
    console.error("No package candidates resolved. Provide --pkg or --auto-near-match with candidate source.");
    process.exit(2);
  }

  const appPkgDirOf = (pkgName) => path.join(appNodeModules, ...pkgPathParts(pkgName));
  const rootPkgDirOf = (pkgName) => path.join(projectRoot, "node_modules", ...pkgPathParts(pkgName));

  // Every in-flight entry is settled, requested or not: an unrequested one still has its original set aside.
  const inFlightElsewhere = Object.keys(logState.packages).filter((pkgName) => logState.packages[pkgName].status === "in-flight" && !packageList.includes(pkgName));
  const priors = [...packageList, ...inFlightElsewhere].map((pkgName) => ({
    pkgName,
    prior: priorSwap(
      logState.packages[pkgName],
      { appPkgDir: appPkgDirOf(pkgName), rootPkgDir: rootPkgDirOf(pkgName), backupsDir: path.join(appNodeModules, ".original"), logPath: outPath, deleteEntry: `delete the package's entry from ${outPath}` },
      opts.pkg === pkgName ? opts.version : "",
    ),
  }));
  const conflicts = priors.filter(({ prior }) => prior.kind === "conflict");
  if (conflicts.length > 0) {
    for (const { pkgName, prior } of conflicts) console.error(`Error: [${pkgName}] ${prior.reason}`);
    process.exit(2);
  }
  const skipped = priors.filter(({ prior }) => prior.kind === "resolved");
  for (const { pkgName, prior } of skipped) console.log(`[${pkgName}] already resolved with ${prior.version}; skipped`);

  // Recovery: settle every interrupted trial before any new one starts, then trial the requested packages afresh.
  const interrupted = priors.filter(({ prior }) => prior.kind === "interrupted");
  for (const { pkgName, prior } of interrupted) {
    const { recovery, inFlight } = prior;
    if (recovery === "restored") restoreOriginal(pkgName, appPkgDirOf(pkgName), inFlight.original, outPath);
    else removeBackupRoot(pkgName, appPkgDirOf(pkgName), inFlight.original, outPath);
    recordAttempt(logState, pkgName, {
      attemptedVersion: inFlight.attemptedVersion,
      startedAt: inFlight.startedAt,
      finishedAt: new Date().toISOString(),
      result: "fail",
      reason: "interrupted",
      recovery,
      original: inFlight.original,
    }, outPath);
    const outcome = recovery === "restored" ? `restored ${describeOriginal(inFlight.original, outPath)}` : "the original was still in place";
    console.log(`[${pkgName}] interrupted trial of ${inFlight.attemptedVersion}: ${outcome}`);
  }

  const toTry = priors
    .filter(({ pkgName, prior }) => packageList.includes(pkgName) && (prior.kind === "untried" || prior.kind === "interrupted"))
    .map(({ pkgName }) => pkgName);

  for (const pkgName of toTry) {
    const appPkgDir = appPkgDirOf(pkgName);
    const appPkgJson = path.join(appPkgDir, "package.json");

    const onDiskVersion = readPkgVersion(appPkgJson);
    const candidates = determineCandidatesForPackage(opts, pkgName, candidateSource, onDiskVersion);

    const untrialable = (reason) => {
      const now = new Date().toISOString();
      recordAttempt(logState, pkgName, {
        attemptedVersion: null,
        startedAt: now,
        finishedAt: now,
        result: "fail",
        reason,
        swapApplied: false,
        rolledBack: false,
        original: null,
        verification: { path: null, pass: false },
      }, outPath);
    };
    if (!fs.existsSync(appPkgJson)) {
      untrialable("on-disk-package-missing");
      continue;
    }
    if (candidates.length === 0) {
      untrialable("no-candidates");
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
        original: null,
        verification: { path: null, pass: false },
      };
      const finish = () => {
        attempt.finishedAt = new Date().toISOString();
        recordAttempt(logState, pkgName, attempt, outPath);
      };

      console.log(`\n[${pkgName}] Trying candidate ${version}`);

      if (!installExact(opts.npm, pkgName, version)) {
        attempt.reason = "npm-install-failed";
        finish();
        continue;
      }

      const rootPkgDir = rootPkgDirOf(pkgName);
      const rootPkgJson = path.join(rootPkgDir, "package.json");
      if (!fs.existsSync(rootPkgJson)) {
        attempt.reason = "root-package-json-missing";
        finish();
        continue;
      }

      const installed = readJson(rootPkgJson);
      if (installed?.name !== pkgName || installed?.version !== version) {
        attempt.reason = `installed-package-mismatch:${installed?.name || "?"}@${installed?.version || "?"}`;
        finish();
        continue;
      }

      // Write-ahead: the log names the original before it moves, so a run killed at any point after this write
      // leaves an in-flight entry the next run can undo exactly, and the gate refuses.
      const original = originalOf(appPkgDir, appNodeModules, pkgName, outPath);
      attempt.original = original;
      logState.packages[pkgName] = {
        status: "in-flight",
        attempts: logState.packages[pkgName]?.attempts ?? [],
        inFlight: { attemptedVersion: version, startedAt, original },
      };
      writeLog(outPath, logState);

      let setAsideDone = false;
      try {
        const beforeDir = originalDir(appPkgDir, original, outPath);
        setAside(appPkgDir, original, outPath);
        setAsideDone = true;
        fs.symlinkSync(rootLinkTarget(appPkgDir, rootPkgDir), appPkgDir, "dir");
        attempt.swapApplied = true;

        const verificationOutAbs = path.join(verificationDir, `${safeIdPart(pkgName)}@${version}.json`);
        const verificationPass = runVerifySwap({
          verifyScript,
          pkgName,
          beforeDir,
          afterDir: appPkgDir,
          expectedVersion: version,
          threshold: opts.threshold,
          verificationOut: verificationOutAbs,
        });
        attempt.verification = { path: toLogPath(outPath, verificationOutAbs), pass: verificationPass };
        attempt.result = verificationPass ? "pass" : "fail";
        attempt.reason = verificationPass ? "verified" : "verification-failed";
      } catch (error) {
        attempt.reason = `trial-error:${String(error?.message || error)}`;
      }

      if (attempt.result === "fail" && setAsideDone) {
        restoreOriginal(pkgName, appPkgDir, original, outPath);
        attempt.rolledBack = true;
      }
      // A set-aside that threw may have made the backup's directories without moving anything into them.
      if (!setAsideDone) removeBackupRoot(pkgName, appPkgDir, original, outPath);
      finish();

      if (attempt.result === "pass") {
        resolved = true;
        console.log(`[${pkgName}] resolved with ${version}`);
        break;
      }
    }

    if (!resolved) {
      console.log(`[${pkgName}] unresolved after ${candidates.length} candidate(s)`);
    }
  }

  const unresolved = Object.entries(logState.packages)
    .filter(([, state]) => state.status !== "resolved")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  console.log(`\nLog: ${path.relative(projectRoot, outPath)}`);
  console.log(`- packages tracked: ${Object.keys(logState.packages).length}`);
  console.log(`- already resolved, skipped: ${skipped.length}`);
  console.log(`- interrupted trials recovered: ${interrupted.length}`);
  console.log(`- unresolved packages: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log(`- unresolved list: ${unresolved.join(", ")}`);
  }

  process.exit(0);
}

main();
