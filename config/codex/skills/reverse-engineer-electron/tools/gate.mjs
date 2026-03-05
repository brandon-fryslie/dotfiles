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

import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { parse } from "@babel/parser";

const EXIT = {
  PASS: 0,
  FAIL: 1,
  USAGE: 2,
  ANALYSIS: 3,
};

const SKIP_KEYS = new Set([
  "type",
  "start",
  "end",
  "loc",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "extra",
  "range",
  "comments",
]);

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

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function listFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      out.push(path.relative(rootDir, abs).split(path.sep).join("/"));
    }
  }
  out.sort();
  return out;
}

function listJsFiles(rootDir) {
  return listFiles(rootDir).filter((rel) => rel.endsWith(".js"));
}

function mapFileHashes(rootDir, relFiles) {
  const hashes = {};
  for (const rel of relFiles) {
    const abs = path.join(rootDir, rel);
    hashes[rel] = sha256File(abs);
  }
  return hashes;
}

function setDiff(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

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

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && item.type) walk(item, visitor);
      }
      continue;
    }
    if (value && typeof value === "object" && value.type) walk(value, visitor);
  }
}

function parseJs(code) {
  return parse(code, {
    sourceType: "unambiguous",
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    plugins: [
      "jsx",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "dynamicImport",
      "importMeta",
      "optionalChaining",
      "nullishCoalescingOperator",
      "topLevelAwait",
      "numericSeparator",
      "logicalAssignment",
      "objectRestSpread",
      "decorators-legacy",
    ],
  });
}

function structuralTokens(node) {
  const tokens = [];
  walk(node, (current) => {
    switch (current.type) {
      case "Identifier":
      case "PrivateName":
        break;
      case "StringLiteral":
        tokens.push("S");
        break;
      case "NumericLiteral":
        tokens.push("N");
        break;
      case "BooleanLiteral":
        tokens.push(current.value ? "T" : "F");
        break;
      case "NullLiteral":
        tokens.push("null");
        break;
      case "RegExpLiteral":
        tokens.push("R");
        break;
      case "BigIntLiteral":
        tokens.push("BI");
        break;
      case "TemplateLiteral":
        tokens.push("TL");
        break;
      case "TemplateElement":
        break;
      case "BinaryExpression":
      case "LogicalExpression":
      case "AssignmentExpression":
        tokens.push(current.operator);
        break;
      case "UnaryExpression":
        tokens.push(`U:${current.operator}`);
        break;
      case "UpdateExpression":
        tokens.push(`${current.prefix ? "pre" : "post"}${current.operator}`);
        break;
      default:
        tokens.push(current.type);
    }
  });
  return tokens;
}

function hashTokens(tokens) {
  return createHash("sha256").update(tokens.join(",")).digest("hex").slice(0, 16);
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
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      out.push(hashTokens(structuralTokens(node)));
    }
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

  if (!fs.existsSync(upstreamAsar) || !fs.existsSync(copiedAsar) || !fs.existsSync(extractedDir)) {
    artifact.error = "Required extract gate input path missing";
    return artifact;
  }

  const upstreamHash = sha256File(upstreamAsar);
  const copiedHash = sha256File(copiedAsar);
  artifact.metrics.upstreamAsarSha256 = upstreamHash;
  artifact.metrics.copiedAsarSha256 = copiedHash;
  artifact.checks.asarHashMatch = upstreamHash === copiedHash;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gate-extract-"));
  try {
    runAsarExtract(upstreamAsar, tmpRoot);

    const expectedFiles = listFiles(tmpRoot);
    const actualFiles = listFiles(extractedDir);

    const missingFiles = setDiff(expectedFiles, actualFiles);
    const extraFiles = setDiff(actualFiles, expectedFiles);

    artifact.metrics.filesCompared = expectedFiles.length;
    artifact.metrics.missingFiles = missingFiles.length;
    artifact.metrics.extraFiles = extraFiles.length;
    artifact.mismatches.missingFiles = missingFiles.slice(0, 200);
    artifact.mismatches.extraFiles = extraFiles.slice(0, 200);

    artifact.checks.extractedFileSetMatch = missingFiles.length === 0 && extraFiles.length === 0;

    const expectedHashes = mapFileHashes(tmpRoot, expectedFiles);
    const actualHashes = mapFileHashes(extractedDir, expectedFiles.filter((rel) => fs.existsSync(path.join(extractedDir, rel))));

    const hashMismatches = [];
    for (const rel of expectedFiles) {
      if (!actualHashes[rel]) continue;
      if (expectedHashes[rel] !== actualHashes[rel]) {
        hashMismatches.push({ relPath: rel, expected: expectedHashes[rel], actual: actualHashes[rel] });
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

  if (!fs.existsSync(origDir) || !fs.existsSync(preparedDir) || !fs.existsSync(manifestPath)) {
    artifact.error = "Required prepare gate input path missing";
    return artifact;
  }

  const origJs = listJsFiles(origDir);
  const preparedJs = listJsFiles(preparedDir);
  const missingFiles = setDiff(origJs, preparedJs);
  const extraFiles = setDiff(preparedJs, origJs);

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
    if (!fs.existsSync(preparedPath)) continue;

    try {
      const origAst = parseJs(fs.readFileSync(origPath, "utf8"));
      const preparedAst = parseJs(fs.readFileSync(preparedPath, "utf8"));

      const origProgramHash = hashTokens(structuralTokens(origAst.program));
      const preparedProgramHash = hashTokens(structuralTokens(preparedAst.program));

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

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    artifact.mismatches.manifestMismatches.push({ type: "manifest-read", error: String(error?.message || error) });
  }

  artifact.metrics.functionCountManifest = Array.isArray(manifest) ? manifest.length : 0;

  const manifestMismatches = [];
  if (!Array.isArray(manifest)) {
    manifestMismatches.push({ type: "manifest-type", expected: "array" });
  } else {
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

    const manifestFiles = Object.keys(manifestByFile);
    const preparedSet = new Set(Object.keys(preparedFnHashesByFile));
    for (const file of manifestFiles) {
      if (!preparedSet.has(file)) {
        manifestMismatches.push({ type: "manifest-file-missing", file });
      }
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
      packagesTracked: 0,
      attemptsTracked: 0,
      failedAttemptsWithoutRollback: 0,
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

  const requiredPaths = [baselineDir, workingDir, nearMatchesPath, replacementsPath];
  const missingRequired = requiredPaths.filter((p) => !fs.existsSync(p));
  artifact.checks.artifactsPresent = missingRequired.length === 0;
  if (missingRequired.length > 0) {
    artifact.mismatches.replacementLogErrors.push({ type: "missing-required", paths: missingRequired });
  }

  if (fs.existsSync(baselineDir) && fs.existsSync(workingDir)) {
    const baselineJs = listJsFiles(baselineDir);
    const workingJs = listJsFiles(workingDir);
    artifact.metrics.baselineJsFiles = baselineJs.length;
    artifact.metrics.workingJsFiles = workingJs.length;

    const missingFiles = setDiff(baselineJs, workingJs);
    const extraFiles = setDiff(workingJs, baselineJs);
    artifact.metrics.jsMissing = missingFiles.length;
    artifact.metrics.jsExtra = extraFiles.length;
    artifact.mismatches.missingFiles = missingFiles.slice(0, 200);
    artifact.mismatches.extraFiles = extraFiles.slice(0, 200);

    const hashMismatches = [];
    for (const rel of baselineJs) {
      const workingPath = path.join(workingDir, rel);
      if (!fs.existsSync(workingPath)) continue;
      const leftHash = sha256File(path.join(baselineDir, rel));
      const rightHash = sha256File(workingPath);
      if (leftHash !== rightHash) {
        hashMismatches.push({ file: rel, baselineHash: leftHash, workingHash: rightHash });
      }
    }

    artifact.metrics.jsHashMismatches = hashMismatches.length;
    artifact.mismatches.jsHashMismatches = hashMismatches.slice(0, 200);
    artifact.checks.workingCodeUnchanged =
      missingFiles.length === 0 && extraFiles.length === 0 && hashMismatches.length === 0;
  }

  let replacements = null;
  try {
    if (fs.existsSync(replacementsPath)) {
      replacements = JSON.parse(fs.readFileSync(replacementsPath, "utf8"));
    }
  } catch (error) {
    artifact.mismatches.replacementLogErrors.push({ type: "replacements-read", error: String(error?.message || error) });
  }

  const replacementLogErrors = artifact.mismatches.replacementLogErrors;
  const missingVerificationArtifacts = [];
  if (!replacements || typeof replacements !== "object") {
    replacementLogErrors.push({ type: "replacements-type", expected: "object" });
  } else {
    const packages = replacements.packages && typeof replacements.packages === "object" ? replacements.packages : null;
    if (!packages) {
      replacementLogErrors.push({ type: "replacements-packages-missing" });
    } else {
      const entries = Object.entries(packages);
      artifact.metrics.packagesTracked = entries.length;

      for (const [pkgName, pkgState] of entries) {
        const attempts = Array.isArray(pkgState?.attempts) ? pkgState.attempts : [];
        artifact.metrics.attemptsTracked += attempts.length;
        if (!Array.isArray(pkgState?.attempts)) {
          replacementLogErrors.push({ type: "attempts-missing", package: pkgName });
          continue;
        }

        let successCount = 0;
        for (const attempt of attempts) {
          const result = attempt?.result;
          const swapApplied = Boolean(attempt?.swapApplied);
          const rolledBack = Boolean(attempt?.rolledBack);

          if (result === "pass") {
            successCount += 1;
            const verificationPath = attempt?.verification?.path;
            if (!verificationPath || !fs.existsSync(path.resolve(process.cwd(), verificationPath))) {
              missingVerificationArtifacts.push({ package: pkgName, attemptVersion: attempt?.attemptedVersion, path: verificationPath || null });
              continue;
            }

            try {
              const verification = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), verificationPath), "utf8"));
              if (!verification?.pass) {
                replacementLogErrors.push({ type: "verification-failed", package: pkgName, path: verificationPath });
              }
            } catch (error) {
              replacementLogErrors.push({ type: "verification-read", package: pkgName, path: verificationPath, error: String(error?.message || error) });
            }
          }

          if (result === "fail" && swapApplied && !rolledBack) {
            artifact.metrics.failedAttemptsWithoutRollback += 1;
            replacementLogErrors.push({ type: "rollback-missing", package: pkgName, attemptVersion: attempt?.attemptedVersion });
          }
        }

        if (pkgState?.status === "resolved") {
          if (successCount !== 1) {
            replacementLogErrors.push({ type: "resolved-success-count", package: pkgName, successCount });
          }
          if (!pkgState?.chosenVersion) {
            replacementLogErrors.push({ type: "resolved-missing-version", package: pkgName });
          }
        }

        if (pkgState?.status === "unresolved" && successCount > 0) {
          replacementLogErrors.push({ type: "unresolved-has-success", package: pkgName });
        }
      }
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
