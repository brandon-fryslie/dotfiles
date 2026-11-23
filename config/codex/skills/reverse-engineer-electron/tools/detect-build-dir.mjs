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
if (appArg === undefined) fail("Usage: node detect-build-dir.mjs <extracted-app-dir>");
const appDir = path.resolve(appArg);

const app = inputAt(appDir, "dir");
if (app.kind !== "dir") fail(`Error: ${appDir} ${app.reason}`);

// [LAW:one-source-of-truth] package.json's main is the app's authoritative entrypoint contract. [LAW:no-silent-failure]
// Only a package.json that isn't there, one that gives no main, or a main that names nothing falls through to the
// heuristic; one that is there but can't be used stops the run naming why.
function mainBuildDir() {
  const manifestPath = path.join(appDir, "package.json");
  const manifest = readJson(manifestPath, JSON_SHAPE.object);
  if (manifest.kind === "absent") return null;
  if (manifest.kind !== "json") fail(`Error: ${manifestPath} ${manifest.reason}`);
  const { main } = manifest.value;
  if (main === undefined) return null;
  if (typeof main !== "string" || main.trim() === "") fail(`Error: ${manifestPath} gives main ${JSON.stringify(main)}, which is not a path`);
  const mainPath = path.join(appDir, main.trim());
  const entry = inputAt(mainPath, "file");
  if (entry.kind === "file") return path.dirname(mainPath);
  if (entry.kind === "unusable") fail(`Error: package.json main ${mainPath} ${entry.reason}`);
  console.error(`  Warning: package.json main '${main.trim()}' ${entry.reason}; falling back to heuristic.`);
  return null;
}

// The directory holding the most .js files outside node_modules; a tie goes to the path that sorts last.
function heuristicBuildDir() {
  const counts = new Map();
  for (const rel of listFiles(appDir, SOURCE_TREE_EXCLUDES).filter((file) => file.endsWith(".js"))) {
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
