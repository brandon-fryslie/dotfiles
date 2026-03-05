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
 * // [LAW:verifiable-goals] Always emits a machine-readable report with explicit signals and parse errors.
 * // [LAW:one-source-of-truth] Bundle classification is derived from code, comments, and package metadata already on disk.
 * // [LAW:dataflow-not-control-flow] Every file goes through the same fixed analysis pipeline; variability is only in the resulting data.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { builtinModules } from "module";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";
import traverseImport from "@babel/traverse";

const traverseAst = traverseImport.default || traverseImport;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINGERPRINTS_PATH = path.join(SCRIPT_DIR, "third-party-fingerprints.json");
const BUNDLE_FORMAT_UNKNOWN = "plain";
const BUILTIN_SET = new Set(builtinModules.map((item) => (item.startsWith("node:") ? item.slice(5) : item)));
const LOADER_RUNTIME_PACKAGES = new Set(["style-loader", "css-loader", "file-loader", "url-loader"]);
const SKIP_KEYS = new Set([
  "type",
  "start",
  "end",
  "loc",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "extra",
  "range",
  "comments",
]);

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

  const out = [];
  const stack = [targetPath];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile() && path.extname(entry.name) === ".js") out.push(full);
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

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && item.type) walk(item, visitor);
      }
      continue;
    }
    if (value && typeof value === "object" && value.type) walk(value, visitor);
  }
}

function structuralTokens(node) {
  const tokens = [];
  walk(node, (current) => {
    switch (current.type) {
      case "Identifier":
      case "PrivateName":
        break;
      case "StringLiteral":
        tokens.push("S");
        break;
      case "NumericLiteral":
        tokens.push("N");
        break;
      case "BooleanLiteral":
        tokens.push(current.value ? "T" : "F");
        break;
      case "NullLiteral":
        tokens.push("null");
        break;
      case "RegExpLiteral":
        tokens.push("R");
        break;
      case "BigIntLiteral":
        tokens.push("BI");
        break;
      case "TemplateLiteral":
        tokens.push("TL");
        break;
      case "TemplateElement":
        break;
      case "BinaryExpression":
      case "LogicalExpression":
      case "AssignmentExpression":
        tokens.push(current.operator);
        break;
      case "UnaryExpression":
        tokens.push(`U:${current.operator}`);
        break;
      case "UpdateExpression":
        tokens.push(`${current.prefix ? "pre" : "post"}${current.operator}`);
        break;
      default:
        tokens.push(current.type);
    }
  });
  return tokens;
}

function hashTokens(tokens) {
  return createHash("sha256").update(tokens.join(",")).digest("hex").slice(0, 16);
}

function extractProgramBodyHash(code) {
  const ast = parseJs(code);
  return hashTokens(structuralTokens(ast.program));
}

function extractFunctionBodyHash(node) {
  const targetBody = node && node.body ? node.body : node;
  return hashTokens(structuralTokens(targetBody));
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

function readPackageJson(pkgDir) {
  const packageJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch {
    return null;
  }
}

function listOnDiskPackages(appDir) {
  const nmDir = path.join(appDir, "node_modules");
  const out = [];
  if (!fs.existsSync(nmDir) || !fs.statSync(nmDir).isDirectory()) return out;

  const entries = fs.readdirSync(nmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(nmDir, entry.name);
      let scopeEntries = [];
      try {
        scopeEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scoped of scopeEntries) {
        if (!scoped.isDirectory()) continue;
        const pkgDir = path.join(scopeDir, scoped.name);
        const pkg = readPackageJson(pkgDir);
        if (!pkg?.name || !pkg?.version) continue;
        out.push({
          name: pkg.name,
          version: pkg.version,
          path: path.relative(appDir, pkgDir),
          dir: pkgDir,
        });
      }
      continue;
    }

    const pkgDir = path.join(nmDir, entry.name);
    const pkg = readPackageJson(pkgDir);
    if (!pkg?.name || !pkg?.version) continue;
    out.push({
      name: pkg.name,
      version: pkg.version,
      path: path.relative(appDir, pkgDir),
      dir: pkgDir,
    });
  }

  out.sort((left, right) => left.name.localeCompare(right.name));
  return out;
}

function listPackageJsFiles(pkgDir) {
  const out = [];
  const stack = [pkgDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile() && path.extname(entry.name) === ".js") out.push(full);
    }
  }
  return out;
}

function indexPackageShapeHashes(packages) {
  const byHash = new Map();
  for (const pkg of packages) {
    const jsFiles = listPackageJsFiles(pkg.dir);
    for (const jsFile of jsFiles) {
      let code = "";
      try {
        code = fs.readFileSync(jsFile, "utf8");
      } catch {
        continue;
      }
      let hash = "";
      try {
        hash = extractProgramBodyHash(code);
      } catch {
        continue;
      }
      const current = byHash.get(hash) || [];
      current.push({
        package: pkg.name,
        version: pkg.version,
        file: path.relative(pkg.dir, jsFile),
        kind: "program",
      });
      byHash.set(hash, current);

      try {
        const ast = parseJs(code);
        // [LAW:one-source-of-truth] Reuse the same structural walker for all detached-node hashing so traversal semantics stay consistent.
        walk(ast.program, (node) => {
          if (
            node.type !== "FunctionDeclaration" &&
            node.type !== "FunctionExpression" &&
            node.type !== "ArrowFunctionExpression"
          ) {
            return;
          }
          const tokens = structuralTokens(node.body);
          if (tokens.length < 20) return;
          const functionHash = hashTokens(tokens);
          const items = byHash.get(functionHash) || [];
          items.push({
            package: pkg.name,
            version: pkg.version,
            file: path.relative(pkg.dir, jsFile),
            kind: "function",
          });
          byHash.set(functionHash, items);
        });
      } catch {
        // Keep file-level hashes even when function-level extraction fails.
      }
    }
  }
  return byHash;
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

function loadLockfilePackages(appDir) {
  const out = [];
  const packageLockPath = path.join(appDir, "package-lock.json");
  if (!fs.existsSync(packageLockPath)) return out;

  try {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
    const pushPackage = (name, version) => {
      if (!name || !version) return;
      out.push({ name, version, path: "package-lock.json", dir: null });
    };

    const rootDeps = packageLock.dependencies || {};
    for (const [name, meta] of Object.entries(rootDeps)) {
      pushPackage(name, meta?.version || null);
    }

    const packages = packageLock.packages || {};
    for (const [pkgPath, meta] of Object.entries(packages)) {
      if (!pkgPath.startsWith("node_modules/")) continue;
      const pkgName = pkgNameFromNodeModulesPath(`/${pkgPath}/index.js`);
      pushPackage(pkgName, meta?.version || null);
    }
  } catch {
    return [];
  }

  const deduped = new Map();
  for (const pkg of out) {
    if (!deduped.has(pkg.name)) deduped.set(pkg.name, pkg);
  }
  return Array.from(deduped.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function parseStaticBareSpecifiers(code) {
  const ast = parseJs(code);
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

function collectCandidateCalls(node, out) {
  if (!node || typeof node !== "object") return;
  if (node.type === "CallExpression" && node.arguments && node.arguments.length > 0) {
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
    for (const element of node.elements) {
      if (!element) continue;
      if (element.type === "FunctionExpression" || element.type === "ArrowFunctionExpression") count += 1;
    }
    return count;
  }
  if (node.type === "ObjectExpression") {
    let count = 0;
    for (const property of node.properties) {
      if (property.type !== "ObjectProperty") continue;
      if (property.value.type === "FunctionExpression" || property.value.type === "ArrowFunctionExpression") count += 1;
      if (property.value.type === "ArrayExpression") {
        const first = property.value.elements?.[0];
        if (first && (first.type === "FunctionExpression" || first.type === "ArrowFunctionExpression")) count += 1;
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
    for (const arg of call.arguments) score = Math.max(score, countModuleLikeEntries(arg));
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

function detectBundle(filePath, code) {
  const ast = parseJs(code);
  const call = pickBestCandidateCall(ast);
  if (!call) return null;

  let firstArg = null;
  let bestArgScore = -1;
  for (const arg of call.arguments) {
    const score = countModuleLikeEntries(arg);
    if (score > bestArgScore) {
      firstArg = arg;
      bestArgScore = score;
    }
  }
  if (!firstArg) return null;

  if (firstArg.type === "ArrayExpression") {
    const modules = [];
    for (let index = 0; index < firstArg.elements.length; index++) {
      const element = firstArg.elements[index];
      if (!element) continue;
      if (element.type !== "FunctionExpression" && element.type !== "ArrowFunctionExpression") continue;
      modules.push({
        id: index,
        key: String(index),
        source: code.slice(element.start, element.end),
        startOffset: element.start,
        endOffset: element.end,
        functionNode: element,
        containerNode: element,
        explicitPackage: null,
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

    for (const property of firstArg.properties) {
      if (property.type !== "ObjectProperty") continue;
      const key = propertyKeyValue(property.key);
      if (key === null) continue;

      if (property.value.type === "ArrayExpression") {
        const firstItem = property.value.elements?.[0];
        if (firstItem && (firstItem.type === "FunctionExpression" || firstItem.type === "ArrowFunctionExpression")) {
          browserifyModules.push({
            id: key,
            key,
            source: code.slice(property.start, property.end),
            startOffset: property.start,
            endOffset: property.end,
            functionNode: firstItem,
            containerNode: property,
            explicitPackage: null,
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
          explicitPackage: pkgNameFromNodeModulesPath(key),
        });
      }
    }

    if (browserifyModules.length > 0) {
      let entryModuleId = null;
      const maybeEntries = call.arguments[2];
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

  return {
    format: BUNDLE_FORMAT_UNKNOWN,
    entryModuleId: null,
    modules: [],
  };
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

function pickUniqueMax(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return { name: entries[0][0], hits: entries[0][1] };
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

function literalValue(node) {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "NumericLiteral") return String(node.value);
  return null;
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

function isWebpackPublicPathAssetModule(moduleRecord) {
  const statements = moduleRecord.functionNode.body?.body || [];
  if (statements.length !== 1) return false;
  const statement = statements[0];
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement.expression;
  if (expression?.type !== "AssignmentExpression") return false;
  if (expression.right?.type !== "BinaryExpression" || expression.right.operator !== "+") return false;
  if (expression.right.right?.type !== "StringLiteral") return false;
  const publicPathOwner = moduleRecord.functionNode.params?.[2];
  const publicPath = expression.right.left;
  return (
    publicPathOwner?.type === "Identifier" &&
    publicPath?.type === "MemberExpression" &&
    !publicPath.computed &&
    publicPath.object?.type === "Identifier" &&
    publicPath.object.name === publicPathOwner.name &&
    publicPath.property?.type === "Identifier" &&
    publicPath.property.name === "p"
  );
}

function extractBundleDependencyInfo(moduleRecord, bundleFormat) {
  const dependencyIds = [];
  const dependencySpecifiers = [];

  const requireParam =
    bundleFormat === "browserify"
      ? moduleRecord.functionNode.params?.[0]?.type === "Identifier"
        ? moduleRecord.functionNode.params[0].name
        : null
      : moduleRecord.functionNode.params?.[2]?.type === "Identifier"
        ? moduleRecord.functionNode.params[2].name
        : null;

  if (requireParam) {
    // [LAW:dataflow-not-control-flow] Dependency extraction always walks the module body; matches become data instead of alternate traversal paths.
    walk(moduleRecord.functionNode.body || moduleRecord.functionNode, (node) => {
      if (node.type !== "CallExpression") return;
      if (node.callee?.type !== "Identifier" || node.callee.name !== requireParam) return;
      const firstArg = node.arguments?.[0];
      const value = literalValue(firstArg);
      if (value === null) return;
      dependencyIds.push(value);
    });
  }

  if (bundleFormat === "browserify" && moduleRecord.containerNode?.value?.type === "ArrayExpression") {
    const depMap = moduleRecord.containerNode.value.elements?.[1];
    if (depMap?.type === "ObjectExpression") {
      for (const property of depMap.properties) {
        if (property.type !== "ObjectProperty") continue;
        const key = propertyKeyValue(property.key);
        const value = literalValue(property.value);
        if (key) dependencySpecifiers.push(key);
        if (value !== null) dependencyIds.push(value);
      }
    }
  }

  return {
    dependencyIds: uniqueStrings(dependencyIds),
    dependencySpecifiers: uniqueStrings(dependencySpecifiers),
  };
}

function buildBundleGraph(bundle) {
  const byId = new Map();
  const parentsById = new Map();
  const edgesById = new Map();

  for (const moduleRecord of bundle.modules) {
    const depInfo = extractBundleDependencyInfo(moduleRecord, bundle.format);
    const enriched = { ...moduleRecord, ...depInfo };
    byId.set(String(moduleRecord.id), enriched);
    edgesById.set(String(moduleRecord.id), depInfo.dependencyIds.map(String));
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

function classifyBundleModules(bundle, context) {
  const graph = buildBundleGraph(bundle);
  const states = [];
  const stateById = new Map();

  for (const moduleRecord of bundle.modules) {
    const graphRecord = graph.byId.get(String(moduleRecord.id));
    const moduleText = moduleRecord.source;
    const webpackCommentSignal = findWebpackCommentSignal(moduleText);
    const licenseSignal = findLicenseSignal(moduleText, context.knownPackages);
    const fingerprintMatches = findFingerprintMatches(moduleText, context.fingerprints);
    const shapeHash = extractFunctionBodyHash(moduleRecord.functionNode);
    const hashMatches = context.packageShapeHashes.get(shapeHash) || [];
    const uniqueHashPackage = hashMatches.length === 1 ? hashMatches[0] : null;
    const stringLiterals = collectStringLiterals(moduleRecord.functionNode.body || moduleRecord.functionNode);
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
      addScore(scores, evidence, uniqueHashPackage.package, uniqueHashPackage.kind === "program" ? 9 : 7, "shape-hash", uniqueHashPackage.file);
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
      generatedAssetModule,
      classification:
        generatedAssetModule
          ? "thirdParty"
          : initialTop &&
              !initialTop.tied &&
              (initialTop.score >= initialThreshold || loaderRuntimeModule || strongSinglePackageFingerprint)
            ? "thirdParty"
            : "app",
      package:
        generatedAssetModule
          ? null
          : initialTop &&
              !initialTop.tied &&
              (initialTop.score >= initialThreshold || loaderRuntimeModule || strongSinglePackageFingerprint)
          ? initialTop.package
          : null,
      version:
        generatedAssetModule
          ? null
          : initialTop &&
              !initialTop.tied &&
              (initialTop.score >= initialThreshold || loaderRuntimeModule || strongSinglePackageFingerprint)
          ? context.packageVersionByName[initialTop.package] || null
          : null,
      signal:
        generatedAssetModule
          ? "asset-export"
          : initialTop &&
              !initialTop.tied &&
              (initialTop.score >= initialThreshold || loaderRuntimeModule || strongSinglePackageFingerprint)
          ? evidence.find((item) => item.package === initialTop.package)?.signal || null
          : null,
      initialThreshold,
    };
    states.push(state);
    stateById.set(String(moduleRecord.id), state);
  }

  // Propagate vendor classification across wrapper/runtime modules.
  // // [LAW:dataflow-not-control-flow] Propagation always runs a fixed number of passes; only the score data changes.
  for (let pass = 0; pass < 3; pass++) {
    for (const state of states) {
      if (state.classification === "thirdParty") continue;

      const depStates = state.moduleRecord.dependencyIds
        .map((id) => stateById.get(String(id)))
        .filter(Boolean);
      const parentStates = (graph.parentsById.get(String(state.id)) || [])
        .map((id) => stateById.get(String(id)))
        .filter(Boolean);

      const thirdPartyDeps = depStates.filter((item) => item.classification === "thirdParty" && item.package);
      const thirdPartyParents = parentStates.filter((item) => item.classification === "thirdParty" && item.package);

      if (thirdPartyDeps.length > 0 && state.moduleRecord.source.length < 2500) {
        const depPackages = thirdPartyDeps.map((item) => item.package);
        const dominantDepPackage = pickTopPackage(
          depPackages.reduce((acc, pkgName) => {
            acc[pkgName] = (acc[pkgName] || 0) + 1;
            return acc;
          }, {}),
        );
        if (dominantDepPackage && dominantDepPackage.score >= 1) {
          addScore(state.scores, state.evidence, dominantDepPackage.package, 4, "dep-wrapper", `${thirdPartyDeps.length} vendor deps`);
        }
      }

      if (thirdPartyParents.length > 0 && state.moduleRecord.source.length < 2200) {
        const parentPackages = thirdPartyParents.map((item) => item.package);
        const dominantParentPackage = pickTopPackage(
          parentPackages.reduce((acc, pkgName) => {
            acc[pkgName] = (acc[pkgName] || 0) + 1;
            return acc;
          }, {}),
        );
        if (dominantParentPackage && dominantParentPackage.score >= 1) {
          addScore(
            state.scores,
            state.evidence,
            dominantParentPackage.package,
            thirdPartyDeps.length === 0 ? 3 : 2,
            "parent-wrapper",
            `${thirdPartyParents.length} vendor parents`,
          );
        }
      }

      if (state.appAnchorScore === 0 && isEmptyObjectExportModule(state.moduleRecord) && thirdPartyParents.length === 1) {
        addScore(state.scores, state.evidence, thirdPartyParents[0].package, 4, "single-parent-helper", "empty object export");
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
      generatedAssetModule: state.generatedAssetModule,
      hashMatchCount: state.hashMatches.length,
      hashMatchPackages: state.hashMatches.map((item) => `${item.package}@${item.version}:${item.kind}`),
      dependencyIds: state.moduleRecord.dependencyIds,
      dependencySpecifiers: state.moduleRecord.dependencySpecifiers,
      topScore: best ? best.score : 0,
      evidence: state.evidence,
    };
  });
}

function analyzePlainJsFile(filePath, code, projectRoot, report) {
  const specifiers = parseStaticBareSpecifiers(code);
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

function analyzeBundleFile(filePath, code, projectRoot, report, context) {
  const bundle = detectBundle(filePath, code);
  if (!bundle || bundle.modules.length === 0 || bundle.format === BUNDLE_FORMAT_UNKNOWN) return false;
  bundle.fileHint = filePath;

  const classified = classifyBundleModules(bundle, context);
  const suggestedDependencies = {};
  let appCount = 0;
  let thirdPartyCount = 0;
  let appBytes = 0;
  let thirdPartyBytes = 0;

  for (const item of classified) {
    if (item.classification === "thirdParty") {
      thirdPartyCount += 1;
      thirdPartyBytes += item.bytes;
      if (item.package && !suggestedDependencies[item.package]) suggestedDependencies[item.package] = item.version || "*";
      continue;
    }
    appCount += 1;
    appBytes += item.bytes;
  }

  report.bundles.push({
    file: fileRel(projectRoot, filePath),
    format: bundle.format,
    entryModuleId: bundle.entryModuleId,
    totalModules: classified.length,
    modules: classified,
    summary: {
      app: appCount,
      thirdParty: thirdPartyCount,
      appBytes,
      thirdPartyBytes,
      extractedModuleBytes: appBytes + thirdPartyBytes,
      sourceBytes: code.length,
      extractionCoverageRatio:
        code.length === 0 ? 0 : Number(((appBytes + thirdPartyBytes) / code.length).toFixed(6)),
    },
    suggestedDependencies,
  });
  return true;
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

  const fingerprints = loadFingerprints();
  const onDiskPackages = listOnDiskPackages(appDir);
  const lockfilePackages = loadLockfilePackages(appDir);
  const packageVersionByName = Object.fromEntries([...lockfilePackages, ...onDiskPackages].map((pkg) => [pkg.name, pkg.version]));
  const packageShapeHashes = indexPackageShapeHashes(onDiskPackages);
  const knownPackages = Array.from(
    new Set([...Object.keys(fingerprints), ...lockfilePackages.map((pkg) => pkg.name), ...onDiskPackages.map((pkg) => pkg.name)]),
  ).sort((left, right) => right.length - left.length || left.localeCompare(right));

  const report = {
    generatedAt: new Date().toISOString(),
    appDir: fileRel(projectRoot, appDir),
    buildDir: fileRel(projectRoot, buildDir),
    out: fileRel(projectRoot, outPath),
    warnings: [],
    parseErrors: [],
    code: {
      filesScanned: 0,
      plainFiles: 0,
      bundledFiles: 0,
      bareSpecifiers: {},
      nodeBuiltins: {},
    },
    onDisk: {
      packages: onDiskPackages.map((pkg) => ({
        name: pkg.name,
        version: pkg.version,
        path: pkg.path,
      })),
    },
    lockfile: {
      packages: lockfilePackages.map((pkg) => ({
        name: pkg.name,
        version: pkg.version,
        path: pkg.path,
      })),
    },
    moduleIndex: {
      file: null,
      bundlesIndexed: 0,
      modulesIndexed: 0,
    },
    bundles: [],
    summary: {
      externalPackagesInCode: 0,
      externalPackagesOnDisk: onDiskPackages.length,
      externalPackagesInCodeAndOnDisk: 0,
      externalPackagesInCodeMissingOnDisk: 0,
      bundledThirdPartyPackages: 0,
      bundledAppModules: 0,
      bundledThirdPartyModules: 0,
      totalModuleCandidates: 0,
      classifiedCandidates: 0,
      classificationRate: 0,
    },
  };

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
    packageShapeHashes,
    packageVersionByName,
    knownPackages,
  };

  for (const jsFile of jsFiles) {
    let code = "";
    try {
      code = fs.readFileSync(jsFile, "utf8");
    } catch (error) {
      report.parseErrors.push({ file: fileRel(projectRoot, jsFile), error: String(error?.message || error) });
      continue;
    }

    try {
      // [LAW:dataflow-not-control-flow] Always collect static bare specifiers for every file; bundle detection only adds extra module-level evidence.
      analyzePlainJsFile(jsFile, code, projectRoot, report);
      const isBundle = analyzeBundleFile(jsFile, code, projectRoot, report, classificationContext);
      if (isBundle) {
        report.code.bundledFiles += 1;
      } else {
        report.code.plainFiles += 1;
      }
    } catch (error) {
      report.parseErrors.push({ file: fileRel(projectRoot, jsFile), error: String(error?.message || error) });
    }
  }

  const inCode = Object.keys(report.code.bareSpecifiers).sort();
  const onDiskSet = new Set(onDiskPackages.map((pkg) => pkg.name));
  const inBoth = inCode.filter((pkg) => onDiskSet.has(pkg));
  const missing = inCode.filter((pkg) => !onDiskSet.has(pkg));

  const bundledThirdPartyPackages = new Set();
  let bundledThirdPartyModules = 0;
  let bundledAppModules = 0;
  for (const bundle of report.bundles) {
    bundledThirdPartyModules += bundle.summary.thirdParty;
    bundledAppModules += bundle.summary.app;
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
  report.summary.totalModuleCandidates = bundledAppModules + bundledThirdPartyModules;
  report.summary.classifiedCandidates = bundledThirdPartyModules;
  report.summary.classificationRate =
    report.summary.totalModuleCandidates === 0
      ? 0
      : Number((report.summary.classifiedCandidates / report.summary.totalModuleCandidates).toFixed(6));

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${fileRel(projectRoot, outPath)}`);
  console.log(`- JS files scanned: ${report.code.filesScanned}`);
  console.log(`- Plain JS files: ${report.code.plainFiles}`);
  console.log(`- Bundled JS files: ${report.code.bundledFiles}`);
  console.log(`- External packages in code: ${report.summary.externalPackagesInCode}`);
  console.log(`- Bundled third-party packages: ${report.summary.bundledThirdPartyPackages}`);
  console.log(`- Bundled app modules: ${report.summary.bundledAppModules}`);
  console.log(`- Bundled third-party modules: ${report.summary.bundledThirdPartyModules}`);
  console.log(`- Candidate module classification rate: ${report.summary.classificationRate}`);
  console.log(`- Parse errors: ${report.parseErrors.length}`);
  if (report.warnings.length > 0) {
    console.log(`- Warnings: ${report.warnings.length}`);
  }
}

main();
