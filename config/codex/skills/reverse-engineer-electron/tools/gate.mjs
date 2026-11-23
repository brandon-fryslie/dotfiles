#!/usr/bin/env node
/**
 * gate.mjs
 *
 * Hard verification gates for prep pipeline steps.
 *
 * Commands:
 *   node gate.mjs extract --upstream-asar <path> --copied-asar <path> --extracted-dir <path> --out <path>
 *   node gate.mjs prepare --orig <dir> --prepared <dir> --manifest <path> --out <path>
 *   node gate.mjs remove-deps --baseline <dir> --working <dir> --deps-dir <dir> --out <path>
 *
 * Exit codes:
 *   0 = pass
 *   1 = gate failed
 *   2 = usage/config error
 *   3 = analysis/parsing failure
 *
 * // [LAW:verifiable-goals] Every gate emits a machine-readable artifact with explicit pass/fail reasons.
 * // [LAW:one-source-of-truth] Gate outcomes are persisted under gates/*.json and become the canonical decision log.
 * // [LAW:dataflow-not-control-flow] Each gate runs a fixed, deterministic sequence of checks every time.
 */

import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { JSON_SHAPE } from "./json-value.mjs";
import { fileDigest, inputAt, readJson, readText } from "./path-state.mjs";
import { fromLogPath, readLog } from "./replacement-log.mjs";
import { walk, isFunctionNode, functionShapeTokens, tokensToHash, parseFile, listFiles, listCodeEntries, SOURCE_TREE_EXCLUDES } from "./shape.mjs";

const EXIT = {
  PASS: 0,
  FAIL: 1,
  USAGE: 2,
  ANALYSIS: 3,
};

function parseArgs(argv) {
  const command = argv[2] || "";
  const opts = {
    upstreamAsar: "",
    copiedAsar: "",
    extractedDir: "",
    orig: "",
    prepared: "",
    manifest: "",
    baseline: "",
    working: "",
    depsDir: "deps",
    out: "",
    threshold: 1,
  };

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--upstream-asar") opts.upstreamAsar = argv[++i] || "";
    else if (arg === "--copied-asar") opts.copiedAsar = argv[++i] || "";
    else if (arg === "--extracted-dir") opts.extractedDir = argv[++i] || "";
    else if (arg === "--orig") opts.orig = argv[++i] || "";
    else if (arg === "--prepared") opts.prepared = argv[++i] || "";
    else if (arg === "--manifest") opts.manifest = argv[++i] || "";
    else if (arg === "--baseline") opts.baseline = argv[++i] || "";
    else if (arg === "--working") opts.working = argv[++i] || "";
    else if (arg === "--deps-dir") opts.depsDir = argv[++i] || opts.depsDir;
    else if (arg === "--out") opts.out = argv[++i] || "";
    else if (arg === "--threshold") opts.threshold = Number(argv[++i] || "1");
    else if (arg === "-h" || arg === "--help") return { help: true, command, opts };
  }

  return { help: false, command, opts };
}

function usage() {
  console.log("Usage:");
  console.log("  node gate.mjs extract --upstream-asar <path> --copied-asar <path> --extracted-dir <path> --out <path>");
  console.log("  node gate.mjs prepare --orig <dir> --prepared <dir> --manifest <path> --out <path>");
  console.log("  node gate.mjs remove-deps --baseline <dir> --working <dir> --deps-dir <dir> --out <path>");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

// The extract gate verifies an extracted dir against the asar's full contents,
// so it skips only the repo a user may have initialized around their work. The
// prepare gate checks what prepare writes, and the remove-deps gate checks the
// app's own code, which is everything outside node_modules: node_modules is what
// remove-deps changes. Both check listCodeEntries over the source-tree set.
const EXTRACT_EXCLUDES = new Set([".git"]);

// [LAW:single-enforcer] What a gate compares a tree entry by, under shape.mjs's link rule: a link by the target it
// names, a special file as itself, a file by its sha256. A file it couldn't read is unread, with the reason, and
// matches nothing, so a gate never passes an entry it could not read.
function entryIdentity(rootDir, entry) {
  if (entry.kind === "link") return { kind: "link", target: entry.target };
  if (entry.kind === "special") return { kind: "special" };
  const digest = fileDigest(path.join(rootDir, entry.rel));
  return digest.kind === "digest" ? { kind: "file", sha256: digest.sha256 } : { kind: "unread", reason: digest.reason };
}

const sameIdentity = (left, right) => left.kind !== "unread" && JSON.stringify(left) === JSON.stringify(right);

// Two trees' entries by path: the paths only the left has, those only the right has, and the paths both have.
function pairEntries(leftEntries, rightEntries) {
  const rightByRel = new Map(rightEntries.map((entry) => [entry.rel, entry]));
  const leftRels = new Set(leftEntries.map(({ rel }) => rel));
  return {
    missing: leftEntries.filter(({ rel }) => !rightByRel.has(rel)).map(({ rel }) => rel),
    extra: rightEntries.filter(({ rel }) => !leftRels.has(rel)).map(({ rel }) => rel),
    shared: leftEntries.filter(({ rel }) => rightByRel.has(rel)).map((left) => ({ left, right: rightByRel.get(left.rel) })),
  };
}

// Each shared pair whose entries differ by entryIdentity, with what each side is.
const identityMismatches = (pairs, leftRoot, rightRoot) => pairs
  .map(({ left, right }) => ({ file: left.rel, expected: entryIdentity(leftRoot, left), actual: entryIdentity(rightRoot, right) }))
  .filter(({ expected, actual }) => !sameIdentity(expected, actual));

// The sentence for each input that is missing or can't be used, with its path and why.
const inputProblems = (inputs) => inputs
  .map(([p, kind]) => ({ p, input: inputAt(p, kind) }))
  .filter(({ input }) => input.kind === "absent" || input.kind === "unusable")
  .map(({ p, input }) => `${p} ${input.reason}`);

function runAsarExtract(asarPath, outDir) {
  const localAsar = path.resolve(process.cwd(), "node_modules/.bin/asar");
  const cmd = fs.existsSync(localAsar) ? localAsar : "asar";
  const result = spawnSync(cmd, ["extract", asarPath, outDir], {
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`asar extract failed: ${result.stderr || result.stdout || "unknown error"}`);
  }
}

function countBy(items) {
  const out = {};
  for (const item of items) {
    out[item] = (out[item] || 0) + 1;
  }
  return out;
}

function collectFunctionHashes(ast) {
  const out = [];
  walk(ast.program, (node) => {
    if (isFunctionNode(node)) out.push(tokensToHash(functionShapeTokens(node)));
  });
  return out;
}

function equalCountMap(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] || 0) !== (right[key] || 0)) return false;
  }
  return true;
}

// A file's text for the gate, or an error naming the file and why it can't be read.
function gateText(filePath) {
  const read = readText(filePath);
  if (read.kind !== "text") throw new Error(`${filePath} ${read.reason}`);
  return read.text;
}

function runExtractGate(opts) {
  const upstreamAsar = path.resolve(process.cwd(), opts.upstreamAsar);
  const copiedAsar = path.resolve(process.cwd(), opts.copiedAsar);
  const extractedDir = path.resolve(process.cwd(), opts.extractedDir);

  const artifact = {
    gate: "extract",
    generatedAt: new Date().toISOString(),
    inputs: {
      upstreamAsar,
      copiedAsar,
      extractedDir,
    },
    checks: {
      asarHashMatch: false,
      extractedFileSetMatch: false,
      extractedEntriesMatch: false,
    },
    metrics: {
      filesCompared: 0,
      missingFiles: 0,
      extraFiles: 0,
      entryMismatches: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      entryMismatches: [],
    },
    pass: false,
  };

  const problems = inputProblems([[upstreamAsar, "file"], [copiedAsar, "file"], [extractedDir, "dir"]]);
  if (problems.length > 0) {
    artifact.error = problems.join("; ");
    return artifact;
  }

  // Each asar's sha256, or why it couldn't be read, which matches nothing.
  const [upstream, copied] = [upstreamAsar, copiedAsar].map(fileDigest);
  artifact.metrics.upstreamAsarSha256 = upstream.sha256 ?? upstream.reason;
  artifact.metrics.copiedAsarSha256 = copied.sha256 ?? copied.reason;
  artifact.checks.asarHashMatch = upstream.kind === "digest" && upstream.sha256 === copied.sha256;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gate-extract-"));
  try {
    runAsarExtract(upstreamAsar, tmpRoot);

    const expected = listFiles(tmpRoot, EXTRACT_EXCLUDES);
    const { missing, extra, shared } = pairEntries(expected, listFiles(extractedDir, EXTRACT_EXCLUDES));

    artifact.metrics.filesCompared = expected.length;
    artifact.metrics.missingFiles = missing.length;
    artifact.metrics.extraFiles = extra.length;
    artifact.mismatches.missingFiles = missing.slice(0, 200);
    artifact.mismatches.extraFiles = extra.slice(0, 200);

    artifact.checks.extractedFileSetMatch = missing.length === 0 && extra.length === 0;

    const entryMismatches = identityMismatches(shared, tmpRoot, extractedDir);
    artifact.metrics.entryMismatches = entryMismatches.length;
    artifact.mismatches.entryMismatches = entryMismatches.slice(0, 200);
    artifact.checks.extractedEntriesMatch = entryMismatches.length === 0;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  artifact.pass = Object.values(artifact.checks).every(Boolean);
  return artifact;
}

function runPrepareGate(opts) {
  const origDir = path.resolve(process.cwd(), opts.orig);
  const preparedDir = path.resolve(process.cwd(), opts.prepared);
  const manifestPath = path.resolve(process.cwd(), opts.manifest || path.join(preparedDir, "manifest.json"));

  const artifact = {
    gate: "prepare",
    generatedAt: new Date().toISOString(),
    inputs: {
      origDir,
      preparedDir,
      manifestPath,
    },
    checks: {
      jsInventoryMatch: false,
      entriesMatch: false,
      fileStructuralHashMatch: false,
      functionStructuralMultisetMatch: false,
      manifestConsistency: false,
    },
    metrics: {
      filesCompared: 0,
      functionCountOrig: 0,
      functionCountPrepared: 0,
      functionCountManifest: 0,
      inventoryMissing: 0,
      inventoryExtra: 0,
      entryMismatches: 0,
      fileHashMismatches: 0,
      functionMultisetMismatches: 0,
      manifestMismatches: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      entryMismatches: [],
      fileHashMismatches: [],
      functionMultisetMismatches: [],
      manifestMismatches: [],
      parseErrors: [],
    },
    pass: false,
  };

  const manifestRead = readJson(manifestPath, JSON_SHAPE.array);
  const problems = [
    ...inputProblems([[origDir, "dir"], [preparedDir, "dir"]]),
    ...(manifestRead.kind === "json" ? [] : [`${manifestPath} ${manifestRead.reason}`]),
  ];
  if (problems.length > 0) {
    artifact.error = problems.join("; ");
    return artifact;
  }

  // [LAW:one-source-of-truth] The entries checked are the ones prepare writes: listCodeEntries on both sides.
  const origEntries = listCodeEntries(origDir, SOURCE_TREE_EXCLUDES);
  const { missing, extra, shared } = pairEntries(origEntries, listCodeEntries(preparedDir, SOURCE_TREE_EXCLUDES));

  artifact.metrics.filesCompared = origEntries.length;
  artifact.metrics.inventoryMissing = missing.length;
  artifact.metrics.inventoryExtra = extra.length;
  artifact.mismatches.missingFiles = missing.slice(0, 200);
  artifact.mismatches.extraFiles = extra.slice(0, 200);
  artifact.checks.jsInventoryMatch = missing.length === 0 && extra.length === 0;

  // A file prepare formatted is compared by its structure; every other pair, a link or a kind that changed, as itself.
  const bothFiles = ({ left, right }) => left.kind === "file" && right.kind === "file";
  const entryMismatches = identityMismatches(shared.filter((pair) => !bothFiles(pair)), origDir, preparedDir);
  artifact.metrics.entryMismatches = entryMismatches.length;
  artifact.mismatches.entryMismatches = entryMismatches.slice(0, 200);
  artifact.checks.entriesMatch = entryMismatches.length === 0;

  const fileHashMismatches = [];
  const functionMultisetMismatches = [];
  const preparedFnHashesByFile = {};

  for (const { left: { rel } } of shared.filter(bothFiles)) {
    try {
      const origAst = parseFile(gateText(path.join(origDir, rel)), rel);
      const preparedAst = parseFile(gateText(path.join(preparedDir, rel)), rel);

      const origProgramHash = tokensToHash(functionShapeTokens(origAst.program));
      const preparedProgramHash = tokensToHash(functionShapeTokens(preparedAst.program));

      if (origProgramHash !== preparedProgramHash) {
        fileHashMismatches.push({
          file: rel,
          origProgramHash,
          preparedProgramHash,
        });
      }

      const origFnHashes = collectFunctionHashes(origAst);
      const preparedFnHashes = collectFunctionHashes(preparedAst);
      preparedFnHashesByFile[rel] = preparedFnHashes;

      artifact.metrics.functionCountOrig += origFnHashes.length;
      artifact.metrics.functionCountPrepared += preparedFnHashes.length;

      const origCountMap = countBy(origFnHashes);
      const preparedCountMap = countBy(preparedFnHashes);
      if (!equalCountMap(origCountMap, preparedCountMap)) {
        functionMultisetMismatches.push({
          file: rel,
          origDistinct: Object.keys(origCountMap).length,
          preparedDistinct: Object.keys(preparedCountMap).length,
        });
      }
    } catch (error) {
      artifact.mismatches.parseErrors.push({ file: rel, error: String(error?.message || error) });
    }
  }

  artifact.metrics.fileHashMismatches = fileHashMismatches.length;
  artifact.metrics.functionMultisetMismatches = functionMultisetMismatches.length;
  artifact.mismatches.fileHashMismatches = fileHashMismatches.slice(0, 200);
  artifact.mismatches.functionMultisetMismatches = functionMultisetMismatches.slice(0, 200);
  artifact.checks.fileStructuralHashMatch = fileHashMismatches.length === 0;
  artifact.checks.functionStructuralMultisetMatch = functionMultisetMismatches.length === 0;

  const manifest = manifestRead.value;
  artifact.metrics.functionCountManifest = manifest.length;

  const manifestMismatches = [];
  const manifestByFile = {};
  for (const entry of manifest) {
    const file = entry?.file;
    const shapeHash = entry?.shapeHash;
    if (typeof file !== "string" || typeof shapeHash !== "string") {
      manifestMismatches.push({ type: "manifest-entry-shape", entry });
      continue;
    }
    manifestByFile[file] = manifestByFile[file] || {};
    manifestByFile[file][shapeHash] = (manifestByFile[file][shapeHash] || 0) + 1;

    if (!Number.isInteger(entry?.line) || entry.line <= 0) {
      manifestMismatches.push({ type: "manifest-line", file, line: entry?.line });
    }
    if (!Number.isInteger(entry?.column) || entry.column < 0) {
      manifestMismatches.push({ type: "manifest-column", file, column: entry?.column });
    }
  }

  for (const [file, preparedHashes] of Object.entries(preparedFnHashesByFile)) {
    const preparedCountMap = countBy(preparedHashes);
    const manifestCountMap = manifestByFile[file] || {};
    if (!equalCountMap(preparedCountMap, manifestCountMap)) {
      manifestMismatches.push({
        type: "manifest-function-multiset",
        file,
        preparedDistinct: Object.keys(preparedCountMap).length,
        manifestDistinct: Object.keys(manifestCountMap).length,
      });
    }
  }

  const preparedSet = new Set(Object.keys(preparedFnHashesByFile));
  for (const file of Object.keys(manifestByFile)) {
    if (!preparedSet.has(file)) {
      manifestMismatches.push({ type: "manifest-file-missing", file });
    }
  }

  artifact.metrics.manifestMismatches = manifestMismatches.length;
  artifact.mismatches.manifestMismatches = manifestMismatches.slice(0, 200);
  artifact.checks.manifestConsistency = manifestMismatches.length === 0;

  artifact.pass = Object.values(artifact.checks).every(Boolean) && artifact.mismatches.parseErrors.length === 0;
  return artifact;
}

function runRemoveDepsGate(opts) {
  const baselineDir = path.resolve(process.cwd(), opts.baseline);
  const workingDir = path.resolve(process.cwd(), opts.working);
  const depsDir = path.resolve(process.cwd(), opts.depsDir);
  const nearMatchesPath = path.join(depsDir, "near-matches.json");
  const replacementsPath = path.join(depsDir, "replacements.json");

  const artifact = {
    gate: "remove-deps",
    generatedAt: new Date().toISOString(),
    inputs: {
      baselineDir,
      workingDir,
      depsDir,
      nearMatchesPath,
      replacementsPath,
    },
    checks: {
      artifactsPresent: false,
      replacementLogConsistent: false,
      verificationArtifactsConsistent: false,
      workingCodeUnchanged: false,
    },
    metrics: {
      baselineEntries: 0,
      workingEntries: 0,
      entriesMissing: 0,
      entriesExtra: 0,
      entryMismatches: 0,
      copiesTracked: 0,
      attemptsTracked: 0,
      missingVerificationArtifacts: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      entryMismatches: [],
      replacementLogErrors: [],
      missingVerificationArtifacts: [],
    },
    pass: false,
  };

  const replacementLogErrors = artifact.mismatches.replacementLogErrors;
  const inputs = [[baselineDir, "dir"], [workingDir, "dir"], [nearMatchesPath, "file"]].map(([p, kind]) => ({ p, input: inputAt(p, kind) }));
  const log = readLog(replacementsPath);
  const missingRequired = [...inputs.filter(({ input }) => input.kind === "absent").map(({ p }) => p), ...(log.kind === "absent" ? [replacementsPath] : [])];
  if (missingRequired.length > 0) replacementLogErrors.push({ type: "missing-required", paths: missingRequired });
  for (const { p, input } of inputs.filter(({ input }) => input.kind === "unusable")) replacementLogErrors.push({ type: "unusable-required", path: p, reason: input.reason });
  artifact.checks.artifactsPresent = inputs.every(({ input }) => input.kind === "dir" || input.kind === "file") && log.kind !== "absent";

  if (inputs[0].input.kind === "dir" && inputs[1].input.kind === "dir") {
    const baseline = listCodeEntries(baselineDir, SOURCE_TREE_EXCLUDES);
    const working = listCodeEntries(workingDir, SOURCE_TREE_EXCLUDES);
    artifact.metrics.baselineEntries = baseline.length;
    artifact.metrics.workingEntries = working.length;

    const { missing, extra, shared } = pairEntries(baseline, working);
    artifact.metrics.entriesMissing = missing.length;
    artifact.metrics.entriesExtra = extra.length;
    artifact.mismatches.missingFiles = missing.slice(0, 200);
    artifact.mismatches.extraFiles = extra.slice(0, 200);

    const entryMismatches = identityMismatches(shared, baselineDir, workingDir);
    artifact.metrics.entryMismatches = entryMismatches.length;
    artifact.mismatches.entryMismatches = entryMismatches.slice(0, 200);
    artifact.checks.workingCodeUnchanged = missing.length === 0 && extra.length === 0 && entryMismatches.length === 0;
  }

  // [LAW:single-enforcer] The log's shape — one pass per resolved copy, none under unresolved, no applied swap
  // left un-rolled-back — is replacement-log.mjs's to enforce; the gate adds only what needs disk.
  const missingVerificationArtifacts = [];
  if (log.kind === "unusable") replacementLogErrors.push(...log.errors);
  const entries = log.kind === "read" ? Object.entries(log.log.copies) : [];
  // A log that couldn't be read has an unknown size, not zero.
  artifact.metrics.copiesTracked = log.kind === "read" ? entries.length : null;
  artifact.metrics.attemptsTracked = log.kind === "read" ? entries.reduce((sum, [, entry]) => sum + entry.attempts.length, 0) : null;

  // An in-flight entry is a swap whose original may still be set aside: disk and log disagree until it is recovered.
  for (const [location, entry] of entries.filter(([, entry]) => entry.status === "in-flight")) {
    replacementLogErrors.push({ type: "swap-in-flight", location, package: entry.name, attemptVersion: entry.inFlight.attemptedVersion });
  }

  for (const [location, entry] of entries.filter(([, entry]) => entry.status === "resolved")) {
    const verificationPath = fromLogPath(replacementsPath, entry.pass.verification.path);
    const verification = readJson(verificationPath, JSON_SHAPE.object);
    if (verification.kind === "absent") {
      missingVerificationArtifacts.push({ location, package: entry.name, attemptVersion: entry.chosenVersion, path: verificationPath });
    } else if (verification.kind === "unusable") {
      replacementLogErrors.push({ type: "verification-read", location, package: entry.name, path: verificationPath, error: verification.reason });
    } else if (verification.value.pass !== true) {
      replacementLogErrors.push({ type: "verification-failed", location, package: entry.name, path: verificationPath });
    }
  }

  artifact.metrics.missingVerificationArtifacts = missingVerificationArtifacts.length;
  artifact.mismatches.missingVerificationArtifacts = missingVerificationArtifacts.slice(0, 200);

  artifact.checks.replacementLogConsistent = replacementLogErrors.length === 0;
  artifact.checks.verificationArtifactsConsistent = missingVerificationArtifacts.length === 0;

  artifact.pass = Object.values(artifact.checks).every(Boolean);
  return artifact;
}

function runGate(command, opts) {
  if (command === "extract") return runExtractGate(opts);
  if (command === "prepare") return runPrepareGate(opts);
  if (command === "remove-deps") return runRemoveDepsGate(opts);
  throw new Error(`Unknown gate command: ${command}`);
}

function validateArgs(command, opts) {
  if (command === "extract") {
    return Boolean(opts.upstreamAsar && opts.copiedAsar && opts.extractedDir && opts.out);
  }
  if (command === "prepare") {
    return Boolean(opts.orig && opts.prepared && opts.out);
  }
  if (command === "remove-deps") {
    return Boolean(opts.baseline && opts.working && opts.depsDir && opts.out);
  }
  return false;
}

function main() {
  const { help, command, opts } = parseArgs(process.argv);
  if (help) {
    usage();
    process.exit(EXIT.PASS);
  }

  if (!validateArgs(command, opts)) {
    usage();
    process.exit(EXIT.USAGE);
  }

  let artifact;
  try {
    artifact = runGate(command, opts);
  } catch (error) {
    artifact = {
      gate: command,
      generatedAt: new Date().toISOString(),
      pass: false,
      error: String(error?.message || error),
      stack: String(error?.stack || ""),
    };
    writeJson(path.resolve(process.cwd(), opts.out), artifact);
    console.error(`Gate ${command} failed during analysis: ${artifact.error}`);
    process.exit(EXIT.ANALYSIS);
  }

  writeJson(path.resolve(process.cwd(), opts.out), artifact);
  if (!artifact.pass) {
    console.error(`Gate ${command}: FAIL`);
    process.exit(EXIT.FAIL);
  }

  console.log(`Gate ${command}: PASS`);
  process.exit(EXIT.PASS);
}

main();
