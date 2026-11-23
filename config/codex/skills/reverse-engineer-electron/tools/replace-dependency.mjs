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
import { emptyLog, fromLogPath, parseLog, serializeLog, toLogPath } from "./replacement-log.mjs";
import { REPLACEMENT_SCOPE, appAt, appPathState, canonicalEntry, copiesOf, describeEntry, isInside, linkDestination, locationDir, locationOf, packageAt, pathState, pkgPathParts, realExisting, replacementOf, stateText, swapOutcome, walkStarts } from "./node-modules.mjs";

function parseArgs(argv) {
  const opts = {
    appDir: "resources/app",
    pkg: "",
    location: "",
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
    else if (arg === "--location") opts.location = argv[++i] || "";
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

function installReplacement(npmBin, replacement) {
  const res = spawnSync(npmBin, ["install", "--silent", "--no-progress", "--save-exact", replacement.spec], {
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

// [LAW:parse-dont-validate] The candidate source as replace-dependency reads it: each package name it lists, mapped
// from the exact version a copy of it is on disk to the versions to trial that copy against. A name it lists with no
// copy on disk has no versions, and is still a name the run is asked about.
function loadCandidateSource(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const parsed = readJson(filePath);
  if (!Array.isArray(parsed?.packages)) {
    console.error(`Error: ${filePath} has no packages list — rerun find-near-match-versions.mjs to write it`);
    process.exit(2);
  }
  const byName = new Map();
  for (const item of parsed.packages) {
    const versions = byName.get(item.name) ?? new Map();
    byName.set(item.name, versions);
    if (item.onDiskVersion === null) continue;
    if (versions.has(item.onDiskVersion)) {
      console.error(`Error: ${filePath} lists ${item.name}@${item.onDiskVersion} twice — rerun find-near-match-versions.mjs to write it`);
      process.exit(2);
    }
    versions.set(item.onDiskVersion, item.candidates.map((candidate) => candidate.version));
  }
  return byName;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function loadLog(logPath) {
  if (!fs.existsSync(logPath)) return emptyLog();
  const parsed = parseLog(fs.readFileSync(logPath, "utf8"), logPath);
  if (parsed.ok) return parsed.log;
  for (const error of parsed.errors) console.error(`Error: ${logPath}: ${JSON.stringify(error)}`);
  process.exit(2);
}

function writeLog(logPath, logState) {
  writeJson(logPath, serializeLog(logState));
}

// A copy as the log and the console name it: { name, location, version }, version the app copy's own or null.
const copyText = (copy) => `${copy.name} ${copy.location}`;

// [LAW:one-source-of-truth] One write appends the attempt and moves the copy's entry to the status it implies,
// replacing any in-flight record — so the log never shows a finished trial still in flight.
function recordAttempt(logState, copy, attempt, logPath) {
  const base = { name: copy.name, version: copy.version, attempts: [...(logState.copies[copy.location]?.attempts ?? []), attempt] };
  logState.copies[copy.location] = attempt.result === "pass"
    ? { ...base, status: "resolved", chosenVersion: attempt.attemptedVersion, pass: attempt }
    : { ...base, status: "unresolved" };
  writeLog(logPath, logState);
}

// Whether packageAt's answer for a replacement directory is pkgName at version, and that answer as text.
const isInstalled = (root, pkgName, version) => root.kind === "package" && root.name === pkgName && root.version === version;
const packageText = (state) => state.kind === "package" ? `${state.name}@${state.version}` : stateText(state);

// The link this tool writes at a copy's location.
function rootLinkTarget(dir, replacementDir) {
  return path.relative(fs.realpathSync(path.dirname(dir)), canonicalEntry(replacementDir));
}

// [LAW:one-source-of-truth] Whether a location holds our link is read off disk, one way for every log status: it is
// a link to a replacement exactly when it leads into the project's replacement scope, and to the replacement for
// name@version exactly when it leads to that one.
const linkedTo = (state, dir) => (state.kind === "link" ? linkDestination(dir, state.target) : null);
const isLinkTo = (state, dir, replacementDir) => linkedTo(state, dir) === canonicalEntry(replacementDir);
const holdsReplacement = (state, dir, scopeDir) => linkedTo(state, dir) !== null && path.dirname(linkedTo(state, dir)) === realExisting(scopeDir);

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
    const backupPresent = fs.existsSync(backup);
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
// [LAW:no-silent-failure]
function priorSwap(entry, ctx, requestedVersion) {
  const { app, copy, projectRoot } = ctx;
  const outcome = swapOutcome(app, copy.location, copy.name);
  const dir = locationDir(app, copy.location);
  const why = outcome.kind === "untrialable" ? ` (${outcome.reason})` : "";
  if (outcome.kind === "untrialable" && !outcome.appOwns) {
    return { kind: "conflict", reason: `the log records the ${entry.status} swap at ${dir}, but that copy can't be swapped (${outcome.reason}), so undoing it would touch files the app doesn't own — put the original back by hand, then ${ctx.deleteEntry}` };
  }
  if (outcome.location !== copy.location) {
    return { kind: "conflict", reason: `the log records the ${entry.status} swap at ${dir}, but ${dir} now leads on to ${locationDir(app, outcome.location)}${why} — put back what the swap left at ${dir}, then rerun` };
  }
  const state = appPathState(dir);
  if (entry.status === "in-flight") {
    const ours = isLinkTo(state, dir, replacementOf(projectRoot, copy.name, entry.inFlight.attemptedVersion).dir);
    return classifyInterrupted(entry.inFlight, state, ours, { ...ctx, dir });
  }

  const chosen = entry.chosenVersion;
  const replacement = replacementOf(projectRoot, copy.name, chosen);
  if (!isLinkTo(state, dir, replacement.dir)) {
    return { kind: "conflict", reason: `resolved with ${chosen} in the log, but ${dir} is not linked to its replacement${why} (re-extracted app with an old log?) — to trial this app copy, ${ctx.deleteEntry}` };
  }
  const restore = `to trial it again, replace the link at ${dir} with ${describeOriginal(entry.pass.original, app.logPath)} and ${ctx.deleteEntry}`;
  if (requestedVersion && requestedVersion !== chosen) {
    return { kind: "conflict", reason: `already resolved with ${chosen}; --version ${requestedVersion} is a retrial — ${restore}` };
  }
  const root = packageAt(replacement.dir);
  if (!isInstalled(root, copy.name, chosen)) {
    return { kind: "conflict", reason: `resolved with ${chosen}, but its replacement ${replacement.dir} is now ${packageText(root)} — reinstall it (npm install ${replacement.spec}), or ${restore}` };
  }
  return { kind: "resolved", version: chosen };
}

// Each conflict a set of priors holds, as the line the run refuses with.
const conflictsOf = (priors) => priors.filter(({ prior }) => prior.kind === "conflict").map(({ copy, prior }) => `[${copyText(copy)}] ${prior.reason}`);

// A run with any reason to refuse names every one, and stops before it moves anything more.
function refuse(reasons) {
  for (const reason of reasons) console.error(`Error: ${reason}`);
  if (reasons.length > 0) process.exit(2);
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help || (!opts.pkg && !opts.autoNearMatch)) {
    console.log("Usage:");
    console.log("  node replace-dependency.mjs --pkg <name> [--location <loc>] [--version <x.y.z>] [--app-dir resources/app]");
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

  if (!fs.existsSync(appNodeModules)) {
    console.error(`Error: ${appNodeModules} does not exist — --app-dir must name an extracted app with its node_modules`);
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
  for (const lockPath of unique(lockPaths.map(canonicalEntry)).sort()) lockTree(lockPath);

  const logState = loadLog(outPath);

  const candidateSource = loadCandidateSource(candidateSourcePath);
  const names = opts.pkg ? [opts.pkg] : [...candidateSource.keys()].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    console.error("No package candidates resolved. Provide --pkg or --auto-near-match with candidate source.");
    process.exit(2);
  }
  const requestedVersion = opts.pkg ? opts.version : "";

  const app = { ...appAt(appNodeModules), backupsDir: path.join(appNodeModules, ".original"), logPath: outPath };
  const scopeDir = path.join(projectRoot, "node_modules", REPLACEMENT_SCOPE);
  const ctxOf = (copy) => ({ app, copy, projectRoot, deleteEntry: `delete the copy's entry (${copy.location}) from ${outPath}` });

  // The starts of every requested name, as the tree is now: each one the walk finds, and the app path node resolves
  // without listing anything, kept when it holds something.
  const requestedStarts = () => {
    const walked = walkStarts(app);
    const appPaths = names.map((name) => ({ name, start: locationOf(app.nodeModules, path.join(app.nodeModules, ...pkgPathParts(name))) }));
    const starts = [...walked.starts.filter(({ name }) => names.includes(name)), ...appPaths]
      .filter(({ start }, index, all) => all.findIndex((other) => other.start === start) === index)
      .filter(({ start }) => appPathState(locationDir(app, start)).kind !== "absent");
    return { starts, unlisted: walked.unlisted };
  };
  const requestedCopies = () => copiesOf(app, requestedStarts().starts);

  // Every in-flight entry is settled first, requested or not: an unrequested one still has its original set aside.
  // [LAW:no-ambient-temporal-coupling] Its record names its location, so it is read off the log, before anything moves.
  const inFlight = Object.entries(logState.copies)
    .filter(([, entry]) => entry.status === "in-flight")
    .map(([location, entry]) => {
      const copy = { name: entry.name, location, version: entry.version };
      return { copy, prior: priorSwap(entry, ctxOf(copy), "") };
    });
  refuse(conflictsOf(inFlight));

  // Recovery: settle every interrupted trial before any new one starts.
  const interrupted = inFlight.filter(({ prior }) => prior.kind === "interrupted");
  for (const { copy, prior } of interrupted) {
    const { recovery, inFlight: record } = prior;
    if (recovery === "restored") restoreOriginal(copy, record.original, app);
    else removeBackupRoots(copy, backupRootsOf(copy, record.original, app));
    recordAttempt(logState, copy, {
      attemptedVersion: record.attemptedVersion,
      startedAt: record.startedAt,
      finishedAt: new Date().toISOString(),
      result: "fail",
      reason: "interrupted",
      recovery,
      original: record.original,
    }, outPath);
    const outcome = recovery === "restored" ? `restored ${describeOriginal(record.original, outPath)}` : "the original was still in place";
    console.log(`[${copyText(copy)}] interrupted trial of ${record.attemptedVersion}: ${outcome}`);
  }

  // [LAW:no-ambient-temporal-coupling] The copies this run trials are read from the tree recovery left, so a copy
  // nested in a recovered original is among them.
  const found = requestedCopies();
  const selected = opts.location === "" ? found : found.filter(({ location, paths }) => location === opts.location || paths.includes(opts.location));
  if (selected.length === 0 && opts.location !== "") {
    refuse([`--location ${opts.location} is not where any copy of ${names.join(", ")} is reached; its copies are at ${found.map(({ location }) => location).join(", ") || "no location"}`]);
  }

  // Every recorded swap of a selected copy is checked against disk, and every untried one is checked for a link this
  // tool would have written, before any trial moves anything.
  const priors = selected.map((copy) => {
    const entry = logState.copies[copy.location];
    const logged = { name: copy.name, location: copy.location, version: entry?.version ?? null };
    if (entry?.status === "resolved") return { copy: logged, prior: priorSwap(entry, ctxOf(logged), requestedVersion) };
    const dir = locationDir(app, copy.location);
    if (!holdsReplacement(appPathState(dir), dir, scopeDir)) return { copy: logged, prior: { kind: "untried" } };
    // Trialing our own link would verify a replacement against itself and record a made-up original.
    return { copy: logged, prior: { kind: "conflict", reason: `${dir} already links to a replacement, but ${outPath} records no resolved swap for it — put the original back over the link first (earlier backups are under ${app.backupsDir}), then rerun` } };
  });
  refuse(conflictsOf(priors));
  const skipped = priors.filter(({ prior }) => prior.kind === "resolved");
  for (const { copy, prior } of skipped) console.log(`[${copyText(copy)}] already resolved with ${prior.version}; skipped`);

  const toTry = selected.filter((copy) => priors.find((prior) => prior.copy.location === copy.location).prior.kind === "untried");
  const versions = unique(toTry.map(({ outcome }) => outcome.loads?.version));
  if (requestedVersion && versions.length > 1) {
    refuse([`--version ${requestedVersion} names one version, but ${opts.pkg}'s copies are ${toTry.map(({ location, outcome }) => `${location} (${outcome.loads?.version ?? "no version"})`).join(", ")} — choose one with --location`]);
  }

  const retired = [];
  for (const { name, location } of toTry) {
    // [LAW:no-ambient-temporal-coupling] Read as this copy's trial starts, from the tree recovery and every earlier
    // trial of this run left: a trial acts on the disk it reads, never on one read before something else moved. A
    // location that is no longer a copy left the app's load graph with a container an earlier trial replaced.
    const current = requestedCopies().find((copy) => copy.location === location);
    if (current === undefined) {
      retired.push({ name, location });
      console.log(`[${name} ${location}] replaced with its container: nothing in the app's node_modules loads it any more`);
      continue;
    }
    const { outcome } = current;
    const copy = { name, location, version: outcome.kind === "trialable" ? outcome.loads.version : null };

    const untrialable = (reason) => {
      console.log(`[${copyText(copy)}] not trialed: ${reason}`);
      const now = new Date().toISOString();
      recordAttempt(logState, copy, {
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
    if (outcome.kind === "untrialable") {
      untrialable(outcome.reason);
      continue;
    }
    const candidates = requestedVersion ? [requestedVersion] : unique([copy.version, ...(candidateSource.get(name)?.get(copy.version) ?? [])]);

    const swapDir = locationDir(app, location);
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
        recordAttempt(logState, copy, attempt, outPath);
      };

      console.log(`\n[${copyText(copy)}] Trying candidate ${version}`);

      const replacement = replacementOf(projectRoot, name, version);
      if (!installReplacement(opts.npm, replacement)) {
        attempt.reason = "npm-install-failed";
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
      logState.copies[location] = {
        name,
        version: copy.version,
        status: "in-flight",
        attempts: logState.copies[location]?.attempts ?? [],
        inFlight: { attemptedVersion: version, startedAt, original },
      };
      writeLog(outPath, logState);

      let setAsideDone = false;
      try {
        const beforeDir = originalDir(copy, original, app);
        setAside(copy, original, app);
        setAsideDone = true;
        fs.symlinkSync(rootLinkTarget(swapDir, replacement.dir), swapDir, "dir");
        attempt.swapApplied = true;

        // One file per copy and version: the location's own path parts under the verification dir.
        const verificationOutAbs = path.join(verificationDir, ...location.split("/"), `${encodeURIComponent(version)}.json`);
        const verificationPass = runVerifySwap({
          verifyScript,
          pkgName: name,
          beforeDir,
          afterDir: swapDir,
          expectedVersion: version,
          threshold: opts.threshold,
          verificationOut: verificationOutAbs,
        });
        attempt.verification = { path: toLogPath(outPath, verificationOutAbs), pass: verificationPass };
        Object.assign(attempt, verificationPass
          ? { result: "pass", reason: "verified" }
          : { result: "fail", reason: "verification-failed" });
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

      if (attempt.result === "pass") {
        resolved = true;
        console.log(`[${copyText(copy)}] resolved with ${version}`);
        break;
      }
    }

    if (!resolved) {
      console.log(`[${copyText(copy)}] unresolved after ${candidates.length} candidate(s)`);
    }
  }

  // [LAW:one-source-of-truth] What the run leaves is read from the tree as it is now, never stored: every start of a
  // requested package that loads something other than a replacement (an app copy, a copy outside the app, or nothing).
  const unresolved = Object.entries(logState.copies)
    .filter(([, entry]) => entry.status !== "resolved")
    .map(([location, entry]) => ({ copy: { name: entry.name, location }, reason: entry.attempts.at(-1).reason }))
    .sort((a, b) => copyText(a.copy).localeCompare(copyText(b.copy)));
  const end = requestedStarts();
  const loads = (start) => {
    const dir = locationDir(app, start);
    const state = pathState(dir);
    if (state.kind !== "dir") return `nothing (${stateText(state)})`;
    const real = fs.realpathSync(dir);
    if (path.dirname(real) === realExisting(scopeDir)) return null;
    return isInside(app, real) ? `the app's copy at ${locationOf(app.realNodeModules, real)}` : `a copy outside the app at ${real}`;
  };
  const leftovers = end.starts.map(({ name, start }) => ({ name, start, loads: loads(start) })).filter(({ loads: what }) => what !== null);
  const noCopy = names.filter((name) => !found.some((copy) => copy.name === name));

  console.log(`\nLog: ${path.relative(projectRoot, outPath)}`);
  console.log(`- copies tracked: ${Object.keys(logState.copies).length}`);
  console.log(`- already resolved, skipped: ${skipped.length}`);
  console.log(`- interrupted trials recovered: ${interrupted.length}`);
  console.log(`- replaced with their container: ${retired.length}`);
  for (const copy of retired) console.log(`  [${copyText(copy)}]`);
  console.log(`- unresolved copies: ${unresolved.length}`);
  for (const { copy, reason } of unresolved) console.log(`  [${copyText(copy)}] ${reason}`);
  console.log(`- requested packages with no copy in the app: ${noCopy.length}`);
  for (const name of noCopy) console.log(`  ${name}`);
  console.log(`- locations of requested packages loading something other than a replacement: ${leftovers.length}, not counting any inside the ${end.unlisted.length} directories it couldn't list`);
  for (const { name, start, loads: what } of leftovers) console.log(`  [${name}] ${start} loads ${what}`);
  console.log("- directories it couldn't list:");
  for (const { path: dir, code } of end.unlisted) console.log(`  ${path.join(appDir, dir)} (${code})`);

  process.exit(0);
}

main();
