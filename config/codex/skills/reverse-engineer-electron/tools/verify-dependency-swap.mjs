#!/usr/bin/env node
/**
 * verify-dependency-swap.mjs
 *
 * Validate whether replacing one dependency copy with another is structurally safe.
 *
 * Usage:
 *   node verify-dependency-swap.mjs --pkg <name> --before <dir> --after <dir> --expected-version <x.y.z> --out <json>
 *
 * // [LAW:verifiable-goals] Writes deterministic pass/fail evidence with explicit coverage metrics.
 * // [LAW:one-source-of-truth] The verification artifact is the canonical authority for swap acceptance.
 * // [LAW:dataflow-not-control-flow] Every trial evaluates the same package identity + reachable-code similarity checks.
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import process from "process";
import { parse } from "@babel/parser";

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
  const opts = {
    pkg: "",
    before: "",
    after: "",
    expectedVersion: "",
    out: "",
    threshold: 0.8,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pkg") opts.pkg = argv[++i] || "";
    else if (arg === "--before") opts.before = argv[++i] || "";
    else if (arg === "--after") opts.after = argv[++i] || "";
    else if (arg === "--expected-version") opts.expectedVersion = argv[++i] || "";
    else if (arg === "--out") opts.out = argv[++i] || "";
    else if (arg === "--threshold") opts.threshold = Number(argv[++i] || "0.8");
    else if (arg === "-h" || arg === "--help") return { help: true, opts };
  }

  return { help: false, opts };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
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
  for (const item of items) out[item] = (out[item] || 0) + 1;
  return out;
}

function multisetIntersectionCount(left, right) {
  let sum = 0;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    sum += Math.min(left[key] || 0, right[key] || 0);
  }
  return sum;
}

function listJsFiles(rootDir) {
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
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && [".js", ".mjs", ".cjs"].includes(path.extname(entry.name))) {
        out.push(path.relative(rootDir, abs).split(path.sep).join("/"));
      }
    }
  }
  out.sort();
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectEntrypoints(pkgJson) {
  const out = [];

  const maybeAdd = (value) => {
    if (typeof value !== "string" || value.length === 0) return;
    out.push(value);
  };

  maybeAdd(pkgJson.main);
  maybeAdd(pkgJson.module);
  maybeAdd(pkgJson.browser);

  function walkExports(node) {
    if (!node) return;
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walkExports(item);
      return;
    }
    if (typeof node === "object") {
      for (const value of Object.values(node)) walkExports(value);
    }
  }

  walkExports(pkgJson.exports);
  if (out.length === 0) out.push("index.js");

  return Array.from(new Set(out));
}

function resolveLocalModule(baseDir, specifier) {
  const candidates = [];

  if (specifier.endsWith(".js") || specifier.endsWith(".mjs") || specifier.endsWith(".cjs")) {
    candidates.push(specifier);
  } else {
    candidates.push(specifier);
    candidates.push(`${specifier}.js`);
    candidates.push(`${specifier}.mjs`);
    candidates.push(`${specifier}.cjs`);
    candidates.push(path.join(specifier, "index.js"));
    candidates.push(path.join(specifier, "index.mjs"));
    candidates.push(path.join(specifier, "index.cjs"));
  }

  for (const candidate of candidates) {
    const abs = path.resolve(baseDir, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }

  return null;
}

function collectRelativeSpecifiers(ast) {
  const out = [];

  walk(ast.program, (node) => {
    if (node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") {
      const source = node.source?.value;
      if (typeof source === "string" && (source.startsWith("./") || source.startsWith("../"))) out.push(source);
      return;
    }

    if (node.type === "CallExpression") {
      if (node.callee?.type === "Identifier" && node.callee.name === "require") {
        const first = node.arguments?.[0];
        if (first?.type === "StringLiteral" && (first.value.startsWith("./") || first.value.startsWith("../"))) {
          out.push(first.value);
        }
      }

      if (node.callee?.type === "Import") {
        const first = node.arguments?.[0];
        if (first?.type === "StringLiteral" && (first.value.startsWith("./") || first.value.startsWith("../"))) {
          out.push(first.value);
        }
      }
    }
  });

  return Array.from(new Set(out));
}

function buildReachableFileSet(pkgRoot, pkgJson) {
  const entries = collectEntrypoints(pkgJson);
  const queue = [];
  const visited = new Set();

  for (const entry of entries) {
    const resolved = resolveLocalModule(pkgRoot, entry.startsWith(".") ? entry : `./${entry}`);
    if (resolved) queue.push(resolved);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const rel = path.relative(pkgRoot, current).split(path.sep).join("/");
    if (visited.has(rel)) continue;
    visited.add(rel);

    let code = "";
    try {
      code = fs.readFileSync(current, "utf8");
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parseJs(code);
    } catch {
      continue;
    }

    const specifiers = collectRelativeSpecifiers(ast);
    for (const specifier of specifiers) {
      const resolved = resolveLocalModule(path.dirname(current), specifier);
      if (!resolved) continue;
      const nextRel = path.relative(pkgRoot, resolved).split(path.sep).join("/");
      if (!visited.has(nextRel)) queue.push(resolved);
    }
  }

  if (visited.size === 0) {
    for (const rel of listJsFiles(pkgRoot)) visited.add(rel);
  }

  return Array.from(visited).sort();
}

function fileStructuralInfo(absPath) {
  const code = fs.readFileSync(absPath, "utf8");
  const ast = parseJs(code);
  const programHash = hashTokens(structuralTokens(ast.program));

  const functionHashes = [];
  walk(ast.program, (node) => {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      functionHashes.push(hashTokens(structuralTokens(node)));
    }
  });

  return {
    programHash,
    functionCounts: countBy(functionHashes),
    functionTotal: functionHashes.length,
  };
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help || !opts.pkg || !opts.before || !opts.after || !opts.out) {
    console.log(
      "Usage: node verify-dependency-swap.mjs --pkg <name> --before <dir> --after <dir> --expected-version <x.y.z> --out <json> [--threshold 0.8]",
    );
    process.exit(help ? 0 : 2);
  }

  const beforeDir = path.resolve(process.cwd(), opts.before);
  const afterDir = path.resolve(process.cwd(), opts.after);
  const outPath = path.resolve(process.cwd(), opts.out);

  const artifact = {
    generatedAt: new Date().toISOString(),
    package: opts.pkg,
    expectedVersion: opts.expectedVersion || null,
    threshold: opts.threshold,
    inputs: {
      beforeDir,
      afterDir,
    },
    checks: {
      packageNameMatch: false,
      packageVersionMatch: false,
      structuralCoveragePass: false,
    },
    metrics: {
      reachableFiles: 0,
      missingReachableFiles: 0,
      exactProgramHashMatches: 0,
      fileCoverage: 0,
      functionCoverage: 0,
      combinedCoverage: 0,
      functionTotalBefore: 0,
      functionIntersection: 0,
    },
    mismatches: {
      package: [],
      missingFiles: [],
      fileProgramMismatch: [],
      parseErrors: [],
    },
    pass: false,
  };

  if (!fs.existsSync(beforeDir) || !fs.existsSync(afterDir)) {
    artifact.mismatches.package.push("before/after directory missing");
    writeJson(outPath, artifact);
    process.exit(1);
  }

  const beforePkgJsonPath = path.join(beforeDir, "package.json");
  const afterPkgJsonPath = path.join(afterDir, "package.json");

  if (!fs.existsSync(beforePkgJsonPath) || !fs.existsSync(afterPkgJsonPath)) {
    artifact.mismatches.package.push("package.json missing in before/after dependency directory");
    writeJson(outPath, artifact);
    process.exit(1);
  }

  const beforePkg = readJson(beforePkgJsonPath);
  const afterPkg = readJson(afterPkgJsonPath);

  artifact.checks.packageNameMatch = beforePkg?.name === opts.pkg && afterPkg?.name === opts.pkg;
  if (!artifact.checks.packageNameMatch) {
    artifact.mismatches.package.push(`package name mismatch: before=${beforePkg?.name || "?"} after=${afterPkg?.name || "?"}`);
  }

  const expectedVersion = opts.expectedVersion || beforePkg?.version || "";
  artifact.checks.packageVersionMatch = afterPkg?.version === expectedVersion;
  if (!artifact.checks.packageVersionMatch) {
    artifact.mismatches.package.push(`version mismatch: expected=${expectedVersion || "?"} actual=${afterPkg?.version || "?"}`);
  }

  const reachableFiles = buildReachableFileSet(beforeDir, beforePkg);
  artifact.metrics.reachableFiles = reachableFiles.length;

  let exactProgramHashMatches = 0;
  let functionTotalBefore = 0;
  let functionIntersection = 0;
  let presentReachableFiles = 0;

  for (const rel of reachableFiles) {
    const beforeFile = path.join(beforeDir, rel);
    const afterFile = path.join(afterDir, rel);
    if (!fs.existsSync(afterFile)) {
      artifact.mismatches.missingFiles.push(rel);
      continue;
    }

    presentReachableFiles += 1;

    try {
      const beforeInfo = fileStructuralInfo(beforeFile);
      const afterInfo = fileStructuralInfo(afterFile);

      if (beforeInfo.programHash === afterInfo.programHash) exactProgramHashMatches += 1;

      functionTotalBefore += beforeInfo.functionTotal;
      functionIntersection += multisetIntersectionCount(beforeInfo.functionCounts, afterInfo.functionCounts);

      if (beforeInfo.programHash !== afterInfo.programHash) {
        artifact.mismatches.fileProgramMismatch.push({
          file: rel,
          beforeProgramHash: beforeInfo.programHash,
          afterProgramHash: afterInfo.programHash,
        });
      }
    } catch (error) {
      artifact.mismatches.parseErrors.push({ file: rel, error: String(error?.message || error) });
    }
  }

  artifact.metrics.missingReachableFiles = artifact.mismatches.missingFiles.length;
  artifact.metrics.exactProgramHashMatches = exactProgramHashMatches;
  artifact.metrics.functionTotalBefore = functionTotalBefore;
  artifact.metrics.functionIntersection = functionIntersection;

  const fileCoverage = reachableFiles.length === 0 ? 1 : presentReachableFiles / reachableFiles.length;
  const functionCoverage = functionTotalBefore === 0 ? 1 : functionIntersection / functionTotalBefore;
  const combinedCoverage = (fileCoverage + functionCoverage) / 2;

  artifact.metrics.fileCoverage = Number(fileCoverage.toFixed(6));
  artifact.metrics.functionCoverage = Number(functionCoverage.toFixed(6));
  artifact.metrics.combinedCoverage = Number(combinedCoverage.toFixed(6));
  artifact.checks.structuralCoveragePass = combinedCoverage >= opts.threshold;

  artifact.pass = Object.values(artifact.checks).every(Boolean) && artifact.mismatches.parseErrors.length === 0;

  writeJson(outPath, artifact);

  if (!artifact.pass) {
    console.error(`Dependency swap verification failed for ${opts.pkg}`);
    process.exit(1);
  }

  console.log(`Dependency swap verification passed for ${opts.pkg}`);
  process.exit(0);
}

main();
