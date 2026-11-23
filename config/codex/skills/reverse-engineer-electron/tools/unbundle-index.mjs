#!/usr/bin/env node
/**
 * unbundle-index.mjs
 *
 * Build deterministic module index + graph from webpack/browserify style bundles.
 *
 * Usage:
 *   node unbundle-index.mjs --build-dir app/.vite/build --out deps/module-index.json --graph-out deps/module-graph.json
 *
 * // [LAW:verifiable-goals] Emits deterministic JSON artifacts for module index and dependency graph, both from the
 * // last run that finished.
 * // [LAW:one-source-of-truth] module-index.json is the canonical module-map input for downstream dependency analysis.
 * // [LAW:dataflow-not-control-flow] Every JS file has one outcome: unreadable or unparsed (a parse error), or parsed,
 * // and a parsed file indexes the modules of the bundle it is, none for a file that isn't one.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { detectBundle, listJsFiles, moduleDependencies, readJsFile } from "./bundle.mjs";
import { clearArtifact, writeArtifact } from "./artifact.mjs";

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
  clearArtifact(outPath);
  clearArtifact(graphPath);

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
    const relFile = path.relative(projectRoot, jsFile).split(path.sep).join("/");
    const read = readJsFile(jsFile);
    if (read.kind !== "parsed") {
      parseErrors.push(...read.errors.map((error) => ({ file: relFile, error })));
      continue;
    }
    const detected = detectBundle(read.ast, read.code);
    if (detected === null) continue;

    const dependencies = moduleDependencies(read.ast, detected);
    const modules = detected.modules.map((moduleRecord) => {
      const depInfo = dependencies.get(moduleRecord);
      const moduleId = moduleRecord.id;
      const nodeId = `${relFile}#${moduleId}`;

      graphNodes.push({ id: nodeId, bundleFile: relFile, moduleId, bytes: moduleRecord.source.length });
      for (const depId of depInfo.dependencyIds) {
        graphEdges.push({ from: nodeId, to: `${relFile}#${depId}`, kind: "module-require" });
      }

      return {
        id: moduleRecord.id,
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

  writeArtifact(outPath, moduleIndex);
  writeArtifact(graphPath, moduleGraph);

  console.log(`Wrote ${path.relative(projectRoot, outPath)}`);
  console.log(`Wrote ${path.relative(projectRoot, graphPath)}`);
  console.log(`- JS files scanned: ${moduleIndex.summary.jsFilesScanned}`);
  console.log(`- Bundles detected: ${moduleIndex.summary.bundlesDetected}`);
  console.log(`- Modules indexed: ${moduleIndex.summary.modulesIndexed}`);
  console.log(`- Parse errors: ${moduleIndex.summary.parseErrors}`);
}

main();
