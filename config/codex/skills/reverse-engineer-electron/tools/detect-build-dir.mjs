#!/usr/bin/env node
//
// detect-build-dir.mjs — Find the JS build directory within an extracted Electron app
//
// Usage: node detect-build-dir.mjs <extracted-app-dir>
//
// Prefers the directory that contains the `main` entrypoint from package.json.
// Falls back to a heuristic: directory containing the most .js files.
// Outputs the relative path from the extracted app root on stdout.
// Exits 1 if no candidate is found, or if an input is there but can't be used.

import fs from "fs";
import { createRequire } from "module";
import path from "path";
import process from "process";
import { JSON_SHAPE } from "./json-value.mjs";
import { inputAt, readJson } from "./path-state.mjs";
import { listFiles, SOURCE_TREE_EXCLUDES } from "./shape.mjs";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const appArg = process.argv[2];
if (!appArg) fail("Usage: node detect-build-dir.mjs <extracted-app-dir>");

const app = inputAt(path.resolve(appArg), "dir");
if (app.kind !== "dir") fail(`Error: ${path.resolve(appArg)} ${app.reason}`);
// node resolves an entrypoint to its real path, so the app dir is spelled the same way.
const appDir = fs.realpathSync(path.resolve(appArg));

// [LAW:one-source-of-truth] The app's entrypoint is the file node loads for it: package.json's main resolved as node
// resolves it (a file, the file with .js, a directory's index.js, and index.js for a main that is unset or not a path).
// [LAW:no-silent-failure] A package.json that is there but can't be used stops the run naming why; only one that isn't
// there, or an entrypoint node can't find, falls through to the heuristic, the second with a warning.
function mainBuildDir() {
  const manifestPath = path.join(appDir, "package.json");
  const manifest = readJson(manifestPath, JSON_SHAPE.object);
  if (manifest.kind === "absent") return null;
  if (manifest.kind !== "json") fail(`Error: ${manifestPath} ${manifest.reason}`);
  try {
    return path.dirname(createRequire(manifestPath).resolve(appDir));
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    console.error(`  Warning: node finds no entrypoint for ${appDir} (main ${JSON.stringify(manifest.value.main) ?? "unset"}); falling back to heuristic.`);
    return null;
  }
}

// The directory holding the most .js files node could load, outside node_modules; a tie goes to the path that sorts
// last. A .js entry that can't be read is named, not counted.
function heuristicBuildDir() {
  const counts = new Map();
  const readable = (rel) => {
    const entry = inputAt(path.join(appDir, rel), "file");
    if (entry.kind !== "file") console.error(`  Warning: ${path.join(appDir, rel)} ${entry.reason}; not counted.`);
    return entry.kind === "file";
  };
  for (const rel of listFiles(appDir, SOURCE_TREE_EXCLUDES).filter((file) => file.endsWith(".js")).filter(readable)) {
    const dir = path.dirname(rel);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  const ranked = [...counts].sort(([leftDir, left], [rightDir, right]) => right - left || (rightDir < leftDir ? -1 : rightDir > leftDir ? 1 : 0));
  return ranked.length === 0 ? null : path.join(appDir, ranked[0][0]);
}

const buildDir = mainBuildDir() ?? heuristicBuildDir();
if (buildDir === null) fail("  Could not auto-detect build directory: no .js files outside node_modules.");

const relative = path.relative(appDir, buildDir).split(path.sep).join("/") || ".";
if (relative.startsWith("node_modules/")) {
  console.error("  Warning: detected path is inside node_modules/; this can be a vendor false positive.");
}
console.error(`  Detected: ${relative}`);
console.log(relative);
