#!/usr/bin/env node
/**
 * replace-dependency.mjs
 *
 * Replace each copy of a dependency the app ships under <appDir>/node_modules with a replacement of that copy's own
 * version, installed at the project root, including near-match auto-trials and deterministic verification.
 *
 * Usage (every copy of one package, or the one copy at --location):
 *   node replace-dependency.mjs --pkg <name> [--location <loc>] [--version <x.y.z>] [--app-dir resources/app]
 *
 * Usage (auto near-match over candidate source):
 *   node replace-dependency.mjs --auto-near-match --candidate-source deps/near-matches.json --app-dir resources/app
 *
 * Exit status: 0 when every copy the run was asked for (every copy of each requested package the walk finds, or the one
 * at --location) is replaced and the whole tree was read; 3 when the run finished but one of those copies still loads
 * something other than its replacement, or the tree couldn't be read in full; 2 when the run refuses before moving
 * anything more; 1 when an error stops it. A requested package is the copies that hold it and the copies its name
 * reaches; one with no copy is named, and asks for nothing: nothing in the app loads it.
 *
 * // [LAW:verifiable-goals] Every attempt is logged with result, rollback state, and verification evidence.
 * // [LAW:one-source-of-truth] deps/replacements.json is the canonical transaction log for dependency swaps, one entry
 * //   per copy; its shape is replacement-log.mjs's, and each trial is written there before the original moves.
 * // [LAW:dataflow-not-control-flow] exception: a candidate stops at its first failing step (install, the replacement
 * //   check, write-ahead, link, verify), because the steps after it have nothing to act on; its attempt records the
 * //   step and why, and a candidate that set its original aside is always rolled back.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { writeOutputs } from "./artifact.mjs";
import { emptyLog, fromLogPath, inFlightEntry, interruptedAttempt, readLog, serializeLog, settledEntry, toLogPath, trialAttempt, untrialedAttempt } from "./replacement-log.mjs";
import { isNonEmptyString, JSON_SHAPE } from "./json-value.mjs";
import { appPathState, describeEntry, inputAt, readJson } from "./path-state.mjs";
import { appAt, canonicalEntry, containerSwappedAt, copiesOf, entryNameOf, isPackageName, linkDestination, locationDir, packageAt, pkgPathParts, realExisting, replacementOf, stateText, swapOutcome, walkStarts } from "./node-modules.mjs";

const USAGE = [
  "Usage:",
  "  node replace-dependency.mjs --pkg <name> [--location <loc>] [--version <x.y.z>] [--app-dir resources/app]",
  "  node replace-dependency.mjs --auto-near-match --candidate-source deps/near-matches.json [--app-dir resources/app]",
];

// The flags that take a value, and the option each sets.
const VALUE_FLAGS = {
  "--app-dir": "appDir",
  "--pkg": "pkg",
  "--location": "location",
  "--version": "version",
  "--npm": "npm",
  "--mode": "mode",
  "--candidate-source": "candidateSource",
  "--out": "out",
  "--verification-dir": "verificationDir",
  "--verify-script": "verifyScript",
  "--threshold": "threshold",
};

// [LAW:parse-dont-validate] The command line as a run reads it, or every reason it can't be read: an unknown flag,
// a flag missing its value or given twice, a --pkg that is no package name, or flags that contradict each other are
// refused, never read as a default. --location and --version choose among --pkg's copies, so they need it; pkg,
// location and version are null when not given.
function parseArgs(argv) {
  const opts = {
    appDir: "resources/app",
    pkg: null,
    location: null,
    version: null,
    npm: "npm",
    mode: "symlink",
    candidateSource: "deps/near-matches.json",
    autoNearMatch: false,
    out: "deps/replacements.json",
    verificationDir: "deps/verification",
    verifyScript: "tools/verify-dependency-swap.mjs",
    threshold: "0.8",
  };
  const errors = [];
  const given = new Set();
  let help = false;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--auto-near-match") {
      opts.autoNearMatch = true;
      continue;
    }
    const key = VALUE_FLAGS[arg];
    const value = argv[i + 1];
    if (key === undefined) errors.push(`unknown argument ${arg}`);
    else if (!isNonEmptyString(value) || value.startsWith("--")) errors.push(`${arg} needs a value`);
    else if (given.has(arg)) errors.push(`${arg} is given twice`);
    else {
      given.add(arg);
      opts[key] = argv[++i];
    }
  }
  if (help && errors.length === 0) return { kind: "help" };
  if (opts.pkg !== null && !isPackageName(opts.pkg)) errors.push(`--pkg ${opts.pkg} is not a package name`);
  if ((opts.pkg !== null) === opts.autoNearMatch) errors.push("give exactly one of --pkg <name> and --auto-near-match");
  if (opts.pkg === null && (opts.location !== null || opts.version !== null)) errors.push("--location and --version choose among --pkg's copies, so they need --pkg");
  const threshold = Number(opts.threshold);
  if (!Number.isFinite(threshold)) errors.push(`--threshold ${opts.threshold} is not a number`);
  if (opts.mode !== "symlink") errors.push(`unsupported mode ${opts.mode} (only 'symlink' supported)`);
  return errors.length > 0 ? { kind: "invalid", errors } : { kind: "run", opts: { ...opts, threshold } };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// [LAW:one-source-of-truth] A tree is locked exactly while the run that locked it lives. The flock belongs to the
// run's own open file description — perl takes it through stdin, which shares that description, and exits — so the
// kernel releases it however the run ends, kill -9 included, and there is no stale lock to judge or take over. Node
// opens files close-on-exec, so npm and the verify script never inherit it. The lock file is never unlinked: a run
// holding the unlinked inode would lock nothing the next run can see.
function lockTree(lockPath) {
  ensureDir(path.dirname(lockPath));
  const fd = fs.openSync(lockPath, "a+");
  // Exit 3 means only that another run holds the lock; any other flock failure dies with its errno on stderr.
  const res = spawnSync("perl", ["-MFcntl=:flock", "-e", 'flock(STDIN, LOCK_EX | LOCK_NB) and exit 0; $!{EWOULDBLOCK} and exit 3; die "flock: $!\\n"'], { stdio: [fd, "inherit", "inherit"] });
  if (res.status === 3) {
    const holder = fs.readFileSync(lockPath, "utf8").trim() || "it has not recorded itself yet";
    console.error(`Error: ${lockPath} is held by another replace-dependency run (${holder}) — wait for it to finish, or stop it; its locks are released the moment it exits, and the next run recovers any trial it left in flight`);
    process.exit(2);
  }
  if (res.status !== 0) {
    console.error(`Error: could not lock ${lockPath} with perl:${res.error?.message ?? `exit ${res.status}, signal ${res.signal}`}`);
    process.exit(2);
  }
  fs.ftruncateSync(fd, 0);
  fs.writeSync(fd, `pid ${process.pid}, started ${new Date().toISOString()}, in ${process.cwd()}: ${process.argv.join(" ")}\n`);
}

function safeNowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// [LAW:no-silent-failure] npm's verdict on the replacement: whether it installed. An npm that can't be started or is
// killed gave no verdict, and every candidate after it would fail the same way, so the run stops; nothing has moved.
// [LAW:no-silent-failure] Whether npm installed the replacement: { ok: true }, or { ok: false, detail } with the last
// line npm wrote to stderr (echoed as it runs), so a failed install's log entry says why.
function installReplacement(npmBin, replacement) {
  const res = spawnSync(npmBin, ["install", "--loglevel=error", "--no-progress", "--save-exact", replacement.spec], {
    stdio: ["inherit", "inherit", "pipe"],
    encoding: "utf8",
  });
  if (res.error || res.signal) {
    console.error(`Error: could not run ${npmBin} install ${replacement.spec}: ${res.error?.message ?? `killed by ${res.signal}`} — fix it, then rerun`);
    process.exit(1);
  }
  process.stderr.write(res.stderr);
  const lastLine = res.stderr.trim().split("\n").at(-1) || `exit ${res.status}`;
  return res.status === 0 ? { ok: true } : { ok: false, detail: lastLine };
}

// [LAW:no-silent-failure] The verifier's verdict, read from the artifact it writes, which its exit status must agree
// with: { kind: "verdict", pass }. A verifier that can't be started, is killed, or ends without a verdict that agrees
// with its status gave none: { kind: "error", detail }. Any earlier file at the artifact's path is removed first, so a
// verdict read back is this run's.
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

  fs.rmSync(verificationOut, { force: true });
  const result = spawnSync("node", args, {
    stdio: "inherit",
  });
  if (result.error || result.signal) return { kind: "error", detail: result.error?.message ?? `killed by ${result.signal}` };
  const read = readJson(verificationOut, JSON_SHAPE.object);
  if (read.kind !== "json") return { kind: "error", detail: `exit ${result.status} with no verdict: ${verificationOut} ${read.reason}` };
  const artifact = read.value;
  if (typeof artifact.pass !== "boolean" || artifact.pass !== (result.status === 0)) {
    return { kind: "error", detail: `exit ${result.status}, but its verdict at ${verificationOut} says pass: ${JSON.stringify(artifact.pass)}` };
  }
  return { kind: "verdict", pass: artifact.pass };
}

// [LAW:parse-dont-validate] The candidate source as replace-dependency reads it: { kind: "read", byName }, each
// package name it lists mapped from the exact version a copy of it is on disk to the versions to trial that copy
// against, or { kind: "absent" } when no file is there. A name it lists with no copy on disk has no versions, and is
// still a name the run is asked about. A file that is there but can't be read, or is in any other shape (one an older
// find-near-match-versions wrote among them), is refused.
function loadCandidateSource(filePath) {
  const read = readJson(filePath, JSON_SHAPE.object);
  if (read.kind === "absent") return { kind: "absent" };
  const refuseSource = (why) => {
    console.error(`Error: ${filePath} ${why} — rerun find-near-match-versions.mjs to write it`);
    process.exit(2);
  };
  if (read.kind === "unusable") refuseSource(read.reason);
  const parsed = read.value;
  if (!Array.isArray(parsed.packages)) refuseSource("has no packages list");
  const byName = new Map();
  for (const item of parsed.packages) {
    const itemOk = isPackageName(item?.name)
      && (item.onDiskVersion === null || isNonEmptyString(item.onDiskVersion))
      && Array.isArray(item.candidates) && item.candidates.every((candidate) => isNonEmptyString(candidate?.version));
    if (!itemOk) refuseSource(`lists ${JSON.stringify(item)}, which is not { name, onDiskVersion (a version or null), candidates: [{ version }] }`);
    const versions = byName.get(item.name) ?? new Map();
    byName.set(item.name, versions);
    if (item.onDiskVersion === null) continue;
    if (versions.has(item.onDiskVersion)) refuseSource(`lists ${item.name}@${item.onDiskVersion} twice`);
    versions.set(item.onDiskVersion, item.candidates.map((candidate) => candidate.version));
  }
  return { kind: "read", byName };
}

// The log a run starts from: no log is an empty one, and a log that is there but can't be read or parsed stops the run
// before it trials or writes anything, so the record of earlier swaps is never overwritten.
function loadLog(logPath) {
  const read = readLog(logPath);
  if (read.kind === "absent") return emptyLog();
  if (read.kind === "read") return read.log;
  for (const error of read.errors) console.error(`Error: ${logPath}: ${JSON.stringify(error)}`);
  process.exit(2);
}

function writeLog(logPath, logState) {
  writeOutputs([[logPath, serializeLog(logState)]]);
}

// A copy as the log and the console name it: { name, location, version }, version the app copy's own or null.
const copyText = (copy) => `${copy.name} ${copy.location}`;

// [LAW:one-source-of-truth] One write appends the attempt and moves the copy's entry to the status it implies,
// replacing any in-flight record — so the log never shows a finished trial still in flight.
function recordAttempt(logState, copy, attempt, logPath) {
  logState.copies[copy.location] = settledEntry(logState.copies[copy.location], copy, attempt);
  writeLog(logPath, logState);
}

// Whether a replacement directory's package is pkgName at version, and what it holds as text.
const isInstalled = (root, pkgName, version) => root.kind === "package" && root.name === pkgName && root.version === version;
const packageText = (state) => state.kind === "package" ? `${state.name}@${state.version}` : stateText(state);

// The link this tool writes at a copy's location.
function rootLinkTarget(dir, replacementDir) {
  return path.relative(fs.realpathSync(path.dirname(dir)), canonicalEntry(replacementDir));
}

// [LAW:one-source-of-truth] Whether a location holds the link to one replacement is read off disk, one way for every
// log status: it is exactly when the link there leads to that replacement's directory.
const isLinkTo = (state, dir, replacementDir) => state.kind === "link" && linkDestination(dir, state.target) === canonicalEntry(replacementDir);

// [LAW:single-enforcer] Whether a resolved copy is replaced, the one answer priorSwap and the summary both read: its
// location links to the replacement its entry chose, and that replacement holds the chosen package.
//   { kind: "held", replacement } | { kind: "unlinked", replacement } | { kind: "not-installed", replacement, root }
function replacementHeld(app, projectRoot, location, entry) {
  const dir = locationDir(app, location);
  const replacement = replacementOf(projectRoot, entry.name, entry.chosenVersion);
  if (!isLinkTo(appPathState(dir), dir, replacement.dir)) return { kind: "unlinked", replacement };
  const root = packageAt(replacement.dir);
  return isInstalled(root, entry.name, entry.chosenVersion) ? { kind: "held", replacement } : { kind: "not-installed", replacement, root };
}

// Decided before anything moves, and written into the log as the trial's in-flight record. Nothing is created here:
// setAside makes the backup's directories, so a trial that never moves the original leaves nothing under .original/.
function originalOf(copy, app) {
  const dir = locationDir(app, copy.location);
  const state = appPathState(dir);
  if (state.kind === "link") return { kind: "link", target: state.target };
  if (state.kind !== "dir") throw new Error(`[${copyText(copy)}] ${dir} holds ${describeEntry(state)}, not a directory to set aside`);
  // [LAW:types-are-the-program] The UUID makes each trial's backup root unique by construction; a bare per-second
  // stamp collided when a retrial landed in the same second as an earlier swap.
  const backupRoot = path.join(app.backupsDir, `${safeNowStamp()}-${randomUUID()}`);
  return { kind: "dir", backupPath: toLogPath(app.logPath, path.join(backupRoot, ...pkgPathParts(copy.name))) };
}

// The directory holding the original's files. A link original is never moved, so it is read where it points.
function originalDir(copy, original, app) {
  if (original.kind === "dir") return fromLogPath(app.logPath, original.backupPath);
  return linkDestination(locationDir(app, copy.location), original.target);
}

function describeOriginal(original, logPath) {
  if (original.kind === "dir") return `the original at ${fromLogPath(logPath, original.backupPath)}`;
  return `a symlink to ${original.target}`;
}

function setAside(copy, original, app) {
  const dir = locationDir(app, copy.location);
  if (original.kind === "dir") {
    const backupDir = fromLogPath(app.logPath, original.backupPath);
    ensureDir(path.dirname(backupDir));
    fs.renameSync(dir, backupDir);
  } else {
    fs.unlinkSync(dir);
  }
}

// A dir original's backup root under .original/ belongs to its one trial, so once the original is out of it (or
// never went in) the root holds nothing worth keeping — empty directories, or a .DS_Store Finder dropped there. A link
// original is never moved and has none. The recursive delete is driven by log data, so a root that is not a direct
// child of the app's .original/ is refused before anything moves — a hand-edited backupPath must never reach the
// log's own directory, or move a path from outside the app into it.
function backupRootsOf(copy, original, app) {
  if (original.kind !== "dir") return [];
  const root = path.join(fromLogPath(app.logPath, original.backupPath), ...pkgPathParts(copy.name).map(() => ".."));
  if (path.dirname(root) !== app.backupsDir) throw new Error(`[${copyText(copy)}] backup root ${root} is not under ${app.backupsDir}; refusing to delete it`);
  return [root];
}

// The original is already where it belongs when this runs, so a failure here is reported as the leftover it is.
function removeBackupRoots(copy, roots) {
  for (const root of roots) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error: [${copyText(copy)}] the original is in place, but its backup root ${root} could not be removed: ${error.message} — remove it, then rerun`);
      process.exit(1);
    }
  }
}

// [LAW:single-enforcer] The one undo, for a failed verification, a trial error, and an interrupted run alike. The
// copy's location holds our link or nothing; rmSync without `recursive` throws on a directory instead of deleting it.
// [LAW:no-silent-failure] Every caller reaches here with the copy's entry in flight on disk, so an undo that fails
// stops the run and leaves that record for the next run to recover from.
function restoreOriginal(copy, original, app) {
  const dir = locationDir(app, copy.location);
  const roots = backupRootsOf(copy, original, app);
  try {
    fs.rmSync(dir, { force: true });
    if (original.kind === "dir") fs.renameSync(fromLogPath(app.logPath, original.backupPath), dir);
    else fs.symlinkSync(original.target, dir, "dir");
  } catch (error) {
    console.error(`Error: [${copyText(copy)}] could not restore ${describeOriginal(original, app.logPath)} to ${dir}: ${error.message} — ${app.logPath} keeps the trial in flight; fix the cause and rerun to recover`);
    process.exit(1);
  }
  removeBackupRoots(copy, roots);
}

// An in-flight entry, read against disk at the location it records. "original-in-place": the original never moved, or
// was already put back. "restored": the original is set aside and restorable. Anything else can't be undone safely,
// so the run refuses.
function classifyInterrupted(inFlight, state, ours, ctx) {
  const { original } = inFlight;
  const { dir } = ctx;
  const trial = `an interrupted trial of ${inFlight.attemptedVersion}`;
  const interrupted = (recovery) => ({ kind: "interrupted", recovery, inFlight });
  const conflict = (reason) => ({ kind: "conflict", reason });

  if (original.kind === "dir") {
    const backup = fromLogPath(ctx.app.logPath, original.backupPath);
    const backupState = appPathState(backup);
    if (backupState.kind === "unreadable") return conflict(`${trial} moved the original to ${backup}, which is ${describeEntry(backupState)} — make it readable, then rerun`);
    const backupPresent = backupState.kind !== "absent";
    if (state.kind === "dir") {
      if (!backupPresent) return interrupted("original-in-place");
      return conflict(`${trial} left the original at ${backup}, but ${dir} holds a directory too — keep the original at ${dir}, remove the other copy, then ${ctx.deleteEntry}`);
    }
    if (!backupPresent) return conflict(`${trial} moved the original to ${backup}, which is gone — the original is lost; re-extract the app, then ${ctx.deleteEntry}`);
    if (state.kind === "absent" || ours) return interrupted("restored");
    return conflict(`${trial} left the original at ${backup}, but ${dir} holds ${describeEntry(state)} this tool did not put there — put the original back at ${dir}, then ${ctx.deleteEntry}`);
  }
  if (state.kind === "link" && state.target === original.target) return interrupted("original-in-place");
  if (state.kind === "absent" || ours) return interrupted("restored");
  return conflict(`${trial} set aside the link at ${dir} to ${original.target}, but ${dir} now holds ${describeEntry(state)} — put the link back, then ${ctx.deleteEntry}`);
}

// [LAW:one-source-of-truth] A logged entry that is in flight or resolved records a swap at its location, and disk has
// to agree with the record: the location still is the copy's swap location (no link now leads it on to another), and
// it holds the link the record implies. A resolved copy must not be trialed again (the log allows exactly one pass per
// resolved copy). When disk and log disagree, neither can be trusted to win, so the run refuses and names the way out.
// A recorded swap at a location the app doesn't own is refused, since undoing it would touch files past a link out of
// the app; any other refusal names the outcome's reason too, so a loop or an unreadable path is named as the cause.
// requestedVersion is --version, or null.
// [LAW:no-silent-failure]
function priorSwap(entry, ctx, requestedVersion) {
  const { app, copy, projectRoot } = ctx;
  const outcome = swapOutcome(app, copy.location);
  const dir = locationDir(app, copy.location);
  const why = outcome.kind === "untrialable" ? ` (${outcome.reason})` : "";
  if (outcome.kind === "untrialable" && !outcome.appOwns) {
    return { kind: "conflict", reason: `the log records the ${entry.status} swap at ${dir}, but that copy can't be swapped (${outcome.reason}), so undoing it would touch files the app doesn't own — put the original back by hand, then ${ctx.deleteEntry}` };
  }
  // An interrupted trial is settled by what sits at its own location, whatever that leads on to.
  const state = appPathState(dir);
  if (entry.status === "in-flight") {
    const ours = isLinkTo(state, dir, replacementOf(projectRoot, copy.name, entry.inFlight.attemptedVersion).dir);
    return classifyInterrupted(entry.inFlight, state, ours, { ...ctx, dir });
  }
  if (outcome.location !== copy.location) {
    return { kind: "conflict", reason: `the log records the ${entry.status} swap at ${dir}, but ${dir} now leads on to ${locationDir(app, outcome.location)}${why} — put back what the swap left at ${dir}, then rerun` };
  }

  const chosen = entry.chosenVersion;
  const held = replacementHeld(app, projectRoot, copy.location, entry);
  const { replacement } = held;
  if (held.kind === "unlinked") {
    return { kind: "conflict", reason: `resolved with ${chosen} in the log, but ${dir} is not linked to its replacement${why} (re-extracted app with an old log?) — to trial this app copy, ${ctx.deleteEntry}` };
  }
  const restore = `to trial it again, replace the link at ${dir} with ${describeOriginal(entry.pass.original, app.logPath)} and ${ctx.deleteEntry}`;
  if (requestedVersion !== null && requestedVersion !== chosen) {
    return { kind: "conflict", reason: `already resolved with ${chosen}; --version ${requestedVersion} is a retrial — ${restore}` };
  }
  if (held.kind === "not-installed") {
    return { kind: "conflict", reason: `resolved with ${chosen}, but its replacement ${replacement.dir} is now ${packageText(held.root)} — reinstall it (npm install ${replacement.spec}), or ${restore}` };
  }
  return { kind: "resolved", version: chosen };
}

// A copy is one of name's when it is that package, or name reaches it (as it reaches an npm alias's copy).
const isCopyOf = (copy, name) => copy.name === name || copy.paths.some((start) => entryNameOf(start) === name);

// Each conflict a set of priors holds, as the line the run refuses with.
const conflictsOf = (priors) => priors.filter(({ prior }) => prior.kind === "conflict").map(({ copy, prior }) => `[${copyText(copy)}] ${prior.reason}`);

// A run with any reason to refuse names every one, and stops before it moves anything more.
function refuse(reasons) {
  for (const reason of reasons) console.error(`Error: ${reason}`);
  if (reasons.length > 0) process.exit(2);
}

// Phase one: every in-flight entry is settled, requested or not, since an unrequested one still has its original set
// aside. [LAW:no-ambient-temporal-coupling] Its record names its location, so it is read off the log, before anything
// moves, and every trial after it reads the tree it leaves. Returns the trials it settled.
function recoverInterrupted(run) {
  const { app, logState, outPath } = run;
  const inFlight = Object.entries(logState.copies)
    .filter(([, entry]) => entry.status === "in-flight")
    .map(([location, entry]) => {
      const copy = { name: entry.name, location, version: entry.version };
      return { copy, prior: priorSwap(entry, run.ctxOf(copy), null) };
    });
  refuse(conflictsOf(inFlight));

  const interrupted = inFlight.filter(({ prior }) => prior.kind === "interrupted");
  for (const { copy, prior } of interrupted) {
    const { recovery, inFlight: record } = prior;
    if (recovery === "restored") restoreOriginal(copy, record.original, app);
    else removeBackupRoots(copy, backupRootsOf(copy, record.original, app));
    recordAttempt(logState, copy, interruptedAttempt(record, recovery, new Date().toISOString()), outPath);
    const outcome = recovery === "restored" ? `restored ${describeOriginal(record.original, outPath)}` : "the original was still in place";
    console.log(`[${copyText(copy)}] interrupted trial of ${record.attemptedVersion}: ${outcome}`);
  }
  return interrupted;
}

// Phase two: the copies this run trials, each with its prior. Every recorded swap of a selected copy is checked
// against disk, and an untried copy already linked to a replacement is refused (trialing it would verify a replacement
// against itself and record a made-up original), before any trial moves anything.
function selectCopies(run, found) {
  const { app, logState, opts, outPath } = run;
  const selected = opts.location === null ? found : found.filter(({ location, paths }) => location === opts.location || paths.includes(opts.location));
  if (opts.location !== null && selected.length === 0) {
    refuse([`--location ${opts.location} is not where any copy of ${opts.pkg} is reached; its copies are at ${found.map(({ location }) => location).join(", ") || "no location"}`]);
  }
  for (const copy of selected.filter(({ location }) => opts.location !== null && location !== opts.location)) {
    console.log(`--location ${opts.location} reaches the copy at ${copy.location}, which is trialed for every path that loads it: ${copy.paths.join(", ")}`);
  }

  const priors = selected.map((copy) => {
    const entry = logState.copies[copy.location];
    if (entry?.status === "resolved") return { copy, prior: priorSwap(entry, run.ctxOf(copy), opts.version) };
    if (copy.outcome.cause !== "replacement") return { copy, prior: { kind: "untried" } };
    return { copy, prior: { kind: "conflict", reason: `${locationDir(app, copy.location)} already links to a replacement, but ${outPath} records no resolved swap for it — put the original back over the link first (earlier backups are under ${app.backupsDir}), then rerun` } };
  });
  refuse(conflictsOf(priors));

  const toTry = priors.filter(({ prior }) => prior.kind === "untried").map(({ copy }) => copy);
  const trialable = toTry.filter(({ outcome }) => outcome.kind === "trialable");
  if (opts.version !== null && new Set(trialable.map(({ outcome }) => outcome.loads.version)).size > 1) {
    refuse([`--version ${opts.version} names one version, but ${opts.pkg}'s copies are ${trialable.map(({ location, outcome }) => `${location} (${outcome.loads.version})`).join(", ")} — choose one with --location`]);
  }
  return { selected, skipped: priors.filter(({ prior }) => prior.kind === "resolved"), toTry };
}

// Phase three, for one copy: each candidate in turn until one verifies. A trial changes nothing but the copy's own
// location and what lies inside it, so the outcome the copy was selected with is still the copy's.
function trialCopy(run, found) {
  const { app, logState, opts, outPath, projectRoot } = run;
  const { name, location, outcome } = found;
  const copy = { name, location, version: outcome.kind === "trialable" ? outcome.loads.version : null };
  if (outcome.kind === "untrialable") {
    console.log(`[${copyText(copy)}] not trialed: ${outcome.reason}`);
    recordAttempt(logState, copy, untrialedAttempt(outcome.reason, new Date().toISOString()), outPath);
    return;
  }
  const listed = run.candidateSource.kind === "read" ? run.candidateSource.byName.get(name)?.get(copy.version) : undefined;
  if (run.candidateSource.kind === "read" && listed === undefined && opts.version === null) {
    console.log(`[${copyText(copy)}] the candidate source lists no candidates for ${name}@${copy.version}, so it is trialed against its own version only — rerun find-near-match-versions.mjs if the app changed`);
  }
  const candidates = opts.version !== null ? [opts.version] : [...new Set([copy.version, ...(listed ?? [])])];
  const swapDir = locationDir(app, location);

  for (const version of candidates) {
    const startedAt = new Date().toISOString();
    const attempt = trialAttempt(version, startedAt);
    const finish = () => {
      attempt.finishedAt = new Date().toISOString();
      recordAttempt(logState, copy, attempt, outPath);
    };

    console.log(`\n[${copyText(copy)}] Trying candidate ${version}`);

    const replacement = replacementOf(projectRoot, name, version);
    const install = installReplacement(opts.npm, replacement);
    if (!install.ok) {
      attempt.reason = `npm-install-failed:${install.detail}`;
      finish();
      continue;
    }

    const installed = packageAt(replacement.dir);
    if (!isInstalled(installed, name, version)) {
      attempt.reason = `installed-package-mismatch:${packageText(installed)}`;
      finish();
      continue;
    }

    // Write-ahead: the log names the original before it moves, so a run killed at any point after this write
    // leaves an in-flight entry the next run can undo exactly, and the gate refuses.
    const original = originalOf(copy, app);
    attempt.original = original;
    logState.copies[location] = inFlightEntry(logState.copies[location], copy, { attemptedVersion: version, startedAt, original });
    writeLog(outPath, logState);

    let setAsideDone = false;
    let verifierError = null;
    try {
      const beforeDir = originalDir(copy, original, app);
      setAside(copy, original, app);
      setAsideDone = true;
      fs.symlinkSync(rootLinkTarget(swapDir, replacement.dir), swapDir, "dir");
      attempt.swapApplied = true;

      // One file per copy and version: the location's own path parts under the verification dir.
      const verificationOutAbs = path.join(run.verificationDir, ...location.split("/"), `${encodeURIComponent(version)}.json`);
      const verified = runVerifySwap({
        verifyScript: run.verifyScript,
        pkgName: name,
        beforeDir,
        afterDir: swapDir,
        expectedVersion: version,
        threshold: opts.threshold,
        verificationOut: verificationOutAbs,
      });
      if (verified.kind === "error") {
        verifierError = verified.detail;
        attempt.reason = `verifier-error:${verified.detail}`;
      } else {
        attempt.verification = { path: toLogPath(outPath, verificationOutAbs), pass: verified.pass };
        Object.assign(attempt, verified.pass ? { result: "pass", reason: "verified" } : { result: "fail", reason: "verification-failed" });
      }
    } catch (error) {
      attempt.reason = `trial-error:${String(error?.message || error)}`;
    }

    if (attempt.result === "fail" && setAsideDone) {
      restoreOriginal(copy, original, app);
      attempt.rolledBack = true;
    }
    // A set-aside that threw may have made the backup's directories without moving anything into them.
    if (!setAsideDone) removeBackupRoots(copy, backupRootsOf(copy, original, app));
    finish();

    // [LAW:no-silent-failure] A verifier that gave no verdict would give none for any candidate after this one.
    if (verifierError !== null) {
      console.error(`Error: [${copyText(copy)}] ${run.verifyScript} gave no verdict on ${version}: ${verifierError} — the original is back; fix the verifier, then rerun`);
      process.exit(1);
    }
    if (attempt.result === "pass") {
      console.log(`[${copyText(copy)}] resolved with ${version}`);
      return;
    }
  }
  console.log(`[${copyText(copy)}] unresolved after ${candidates.length} candidate(s)`);
}

// Phase four: what the run leaves, and the exit status it implies. [LAW:one-source-of-truth] It is read from the tree
// as it is now, judged against the log: a copy is replaced exactly when its location holds the link to the replacement
// its resolved entry chose, and every path that loads any other copy of a requested package is named with what it
// loads. A copy that a container's swap took out of the app, logged or selected, is listed as retired, not unresolved.
function summarize(run, { found, selected, skipped, interrupted }) {
  const { app, logState, outPath, projectRoot, names, appDir } = run;
  const retired = new Map([...Object.entries(logState.copies).map(([location, { name }]) => ({ name, location })), ...selected]
    .filter(({ location }) => containerSwappedAt(app, location) !== null)
    .map(({ name, location }) => [location, { name, location }]));
  const unresolved = Object.entries(logState.copies)
    .filter(([location, entry]) => entry.status !== "resolved" && !retired.has(location))
    .map(([location, entry]) => ({ copy: { name: entry.name, location }, reason: entry.attempts.at(-1).reason }))
    .sort((a, b) => copyText(a.copy).localeCompare(copyText(b.copy)));

  const end = run.requestedCopies();
  const replaced = (copy) => {
    const entry = logState.copies[copy.location];
    return entry?.status === "resolved" && replacementHeld(app, projectRoot, copy.location, entry).kind === "held";
  };
  const loadsText = ({ location, outcome }) => {
    if (outcome.loads === null) return `nothing (${outcome.reason})`;
    const where = outcome.kind === "untrialable" && !outcome.appOwns ? `a copy outside the app at ${location}` : `the app's copy at ${location}`;
    return outcome.kind === "untrialable" ? `${where} (${outcome.reason})` : where;
  };
  const left = end.copies.filter((copy) => !replaced(copy));
  const leftovers = left.flatMap((copy) => copy.paths.map((start) => ({ name: copy.name, start, loads: loadsText(copy) })));
  // --location asks for one copy; otherwise every copy of the package, a path left loading nothing among them.
  const asked = (copy) => run.opts.location === null || selected.some(({ location }) => location === copy.location);
  const noCopy = names.filter((name) => !found.some((copy) => isCopyOf(copy, name)));
  const { unlisted, verdict } = end.walk;

  console.log(`\nLog: ${path.relative(projectRoot, outPath)}`);
  console.log(`- copies tracked: ${Object.keys(logState.copies).length}`);
  console.log(`- already resolved, skipped: ${skipped.length}`);
  console.log(`- interrupted trials recovered: ${interrupted.length}`);
  console.log(`- replaced with their container: ${retired.size}`);
  for (const copy of retired.values()) console.log(`  [${copyText(copy)}]`);
  console.log(`- unresolved copies: ${unresolved.length}`);
  for (const { copy, reason } of unresolved) console.log(`  [${copyText(copy)}] ${reason}`);
  console.log(`- requested packages with no copy in the directories it could list: ${noCopy.length}`);
  for (const name of noCopy) console.log(`  ${name}`);
  console.log(`- locations of requested packages loading something other than a replacement: ${leftovers.length}, not counting any inside the ${unlisted.length} directories it couldn't list`);
  for (const { name, start, loads } of leftovers) console.log(`  [${name}] ${start} loads ${loads}`);
  console.log("- directories it couldn't list:");
  for (const { path: dir, code } of unlisted) console.log(`  ${path.join(appDir, dir)} (${code})`);

  return left.some(asked) || verdict.kind !== "listed" ? 3 : 0;
}

function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.kind !== "run") {
    for (const error of parsed.kind === "invalid" ? parsed.errors : []) console.error(`Error: ${error}`);
    for (const line of USAGE) console.log(line);
    process.exit(parsed.kind === "help" ? 0 : 2);
  }
  const { opts } = parsed;

  const projectRoot = process.cwd();
  const appDir = path.resolve(projectRoot, opts.appDir);
  const appNodeModules = path.join(appDir, "node_modules");
  const outPath = path.resolve(projectRoot, opts.out);
  const verificationDir = path.resolve(projectRoot, opts.verificationDir);
  const candidateSourcePath = path.resolve(projectRoot, opts.candidateSource);

  const nodeModulesInput = inputAt(appNodeModules, "dir");
  if (nodeModulesInput.kind !== "dir") {
    console.error(`Error: ${appNodeModules} ${nodeModulesInput.reason} — --app-dir must name an extracted app with its node_modules`);
    process.exit(2);
  }
  if (realExisting(path.join(projectRoot, "node_modules")) === fs.realpathSync(appNodeModules)) {
    console.error(`Error: --app-dir ${appDir} is the project root, so npm would install over the app's own copies before the log records them — run from a project root outside the app`);
    process.exit(2);
  }
  // [LAW:no-ambient-temporal-coupling] Every tree a run changes is locked before it reads the log or any package:
  // the project's node_modules (npm writes it and package.json), the app's node_modules (renames, links, .original/),
  // the verification dir, and the log. Spellings that name one file are locked once, or the run would refuse itself;
  // locks are taken in path order, so of two runs wanting the same locks the one that loses is refused before it
  // holds any.
  const lockPaths = [
    path.join(projectRoot, "node_modules", ".replace-dependency.lock"),
    path.join(appNodeModules, ".replace-dependency.lock"),
    path.join(verificationDir, ".replace-dependency.lock"),
    `${outPath}.lock`,
  ];
  for (const lockPath of [...new Set(lockPaths.map(canonicalEntry))].sort()) lockTree(lockPath);

  const logState = loadLog(outPath);
  const candidateSource = loadCandidateSource(candidateSourcePath);
  if (candidateSource.kind === "absent") {
    if (opts.autoNearMatch) refuse([`--auto-near-match trials the packages ${candidateSourcePath} lists, and there is no file there — run find-near-match-versions.mjs to write it, or name it with --candidate-source`]);
    if (opts.version === null) console.log(`No candidate source at ${candidateSourcePath}: each copy is trialed against its own version only`);
  }
  const names = opts.pkg !== null ? [opts.pkg] : [...candidateSource.byName.keys()].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) refuse([`${candidateSourcePath} lists no packages, so --auto-near-match has nothing to trial`]);

  const app = { ...appAt(appNodeModules, projectRoot), backupsDir: path.join(appNodeModules, ".original"), logPath: outPath };
  const run = {
    app,
    appDir,
    logState,
    opts,
    outPath,
    projectRoot,
    names,
    candidateSource,
    verificationDir,
    verifyScript: path.resolve(projectRoot, opts.verifyScript),
    ctxOf: (copy) => ({ app, copy, projectRoot, deleteEntry: `delete the copy's entry (${copy.location}) from ${outPath}` }),
    // Every copy of a requested package, as the tree is now, and the walk that found them.
    requestedCopies: () => {
      const walk = walkStarts(app, names);
      return { walk, copies: copiesOf(app, walk.starts).filter((copy) => names.some((name) => isCopyOf(copy, name))) };
    },
  };

  const interrupted = recoverInterrupted(run);
  // Read from the tree recovery left, so a copy nested in a recovered original is among them.
  const found = run.requestedCopies().copies;
  const { selected, skipped, toTry } = selectCopies(run, found);
  for (const { copy, prior } of skipped) console.log(`[${copyText(copy)}] already resolved with ${prior.version}; skipped`);

  // [LAW:no-ambient-temporal-coupling] Read off the tree as each copy's trial starts: a copy nested in one an earlier
  // trial replaced went aside with it, so it is named, not trialed.
  for (const copy of toTry) {
    const container = containerSwappedAt(app, copy.location);
    if (container === null) trialCopy(run, copy);
    else console.log(`[${copyText(copy)}] replaced with its container ${container}: nothing in the app's node_modules loads it any more`);
  }

  process.exit(summarize(run, { found, selected, skipped, interrupted }));
}

main();
