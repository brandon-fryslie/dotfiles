#!/usr/bin/env node
/**
 * unbundle-index.mjs
 *
 * Build deterministic module index + graph from webpack/browserify style bundles.
 *
 * Usage:
 *   node unbundle-index.mjs --build-dir app/.vite/build --out deps/module-index.json --graph-out deps/module-graph.json
 *
 * // [LAW:verifiable-goals] Emits deterministic JSON artifacts for module index and dependency graph.
 * // [LAW:one-source-of-truth] module-index.json is the canonical module-map input for downstream dependency analysis.
 * // [LAW:dataflow-not-control-flow] Every JS file executes the same parse/detect/index pipeline.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { parse } from "@babel/parser";

function parseArgs(argv) {
  const opts = {
    buildDir: "app",
    out: "deps/module-index.json",
    graphOut: "deps/module-graph.json",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--build-dir") opts.buildDir = argv[++i] || opts.buildDir;
    else if (arg === "--out") opts.out = argv[++i] || opts.out;
    else if (arg === "--graph-out") opts.graphOut = argv[++i] || opts.graphOut;
    else if (arg === "-h" || arg === "--help") return { help: true, opts };
  }

  return { help: false, opts };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && path.extname(entry.name) === ".js") out.push(abs);
    }
  }
  out.sort();
  return out;
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

function collectCandidateCalls(node, out) {
  if (!node || typeof node !== "object") return;
  if (node.type === "CallExpression" && Array.isArray(node.arguments)) {
    for (const arg of node.arguments) {
      if (arg?.type === "ArrayExpression" || arg?.type === "ObjectExpression") {
        out.push(node);
        break;
      }
    }
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) collectCandidateCalls(item, out);
      continue;
    }
    if (value && typeof value === "object") collectCandidateCalls(value, out);
  }
}

function countModuleLikeEntries(node) {
  if (!node) return 0;

  if (node.type === "ArrayExpression") {
    let count = 0;
    for (const element of node.elements || []) {
      if (!element) continue;
      if (element.type === "FunctionExpression" || element.type === "ArrowFunctionExpression") {
        count += 1;
      }
    }
    return count;
  }

  if (node.type === "ObjectExpression") {
    let count = 0;
    for (const prop of node.properties || []) {
      if (prop.type !== "ObjectProperty") continue;
      const value = prop.value;
      if (value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression") count += 1;
      if (value?.type === "ArrayExpression") {
        const head = value.elements?.[0];
        if (head && (head.type === "FunctionExpression" || head.type === "ArrowFunctionExpression")) count += 1;
      }
    }
    return count;
  }

  return 0;
}

function pickBestCandidateCall(ast) {
  const calls = [];
  collectCandidateCalls(ast.program, calls);

  let best = null;
  let bestScore = -1;
  for (const call of calls) {
    let score = 0;
    for (const arg of call.arguments || []) score = Math.max(score, countModuleLikeEntries(arg));
    if (score > bestScore) {
      best = call;
      bestScore = score;
    }
  }

  return best;
}

function propertyKeyValue(keyNode) {
  if (!keyNode) return null;
  if (keyNode.type === "Identifier") return keyNode.name;
  if (keyNode.type === "StringLiteral") return keyNode.value;
  if (keyNode.type === "NumericLiteral") return String(keyNode.value);
  return null;
}

function entryModuleFromCode(code) {
  const marker = ".s=";
  let idx = code.indexOf(marker);
  while (idx !== -1) {
    let pos = idx + marker.length;
    let value = "";
    while (pos < code.length) {
      const ch = code[pos];
      if (ch >= "0" && ch <= "9") {
        value += ch;
        pos += 1;
        continue;
      }
      break;
    }
    if (value.length > 0) return Number(value);
    idx = code.indexOf(marker, idx + marker.length);
  }
  return null;
}

function literalValue(node) {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "NumericLiteral") return String(node.value);
  return null;
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visitor);
      continue;
    }
    if (value && typeof value === "object") walk(value, visitor);
  }
}

function extractBundleDependencyInfo(moduleRecord, format) {
  const dependencyIds = [];
  const dependencySpecifiers = [];

  const requireParam =
    format === "browserify"
      ? moduleRecord.functionNode.params?.[0]?.type === "Identifier"
        ? moduleRecord.functionNode.params[0].name
        : null
      : moduleRecord.functionNode.params?.[2]?.type === "Identifier"
        ? moduleRecord.functionNode.params[2].name
        : null;

  if (requireParam) {
    walk(moduleRecord.functionNode.body || moduleRecord.functionNode, (node) => {
      if (node.type !== "CallExpression") return;
      if (node.callee?.type !== "Identifier" || node.callee.name !== requireParam) return;
      const value = literalValue(node.arguments?.[0]);
      if (value !== null) dependencyIds.push(value);
    });
  }

  if (format === "browserify" && moduleRecord.containerNode?.value?.type === "ArrayExpression") {
    const depMap = moduleRecord.containerNode.value.elements?.[1];
    if (depMap?.type === "ObjectExpression") {
      for (const property of depMap.properties || []) {
        if (property.type !== "ObjectProperty") continue;
        const key = propertyKeyValue(property.key);
        const value = literalValue(property.value);
        if (key) dependencySpecifiers.push(key);
        if (value !== null) dependencyIds.push(value);
      }
    }
  }

  return {
    dependencyIds: Array.from(new Set(dependencyIds.map(String))).sort(),
    dependencySpecifiers: Array.from(new Set(dependencySpecifiers)).sort(),
  };
}

function detectBundle(code) {
  const ast = parseJs(code);
  const call = pickBestCandidateCall(ast);
  if (!call) return null;

  let firstArg = null;
  let firstArgScore = -1;
  for (const arg of call.arguments || []) {
    const score = countModuleLikeEntries(arg);
    if (score > firstArgScore) {
      firstArg = arg;
      firstArgScore = score;
    }
  }
  if (!firstArg) return null;

  if (firstArg.type === "ArrayExpression") {
    const modules = [];
    for (let i = 0; i < firstArg.elements.length; i++) {
      const element = firstArg.elements[i];
      if (!element) continue;
      if (element.type !== "FunctionExpression" && element.type !== "ArrowFunctionExpression") continue;
      modules.push({
        id: i,
        key: String(i),
        source: code.slice(element.start, element.end),
        startOffset: element.start,
        endOffset: element.end,
        functionNode: element,
        containerNode: element,
      });
    }

    if (modules.length > 0) {
      return {
        format: "webpack4",
        entryModuleId: entryModuleFromCode(code),
        modules,
      };
    }
  }

  if (firstArg.type === "ObjectExpression") {
    const browserifyModules = [];
    const webpackModules = [];

    for (const property of firstArg.properties || []) {
      if (property.type !== "ObjectProperty") continue;
      const key = propertyKeyValue(property.key);
      if (key === null) continue;

      if (property.value.type === "ArrayExpression") {
        const head = property.value.elements?.[0];
        if (head && (head.type === "FunctionExpression" || head.type === "ArrowFunctionExpression")) {
          browserifyModules.push({
            id: key,
            key,
            source: code.slice(property.start, property.end),
            startOffset: property.start,
            endOffset: property.end,
            functionNode: head,
            containerNode: property,
          });
        }
        continue;
      }

      if (property.value.type === "FunctionExpression" || property.value.type === "ArrowFunctionExpression") {
        webpackModules.push({
          id: key,
          key,
          source: code.slice(property.start, property.end),
          startOffset: property.start,
          endOffset: property.end,
          functionNode: property.value,
          containerNode: property,
        });
      }
    }

    if (browserifyModules.length > 0) {
      let entryModuleId = null;
      const maybeEntries = call.arguments?.[2];
      if (maybeEntries?.type === "ArrayExpression" && maybeEntries.elements?.length > 0) {
        const firstEntry = maybeEntries.elements[0];
        if (firstEntry?.type === "NumericLiteral") entryModuleId = firstEntry.value;
        if (firstEntry?.type === "StringLiteral") entryModuleId = firstEntry.value;
      }
      return {
        format: "browserify",
        entryModuleId,
        modules: browserifyModules,
      };
    }

    if (webpackModules.length > 0) {
      return {
        format: "webpack5",
        entryModuleId: null,
        modules: webpackModules,
      };
    }
  }

  return null;
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help) {
    console.log("Usage: node unbundle-index.mjs --build-dir <dir> --out <module-index.json> --graph-out <module-graph.json>");
    process.exit(0);
  }

  const projectRoot = process.cwd();
  const buildDir = path.resolve(projectRoot, opts.buildDir);
  const outPath = path.resolve(projectRoot, opts.out);
  const graphPath = path.resolve(projectRoot, opts.graphOut);

  if (!fs.existsSync(buildDir)) {
    console.error(`Build directory not found: ${buildDir}`);
    process.exit(2);
  }

  const jsFiles = listJsFiles(buildDir);
  const bundles = [];
  const graphNodes = [];
  const graphEdges = [];
  const parseErrors = [];

  for (const jsFile of jsFiles) {
    let code = "";
    try {
      code = fs.readFileSync(jsFile, "utf8");
    } catch (error) {
      parseErrors.push({ file: path.relative(projectRoot, jsFile), error: String(error?.message || error) });
      continue;
    }

    try {
      const detected = detectBundle(code);
      if (!detected) continue;

      const relFile = path.relative(projectRoot, jsFile).split(path.sep).join("/");
      const modules = detected.modules.map((moduleRecord) => {
        const depInfo = extractBundleDependencyInfo(moduleRecord, detected.format);
        const moduleId = String(moduleRecord.id);
        const nodeId = `${relFile}#${moduleId}`;

        graphNodes.push({ id: nodeId, bundleFile: relFile, moduleId, bytes: moduleRecord.source.length });
        for (const depId of depInfo.dependencyIds) {
          const depNodeId = `${relFile}#${String(depId)}`;
          graphEdges.push({ from: nodeId, to: depNodeId, kind: "module-require" });
        }

        return {
          id: moduleRecord.id,
          key: moduleRecord.key,
          bytes: moduleRecord.source.length,
          startOffset: moduleRecord.startOffset,
          endOffset: moduleRecord.endOffset,
          dependencyIds: depInfo.dependencyIds,
          dependencySpecifiers: depInfo.dependencySpecifiers,
        };
      });

      bundles.push({
        file: relFile,
        format: detected.format,
        entryModuleId: detected.entryModuleId,
        totalModules: modules.length,
        modules,
      });
    } catch (error) {
      parseErrors.push({ file: path.relative(projectRoot, jsFile), error: String(error?.message || error) });
    }
  }

  const moduleIndex = {
    generatedAt: new Date().toISOString(),
    buildDir: path.relative(projectRoot, buildDir).split(path.sep).join("/"),
    bundles,
    summary: {
      jsFilesScanned: jsFiles.length,
      bundlesDetected: bundles.length,
      modulesIndexed: bundles.reduce((sum, b) => sum + b.totalModules, 0),
      parseErrors: parseErrors.length,
    },
    parseErrors,
  };

  const moduleGraph = {
    generatedAt: new Date().toISOString(),
    buildDir: path.relative(projectRoot, buildDir).split(path.sep).join("/"),
    nodes: graphNodes,
    edges: graphEdges,
    summary: {
      nodeCount: graphNodes.length,
      edgeCount: graphEdges.length,
    },
  };

  ensureDir(path.dirname(outPath));
  ensureDir(path.dirname(graphPath));
  fs.writeFileSync(outPath, JSON.stringify(moduleIndex, null, 2));
  fs.writeFileSync(graphPath, JSON.stringify(moduleGraph, null, 2));

  console.log(`Wrote ${path.relative(projectRoot, outPath)}`);
  console.log(`Wrote ${path.relative(projectRoot, graphPath)}`);
  console.log(`- JS files scanned: ${moduleIndex.summary.jsFilesScanned}`);
  console.log(`- Bundles detected: ${moduleIndex.summary.bundlesDetected}`);
  console.log(`- Modules indexed: ${moduleIndex.summary.modulesIndexed}`);
  console.log(`- Parse errors: ${moduleIndex.summary.parseErrors}`);
}

main();
