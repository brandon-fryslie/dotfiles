//
// replacement-log.mjs — the contract for deps/replacements.json, the transaction log of dependency swaps.
// replace-dependency.mjs is its one writer; gate.mjs remove-deps reads it.
//
// [LAW:one-source-of-truth] [LAW:single-enforcer] Every rule about the log's shape lives here and both tools
// import it. The gate used to re-check entries by hand, which is the paired-tool drift this module exists to end.
// [LAW:parse-dont-validate] parseLog turns the file into entries whose status decides what they carry, so a
// resolved entry always has its one pass attempt and an in-flight entry always names its original.
//
// Entry, by status:
//   unresolved  { attempts }                       no pass attempt
//   in-flight   { attempts, inFlight }             a trial was moving the original when the run ended
//   resolved    { attempts, chosenVersion, pass }  exactly one pass attempt, for chosenVersion
// The original of a trial (inFlight.original, a pass attempt's original):
//   { kind: "dir",  backupPath }  the app copy was a directory, renamed into .original/
//   { kind: "link", target }      the app path was already a symlink; target is its readlink text
// Attempt, by reason:
//   "interrupted" { recovery: "original-in-place" | "restored", original }  disk alone can't say whether a swap
//                 happened and was undone before the kill, so it records only what disk showed
//   any other     { swapApplied, rolledBack, original | null, verification }  a trial this run saw end
//
// Stored paths (backupPath, verification.path) are relative to the log's directory, so a run from any cwd reads
// them the same way.

import path from "path";

export const SCHEMA_VERSION = 2;

const RECOVERIES = new Set(["original-in-place", "restored"]);

export function toLogPath(logPath, absPath) {
  return path.relative(path.dirname(logPath), absPath).split(path.sep).join("/");
}

export function fromLogPath(logPath, storedPath) {
  return path.resolve(path.dirname(logPath), storedPath);
}

export function emptyLog() {
  return { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), packages: {}, events: [] };
}

// The on-disk form of a parsed log: `pass` is a reference into `attempts`, so it is derived, never stored.
export function serializeLog(log) {
  const packages = Object.fromEntries(
    Object.entries(log.packages).map(([name, entry]) => [
      name,
      {
        status: entry.status,
        chosenVersion: entry.status === "resolved" ? entry.chosenVersion : null,
        attempts: entry.attempts,
        ...(entry.status === "in-flight" ? { inFlight: entry.inFlight } : {}),
      },
    ]),
  );
  return { schemaVersion: log.schemaVersion, createdAt: log.createdAt, updatedAt: new Date().toISOString(), packages, events: log.events };
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value) => typeof value === "string";

function originalError(original) {
  if (!isObject(original)) return "original must be an object";
  if (original.kind === "dir") return isString(original.backupPath) ? null : "a dir original needs backupPath";
  if (original.kind === "link") return isString(original.target) ? null : "a link original needs target";
  return `original kind must be "dir" or "link", got ${JSON.stringify(original.kind)}`;
}

function attemptError(attempt) {
  if (!isObject(attempt)) return "attempt must be an object";
  if (attempt.result !== "pass" && attempt.result !== "fail") return `result must be "pass" or "fail", got ${JSON.stringify(attempt.result)}`;
  if (attempt.reason === "interrupted") {
    if (attempt.result !== "fail") return "an interrupted attempt must be a fail";
    if (!RECOVERIES.has(attempt.recovery)) return `an interrupted attempt needs recovery "original-in-place" or "restored", got ${JSON.stringify(attempt.recovery)}`;
    return originalError(attempt.original);
  }
  if (typeof attempt.swapApplied !== "boolean" || typeof attempt.rolledBack !== "boolean") return "swapApplied and rolledBack must be booleans";
  if (!isObject(attempt.verification)) return "verification must be an object";
  if (attempt.result === "fail") {
    // A failed undo leaves the entry in-flight instead, so a recorded fail whose swap stayed applied is corrupt.
    if (attempt.swapApplied && !attempt.rolledBack) return "rollback-missing";
    return attempt.original === null || attempt.original === undefined ? null : originalError(attempt.original);
  }
  if (!attempt.swapApplied) return "a pass must have its swap applied";
  if (!isString(attempt.verification.path)) return "a pass needs verification.path";
  return originalError(attempt.original);
}

function parseEntry(raw) {
  if (!isObject(raw)) return { error: { type: "entry-type" } };
  if (!Array.isArray(raw.attempts)) return { error: { type: "attempts-missing" } };
  for (const [index, attempt] of raw.attempts.entries()) {
    const error = attemptError(attempt);
    if (error === "rollback-missing") return { error: { type: "rollback-missing", attempt: index, attemptVersion: attempt.attemptedVersion } };
    if (error) return { error: { type: "attempt-invalid", attempt: index, detail: error } };
  }
  const passes = raw.attempts.filter((attempt) => attempt.result === "pass");
  if (raw.status !== "in-flight" && raw.inFlight !== undefined) return { error: { type: "in-flight-record-on-settled", status: raw.status } };

  if (raw.status === "resolved") {
    if (!isString(raw.chosenVersion)) return { error: { type: "resolved-missing-version" } };
    if (passes.length !== 1) return { error: { type: "resolved-success-count", successCount: passes.length } };
    if (passes[0].attemptedVersion !== raw.chosenVersion) return { error: { type: "resolved-version-mismatch", chosenVersion: raw.chosenVersion, passVersion: passes[0].attemptedVersion } };
    return { entry: { status: "resolved", attempts: raw.attempts, chosenVersion: raw.chosenVersion, pass: passes[0] } };
  }
  if (raw.status !== "unresolved" && raw.status !== "in-flight") return { error: { type: "status-invalid", status: raw.status ?? null } };
  if (passes.length > 0) return { error: { type: "unresolved-has-success", status: raw.status } };
  if (raw.status === "unresolved") return { entry: { status: "unresolved", attempts: raw.attempts } };

  const inFlight = raw.inFlight;
  if (!isObject(inFlight) || !isString(inFlight.attemptedVersion) || !isString(inFlight.startedAt)) {
    return { error: { type: "in-flight-record-invalid", detail: "inFlight needs attemptedVersion and startedAt" } };
  }
  const error = originalError(inFlight.original);
  if (error) return { error: { type: "in-flight-record-invalid", detail: error } };
  return { entry: { status: "in-flight", attempts: raw.attempts, inFlight } };
}

// { ok: true, log } with every entry parsed into its status's shape, or { ok: false, errors } naming each problem.
export function parseLog(text, logPath) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [{ type: "replacements-json", path: logPath, error: error.message }] };
  }
  if (!isObject(raw)) return { ok: false, errors: [{ type: "replacements-type", path: logPath, expected: "object" }] };
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [{
        type: "schema-version",
        path: logPath,
        found: raw.schemaVersion ?? null,
        expected: SCHEMA_VERSION,
        detail: `stored paths changed meaning in v${SCHEMA_VERSION}; move ${logPath} aside and rerun the swaps`,
      }],
    };
  }
  if (!isObject(raw.packages)) return { ok: false, errors: [{ type: "replacements-packages-missing", path: logPath }] };
  if (!Array.isArray(raw.events)) return { ok: false, errors: [{ type: "events-missing", path: logPath }] };

  const packages = {};
  const errors = [];
  for (const [name, rawEntry] of Object.entries(raw.packages)) {
    const { entry, error } = parseEntry(rawEntry);
    if (error) errors.push({ ...error, package: name });
    else packages[name] = entry;
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, log: { schemaVersion: raw.schemaVersion, createdAt: raw.createdAt, packages, events: raw.events } };
}
