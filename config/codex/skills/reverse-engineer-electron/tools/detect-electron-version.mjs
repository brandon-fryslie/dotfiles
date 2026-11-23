#!/usr/bin/env node
//
// detect-electron-version.mjs — Detect the Electron version from an installed .app
//
// Usage: node detect-electron-version.mjs <path-to-app> [extracted-app-dir]
//
// Tries two methods in order:
//   1. Electron Framework Info.plist (preferred, no heuristics)
//   2. package.json in the extracted app (if extracted-app-dir provided)
//
// Outputs: <version> <major> on stdout (e.g., "32.4.1 32")
// Exits 1 if the version cannot be determined, or if an input is there but can't be used.

import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { isPlainObject, JSON_SHAPE } from "./json-value.mjs";
import { inputAt, readJson } from "./path-state.mjs";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const [appArg, extractedArg] = process.argv.slice(2);
if (appArg === undefined) fail("Usage: node detect-electron-version.mjs <path-to-app> [extracted-app-dir]");
const appPath = path.resolve(appArg);

const app = inputAt(appPath, "dir");
if (app.kind !== "dir") fail(`Error: ${appPath} ${app.reason}`);

const found = (where, version) => {
  console.error(`  Found in ${where}: ${version}`);
  console.log(`${version} ${version.split(".")[0]}`);
  process.exit(0);
};

// Method 1: Electron Framework Info.plist. [LAW:verifiable-goals] Prefer deterministic metadata over heuristic string
// scraping. A plist that isn't there leaves method 2; one that is there but can't be read stops the run.
const plistPath = path.join(appPath, "Contents", "Frameworks", "Electron Framework.framework", "Resources", "Info.plist");
const plist = inputAt(plistPath, "file");
if (plist.kind === "unusable") fail(`Error: ${plistPath} ${plist.reason}`);
if (plist.kind === "file") {
  // plutil exits non-zero for a key the plist doesn't carry; each miss is said, and the next key or method is tried.
  for (const key of ["CFBundleShortVersionString", "CFBundleVersion"]) {
    const extracted = spawnSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plistPath], { encoding: "utf8" });
    const version = extracted.status === 0 ? extracted.stdout.trim() : "";
    if (version !== "") found("Electron Framework Info.plist", version);
    console.error(`  ${plistPath} gives no ${key}: ${(extracted.stderr || extracted.error?.message || "empty").trim()}`);
  }
}

// Method 2: the electron dependency package.json declares, its range's leading operators dropped.
if (extractedArg !== undefined) {
  const extractedDir = path.resolve(extractedArg);
  const extracted = inputAt(extractedDir, "dir");
  if (extracted.kind !== "dir") fail(`Error: ${extractedDir} ${extracted.reason}`);
  const manifestPath = path.join(extractedDir, "package.json");
  const manifest = readJson(manifestPath, JSON_SHAPE.object);
  if (manifest.kind === "unusable") fail(`Error: ${manifestPath} ${manifest.reason}`);
  if (manifest.kind === "json") {
    const dependencyMaps = ["devDependencies", "dependencies"].map((field) => [field, manifest.value[field]]).filter(([, deps]) => deps !== undefined);
    for (const [field, deps] of dependencyMaps) {
      if (!isPlainObject(deps)) fail(`Error: ${manifestPath} gives ${field} ${JSON.stringify(deps)}, which is not an object`);
    }
    const spec = dependencyMaps.map(([, deps]) => deps.electron).find((value) => typeof value === "string" && value.trim() !== "");
    const version = spec === undefined ? "" : spec.trim().replace(/^[^0-9]*/, "");
    if (version !== "") found("package.json", version);
  }
}

fail("  Could not determine Electron version");
