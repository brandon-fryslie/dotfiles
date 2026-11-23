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
import { isPlainObject, JSON_SHAPE } from "./json-value.mjs";
import { appPathState, fileDigest, inputAt, isUnmet, readJson, treeFileText } from "./path-state.mjs";
import { fromLogPath, readLog } from "./replacement-log.mjs";
import { walk, isFunctionNode, functionShapeTokens, tokensToHash, parseFile, listFiles, listSourceFiles, SOURCE_TREE_EXCLUDES } from "./shape.mjs";

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

// [LAW:types-are-the-program] What a listed entry is, as every gate compares it: a link by the target it names, a file
// by its bytes' sha256, or an entry that can't be read, with the reader's reason. A link is never read through, so it
// is not a second name for its target; and an unread entry matches nothing, so a gate never certifies content it
// didn't read.
function entryIdentity(filePath) {
  const at = appPathState(filePath);
  if (at.kind === "link") return { kind: "link", target: at.target };
  const digest = fileDigest(filePath);
  return digest.kind === "sha256" ? digest : { kind: "unread", reason: digest.reason };
}

const sameEntry = (left, right) =>
  (left.kind === "link" && right.kind === "link" && left.target === right.target) ||
  (left.kind === "sha256" && right.kind === "sha256" && left.hex === right.hex);

// The extract gate verifies an extracted dir against the asar's full contents,
// so it skips only the repo a user may have initialized around their work. The
// prepare gate walks the tree prepare walked, and the remove-deps gate checks the
// app's own code, which is everything outside node_modules: node_modules is what
// remove-deps changes, and replace-dependency leaves symlinks there that no walk
// descends. Both use the source-tree set.
const EXTRACT_EXCLUDES = new Set([".git"]);

// [LAW:no-silent-failure] A gate's required inputs, each [path, what reading it gave]: the ones it can't use, each
// with its path and the reason the reader gave, so one that isn't there and one that can't be used are told apart.
const unmetInputs = (inputs) => inputs.filter(([, input]) => isUnmet(input)).map(([p, input]) => ({ path: p, kind: input.kind, reason: input.reason }));

const problemsText = (problems) => problems.map(({ path: p, reason }) => `${p} ${reason}`).join("; ");

function mapEntryIdentities(rootDir, relFiles) {
  return Object.fromEntries(relFiles.map((rel) => [rel, entryIdentity(path.join(rootDir, rel))]));
}

function setDiff(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

// [LAW:no-silent-failure] The project's own asar when it installs one, or the one on PATH when it doesn't; a shim that
// is there but isn't a file it can read stops the gate rather than letting another asar stand in for it, and a binary
// that won't run is named with the error. Returns the binary run.
function runAsarExtract(asarPath, outDir) {
  const localAsar = path.resolve(process.cwd(), "node_modules/.bin/asar");
  const local = inputAt(localAsar, "file");
  if (local.kind === "unusable") throw new Error(`${localAsar} ${local.reason}`);
  const cmd = local.kind === "file" ? localAsar : "asar";
  const result = spawnSync(cmd, ["extract", asarPath, outDir], {
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`asar extract (${cmd}) failed: ${result.error?.message ?? (result.stderr || result.stdout || `exit ${result.status}, signal ${result.signal}`)}`);
  }
  return cmd;
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
      extractedFileHashMatch: false,
    },
    metrics: {
      filesCompared: 0,
      missingFiles: 0,
      extraFiles: 0,
      hashMismatches: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      hashMismatches: [],
    },
    pass: false,
  };

  // Each asar is read for its digest, so one that can't be read is a required input the gate can't use.
  const upstreamDigest = fileDigest(upstreamAsar);
  const copiedDigest = fileDigest(copiedAsar);
  const problems = unmetInputs([[upstreamAsar, upstreamDigest], [copiedAsar, copiedDigest], [extractedDir, inputAt(extractedDir, "dir")]]);
  if (problems.length > 0) {
    artifact.error = `Required extract gate input: ${problemsText(problems)}`;
    return artifact;
  }

  artifact.metrics.upstreamAsarSha256 = upstreamDigest.hex;
  artifact.metrics.copiedAsarSha256 = copiedDigest.hex;
  artifact.checks.asarHashMatch = upstreamDigest.hex === copiedDigest.hex;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gate-extract-"));
  try {
    artifact.inputs.asarBinary = runAsarExtract(upstreamAsar, tmpRoot);

    const expectedFiles = listFiles(tmpRoot, EXTRACT_EXCLUDES);
    const actualFiles = listFiles(extractedDir, EXTRACT_EXCLUDES);

    const missingFiles = setDiff(expectedFiles, actualFiles);
    const extraFiles = setDiff(actualFiles, expectedFiles);

    artifact.metrics.filesCompared = expectedFiles.length;
    artifact.metrics.missingFiles = missingFiles.length;
    artifact.metrics.extraFiles = extraFiles.length;
    artifact.mismatches.missingFiles = missingFiles.slice(0, 200);
    artifact.mismatches.extraFiles = extraFiles.slice(0, 200);

    artifact.checks.extractedFileSetMatch = missingFiles.length === 0 && extraFiles.length === 0;

    const expectedEntries = mapEntryIdentities(tmpRoot, expectedFiles);
    // [LAW:one-source-of-truth] The listing is the gate's picture of each tree: a file is there when the listing has it.
    const actualSet = new Set(actualFiles);
    const actualEntries = mapEntryIdentities(extractedDir, expectedFiles.filter((rel) => actualSet.has(rel)));

    const hashMismatches = [];
    for (const rel of expectedFiles) {
      if (!actualEntries[rel]) continue;
      if (!sameEntry(expectedEntries[rel], actualEntries[rel])) {
        hashMismatches.push({ relPath: rel, expected: expectedEntries[rel], actual: actualEntries[rel] });
      }
    }

    artifact.metrics.hashMismatches = hashMismatches.length;
    artifact.mismatches.hashMismatches = hashMismatches.slice(0, 200);
    artifact.checks.extractedFileHashMatch = hashMismatches.length === 0;
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
      fileHashMismatches: 0,
      functionMultisetMismatches: 0,
      manifestMismatches: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      fileHashMismatches: [],
      functionMultisetMismatches: [],
      manifestMismatches: [],
      parseErrors: [],
    },
    pass: false,
  };

  const manifestRead = readJson(manifestPath, JSON_SHAPE.array);
  const problems = unmetInputs([[origDir, inputAt(origDir, "dir")], [preparedDir, inputAt(preparedDir, "dir")], [manifestPath, manifestRead]]);
  if (problems.length > 0) {
    artifact.error = `Required prepare gate input: ${problemsText(problems)}`;
    return artifact;
  }
  const manifest = manifestRead.value;

  const origJs = listSourceFiles(origDir, SOURCE_TREE_EXCLUDES);
  const preparedJs = listSourceFiles(preparedDir, SOURCE_TREE_EXCLUDES);
  const missingFiles = setDiff(origJs, preparedJs);
  const extraFiles = setDiff(preparedJs, origJs);
  // [LAW:one-source-of-truth] The listing is the gate's picture of each tree: a file is there when the listing has it.
  const preparedSet = new Set(preparedJs);

  artifact.metrics.filesCompared = origJs.length;
  artifact.metrics.inventoryMissing = missingFiles.length;
  artifact.metrics.inventoryExtra = extraFiles.length;
  artifact.mismatches.missingFiles = missingFiles.slice(0, 200);
  artifact.mismatches.extraFiles = extraFiles.slice(0, 200);
  artifact.checks.jsInventoryMatch = missingFiles.length === 0 && extraFiles.length === 0;

  const fileHashMismatches = [];
  const functionMultisetMismatches = [];
  const preparedFnHashesByFile = {};

  for (const rel of origJs) {
    const origPath = path.join(origDir, rel);
    const preparedPath = path.join(preparedDir, rel);
    if (!preparedSet.has(rel)) continue;

    try {
      const origAst = parseFile(treeFileText(origPath), rel);
      const preparedAst = parseFile(treeFileText(preparedPath), rel);

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

  artifact.metrics.functionCountManifest = manifest.length;

  const manifestMismatches = [];
  const manifestByFile = {};
  for (const entry of manifest) {
    if (!isPlainObject(entry) || typeof entry.file !== "string" || typeof entry.shapeHash !== "string") {
      manifestMismatches.push({ type: "manifest-entry-shape", entry });
      continue;
    }
    const { file, shapeHash } = entry;
    manifestByFile[file] = manifestByFile[file] || {};
    manifestByFile[file][shapeHash] = (manifestByFile[file][shapeHash] || 0) + 1;

    if (!Number.isInteger(entry.line) || entry.line <= 0) {
      manifestMismatches.push({ type: "manifest-line", file, line: entry.line });
    }
    if (!Number.isInteger(entry.column) || entry.column < 0) {
      manifestMismatches.push({ type: "manifest-column", file, column: entry.column });
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

  const manifestFiles = Object.keys(manifestByFile);
  const hashedFiles = new Set(Object.keys(preparedFnHashesByFile));
  for (const file of manifestFiles) {
    if (!hashedFiles.has(file)) {
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
      baselineJsFiles: 0,
      workingJsFiles: 0,
      jsMissing: 0,
      jsExtra: 0,
      jsHashMismatches: 0,
      copiesTracked: 0,
      attemptsTracked: 0,
      missingVerificationArtifacts: 0,
    },
    mismatches: {
      missingFiles: [],
      extraFiles: [],
      jsHashMismatches: [],
      replacementLogErrors: [],
      missingVerificationArtifacts: [],
    },
    pass: false,
  };

  // [LAW:single-enforcer] The log's state is readLog's to say, here as in replace-dependency, and an absent or
  // unusable log is a required input like the rest.
  const log = readLog(replacementsPath);
  const baseline = inputAt(baselineDir, "dir");
  const working = inputAt(workingDir, "dir");
  const problems = unmetInputs([[baselineDir, baseline], [workingDir, working], [nearMatchesPath, inputAt(nearMatchesPath, "file")], [replacementsPath, log]]);
  const missingRequired = problems.filter(({ kind }) => kind === "absent").map(({ path: p }) => p);
  const unusableRequired = problems.filter(({ kind }) => kind === "unusable").map(({ path: p, reason }) => ({ path: p, reason }));
  artifact.checks.artifactsPresent = problems.length === 0;
  if (missingRequired.length > 0) {
    artifact.mismatches.replacementLogErrors.push({ type: "missing-required", paths: missingRequired });
  }
  if (unusableRequired.length > 0) {
    artifact.mismatches.replacementLogErrors.push({ type: "unusable-required", inputs: unusableRequired });
  }

  // The working tree is compared only when both trees are there to list.
  if (baseline.kind === "dir" && working.kind === "dir") {
    const baselineJs = listSourceFiles(baselineDir, SOURCE_TREE_EXCLUDES);
    const workingJs = listSourceFiles(workingDir, SOURCE_TREE_EXCLUDES);
    artifact.metrics.baselineJsFiles = baselineJs.length;
    artifact.metrics.workingJsFiles = workingJs.length;

    const missingFiles = setDiff(baselineJs, workingJs);
    const extraFiles = setDiff(workingJs, baselineJs);
    artifact.metrics.jsMissing = missingFiles.length;
    artifact.metrics.jsExtra = extraFiles.length;
    artifact.mismatches.missingFiles = missingFiles.slice(0, 200);
    artifact.mismatches.extraFiles = extraFiles.slice(0, 200);

    const hashMismatches = [];
    // [LAW:one-source-of-truth] The listing is the gate's picture of each tree: a file is there when the listing has it.
    const workingSet = new Set(workingJs);
    for (const rel of baselineJs) {
      if (!workingSet.has(rel)) continue;
      const baselineEntry = entryIdentity(path.join(baselineDir, rel));
      const workingEntry = entryIdentity(path.join(workingDir, rel));
      if (!sameEntry(baselineEntry, workingEntry)) {
        hashMismatches.push({ file: rel, baseline: baselineEntry, working: workingEntry });
      }
    }

    artifact.metrics.jsHashMismatches = hashMismatches.length;
    artifact.mismatches.jsHashMismatches = hashMismatches.slice(0, 200);
    artifact.checks.workingCodeUnchanged =
      missingFiles.length === 0 && extraFiles.length === 0 && hashMismatches.length === 0;
  }

  // [LAW:single-enforcer] The log's shape — one pass per resolved copy, none under unresolved, no applied swap
  // left un-rolled-back — is replacement-log.mjs's to enforce; the gate adds only what needs disk.
  const replacementLogErrors = artifact.mismatches.replacementLogErrors;
  const missingVerificationArtifacts = [];
  if (log.kind === "rejected") replacementLogErrors.push(...log.errors);
  const entries = log.kind === "log" ? Object.entries(log.log.copies) : [];
  // A log the gate couldn't read has a size that is unknown, not zero.
  artifact.metrics.copiesTracked = log.kind === "log" ? entries.length : null;
  artifact.metrics.attemptsTracked = log.kind === "log" ? entries.reduce((sum, [, entry]) => sum + entry.attempts.length, 0) : null;

  // An in-flight entry is a swap whose original may still be set aside: disk and log disagree until it is recovered.
  for (const [location, entry] of entries.filter(([, entry]) => entry.status === "in-flight")) {
    replacementLogErrors.push({ type: "swap-in-flight", location, package: entry.name, attemptVersion: entry.inFlight.attemptedVersion });
  }

  for (const [location, entry] of entries.filter(([, entry]) => entry.status === "resolved")) {
    const verificationPath = fromLogPath(replacementsPath, entry.pass.verification.path);
    const verification = readJson(verificationPath, JSON_SHAPE.object);
    if (verification.kind === "absent") {
      missingVerificationArtifacts.push({ location, package: entry.name, attemptVersion: entry.chosenVersion, path: verificationPath });
    } else if (verification.kind !== "json") {
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
