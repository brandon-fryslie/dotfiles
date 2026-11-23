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
 * // [LAW:dataflow-not-control-flow] Every JS file executes the same read/parse/detect/index pipeline; a file that can't
 * // be read or parsed is a parse error, and one that isn't a bundle indexes no modules.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { parseRunnable, listFiles, SOURCE_TREE_EXCLUDES } from "./shape.mjs";
import { detectBundle, moduleDependencies } from "./bundle.mjs";

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
  return listFiles(rootDir, SOURCE_TREE_EXCLUDES)
    .filter((rel) => path.extname(rel) === ".js")
    .map((rel) => path.join(rootDir, rel));
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

    const relFile = path.relative(projectRoot, jsFile).split(path.sep).join("/");
    const { ast, errors } = parseRunnable(code, "js");
    parseErrors.push(...errors.map((error) => ({ file: relFile, error })));
    const detected = ast === null ? null : detectBundle(ast, code);
    if (detected === null) continue;

    const dependencies = moduleDependencies(ast, detected);
    const modules = detected.modules.map((moduleRecord) => {
      const depInfo = dependencies.get(moduleRecord);
      const moduleId = String(moduleRecord.id);
      const nodeId = `${relFile}#${moduleId}`;

      graphNodes.push({ id: nodeId, bundleFile: relFile, moduleId, bytes: moduleRecord.source.length });
      for (const depId of depInfo.dependencyIds) {
        graphEdges.push({ from: nodeId, to: `${relFile}#${depId}`, kind: "module-require" });
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
