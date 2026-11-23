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
import { appAt, byNameThenLocation, copiesOf, entryNameOf, locationDir, topLevelLocation, walkStarts } from "./node-modules.mjs";
import { loadLockfile } from "./package-lock.mjs";
import { isPlainObject, JSON_SHAPE } from "./json-value.mjs";
import { inputAt, readJson } from "./path-state.mjs";
import { walk, isFunctionNode, bodyStatements, statementsShape, traverse } from "./shape.mjs";
import { listJsFiles, readBuildFile, readJsFile } from "./bundle.mjs";
import { clearOutputs, writeOutputs } from "./artifact.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINGERPRINTS_PATH = path.join(SCRIPT_DIR, "third-party-fingerprints.json");
const BUILTIN_SET = new Set(builtinModules.map((item) => (item.startsWith("node:") ? item.slice(5) : item)));
const LOADER_RUNTIME_PACKAGES = new Set(["style-loader", "css-loader", "file-loader", "url-loader"]);
// The body-token count under which a file's or function's shape is too common to name its package.
const MIN_FUNCTION_SHAPE_TOKENS = 20;
// [LAW:one-type-per-behavior] A wrapper rule credits a module that isn't yet classified with the package that
// dominates its vendor neighbours of one kind. A wrapper is a small module, so a module at or over sourceLimit
// characters has no neighbours to the rule, and a large module that requires vendor code is not credited to it.
const WRAPPER_RULES = [
  { signal: "dep-wrapper", neighbours: "deps", sourceLimit: 2500, weight: () => 4 },
  { signal: "parent-wrapper", neighbours: "parents", sourceLimit: 2200, weight: (vendor) => (vendor.deps.length === 0 ? 3 : 2) },
];
// [LAW:types-are-the-program] The values a module's classification and a build file's outcome take; each is counted
// under its own name, and tally refuses any other value.
const CLASSIFICATIONS = ["app", "thirdParty", "asset"];
const FILE_OUTCOMES = ["unreadable", "unparsed", "plain", "bundled"];
// The sum of amountOf over the items under each name keyOf gives, with every name present.
function tally(names, items, keyOf, amountOf = () => 1) {
  const totals = Object.fromEntries(names.map((name) => [name, 0]));
  for (const item of items) {
    const name = keyOf(item);
    if (!(name in totals)) throw new Error(`${JSON.stringify(name)} is not one of ${names.join(", ")}`);
    totals[name] += amountOf(item);
  }
  return totals;
}
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

// The package a path names: the entry after its last node_modules, by node-modules.mjs's grammar.
const packageOfPath = (text) => entryNameOf(text.split("\\").join("/"));

// [LAW:one-source-of-truth] Every copy of every package node finds in the app's node_modules, with the swap outcome
// replace-dependency acts on (including what it loads, or that it loads nothing), and the walk's verdict on how much
// of the tree could be read.
function readOnDisk(appDir, projectRoot) {
  const app = appAt(path.join(appDir, "node_modules"), projectRoot);
  const { verdict, starts, unlisted } = walkStarts(app);
  return { verdict, unlisted, copies: copiesOf(app, starts).map((copy) => ({ ...copy, dir: locationDir(app, copy.location) })) };
}


// Each loaded package version's file and function shapes, in the BODY domain a bundle factory is looked up in, and every file
// or directory that couldn't be listed, read, or parsed, so a package that contributed no shapes because it couldn't
// be read is a parse error, not a package that matched nothing. [LAW:no-silent-failure]
// A shape maps to the package versions that ship it, each once, at the first of its files that has it.
function indexPackageShapeHashes(packages) {
  const byHash = new Map();
  const errors = [];
  for (const pkg of packages) {
    let jsFiles;
    try {
      jsFiles = listJsFiles(pkg.dir);
    } catch (error) {
      errors.push(fileError(pkg.dir, error));
      continue;
    }
    for (const jsFile of jsFiles) {
      const read = readJsFile(jsFile);
      if (read.kind !== "parsed") {
        errors.push(fileError(jsFile, read.error));
        continue;
      }
      const entry = { package: pkg.name, version: pkg.version, file: path.relative(pkg.dir, jsFile) };
      const statementLists = [read.ast.program.body];
      walk(read.ast.program, (node) => {
        if (isFunctionNode(node)) statementLists.push(bodyStatements(node));
      });
      for (const shape of statementLists.map(statementsShape).filter(({ size }) => size >= MIN_FUNCTION_SHAPE_TOKENS)) {
        const versions = byHash.get(shape.hash) ?? new Map();
        if (!versions.has(`${pkg.name}@${pkg.version}`)) versions.set(`${pkg.name}@${pkg.version}`, entry);
        byHash.set(shape.hash, versions);
      }
    }
  }
  return { byHash: new Map([...byHash].map(([hash, versions]) => [hash, [...versions.values()]])), errors };
}

const isCount = (value) => Number.isInteger(value) && value >= 0;

// [LAW:parse-dont-validate] A module index as unbundle-index.mjs writes one, read for its counts:
// { kind: "index", counts: { bundlesIndexed, modulesIndexed } }, or the reader's absent or unusable, or no-counts when
// its summary doesn't give both; every outcome but the index carries the reason.
function readModuleIndex(file) {
  const read = readJson(file, JSON_SHAPE.object);
  if (read.kind !== "json") return read;
  const { summary } = read.value;
  if (!isPlainObject(summary) || !isCount(summary.bundlesDetected) || !isCount(summary.modulesIndexed)) {
    return { kind: "no-counts", reason: "has no summary with bundlesDetected and modulesIndexed counts" };
  }
  return { kind: "index", counts: { bundlesIndexed: summary.bundlesDetected, modulesIndexed: summary.modulesIndexed } };
}

function loadFingerprints() {
  // [LAW:no-silent-failure] The skill's own file: one it can't read is a broken install, not an input to report.
  const read = readJson(FINGERPRINTS_PATH, JSON_SHAPE.object);
  if (read.kind !== "json") throw new Error(`${FINGERPRINTS_PATH} ${read.reason}`);
  const raw = read.value;
  const filtered = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("//")) continue;
    filtered[key] = Array.isArray(value) ? value : [];
  }
  return filtered;
}

function parseStaticBareSpecifiers(ast) {
  const specifiers = [];

  traverse(ast, {
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
    const pkgName = packageOfPath(rawLine);
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

// [LAW:types-are-the-program] Report objects keyed by package name have no prototype, so a package named constructor
// or __proto__ is a key like any other.
const byName = () => Object.create(null);

function addScore(scoreMap, evidenceList, pkgName, points, signal, detail) {
  if (!pkgName || !Number.isFinite(points) || points <= 0) return;
  scoreMap.set(pkgName, (scoreMap.get(pkgName) ?? 0) + points);
  evidenceList.push({ package: pkgName, score: points, signal, detail: detail || null });
}

// How many of the given module states are each package's.
function countPackages(states) {
  const counts = new Map();
  for (const { package: pkgName } of states) counts.set(pkgName, (counts.get(pkgName) ?? 0) + 1);
  return counts;
}

function pickTopPackage(scoreMap) {
  const entries = [...scoreMap];
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

// The one expression a factory's body is: its one statement's expression, or the value it returns.
function soleExpression(functionNode) {
  const statements = bodyStatements(functionNode);
  if (statements.length !== 1) return null;
  const [statement] = statements;
  if (statement.type === "ExpressionStatement") return statement.expression;
  return statement.type === "ReturnStatement" ? statement.argument : null;
}

function isEmptyObjectExportModule(moduleRecord) {
  const expression = soleExpression(moduleRecord.functionNode);
  return expression?.type === "AssignmentExpression" && expression.right.type === "ObjectExpression" && expression.right.properties.length === 0;
}

// A webpack factory that exports the bundle's public path (its require binding's `p`) plus a file name.
function isWebpackPublicPathAssetModule(moduleRecord) {
  const expression = soleExpression(moduleRecord.functionNode);
  if (expression?.type !== "AssignmentExpression") return false;
  if (expression.right.type !== "BinaryExpression" || expression.right.operator !== "+") return false;
  if (expression.right.right.type !== "StringLiteral") return false;
  const publicPath = expression.right.left;
  return (
    moduleRecord.require !== null &&
    publicPath.type === "MemberExpression" &&
    !publicPath.computed &&
    publicPath.object.type === "Identifier" &&
    publicPath.object.name === moduleRecord.require.name &&
    publicPath.property.type === "Identifier" &&
    publicPath.property.name === "p"
  );
}

// Each module record by id, and the ids of the modules that require each one.
function buildBundleGraph(bundle) {
  const byId = new Map(bundle.modules.map((record) => [record.id, record]));
  const parentsById = new Map(bundle.modules.map((record) => [record.id, []]));
  for (const record of bundle.modules) {
    for (const depId of record.dependencyIds) parentsById.get(depId).push(record.id);
  }
  return { byId, parentsById };
}

function classifyBundleModules(bundle, context) {
  const graph = buildBundleGraph(bundle);
  const states = [];
  // A vendor module's classification, credited to the package its evidence names.
  const vendorModule = (pkgName, evidence) => ({
    classification: "thirdParty",
    package: pkgName,
    version: context.packageVersionByName.get(pkgName) ?? null,
    signal: evidence.find((item) => item.package === pkgName)?.signal || null,
  });

  for (const moduleRecord of bundle.modules) {
    const graphRecord = graph.byId.get(moduleRecord.id);
    const moduleText = moduleRecord.source;
    const webpackCommentSignal = findWebpackCommentSignal(moduleText);
    const licenseSignal = findLicenseSignal(moduleText, context.knownPackages);
    const fingerprintMatches = findFingerprintMatches(moduleText, context.fingerprints);
    const shapeHash = statementsShape(bodyStatements(moduleRecord.functionNode)).hash;
    const hashMatches = context.packageShapeHashes.get(shapeHash) ?? [];
    // A shape names a package when every package version that ships it is a version of that one package.
    const uniqueHashPackage = new Set(hashMatches.map((item) => item.package)).size === 1 ? hashMatches[0] : null;
    const stringLiterals = collectStringLiterals(moduleRecord.functionNode.body);
    const appAnchorScore = scoreAppAnchors(stringLiterals);
    const generatedAssetModule = isWebpackPublicPathAssetModule(moduleRecord);
    const scores = new Map();
    const evidence = [];

    if (moduleRecord.explicitPackage) {
      addScore(scores, evidence, moduleRecord.explicitPackage, 10, "module-path", moduleRecord.id);
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
      scores.size === 1;
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
        ? vendorModule(vendorTop.package, evidence)
        : { classification: "app", package: null, version: null, signal: null };
    const state = {
      id: moduleRecord.id,
      moduleRecord: graphRecord,
      own: { scores, evidence },
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
  }

  // Propagate vendor classification across wrapper/runtime modules.
  // [LAW:dataflow-not-control-flow] Propagation is a fixpoint over the bundle graph. Each round scores every module
  // still classified as app code afresh: its own evidence, plus what every wrapper rule credits it from the vendor
  // neighbours the previous round left. The modules that pass their threshold are promoted together, and rounds
  // repeat until none is, so the result depends on the graph alone, not on module order.
  for (let promoted = true; promoted; ) {
    const vendorById = new Map(states.filter((item) => item.classification === "thirdParty").map((item) => [item.id, item]));
    const vendorIn = (ids) => ids.map((id) => vendorById.get(id)).filter(Boolean);
    const promotions = states.filter((item) => item.classification === "app").flatMap((state) => {
      const scores = new Map(state.own.scores);
      const evidence = [...state.own.evidence];
      const vendor = { deps: vendorIn(state.moduleRecord.dependencyIds), parents: vendorIn(graph.parentsById.get(state.id)) };
      for (const rule of WRAPPER_RULES) {
        const neighbours = state.moduleRecord.source.length < rule.sourceLimit ? vendor[rule.neighbours] : [];
        // Neighbours split evenly between packages name none of them.
        const dominant = pickTopPackage(countPackages(neighbours));
        if (dominant && !dominant.tied) addScore(scores, evidence, dominant.package, rule.weight(vendor), rule.signal, `${neighbours.length} vendor ${rule.neighbours}`);
      }
      if (state.appAnchorScore === 0 && isEmptyObjectExportModule(state.moduleRecord) && vendor.parents.length === 1) {
        addScore(scores, evidence, vendor.parents[0].package, 4, "single-parent-helper", "empty object export");
      }
      state.scores = scores;
      state.evidence = evidence;

      const top = pickTopPackage(scores);
      const promotionThreshold =
        state.appAnchorScore === 0 && state.moduleRecord.source.length <= 120
          ? 3
          : state.appAnchorScore === 0 && state.moduleRecord.source.length <= 500
            ? 4
            : 6;
      return top && top.score >= promotionThreshold && !top.tied ? [[state, top.package]] : [];
    });
    for (const [state, pkgName] of promotions) Object.assign(state, vendorModule(pkgName, state.evidence));
    promoted = promotions.length > 0;
  }

  const bundlePackageTotals = new Map();
  for (const state of states) {
    const top = pickTopPackage(state.scores);
    if (!top) continue;
    bundlePackageTotals.set(top.package, (bundlePackageTotals.get(top.package) ?? 0) + top.score);
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

  // A single-vendor bundle's code modules are all that vendor's; its assets stay assets.
  if (bundleLooksLikeSingleVendor) {
    for (const state of states.filter((item) => item.classification !== "asset")) {
      addScore(state.scores, state.evidence, dominantBundlePackage.package, 5, "bundle-family", bundle.format);
      Object.assign(state, vendorModule(dominantBundlePackage.package, state.evidence), { signal: state.signal || "bundle-family" });
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
      hashMatches: state.hashMatches.map(({ package: pkgName, version }) => ({ package: pkgName, version })),
      dependencyIds: state.moduleRecord.dependencyIds,
      unresolvedDependencyIds: state.moduleRecord.unresolvedDependencyIds,
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
    const current = report.code.bareSpecifiers[pkgName] || { count: 0, files: byName() };
    current.count += 1;
    const rel = fileRel(projectRoot, filePath);
    current.files[rel] = (current.files[rel] || 0) + 1;
    report.code.bareSpecifiers[pkgName] = current;
  }
}

// Records a bundle a build file is, with its classified modules.
function recordBundle(filePath, detected, code, projectRoot, report, context) {
  // A module keyed by its node_modules path (webpack5's, or browserify's with full paths) names its package.
  const bundle = {
    ...detected,
    fileHint: filePath,
    modules: detected.modules.map((record) => ({ ...record, explicitPackage: packageOfPath(record.id) })),
  };

  const classified = classifyBundleModules(bundle, context);
  const suggestedDependencies = byName();
  for (const item of classified) {
    // [LAW:no-silent-failure] A package no source gives a version for is suggested at null, never at a range that
    // would install whatever version is latest.
    if (item.package && !Object.hasOwn(suggestedDependencies, item.package)) suggestedDependencies[item.package] = item.version;
  }
  const counts = tally(CLASSIFICATIONS, classified, (item) => item.classification);
  const bytes = tally(CLASSIFICATIONS, classified, (item) => item.classification, (item) => item.bytes);
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
}

// A build file's outcome, after recording what it found: unreadable or unparsed (its errors recorded), or a parsed
// file whose static bare specifiers are recorded, and that is plain or bundled.
function analyzeBuildFile(jsFile, projectRoot, report, context) {
  const read = readBuildFile(jsFile);
  if (read.kind !== "parsed") {
    report.parseErrors.push(fileError(fileRel(projectRoot, jsFile), read.error));
    return read.kind;
  }
  analyzePlainJsFile(jsFile, read.ast, projectRoot, report);
  if (read.bundle === null) return "plain";
  recordBundle(jsFile, read.bundle, read.code, projectRoot, report, context);
  return "bundled";
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
  clearOutputs([outPath]);
  // [LAW:no-silent-failure] Everything below reads under the app dir, and a path under one that isn't a directory
  // holds nothing, so an app dir that isn't one stops the run rather than reading as an app that ships nothing.
  const app = inputAt(appDir, "dir");
  if (app.kind !== "dir") {
    console.error(`Error: --app-dir ${appDir} ${app.reason}`);
    process.exit(2);
  }

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
  const lockfilePath = path.join(appDir, "package-lock.json");
  const lockfile = { file: fileRel(projectRoot, lockfilePath), ...loadLockfile(lockfilePath) };
  // [LAW:one-source-of-truth] A package's version is the one the app's own require loads: the copy of it its
  // top-level location reaches (a copy is named for the package it holds, so an alias's is another package's), else
  // the lockfile's.
  const topLevelVersions = loadingCopies
    .filter(({ name, paths }) => paths.includes(topLevelLocation(name)))
    .map(({ name, outcome }) => [name, outcome.loads.version]);
  const packageVersionByName = new Map([
    ...lockfile.packages.filter(({ name, location }) => location === topLevelLocation(name)).map(({ name, version }) => [name, version]),
    ...topLevelVersions,
  ]);
  const shapeIndex = indexPackageShapeHashes(loadedPackageVersions);
  const knownPackages = Array.from(
    new Set([...Object.keys(fingerprints), ...lockfile.packages.map((pkg) => pkg.name), ...loadedPackageVersions.map((pkg) => pkg.name)]),
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
      files: tally(FILE_OUTCOMES, [], () => null),
      bareSpecifiers: byName(),
      nodeBuiltins: byName(),
    },
    onDisk: onDiskReport,
    lockfile,
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
  for (const [source, verdict] of [["node_modules", onDisk.verdict], [lockfile.file, lockfile.verdict]]) {
    if (verdict.kind === "incomplete") report.warnings.push(`${source} can't be fully read: ${verdict.reason}`);
  }

  // [LAW:no-silent-failure] --module-index is optional, but an index it names is one the run was asked to read: one
  // that isn't there, can't be read, or has no counts is a warning, never the report of a run given no index.
  if (opts.moduleIndex) {
    const moduleIndexPath = path.resolve(projectRoot, opts.moduleIndex);
    const moduleIndex = readModuleIndex(moduleIndexPath);
    if (moduleIndex.kind === "index") Object.assign(report.moduleIndex, { file: fileRel(projectRoot, moduleIndexPath), ...moduleIndex.counts });
    else report.warnings.push(`Could not read module index ${fileRel(projectRoot, moduleIndexPath)}: it ${moduleIndex.reason}`);
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

  const outcomes = jsFiles.map((jsFile) => analyzeBuildFile(jsFile, projectRoot, report, classificationContext));
  report.code.files = tally(FILE_OUTCOMES, outcomes, (outcome) => outcome);

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

  writeOutputs([[outPath, report]]);

  console.log(`Wrote ${fileRel(projectRoot, outPath)}`);
  console.log(`- JS files scanned: ${report.code.filesScanned} (unreadable: ${report.code.files.unreadable}, unparsed: ${report.code.files.unparsed})`);
  console.log(`- Plain JS files: ${report.code.files.plain}`);
  console.log(`- Bundled JS files: ${report.code.files.bundled}`);
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
