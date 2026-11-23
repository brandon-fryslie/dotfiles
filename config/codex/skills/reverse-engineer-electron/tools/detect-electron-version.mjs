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
// Exits 1 if the version cannot be determined, or an input that is there can't be used.

import { spawnSync } from "child_process";
import path from "path";
import process from "process";
import { JSON_SHAPE } from "./json-value.mjs";
import { inputAt, readJson } from "./path-state.mjs";

function fail(message) {
  console.error(`  ${message}`);
  process.exit(1);
}

function found(version, where) {
  console.error(`  Found in ${where}: ${version}`);
  console.log(`${version} ${version.split(".")[0]}`);
  process.exit(0);
}

// The value plutil reads for key from plist, or null when the plist doesn't hold it.
function plistValue(plist, key) {
  const result = spawnSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist], { encoding: "utf8" });
  if (result.error) throw result.error;
  return result.status === 0 && result.stdout.trim() !== "" ? result.stdout.trim() : null;
}

// [LAW:parse-dont-validate] The one version a dependency spec names: an exact semver, written bare, with "=", or with
// "v". A range (^, ~, >=, x), a tag or a URL names no one version, so it gives none.
const EXACT_VERSION = /^[=v]?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;
const versionOf = (spec) => EXACT_VERSION.exec(spec.trim())?.[1] ?? null;

function main() {
  const [appPath, extractedDir] = process.argv.slice(2);
  if (appPath === undefined) fail("Usage: node detect-electron-version.mjs <path-to-app> [extracted-app-dir]");
  const app = inputAt(appPath, "dir");
  if (app.kind !== "dir") fail(`Error: ${appPath} ${app.reason}`);

  // Method 1: Electron Framework Info.plist
  // [LAW:verifiable-goals] Prefer deterministic metadata over heuristic string scraping.
  const plist = path.join(appPath, "Contents", "Frameworks", "Electron Framework.framework", "Resources", "Info.plist");
  const plistInput = inputAt(plist, "file");
  if (plistInput.kind === "unusable") fail(`Error: ${plist} ${plistInput.reason}`);
  if (plistInput.kind === "file") {
    const version = plistValue(plist, "CFBundleShortVersionString") ?? plistValue(plist, "CFBundleVersion");
    if (version !== null) found(version, "Electron Framework Info.plist");
  }

  // Method 2: package.json in the extracted app
  if (extractedDir !== undefined) {
    const manifestPath = path.join(extractedDir, "package.json");
    const manifest = readJson(manifestPath, JSON_SHAPE.object);
    if (manifest.kind === "unusable") fail(`Error: ${manifestPath} ${manifest.reason}`);
    if (manifest.kind === "json") {
      const { devDependencies, dependencies } = manifest.value;
      const spec = devDependencies?.electron ?? dependencies?.electron;
      if (spec !== undefined) {
        const version = typeof spec === "string" ? versionOf(spec) : null;
        if (version === null) fail(`Could not determine Electron version: ${manifestPath} gives electron ${JSON.stringify(spec)}, which names no one version`);
        found(version, "package.json");
      }
    }
  }

  fail("Could not determine Electron version");
}

main();
