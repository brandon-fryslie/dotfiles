//
// replacement-log.mjs — the contract for deps/replacements.json, the transaction log of dependency swaps.
// replace-dependency.mjs is its one writer; gate.mjs remove-deps reads it.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Every rule about the log's shape lives here and both tools
// import it. The gate used to re-check entries by hand, which is the paired-tool drift this module exists to end.
// [LAW:parse-dont-validate] readLog turns the file into entries whose status decides what they carry, so a
// resolved entry always has its one pass attempt and an in-flight entry always names its original.
//
// The log holds one entry per copy, keyed by the copy's location: its swap location, the one every consumer of the
// copy loads it through (node-modules.mjs's swapOutcome decides it). The key is the one place a location is stored.
// Every entry names the package the copy is (name: the one its location's package.json names, which differs from the
// name the location is reached by at an npm alias, or that name when it held none) and the version the app's copy is
// (version, null when the location held no
// copy of name that could be trialed, so only an unresolved entry can have none); by status it carries:
//   unresolved  { attempts }                       at least one attempt, and no pass
//   in-flight   { attempts, inFlight }             a trial was moving the original when the run ended
//   resolved    { attempts, chosenVersion, pass }  exactly one pass attempt, for chosenVersion
// The original of a trial (inFlight.original, a pass attempt's original) is what sat at the copy's location:
//   { kind: "dir",  backupPath }  a directory, renamed into .original/
//   { kind: "link", target }      a symlink; target is its readlink text
// Attempt, by reason:
//   "interrupted" { recovery: "original-in-place" | "restored", original }  disk alone can't say whether a swap
//                 happened and was undone before the kill, so it records only what disk showed
//   any other     { swapApplied, rolledBack, original | null, verification }  a trial this run saw end
// This module builds every entry and attempt the writer stores, so the shapes it writes are the shapes it parses.
//
// A location is node-modules.mjs's isLocation: a package's path relative to the app dir, as npm's lockfile spells
// one. Other stored paths (backupPath, verification.path) are relative to the log's directory, so a run from any
// cwd reads them the same way.

import path from "path";
import { isNonEmptyString, isPlainObject, JSON_SHAPE } from "./json-value.mjs";
import { readJson } from "./path-state.mjs";
import { isLocation } from "./node-modules.mjs";

export const SCHEMA_VERSION = 4;

const RECOVERIES = new Set(["original-in-place", "restored"]);

export function toLogPath(logPath, absPath) {
  return path.relative(path.dirname(logPath), absPath).split(path.sep).join("/");
}

export function fromLogPath(logPath, storedPath) {
  return path.resolve(path.dirname(logPath), storedPath);
}

export function emptyLog() {
  return { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), copies: {} };
}

// [LAW:single-enforcer] The attempts and entries replace-dependency stores, each in the shape parseEntry reads back.
export const trialAttempt = (attemptedVersion, startedAt) => ({
  attemptedVersion,
  startedAt,
  finishedAt: null,
  result: "fail",
  reason: "unknown",
  swapApplied: false,
  rolledBack: false,
  original: null,
  verification: { path: null, pass: false },
});

// A copy that was never trialed, and why.
export const untrialedAttempt = (reason, at) => ({ ...trialAttempt(null, at), finishedAt: at, reason });

export const interruptedAttempt = (inFlight, recovery, finishedAt) => ({
  attemptedVersion: inFlight.attemptedVersion,
  startedAt: inFlight.startedAt,
  finishedAt,
  result: "fail",
  reason: "interrupted",
  recovery,
  original: inFlight.original,
});

// The entry a copy has once attempt is appended to its prior entry's (or to none): resolved on a pass, unresolved
// otherwise, so a finished trial never stays in flight.
export function settledEntry(prior, copy, attempt) {
  const base = { name: copy.name, version: copy.version, attempts: [...(prior?.attempts ?? []), attempt] };
  return attempt.result === "pass" ? { ...base, status: "resolved", chosenVersion: attempt.attemptedVersion, pass: attempt } : { ...base, status: "unresolved" };
}

// The write-ahead record of a trial about to move the copy's original.
export const inFlightEntry = (prior, copy, inFlight) => ({ name: copy.name, version: copy.version, status: "in-flight", attempts: prior?.attempts ?? [], inFlight });

// The on-disk form of a parsed log: `pass` is a reference into `attempts`, so it is derived, never stored.
export function serializeLog(log) {
  const copies = Object.fromEntries(
    Object.entries(log.copies).map(([location, entry]) => [
      location,
      {
        name: entry.name,
        version: entry.version,
        status: entry.status,
        chosenVersion: entry.status === "resolved" ? entry.chosenVersion : null,
        attempts: entry.attempts,
        ...(entry.status === "in-flight" ? { inFlight: entry.inFlight } : {}),
      },
    ]),
  );
  return { schemaVersion: log.schemaVersion, createdAt: log.createdAt, updatedAt: new Date().toISOString(), copies };
}

const isString = (value) => typeof value === "string";

function originalError(original) {
  if (!isPlainObject(original)) return "original must be an object";
  if (original.kind === "dir") return isString(original.backupPath) ? null : "a dir original needs backupPath";
  if (original.kind === "link") return isString(original.target) ? null : "a link original needs target";
  return `original kind must be "dir" or "link", got ${JSON.stringify(original.kind)}`;
}

function attemptError(attempt) {
  if (!isPlainObject(attempt)) return "attempt must be an object";
  if (attempt.result !== "pass" && attempt.result !== "fail") return `result must be "pass" or "fail", got ${JSON.stringify(attempt.result)}`;
  if (attempt.reason === "interrupted") {
    if (attempt.result !== "fail") return "an interrupted attempt must be a fail";
    if (!RECOVERIES.has(attempt.recovery)) return `an interrupted attempt needs recovery "original-in-place" or "restored", got ${JSON.stringify(attempt.recovery)}`;
    return originalError(attempt.original);
  }
  if (typeof attempt.swapApplied !== "boolean" || typeof attempt.rolledBack !== "boolean") return "swapApplied and rolledBack must be booleans";
  if (!isPlainObject(attempt.verification)) return "verification must be an object";
  if (attempt.result === "fail") {
    // A failed undo leaves the entry in-flight instead, so a recorded fail whose swap stayed applied is corrupt.
    if (attempt.swapApplied && !attempt.rolledBack) return "rollback-missing";
    return attempt.original === null || attempt.original === undefined ? null : originalError(attempt.original);
  }
  if (!attempt.swapApplied || attempt.rolledBack) return "a pass must have its swap applied and kept";
  if (!isString(attempt.verification.path) || attempt.verification.pass !== true) return "a pass needs a passing verification with its path";
  return originalError(attempt.original);
}

function parseEntry(raw) {
  if (!isPlainObject(raw)) return { error: { type: "entry-type" } };
  if (!isNonEmptyString(raw.name) || !(raw.version === null || isNonEmptyString(raw.version))) {
    return { error: { type: "copy-name-invalid", detail: `an entry needs a name and a version (or null), got ${JSON.stringify({ name: raw.name, version: raw.version })}` } };
  }
  if (!Array.isArray(raw.attempts)) return { error: { type: "attempts-missing" } };
  for (const [index, attempt] of raw.attempts.entries()) {
    const error = attemptError(attempt);
    if (error === "rollback-missing") return { error: { type: "rollback-missing", attempt: index, attemptVersion: attempt.attemptedVersion } };
    if (error) return { error: { type: "attempt-invalid", attempt: index, detail: error } };
  }
  const passes = raw.attempts.filter((attempt) => attempt.result === "pass");
  if (raw.status !== "in-flight" && raw.inFlight !== undefined) return { error: { type: "in-flight-record-on-settled", status: raw.status } };
  // Only a copy that couldn't be trialed has no version, and an entry is unresolved after its first attempt.
  if (raw.version === null && (raw.status === "resolved" || raw.status === "in-flight")) return { error: { type: "copy-name-invalid", detail: `a ${raw.status} entry needs the version of the copy it trialed` } };
  if (raw.status === "unresolved" && raw.attempts.length === 0) return { error: { type: "attempts-missing", detail: "an unresolved entry records at least one attempt" } };

  if (raw.status === "resolved") {
    if (!isString(raw.chosenVersion)) return { error: { type: "resolved-missing-version" } };
    if (passes.length !== 1) return { error: { type: "resolved-success-count", successCount: passes.length } };
    if (passes[0].attemptedVersion !== raw.chosenVersion) return { error: { type: "resolved-version-mismatch", chosenVersion: raw.chosenVersion, passVersion: passes[0].attemptedVersion } };
    return { entry: { name: raw.name, version: raw.version, status: "resolved", attempts: raw.attempts, chosenVersion: raw.chosenVersion, pass: passes[0] } };
  }
  if (raw.status !== "unresolved" && raw.status !== "in-flight") return { error: { type: "status-invalid", status: raw.status ?? null } };
  if (passes.length > 0) return { error: { type: "unresolved-has-success", status: raw.status } };
  if (raw.status === "unresolved") return { entry: { name: raw.name, version: raw.version, status: "unresolved", attempts: raw.attempts } };

  const inFlight = raw.inFlight;
  if (!isPlainObject(inFlight) || !isString(inFlight.attemptedVersion) || !isString(inFlight.startedAt)) {
    return { error: { type: "in-flight-record-invalid", detail: "inFlight needs attemptedVersion and startedAt" } };
  }
  const error = originalError(inFlight.original);
  if (error) return { error: { type: "in-flight-record-invalid", detail: error } };
  return { entry: { name: raw.name, version: raw.version, status: "in-flight", attempts: raw.attempts, inFlight } };
}

// [LAW:single-enforcer] The log at logPath, as both its writer and the gate read it: { kind: "absent" } when nothing is
// there, { kind: "read", log } with every entry parsed into its status's shape, or { kind: "unusable", errors } naming
// each problem, so a log that is there but can't be read is never taken for no log. It is read through readJson, as
// every JSON input is.
export function readLog(logPath) {
  const read = readJson(logPath, JSON_SHAPE.object);
  if (read.kind === "absent") return { kind: "absent" };
  if (read.kind === "json") return parseLog(read.value, logPath);
  return { kind: "unusable", errors: [{ type: "replacements-unreadable", path: logPath, error: read.reason }] };
}

function parseLog(raw, logPath) {
  const unusable = (errors) => ({ kind: "unusable", errors });
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return unusable([{
      type: "schema-version",
      path: logPath,
      found: raw.schemaVersion ?? null,
      expected: SCHEMA_VERSION,
      detail: `an older replace-dependency wrote this log, and its records can't be read as this version's: put each swapped copy's original back over its link (backups are under the app's node_modules/.original/), or re-extract the app, then delete the log and rerun`,
    }]);
  }
  if (!isPlainObject(raw.copies)) return unusable([{ type: "replacements-copies-missing", path: logPath }]);

  const copies = {};
  const errors = [];
  for (const [location, rawEntry] of Object.entries(raw.copies)) {
    const { entry, error } = isLocation(location)
      ? parseEntry(rawEntry)
      : { error: { type: "location-invalid", detail: "an entry's key must be a location under node_modules/" } };
    if (error) errors.push({ ...error, location, package: isPlainObject(rawEntry) ? rawEntry.name ?? null : null });
    else copies[location] = entry;
  }
  if (errors.length > 0) return unusable(errors);
  return { kind: "read", log: { schemaVersion: raw.schemaVersion, createdAt: raw.createdAt, copies } };
}
