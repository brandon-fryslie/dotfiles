#!/usr/bin/env node
//
// detect-build-dir.mjs — Find the JS build directory within an extracted Electron app
//
// Usage: node detect-build-dir.mjs <extracted-app-dir>
//
// The build directory is the one holding the file Electron loads as the app's entry point. An app with no
// package.json, or one whose entry point node can't find, falls back to a heuristic: the directory holding the most
// source files, outside node_modules. Prints the path relative to the app dir as stdout's last line (stderr carries
// the chatter); exits 1 when no directory is found or an input can't be used.

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import process from "process";
import { JSON_SHAPE } from "./json-value.mjs";
import { inputAt, readJson } from "./path-state.mjs";
import { listSourceFiles, unreadText, SOURCE_TREE_EXCLUDES } from "./shape.mjs";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// [LAW:one-source-of-truth] The entry file is the one node resolves for the app directory, as Electron loads it:
// package.json's main, or index.js when main names nothing there. The trailing separator makes node read the app as a
// directory, so a sibling file named after it (app.js beside app/) can't win. null when node finds no entry file.
function entryFile(appDir, manifestPath) {
  try {
    return createRequire(manifestPath).resolve(appDir + path.sep);
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    console.error(`  Warning: node finds no entry file for ${appDir} (${error.message.split("\n")[0]}); falling back to the heuristic.`);
    return null;
  }
}

// The directory holding the most source files, ties broken by path, read by shape.mjs's link rule; null for none.
function busiestSourceDir(appDir) {
  const { files, unread } = listSourceFiles(appDir, SOURCE_TREE_EXCLUDES);
  for (const entry of unread) console.error(`  ${unreadText(appDir, entry)}`);
  const counts = new Map();
  for (const rel of files) counts.set(path.posix.dirname(rel), (counts.get(path.posix.dirname(rel)) ?? 0) + 1);
  const [best] = [...counts].sort(([dirA, a], [dirB, b]) => b - a || (dirA < dirB ? -1 : dirA > dirB ? 1 : 0));
  return best === undefined ? null : path.join(appDir, best[0]);
}

function main() {
  const [appArg] = process.argv.slice(2);
  if (appArg === undefined) {
    console.error("Usage: node detect-build-dir.mjs <extracted-app-dir>");
    process.exit(1);
  }
  const input = inputAt(appArg, "dir");
  if (input.kind !== "dir") fail(`${appArg} ${input.reason}`);
  const appDir = fs.realpathSync(appArg);

  // [LAW:no-silent-failure] A package.json that is there but can't be read is an error, never the heuristic.
  const manifestPath = path.join(appDir, "package.json");
  const manifest = readJson(manifestPath, JSON_SHAPE.object);
  if (manifest.kind === "unusable") fail(`${manifestPath} ${manifest.reason}`);
  const entry = manifest.kind === "json" ? entryFile(appDir, manifestPath) : null;
  const buildDir = entry === null ? busiestSourceDir(appDir) : path.dirname(entry);
  if (buildDir === null) fail(`no build directory in ${appDir}: it holds no source files outside node_modules`);

  const relative = path.relative(appDir, buildDir) || ".";
  if (relative.split(path.sep)[0] === "..") fail(`${appDir}'s entry file ${entry} is outside the app`);
  if (relative.split(path.sep).includes("node_modules")) {
    console.error("  Warning: detected path is inside node_modules/; this can be a vendor false positive.");
  }
  console.error(`  Detected: ${relative}`);
  console.log(relative);
}

main();
