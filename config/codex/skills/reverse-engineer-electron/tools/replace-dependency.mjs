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
 * // [LAW:dataflow-not-control-flow] exception: a candidate stops at its first failing step (install, the root
 * //   package check, write-ahead, link, verify), because the steps after it have nothing to act on; its attempt records
 * //   the step and why, and a candidate that set its original aside is always rolled back.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { topLevelEntries } from "./node-modules.mjs";
import { emptyLog, fromLogPath, isLocation, parseLog, serializeLog, toLogPath } from "./replacement-log.mjs";

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

// [LAW:one-source-of-truth] One write appends the attempt and moves the entry to the status it implies, replacing
// any in-flight record — so the log never shows a finished trial still in flight.
function recordAttempt(logState, pkgName, attempt, logPath) {
  const attempts = [...(logState.packages[pkgName]?.attempts ?? []), attempt];
  logState.packages[pkgName] = attempt.result === "pass"
    ? { status: "resolved", attempts, chosenVersion: attempt.attemptedVersion, pass: attempt }
    : { status: "unresolved", attempts };
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

// [LAW:single-enforcer] The one constructor of a location, the form replacement-log.mjs parses: the path from a
// node_modules directory to a package in it, spelled from the app's node_modules. A package's own app path is its name
// under the app's node_modules, whatever its parents link to; a link's destination is a canonical path, measured
// from the app's real node_modules, so an app whose node_modules is itself a symlink still writes one.
function locationOf(nodeModules, dir) {
  const location = ["node_modules", ...path.relative(nodeModules, dir).split(path.sep)].join("/");
  if (!isLocation(location)) throw new Error(`${dir} is not inside ${nodeModules}`);
  return location;
}

function locationDir(app, location) {
  return path.join(app.nodeModules, ...location.split("/").slice(1));
}

// [LAW:one-source-of-truth] The swap location: where every consumer of the app's copy loads it through, read off
// disk the same way before, during, and after a swap. It is the app path, followed through each link to another
// location of the same package inside the app's node_modules, so for a pnpm layout, whose top-level link and .pnpm
// siblings all lead to one store copy, it is that copy's location. A link leading anywhere else (out of the app's
// node_modules, as a workspace package or our link to the root does, or to another package, as an alias does) is
// itself the swap location: nothing past it is ours to move. Links that loop are a value too, so the caller refuses
// them the way it refuses every other disk state it can't trial.
function findSwapLocation(pkgName, app) {
  const tail = `${path.sep}${path.join("node_modules", ...pkgPathParts(pkgName))}`;
  const chain = [locationOf(app.nodeModules, path.join(app.nodeModules, ...pkgPathParts(pkgName)))];
  for (;;) {
    const dir = locationDir(app, chain.at(-1));
    const state = appPathState(dir);
    const next = state.kind === "link" ? linkDestination(dir, state.target) : null;
    if (next === null || !next.startsWith(`${app.realNodeModules}${path.sep}`) || !next.endsWith(tail)) return { kind: "found", location: chain.at(-1) };
    const nextLocation = locationOf(app.realNodeModules, next);
    if (chain.includes(nextLocation)) return { kind: "loop", chain: [...chain, nextLocation] };
    chain.push(nextLocation);
  }
}

// Every location in the app's node_modules a package can load from, by package name: the top-level entries of each
// node_modules directory found by walking real directories. Links are listed but never descended, so a link cycle
// cannot loop the walk; .original/ holds set-aside backups nothing loads.
function locationsByName(app) {
  const byName = new Map();
  const walk = (dir) => {
    if (path.basename(dir) === "node_modules") {
      for (const entry of topLevelEntries(dir)) byName.set(entry.name, [...(byName.get(entry.name) ?? []), locationOf(app.nodeModules, entry.dir)]);
    }
    for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
      const childDir = path.join(dir, child.name);
      if (child.isDirectory() && childDir !== app.backupsDir) walk(childDir);
    }
  };
  walk(app.nodeModules);
  return byName;
}

// [LAW:one-source-of-truth] What a resolved package's locations load, read from the tree as it is now, never stored:
// each location that loads a copy other than the root package, and each that loads nothing (a link left dangling).
function copiesLeft(pkgName, locations, rootPkgDir, app) {
  const root = fs.realpathSync(rootPkgDir);
  const loads = (location) => {
    const dir = locationDir(app, location);
    if (!fs.existsSync(dir)) return "nothing";
    return fs.realpathSync(dir) === root ? "root" : "another copy";
  };
  return (locations.get(pkgName) ?? []).map((location) => ({ location, loads: loads(location) })).filter(({ loads }) => loads !== "root");
}

// The link this tool writes at a swap location.
function rootLinkTarget(dir, rootPkgDir) {
  return path.relative(fs.realpathSync(path.dirname(dir)), canonicalEntry(rootPkgDir));
}

// [LAW:one-source-of-truth] Whether a swap location holds our link is read off disk, one way for every log status:
// it is ours exactly when it leads to the root entry this tool links to.
function isOurLink(state, dir, rootPkgDir) {
  return state.kind === "link" && linkDestination(dir, state.target) === canonicalEntry(rootPkgDir);
}

// Decided before anything moves, and written into the log as the trial's in-flight record. Nothing is created here:
// setAside makes the backup's directories, so a trial that never moves the original leaves nothing under .original/.
function originalOf(location, pkgName, app) {
  const dir = locationDir(app, location);
  const state = appPathState(dir);
  if (state.kind === "link") return { kind: "link", location, target: state.target };
  if (state.kind === "absent") throw new Error(`[${pkgName}] nothing is at ${dir} to set aside`);
  // [LAW:types-are-the-program] The UUID makes each trial's backup root unique by construction; a bare per-second
  // stamp collided when a retrial landed in the same second as an earlier swap.
  const backupRoot = path.join(app.backupsDir, `${safeNowStamp()}-${randomUUID()}`);
  return { kind: "dir", location, backupPath: toLogPath(app.logPath, path.join(backupRoot, ...pkgPathParts(pkgName))) };
}

// The directory holding the original's files. A link original is never moved, so it is read where it points.
function originalDir(original, app) {
  if (original.kind === "dir") return fromLogPath(app.logPath, original.backupPath);
  return linkDestination(locationDir(app, original.location), original.target);
}

function describeOriginal(original, logPath) {
  if (original.kind === "dir") return `the original at ${fromLogPath(logPath, original.backupPath)}`;
  return `a symlink to ${original.target}`;
}

function setAside(original, app) {
  const dir = locationDir(app, original.location);
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
function backupRootsOf(pkgName, original, app) {
  if (original.kind !== "dir") return [];
  const root = path.join(fromLogPath(app.logPath, original.backupPath), ...pkgPathParts(pkgName).map(() => ".."));
  if (path.dirname(root) !== app.backupsDir) throw new Error(`[${pkgName}] backup root ${root} is not under ${app.backupsDir}; refusing to delete it`);
  return [root];
}

// The original is already where it belongs when this runs, so a failure here is reported as the leftover it is.
function removeBackupRoots(pkgName, roots) {
  for (const root of roots) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error: [${pkgName}] the original is in place, but its backup root ${root} could not be removed: ${error.message} — remove it, then rerun`);
      process.exit(1);
    }
  }
}

// [LAW:single-enforcer] The one undo, for a failed verification, a trial error, and an interrupted run alike. The
// swap location holds our link or nothing; rmSync without `recursive` throws on a directory instead of deleting it.
// [LAW:no-silent-failure] Every caller reaches here with the package's entry in flight on disk, so an undo that
// fails stops the run and leaves that record for the next run to recover from.
function restoreOriginal(pkgName, original, app) {
  const dir = locationDir(app, original.location);
  const roots = backupRootsOf(pkgName, original, app);
  try {
    fs.rmSync(dir, { force: true });
    if (original.kind === "dir") fs.renameSync(fromLogPath(app.logPath, original.backupPath), dir);
    else fs.symlinkSync(original.target, dir, "dir");
  } catch (error) {
    console.error(`Error: [${pkgName}] could not restore ${describeOriginal(original, app.logPath)} to ${dir}: ${error.message} — ${app.logPath} keeps the trial in flight; fix the cause and rerun to recover`);
    process.exit(1);
  }
  removeBackupRoots(pkgName, roots);
}

// An in-flight entry, read against disk at the location it records. "original-in-place": the original never moved, or
// was already put back. "restored": the original is set aside and restorable. Anything else can't be undone safely,
// so the run refuses.
function classifyInterrupted(inFlight, state, ours, ctx) {
  const { original } = inFlight;
  const { dir } = ctx;
  const trial = `an interrupted trial of ${inFlight.attemptedVersion}`;
  const interrupted = (recovery) => ({ kind: "interrupted", recovery, inFlight, swapLocation: original.location });
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
    return conflict(`${trial} left the original at ${backup}, but ${dir} is a link this tool did not make (-> ${state.target}) — put the original back at ${dir}, then ${ctx.deleteEntry}`);
  }
  if (state.kind === "link" && state.target === original.target) return interrupted("original-in-place");
  if (state.kind === "absent" || ours) return interrupted("restored");
  const found = state.kind === "dir" ? "a directory" : `a link to ${state.target}`;
  return conflict(`${trial} set aside the link at ${dir} to ${original.target}, but ${dir} now holds ${found} — put the link back, then ${ctx.deleteEntry}`);
}

// [LAW:one-source-of-truth] A log status of "resolved" records a swap that already happened, so a rerun must
// not trial the package again (the log allows exactly one pass per resolved package). Disk has to agree with the
// record in both directions — the app path still leads to the location the record swapped, and that location holds
// our link — and when it doesn't, neither side can be trusted to win, so the run refuses and names the way out.
// [LAW:no-silent-failure]
function priorSwap(entry, ctx, requestedVersion) {
  const status = entry?.status ?? "unresolved";
  const found = findSwapLocation(ctx.pkgName, ctx.app);
  if (found.kind === "loop") return { kind: "conflict", reason: `the app's links loop, so no copy of it loads: ${found.chain.join(" -> ")} — fix the links, then rerun` };
  const current = locationDir(ctx.app, found.location);
  if (status === "unresolved") {
    if (!isOurLink(appPathState(current), current, ctx.rootPkgDir)) return { kind: "untried", swapLocation: found.location };
    // Trialing our own link would verify the root package against itself and record a made-up original.
    return { kind: "conflict", reason: `${current} already links to the root package, but ${ctx.app.logPath} records no resolved swap for it — put the original back over the link first (earlier backups are under ${ctx.app.backupsDir}), then rerun` };
  }

  const recorded = status === "in-flight" ? entry.inFlight.original : entry.pass.original;
  const dir = locationDir(ctx.app, recorded.location);
  if (found.location !== recorded.location) {
    return { kind: "conflict", reason: `the log records the ${status} swap at ${dir}, but ${ctx.appPkgDir} now leads to ${current} — make it lead to ${dir} again, then rerun` };
  }
  const state = appPathState(dir);
  const ours = isOurLink(state, dir, ctx.rootPkgDir);
  if (status === "in-flight") return classifyInterrupted(entry.inFlight, state, ours, { ...ctx, dir });

  const chosen = entry.chosenVersion;
  if (!ours) {
    return { kind: "conflict", reason: `resolved with ${chosen} in the log, but ${dir} is not linked to the root package (re-extracted app with an old log?) — to trial this app copy, ${ctx.deleteEntry}` };
  }
  const restore = `to trial it again, replace the link at ${dir} with ${describeOriginal(entry.pass.original, ctx.app.logPath)} and ${ctx.deleteEntry}`;
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
  const packageList = determinePackageList(opts, candidateSource);
  if (packageList.length === 0) {
    console.error("No package candidates resolved. Provide --pkg or --auto-near-match with candidate source.");
    process.exit(2);
  }

  const app = { nodeModules: appNodeModules, realNodeModules: fs.realpathSync(appNodeModules), backupsDir: path.join(appNodeModules, ".original"), logPath: outPath };
  const appPkgDirOf = (pkgName) => path.join(appNodeModules, ...pkgPathParts(pkgName));
  const rootPkgDirOf = (pkgName) => path.join(projectRoot, "node_modules", ...pkgPathParts(pkgName));

  // Every in-flight entry is settled, requested or not: an unrequested one still has its original set aside.
  const inFlightElsewhere = Object.keys(logState.packages).filter((pkgName) => logState.packages[pkgName].status === "in-flight" && !packageList.includes(pkgName));
  const priors = [...packageList, ...inFlightElsewhere].map((pkgName) => ({
    pkgName,
    prior: priorSwap(
      logState.packages[pkgName],
      { pkgName, appPkgDir: appPkgDirOf(pkgName), rootPkgDir: rootPkgDirOf(pkgName), app, deleteEntry: `delete the package's entry from ${outPath}` },
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
    if (recovery === "restored") restoreOriginal(pkgName, inFlight.original, app);
    else removeBackupRoots(pkgName, backupRootsOf(pkgName, inFlight.original, app));
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

  const toTry = priors.filter(({ pkgName, prior }) => packageList.includes(pkgName) && (prior.kind === "untried" || prior.kind === "interrupted"));

  for (const { pkgName, prior: { swapLocation } } of toTry) {
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

    const swapDir = locationDir(app, swapLocation);
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

      console.log(`\n[${pkgName}] Trying candidate ${version} at ${swapLocation}`);

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
      const original = originalOf(swapLocation, pkgName, app);
      attempt.original = original;
      logState.packages[pkgName] = {
        status: "in-flight",
        attempts: logState.packages[pkgName]?.attempts ?? [],
        inFlight: { attemptedVersion: version, startedAt, original },
      };
      writeLog(outPath, logState);

      let setAsideDone = false;
      try {
        const beforeDir = originalDir(original, app);
        setAside(original, app);
        setAsideDone = true;
        fs.symlinkSync(rootLinkTarget(swapDir, rootPkgDir), swapDir, "dir");
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
        Object.assign(attempt, verificationPass
          ? { result: "pass", reason: "verified" }
          : { result: "fail", reason: "verification-failed" });
      } catch (error) {
        attempt.reason = `trial-error:${String(error?.message || error)}`;
      }

      if (attempt.result === "fail" && setAsideDone) {
        restoreOriginal(pkgName, original, app);
        attempt.rolledBack = true;
      }
      // A set-aside that threw may have made the backup's directories without moving anything into them.
      if (!setAsideDone) removeBackupRoots(pkgName, backupRootsOf(pkgName, original, app));
      finish();

      if (attempt.result === "pass") {
        resolved = true;
        console.log(`[${pkgName}] resolved with ${version} at ${swapLocation}`);
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
  // A resolved package's swap replaces one copy; any other copy of it the app ships is named here, read from the tree
  // the run leaves behind.
  const locations = locationsByName(app);
  const copies = packageList
    .filter((pkgName) => logState.packages[pkgName]?.status === "resolved")
    .flatMap((pkgName) => copiesLeft(pkgName, locations, rootPkgDirOf(pkgName), app).map((copy) => ({ pkgName, ...copy })));
  console.log(`- locations of resolved packages loading something other than the root package: ${copies.length}`);
  for (const { pkgName, location, loads } of copies) console.log(`  [${pkgName}] ${location} loads ${loads}`);

  process.exit(0);
}

main();
