#!/usr/bin/env node
/**
 * detect-dependencies.mjs
 *
 * Deterministically identifies third-party dependencies in two cases:
 * 1. Plain JS files with static bare imports/requires
 * 2. Bundled webpack/browserify files whose modules must be classified
 *
 * This uses AST parsing plus structural hashing. It does not use regex-based
 * code parsing for important decisions.
 *
 * // [LAW:verifiable-goals] A run that finishes writes a machine-readable report with explicit signals and errors, and
 * // one that fails leaves no report at --out: the previous run's is removed first, and this run's is renamed into
 * // place whole, so a report at --out is always the last finished run's.
 * // [LAW:one-source-of-truth] Bundle classification is derived from code, comments, and package metadata already on disk,
 * // and from the hand-curated third-party-fingerprints.json beside this script.
 * // [LAW:dataflow-not-control-flow] Every build file has one outcome: unreadable, unparsed (with its syntax errors), or
 * // parsed. Every parsed file goes through the same two analyses, static bare specifiers and bundle detection, on
 * // its one syntax tree; what varies is the data they find.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { builtinModules } from "module";
import { fileURLToPath } from "url";
import { appAt, compareLocations, copiesOf, entryNameOf, isLocation, isNonEmptyString, locationDir, topLevelLocation, walkStarts } from "./node-modules.mjs";
import { walk, isFunctionNode, functionBodyShape, parseRunnable, listFiles, SOURCE_TREE_EXCLUDES } from "./shape.mjs";
import { detectBundle, moduleDependencies } from "./bundle.mjs";
import traverseImport from "@babel/traverse";

const traverseAst = traverseImport.default || traverseImport;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINGERPRINTS_PATH = path.join(SCRIPT_DIR, "third-party-fingerprints.json");
const BUILTIN_SET = new Set(builtinModules.map((item) => (item.startsWith("node:") ? item.slice(5) : item)));
const LOADER_RUNTIME_PACKAGES = new Set(["style-loader", "css-loader", "file-loader", "url-loader"]);
// The body-token count under which a function's shape is too common to name its package.
const MIN_FUNCTION_SHAPE_TOKENS = 20;
// [LAW:one-type-per-behavior] A wrapper rule credits a module that isn't yet classified with the package that
// dominates its vendor neighbours of one kind. A wrapper is a small module, so a module at or over sourceLimit
// characters has no neighbours to the rule, and a large module that requires vendor code is not credited to it.
const WRAPPER_RULES = [
  { signal: "dep-wrapper", neighbours: "deps", sourceLimit: 2500, weight: () => 4 },
  { signal: "parent-wrapper", neighbours: "parents", sourceLimit: 2200, weight: (vendor) => (vendor.deps.length === 0 ? 3 : 2) },
];
// One record per file that couldn't be read, parsed, or listed, in report.parseErrors.
const fileError = (file, error) => ({ file, error: String(error?.message || error) });
function parseArgs(argv) {
  const opts = {
    appDir: "resources/app",
    buildDir: "app",
    out: "deps/detected-dependencies.json",
    moduleIndex: "",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app-dir") opts.appDir = argv[++i] || opts.appDir;
    else if (arg === "--build-dir") opts.buildDir = argv[++i] || opts.buildDir;
    else if (arg === "--out") opts.out = argv[++i] || opts.out;
    else if (arg === "--module-index") opts.moduleIndex = argv[++i] || opts.moduleIndex;
    else if (arg === "-h" || arg === "--help") return { help: true, opts };
  }

  return { help: false, opts };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listJsFiles(targetPath) {
  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    return path.extname(targetPath) === ".js" ? [targetPath] : [];
  }
  return listPackageJsFiles(targetPath);
}

function isBareSpecifier(specifier) {
  if (!specifier) return false;
  if (specifier.startsWith("node:")) return true;
  if (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) return false;
  return true;
}

function normalizeBareSpecifier(specifier) {
  return specifier.startsWith("node:") ? specifier.slice("node:".length) : specifier;
}

function pkgNameFromSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  const slashIndex = specifier.indexOf("/");
  return slashIndex === -1 ? specifier : specifier.slice(0, slashIndex);
}

function pkgNameFromNodeModulesPath(text) {
  const marker = "/node_modules/";
  const normalized = text.split("\\").join("/");
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  const tail = normalized.slice(idx + marker.length);
  const parts = tail.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  return parts[0];
}

// [LAW:one-source-of-truth] Every copy of every package node finds in the app's node_modules, with the swap outcome
// replace-dependency acts on (including what it loads, or that it loads nothing), and the walk's verdict on how much
// of the tree could be read.
function readOnDisk(appDir, projectRoot) {
  const app = appAt(path.join(appDir, "node_modules"), projectRoot);
  const { verdict, starts, unlisted } = walkStarts(app);
  return { verdict, unlisted, copies: copiesOf(app, starts).map((copy) => ({ ...copy, dir: locationDir(app, copy.location) })) };
}

const byNameThenLocation = (copies) => [...copies].sort((a, b) => a.name.localeCompare(b.name) || compareLocations(a.location, b.location));

function listPackageJsFiles(pkgDir) {
  return listFiles(pkgDir, SOURCE_TREE_EXCLUDES)
    .filter((rel) => path.extname(rel) === ".js")
    .map((rel) => path.join(pkgDir, rel));
}

// Each loaded package version's function shapes, in the BODY domain a bundle factory is looked up in, and every file
// or directory that couldn't be listed, read, or parsed, so a package that contributed no shapes because it couldn't
// be read is a parse error, not a package that matched nothing. [LAW:no-silent-failure]
// A shape maps to the package versions that ship it, each once, at the first of its files that has it.
function indexPackageShapeHashes(packages) {
  const byHash = new Map();
  const errors = [];
  const attempt = (file, work) => {
    try {
      return work();
    } catch (error) {
      errors.push(fileError(file, error));
      return null;
    }
  };
  for (const pkg of packages) {
    for (const jsFile of attempt(pkg.dir, () => listPackageJsFiles(pkg.dir)) ?? []) {
      const code = attempt(jsFile, () => fs.readFileSync(jsFile, "utf8"));
      if (code === null) continue;
      const { ast, errors: syntaxErrors } = parseRunnable(code, "js");
      errors.push(...syntaxErrors.map((error) => fileError(jsFile, error)));
      if (ast === null) continue;
      const entry = { package: pkg.name, version: pkg.version, file: path.relative(pkg.dir, jsFile) };
      walk(ast.program, (node) => {
        if (!isFunctionNode(node)) return;
        const shape = functionBodyShape(node);
        if (shape.size < MIN_FUNCTION_SHAPE_TOKENS) return;
        const versions = byHash.get(shape.hash) ?? new Map();
        if (!versions.has(`${pkg.name}@${pkg.version}`)) versions.set(`${pkg.name}@${pkg.version}`, entry);
        byHash.set(shape.hash, versions);
      });
    }
  }
  return { byHash: new Map([...byHash].map(([hash, versions]) => [hash, [...versions.values()]])), errors };
}

function loadFingerprints() {
  const raw = JSON.parse(fs.readFileSync(FINGERPRINTS_PATH, "utf8"));
  const filtered = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("//")) continue;
    filtered[key] = Array.isArray(value) ? value : [];
  }
  return filtered;
}

// [LAW:one-source-of-truth] Every package version the app's package-lock.json records, at the location it records it
// at, named by the one location grammar node-modules.mjs owns: a key's package is the entry after its last
// node_modules, or the name its entry records, for an alias. A lockfile v1's top-level dependencies are at their top-level locations. A lockfile that is there and
// can't be read stops the run, never reads as one that records nothing. [LAW:no-silent-failure]
function loadLockfilePackages(appDir) {
  const packageLockPath = path.join(appDir, "package-lock.json");
  if (!fs.existsSync(packageLockPath)) return [];
  let packageLock;
  try {
    packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
  } catch (error) {
    throw new Error(`${packageLockPath} is not a readable lockfile: ${error.message}`);
  }
  const recorded = [
    ...Object.entries(packageLock.dependencies ?? {}).map(([name, meta]) => [topLevelLocation(name), meta?.version]),
    // An alias's entry records the package it is as its name.
    ...Object.entries(packageLock.packages ?? {}).map(([location, meta]) => [location, meta?.version, isNonEmptyString(meta?.name) ? meta.name : undefined]),
  ];
  const byLocation = new Map(recorded
    .filter(([location, version]) => isLocation(location) && isNonEmptyString(version))
    .map(([location, version, name]) => [location, { name: name ?? entryNameOf(location), version, location }]));
  return [...byLocation.values()].sort((left, right) => left.name.localeCompare(right.name) || compareLocations(left.location, right.location));
}

function parseStaticBareSpecifiers(ast) {
  const specifiers = [];

  traverseAst(ast, {
    ImportDeclaration(p) {
      const source = p.node.source?.value;
      if (typeof source === "string") specifiers.push(source);
    },
    ExportNamedDeclaration(p) {
      const source = p.node.source?.value;
      if (typeof source === "string") specifiers.push(source);
    },
    ExportAllDeclaration(p) {
      const source = p.node.source?.value;
      if (typeof source === "string") specifiers.push(source);
    },
    CallExpression(p) {
      if (p.node.callee?.type === "Identifier" && p.node.callee.name === "require") {
        const firstArg = p.node.arguments?.[0];
        if (firstArg?.type === "StringLiteral") specifiers.push(firstArg.value);
      }

      if (p.node.callee?.type === "MemberExpression" && !p.node.callee.computed) {
        const object = p.node.callee.object;
        const property = p.node.callee.property;
        if (object?.type === "Identifier" && object.name === "require" && property?.type === "Identifier" && property.name === "resolve") {
          const firstArg = p.node.arguments?.[0];
          if (firstArg?.type === "StringLiteral") specifiers.push(firstArg.value);
        }
      }
    },
  });

  return specifiers;
}

function findFingerprintMatches(text, fingerprints) {
  const counts = {};
  const lowered = text.toLowerCase();
  for (const [pkgName, needles] of Object.entries(fingerprints)) {
    const matched = [];
    for (const needle of needles) {
      if (typeof needle !== "string" || needle.length === 0) continue;
      if (lowered.includes(needle.toLowerCase())) matched.push(needle);
    }
    if (matched.length > 0) counts[pkgName] = { hits: matched.length, matched };
  }
  return counts;
}

function findVersionText(text) {
  let current = "";
  for (let idx = 0; idx < text.length; idx++) {
    const ch = text[idx];
    const isDigit = ch >= "0" && ch <= "9";
    if (isDigit || ch === ".") {
      current += ch;
      continue;
    }
    if (current.split(".").length >= 3 && current[0] >= "0" && current[0] <= "9") return current;
    current = "";
  }
  if (current.split(".").length >= 3 && current[0] >= "0" && current[0] <= "9") return current;
  return null;
}

function isBoundaryChar(ch) {
  if (!ch) return true;
  const code = ch.charCodeAt(0);
  const isDigit = code >= 48 && code <= 57;
  const isUpper = code >= 65 && code <= 90;
  const isLower = code >= 97 && code <= 122;
  return !(isDigit || isUpper || isLower || ch === "_" || ch === "-" || ch === "/" || ch === ".");
}

function includesWithBoundaries(text, needle) {
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  let index = haystack.indexOf(target);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : "";
    const after = index + target.length < haystack.length ? haystack[index + target.length] : "";
    if (isBoundaryChar(before) && isBoundaryChar(after)) return true;
    index = haystack.indexOf(target, index + 1);
  }
  return false;
}

function extractLicenseSections(text) {
  const lowered = text.toLowerCase();
  const markers = ["@license", "copyright"];
  const sections = [];
  for (const marker of markers) {
    let start = lowered.indexOf(marker);
    while (start !== -1) {
      let from = start;
      let to = Math.min(text.length, start + 320);
      const blockStart = text.lastIndexOf("/*", start);
      const blockEnd = text.indexOf("*/", start);
      if (blockStart !== -1 && blockEnd !== -1) {
        from = blockStart;
        to = blockEnd + 2;
      }
      sections.push(text.slice(from, to));
      start = lowered.indexOf(marker, start + marker.length);
    }
  }
  return sections;
}

function findLicenseSignal(text, knownPackages) {
  const sections = extractLicenseSections(text);
  if (sections.length === 0) return null;
  for (const section of sections) {
    for (const pkgName of knownPackages) {
      if (includesWithBoundaries(section, pkgName)) {
        return {
          package: pkgName,
          version: findVersionText(section),
          signal: "license",
        };
      }
    }
  }
  return null;
}

function findWebpackCommentSignal(text) {
  const markers = ["EXTERNAL MODULE:", "CONCATENATED MODULE:"];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const lineEnd = text.indexOf("\n", idx);
    const rawLine = lineEnd === -1 ? text.slice(idx) : text.slice(idx, lineEnd);
    const pkgName = pkgNameFromNodeModulesPath(rawLine);
    if (!pkgName) continue;
    return {
      package: pkgName,
      version: null,
      signal: "webpack-comment",
    };
  }
  return null;
}

function fileRel(projectRoot, absPath) {
  return path.relative(projectRoot, absPath) || ".";
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function addScore(scoreMap, evidenceList, pkgName, points, signal, detail) {
  if (!pkgName || !Number.isFinite(points) || points <= 0) return;
  scoreMap[pkgName] = (scoreMap[pkgName] || 0) + points;
  evidenceList.push({ package: pkgName, score: points, signal, detail: detail || null });
}

// How many of the given module states are each package's.
function countPackages(states) {
  const counts = {};
  for (const { package: pkgName } of states) counts[pkgName] = (counts[pkgName] || 0) + 1;
  return counts;
}

function pickTopPackage(scoreMap) {
  const entries = Object.entries(scoreMap);
  if (entries.length === 0) return null;
  entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const [pkgName, score] = entries[0];
  const runnerUp = entries[1] ? entries[1][1] : -Infinity;
  return {
    package: pkgName,
    score,
    margin: score - runnerUp,
    tied: runnerUp === score,
  };
}

function packageBaseName(pkgName) {
  return pkgName.startsWith("@") ? pkgName.split("/")[1] || pkgName : pkgName;
}

function hasSelfIdentifyingFingerprint(pkgName, matchInfo) {
  if (!matchInfo?.matched?.length) return false;
  const baseName = packageBaseName(pkgName).toLowerCase();
  const fullName = pkgName.toLowerCase();
  return matchInfo.matched.some((needle) => {
    const lowered = needle.toLowerCase();
    return lowered.includes(fullName) || lowered.includes(baseName);
  });
}

function collectStringLiterals(node) {
  const values = [];
  walk(node, (current) => {
    if (current.type === "StringLiteral" && typeof current.value === "string") values.push(current.value);
  });
  return values;
}

function scoreAppAnchors(stringLiterals) {
  let score = 0;
  const unique = uniqueStrings(stringLiterals);
  for (const value of unique) {
    const lowered = value.toLowerCase();
    if (lowered.includes("http://") || lowered.includes("https://")) score += 3;
    if (lowered.includes("/api/")) score += 3;
    if (lowered.includes("discord.com") || lowered.includes("discordsplash")) score += 4;
    if (value.includes("Splash.onStateUpdate") || value === "Splash") score += 4;
  }
  return score;
}

function isEmptyObjectExportModule(moduleRecord) {
  const statements = moduleRecord.functionNode.body?.body || [];
  if (statements.length !== 1) return false;
  const statement = statements[0];
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement.expression;
  if (expression?.type !== "AssignmentExpression") return false;
  return expression.right?.type === "ObjectExpression" && expression.right.properties.length === 0;
}

// A webpack factory whose one statement exports the bundle's public path (its require binding's `p`) plus a file name.
function isWebpackPublicPathAssetModule(moduleRecord) {
  const statements = moduleRecord.functionNode.body?.body || [];
  if (statements.length !== 1) return false;
  const statement = statements[0];
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement.expression;
  if (expression?.type !== "AssignmentExpression") return false;
  if (expression.right?.type !== "BinaryExpression" || expression.right.operator !== "+") return false;
  if (expression.right.right?.type !== "StringLiteral") return false;
  const publicPath = expression.right.left;
  return (
    moduleRecord.require !== null &&
    publicPath?.type === "MemberExpression" &&
    !publicPath.computed &&
    publicPath.object?.type === "Identifier" &&
    publicPath.object.name === moduleRecord.require.name &&
    publicPath.property?.type === "Identifier" &&
    publicPath.property.name === "p"
  );
}

function buildBundleGraph(bundle, dependencies) {
  const byId = new Map();
  const parentsById = new Map();
  const edgesById = new Map();

  for (const moduleRecord of bundle.modules) {
    const depInfo = dependencies.get(moduleRecord);
    byId.set(String(moduleRecord.id), { ...moduleRecord, ...depInfo });
    edgesById.set(String(moduleRecord.id), depInfo.dependencyIds);
    parentsById.set(String(moduleRecord.id), []);
  }

  for (const [fromId, deps] of edgesById.entries()) {
    for (const depId of deps) {
      if (!parentsById.has(depId)) continue;
      parentsById.get(depId).push(fromId);
    }
  }

  return { byId, edgesById, parentsById };
}

function classifyBundleModules(bundle, dependencies, context) {
  const graph = buildBundleGraph(bundle, dependencies);
  const states = [];
  const stateById = new Map();

  for (const moduleRecord of bundle.modules) {
    const graphRecord = graph.byId.get(String(moduleRecord.id));
    const moduleText = moduleRecord.source;
    const webpackCommentSignal = findWebpackCommentSignal(moduleText);
    const licenseSignal = findLicenseSignal(moduleText, context.knownPackages);
    const fingerprintMatches = findFingerprintMatches(moduleText, context.fingerprints);
    const shapeHash = functionBodyShape(moduleRecord.functionNode).hash;
    const hashMatches = context.packageShapeHashes.get(shapeHash) ?? [];
    // A shape names a package when every package version that ships it is a version of that one package.
    const uniqueHashPackage = new Set(hashMatches.map((item) => item.package)).size === 1 ? hashMatches[0] : null;
    const stringLiterals = collectStringLiterals(moduleRecord.functionNode.body);
    const appAnchorScore = scoreAppAnchors(stringLiterals);
    const generatedAssetModule = isWebpackPublicPathAssetModule(moduleRecord);
    const scores = {};
    const evidence = [];

    if (moduleRecord.explicitPackage) {
      addScore(scores, evidence, moduleRecord.explicitPackage, 10, "module-path", moduleRecord.key);
    }

    if (webpackCommentSignal) {
      addScore(scores, evidence, webpackCommentSignal.package, 9, "webpack-comment", null);
    }

    if (licenseSignal) {
      addScore(scores, evidence, licenseSignal.package, 6, "license", licenseSignal.version);
    }

    if (uniqueHashPackage) {
      addScore(scores, evidence, uniqueHashPackage.package, 7, "shape-hash", uniqueHashPackage.file);
    }

    for (const [pkgName, matchInfo] of Object.entries(fingerprintMatches)) {
      addScore(scores, evidence, pkgName, Math.min(6, matchInfo.hits * 2), "string-fingerprint", `${matchInfo.hits} hits`);
      if (hasSelfIdentifyingFingerprint(pkgName, matchInfo)) {
        addScore(scores, evidence, pkgName, 7, "package-self-id", matchInfo.matched[0]);
      }
    }

    for (const depSpecifier of graphRecord.dependencySpecifiers) {
      if (!isBareSpecifier(depSpecifier)) continue;
      const pkgName = pkgNameFromSpecifier(normalizeBareSpecifier(depSpecifier));
      addScore(scores, evidence, pkgName, 4, "dep-specifier", depSpecifier);
    }

    const initialTop = pickTopPackage(scores);
    const lowAnchorTinyModule = moduleRecord.source.length <= 500 && appAnchorScore === 0;
    const loaderRuntimeModule =
      initialTop &&
      LOADER_RUNTIME_PACKAGES.has(initialTop.package) &&
      initialTop.score >= 2 &&
      appAnchorScore <= 3 &&
      moduleRecord.source.length <= 5000;
    const strongSinglePackageFingerprint =
      initialTop &&
      !initialTop.tied &&
      initialTop.score >= 4 &&
      appAnchorScore === 0 &&
      Object.keys(scores).length === 1;
    const initialThreshold = lowAnchorTinyModule ? 4 : 6;
    const vendorTop =
      initialTop && !initialTop.tied && (initialTop.score >= initialThreshold || loaderRuntimeModule || strongSinglePackageFingerprint)
        ? initialTop
        : null;
    // [LAW:types-are-the-program] A module is an asset, a vendor module with its package, or app code; only a vendor
    // module has a package.
    const initial = generatedAssetModule
      ? { classification: "asset", package: null, version: null, signal: "asset-export" }
      : vendorTop
        ? {
            classification: "thirdParty",
            package: vendorTop.package,
            version: context.packageVersionByName[vendorTop.package] || null,
            signal: evidence.find((item) => item.package === vendorTop.package)?.signal || null,
          }
        : { classification: "app", package: null, version: null, signal: null };
    const state = {
      id: moduleRecord.id,
      moduleRecord: graphRecord,
      scores,
      evidence,
      shapeHash,
      fingerprintMatches: Object.fromEntries(
        Object.entries(fingerprintMatches).map(([pkgName, matchInfo]) => [pkgName, matchInfo.hits]),
      ),
      hashMatches,
      stringLiterals,
      appAnchorScore,
      ...initial,
      initialThreshold,
    };
    states.push(state);
    stateById.set(String(moduleRecord.id), state);
  }

  // Propagate vendor classification across wrapper/runtime modules.
  // [LAW:dataflow-not-control-flow] Propagation runs a fixed number of passes over the modules still classified as
  // app code, and applies every wrapper rule to each; what varies is the vendor neighbours a rule finds, and so the
  // scores.
  const vendorStates = (ids) => ids.map((id) => stateById.get(id)).filter((item) => item?.classification === "thirdParty");
  for (let pass = 0; pass < 3; pass++) {
    for (const state of states.filter((item) => item.classification === "app")) {
      const vendor = { deps: vendorStates(state.moduleRecord.dependencyIds), parents: vendorStates(graph.parentsById.get(String(state.id))) };
      for (const rule of WRAPPER_RULES) {
        const neighbours = state.moduleRecord.source.length < rule.sourceLimit ? vendor[rule.neighbours] : [];
        const dominant = pickTopPackage(countPackages(neighbours));
        if (dominant) addScore(state.scores, state.evidence, dominant.package, rule.weight(vendor), rule.signal, `${neighbours.length} vendor ${rule.neighbours}`);
      }
      if (state.appAnchorScore === 0 && isEmptyObjectExportModule(state.moduleRecord) && vendor.parents.length === 1) {
        addScore(state.scores, state.evidence, vendor.parents[0].package, 4, "single-parent-helper", "empty object export");
      }

      const top = pickTopPackage(state.scores);
      const promotionThreshold =
        state.appAnchorScore === 0 && state.moduleRecord.source.length <= 120
          ? 3
          : state.appAnchorScore === 0 && state.moduleRecord.source.length <= 500
            ? 4
            : 6;
      if (top && top.score >= promotionThreshold && !top.tied) {
        state.classification = "thirdParty";
        state.package = top.package;
        state.version = context.packageVersionByName[top.package] || null;
        state.signal = state.evidence.find((item) => item.package === top.package)?.signal || null;
      }
    }
  }

  const bundlePackageTotals = {};
  for (const state of states) {
    const top = pickTopPackage(state.scores);
    if (!top) continue;
    bundlePackageTotals[top.package] = (bundlePackageTotals[top.package] || 0) + top.score;
  }
  const dominantBundlePackage = pickTopPackage(bundlePackageTotals);
  const bundleBaseName = path.basename(bundle.fileHint || "", ".js").toLowerCase();
  const bundleLooksLikeSingleVendor =
    bundle.format === "browserify" &&
    dominantBundlePackage &&
    dominantBundlePackage.score >= 20 &&
    (!dominantBundlePackage.tied || dominantBundlePackage.margin >= 8) &&
    (bundleBaseName.includes(dominantBundlePackage.package.replace("@", "").split("/").pop().toLowerCase()) ||
      states.filter((item) => item.package === dominantBundlePackage.package).length >= 5);

  if (bundleLooksLikeSingleVendor) {
    for (const state of states) {
      state.classification = "thirdParty";
      state.package = dominantBundlePackage.package;
      state.version = context.packageVersionByName[dominantBundlePackage.package] || null;
      state.signal = state.signal || "bundle-family";
      addScore(state.scores, state.evidence, dominantBundlePackage.package, 5, "bundle-family", bundle.format);
    }
  }

  return states.map((state) => {
    const best = pickTopPackage(state.scores);
    return {
      id: state.id,
      classification: state.classification,
      package: state.package,
      version: state.version,
      signal: state.signal,
      bytes: state.moduleRecord.source.length,
      shapeHash: state.shapeHash,
      fingerprintHits: state.fingerprintMatches,
      appAnchorScore: state.appAnchorScore,
      hashMatchCount: state.hashMatches.length,
      hashMatchPackages: state.hashMatches.map((item) => `${item.package}@${item.version}`),
      dependencyIds: state.moduleRecord.dependencyIds,
      dependencySpecifiers: state.moduleRecord.dependencySpecifiers,
      topScore: best ? best.score : 0,
      evidence: state.evidence,
    };
  });
}

function analyzePlainJsFile(filePath, ast, projectRoot, report) {
  const specifiers = parseStaticBareSpecifiers(ast);
  for (const rawSpecifier of specifiers) {
    if (!isBareSpecifier(rawSpecifier)) continue;
    const normalized = normalizeBareSpecifier(rawSpecifier);
    if (BUILTIN_SET.has(normalized)) {
      report.code.nodeBuiltins[normalized] = (report.code.nodeBuiltins[normalized] || 0) + 1;
      continue;
    }
    const pkgName = pkgNameFromSpecifier(normalized);
    const current = report.code.bareSpecifiers[pkgName] || { count: 0, files: {} };
    current.count += 1;
    const rel = fileRel(projectRoot, filePath);
    current.files[rel] = (current.files[rel] || 0) + 1;
    report.code.bareSpecifiers[pkgName] = current;
  }
}

// Records the file's bundle, if it is one, and says whether it is.
function analyzeBundleFile(filePath, ast, code, projectRoot, report, context) {
  const detected = detectBundle(ast, code);
  if (detected === null) return false;
  // A module keyed by its node_modules path (webpack5's, or browserify's with full paths) names its package.
  const bundle = {
    ...detected,
    fileHint: filePath,
    modules: detected.modules.map((record) => ({ ...record, explicitPackage: pkgNameFromNodeModulesPath(record.key) })),
  };

  const classified = classifyBundleModules(bundle, moduleDependencies(ast, bundle), context);
  const suggestedDependencies = {};
  const counts = { app: 0, thirdParty: 0, asset: 0 };
  const bytes = { app: 0, thirdParty: 0, asset: 0 };
  for (const item of classified) {
    counts[item.classification] += 1;
    bytes[item.classification] += item.bytes;
    if (item.package && !suggestedDependencies[item.package]) suggestedDependencies[item.package] = item.version || "*";
  }
  const extractedModuleBytes = bytes.app + bytes.thirdParty + bytes.asset;

  report.bundles.push({
    file: fileRel(projectRoot, filePath),
    format: bundle.format,
    entryModuleId: bundle.entryModuleId,
    totalModules: classified.length,
    modules: classified,
    summary: {
      ...counts,
      appBytes: bytes.app,
      thirdPartyBytes: bytes.thirdParty,
      assetBytes: bytes.asset,
      extractedModuleBytes,
      sourceBytes: code.length,
      extractionCoverageRatio: code.length === 0 ? 0 : Number((extractedModuleBytes / code.length).toFixed(6)),
    },
    suggestedDependencies,
  });
  return true;
}

// A build file's outcome, after recording what it found: unreadable or unparsed (its errors recorded), or a parsed
// file whose static bare specifiers are recorded, and that is plain or bundled.
function analyzeBuildFile(jsFile, projectRoot, report, context) {
  const recordError = (error) => report.parseErrors.push(fileError(fileRel(projectRoot, jsFile), error));
  let code;
  try {
    code = fs.readFileSync(jsFile, "utf8");
  } catch (error) {
    recordError(error);
    return "unreadable";
  }
  const { ast, errors } = parseRunnable(code, "js");
  errors.forEach(recordError);
  if (ast === null) return "unparsed";
  analyzePlainJsFile(jsFile, ast, projectRoot, report);
  return analyzeBundleFile(jsFile, ast, code, projectRoot, report, context) ? "bundled" : "plain";
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help) {
    console.log(
      "Usage: node detect-dependencies.mjs [--app-dir <dir>] [--build-dir <dir-or-file>] [--module-index <file>] [--out <file>]",
    );
    process.exit(0);
  }

  const projectRoot = process.cwd();
  const appDir = path.resolve(projectRoot, opts.appDir);
  const buildDir = path.resolve(projectRoot, opts.buildDir);
  const outPath = path.resolve(projectRoot, opts.out);
  fs.rmSync(outPath, { force: true });

  const fingerprints = loadFingerprints();
  const onDisk = readOnDisk(appDir, projectRoot);
  // Every copy the app loads, trialable or not, lends its name and its shape hashes to classification: once per
  // name@version, however many paths or copies reach it, and under the name of the package it is, so an alias's code
  // is credited to the package it aliases and identical copies' hashes stay unique to the one package version.
  const loadingCopies = onDisk.copies.filter(({ outcome }) => outcome.loads !== null);
  const loadedPackageVersions = [...new Map(loadingCopies
    .map(({ dir, outcome }) => [`${outcome.loads.name}@${outcome.loads.version}`, { name: outcome.loads.name, version: outcome.loads.version, dir }])).values()];
  // A copy on disk is a directory, however many locations reach it.
  const copiesOnDisk = new Set(loadingCopies.map(({ dir }) => fs.realpathSync(dir))).size;
  const lockfilePackages = loadLockfilePackages(appDir);
  // [LAW:one-source-of-truth] A package's version is the one the app's own require loads: the copy of it its
  // top-level location reaches (a copy is named for the package it holds, so an alias's is another package's), else
  // the lockfile's.
  const topLevelVersions = loadingCopies
    .filter(({ name, paths }) => paths.includes(topLevelLocation(name)))
    .map(({ name, outcome }) => [name, outcome.loads.version]);
  const packageVersionByName = Object.fromEntries([
    ...lockfilePackages.filter(({ name, location }) => location === topLevelLocation(name)).map(({ name, version }) => [name, version]),
    ...topLevelVersions,
  ]);
  const shapeIndex = indexPackageShapeHashes(loadedPackageVersions);
  const knownPackages = Array.from(
    new Set([...Object.keys(fingerprints), ...lockfilePackages.map((pkg) => pkg.name), ...loadedPackageVersions.map((pkg) => pkg.name)]),
  ).sort((left, right) => right.length - left.length || left.localeCompare(right));
  const onDiskReport = {
    nodeModules: onDisk.verdict,
    packages: byNameThenLocation(onDisk.copies.filter(({ outcome }) => outcome.kind === "trialable"))
      .map(({ name, location, paths, outcome }) => ({ name, version: outcome.loads.version, location, paths })),
    untrialable: byNameThenLocation(onDisk.copies.filter(({ outcome }) => outcome.kind === "untrialable"))
      .map(({ name, location, paths, outcome }) => ({ name, location, reason: outcome.reason, loads: outcome.loads, paths })),
    unlisted: onDisk.unlisted,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    appDir: fileRel(projectRoot, appDir),
    buildDir: fileRel(projectRoot, buildDir),
    out: fileRel(projectRoot, outPath),
    warnings: [],
    parseErrors: [],
    code: {
      filesScanned: 0,
      unreadableFiles: 0,
      unparsedFiles: 0,
      plainFiles: 0,
      bundledFiles: 0,
      bareSpecifiers: {},
      nodeBuiltins: {},
    },
    onDisk: onDiskReport,
    lockfile: {
      packages: lockfilePackages,
    },
    moduleIndex: {
      file: null,
      bundlesIndexed: 0,
      modulesIndexed: 0,
    },
    bundles: [],
    summary: {
      externalPackagesInCode: 0,
      externalCopiesOnDisk: copiesOnDisk,
      externalPackagesInCodeAndOnDisk: 0,
      externalPackagesInCodeMissingOnDisk: 0,
      bundledThirdPartyPackages: 0,
      bundledAppModules: 0,
      bundledThirdPartyModules: 0,
      bundledAssetModules: 0,
      totalModuleCandidates: 0,
      classifiedCandidates: 0,
      classificationRate: 0,
    },
  };

  for (const { location, reason } of onDiskReport.untrialable) report.warnings.push(`${location}: replace-dependency can't trial it (${reason})`);
  for (const { file, error } of shapeIndex.errors) report.parseErrors.push({ file: fileRel(projectRoot, file), error });
  if (onDisk.verdict.kind === "incomplete") report.warnings.push(`node_modules can't be fully read: ${onDisk.verdict.reason}`);

  const moduleIndexPath = opts.moduleIndex ? path.resolve(projectRoot, opts.moduleIndex) : null;
  if (moduleIndexPath && fs.existsSync(moduleIndexPath)) {
    try {
      const moduleIndex = JSON.parse(fs.readFileSync(moduleIndexPath, "utf8"));
      report.moduleIndex.file = fileRel(projectRoot, moduleIndexPath);
      report.moduleIndex.bundlesIndexed = moduleIndex?.summary?.bundlesDetected || 0;
      report.moduleIndex.modulesIndexed = moduleIndex?.summary?.modulesIndexed || 0;
    } catch (error) {
      report.warnings.push(`Could not parse module index (${fileRel(projectRoot, moduleIndexPath)}): ${String(error?.message || error)}`);
    }
  }

  const buildDirRel = report.buildDir.split(path.sep).join("/");
  if (buildDirRel.includes("node_modules/") || buildDirRel.startsWith("node_modules")) {
    report.warnings.push(
      "Build directory is inside node_modules; this can be a false positive from auto-detection rather than app-owned code.",
    );
  }

  const jsFiles = listJsFiles(buildDir);
  report.code.filesScanned = jsFiles.length;

  const classificationContext = {
    fingerprints,
    packageShapeHashes: shapeIndex.byHash,
    packageVersionByName,
    knownPackages,
  };

  for (const jsFile of jsFiles) report.code[`${analyzeBuildFile(jsFile, projectRoot, report, classificationContext)}Files`] += 1;

  const inCode = Object.keys(report.code.bareSpecifiers).sort();
  const onDiskSet = new Set(loadedPackageVersions.map((pkg) => pkg.name));
  const inBoth = inCode.filter((pkg) => onDiskSet.has(pkg));
  const missing = inCode.filter((pkg) => !onDiskSet.has(pkg));

  const bundledThirdPartyPackages = new Set();
  let bundledThirdPartyModules = 0;
  let bundledAppModules = 0;
  let bundledAssetModules = 0;
  for (const bundle of report.bundles) {
    bundledThirdPartyModules += bundle.summary.thirdParty;
    bundledAppModules += bundle.summary.app;
    bundledAssetModules += bundle.summary.asset;
    for (const pkgName of Object.keys(bundle.suggestedDependencies)) bundledThirdPartyPackages.add(pkgName);
    if (bundle.summary.extractionCoverageRatio < 0.05) {
      report.warnings.push(
        `Low module extraction coverage for ${bundle.file} (${bundle.summary.extractionCoverageRatio}); module-level third-party classification may be incomplete.`,
      );
    }
  }

  report.summary.externalPackagesInCode = inCode.length;
  report.summary.externalPackagesInCodeAndOnDisk = inBoth.length;
  report.summary.externalPackagesInCodeMissingOnDisk = missing.length;
  report.summary.bundledThirdPartyPackages = bundledThirdPartyPackages.size;
  report.summary.bundledAppModules = bundledAppModules;
  report.summary.bundledThirdPartyModules = bundledThirdPartyModules;
  report.summary.bundledAssetModules = bundledAssetModules;
  report.summary.totalModuleCandidates = bundledAppModules + bundledThirdPartyModules + bundledAssetModules;
  report.summary.classifiedCandidates = bundledThirdPartyModules + bundledAssetModules;
  report.summary.classificationRate =
    report.summary.totalModuleCandidates === 0
      ? 0
      : Number((report.summary.classifiedCandidates / report.summary.totalModuleCandidates).toFixed(6));

  ensureDir(path.dirname(outPath));
  const partialPath = `${outPath}.${process.pid}.partial`;
  fs.writeFileSync(partialPath, JSON.stringify(report, null, 2));
  fs.renameSync(partialPath, outPath);

  console.log(`Wrote ${fileRel(projectRoot, outPath)}`);
  console.log(`- JS files scanned: ${report.code.filesScanned} (unreadable: ${report.code.unreadableFiles}, unparsed: ${report.code.unparsedFiles})`);
  console.log(`- Plain JS files: ${report.code.plainFiles}`);
  console.log(`- Bundled JS files: ${report.code.bundledFiles}`);
  console.log(`- External packages in code: ${report.summary.externalPackagesInCode}`);
  console.log(`- Bundled third-party packages: ${report.summary.bundledThirdPartyPackages}`);
  console.log(`- Bundled app modules: ${report.summary.bundledAppModules}`);
  console.log(`- Bundled third-party modules: ${report.summary.bundledThirdPartyModules}`);
  console.log(`- Bundled asset modules: ${report.summary.bundledAssetModules}`);
  console.log(`- Candidate module classification rate: ${report.summary.classificationRate}`);
  console.log(`- Parse errors: ${report.parseErrors.length}`);
  console.log(`- Copies on disk: ${copiesOnDisk} (trialable: ${onDiskReport.packages.length})`);
  console.log(`- Warnings: ${report.warnings.length}`);
  for (const warning of report.warnings) console.log(`  ${warning}`);
}

main();
