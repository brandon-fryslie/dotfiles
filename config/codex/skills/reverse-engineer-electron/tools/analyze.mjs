#!/usr/bin/env node
/**
 * analyze.mjs — Deterministic structural analysis for decompiled JS
 *
 * Runs after prepare.mjs to produce analysis.json — 100% deterministic
 * structural facts that feed into the LLM renaming phase. Zero heuristics,
 * zero name suggestions. Only: scope trees, call graph, type evidence
 * (what operations are performed), and cross-references (where each
 * identifier is defined and used).
 *
 * Usage: node analyze.mjs <build-dir> [--deps <deps.json>] [--out <analysis.json>]
 *
 * // [LAW:verifiable-goals] Emits machine-readable JSON; every field is deterministic and reproducible.
 * // [LAW:one-source-of-truth] All analysis derives from the AST — no duplicated parsing, no heuristic guessing.
 * // [LAW:dataflow-not-control-flow] Every file goes through the same five passes; variability lives in the resulting data.
 * // [LAW:one-way-deps] analyze.mjs depends only on @babel/parser + @babel/traverse + child_process. No tool module imports.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { execFileSync } from "child_process";
import { parse } from "@babel/parser";
import traverseImport from "@babel/traverse";

const traverseAst = traverseImport.default || traverseImport;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    buildDir: null,
    depsFile: null,
    out: null,
  };

  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--deps") {
      opts.depsFile = argv[++i] || null;
    } else if (arg === "--out") {
      opts.out = argv[++i] || null;
    } else if (arg === "-h" || arg === "--help") {
      return { help: true, opts };
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  opts.buildDir = positional[0] || null;
  return { help: false, opts };
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function listJsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
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

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseSafe(code, filePath) {
  try {
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
  } catch (error) {
    return { parseError: error.message, filePath };
  }
}

// ---------------------------------------------------------------------------
// Line index (char offset -> line:col)
// ---------------------------------------------------------------------------

function buildLineIndex(code) {
  const lines = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") lines.push(i + 1);
  }
  return lines;
}

function charToLineCol(lineIndex, charOffset) {
  let lo = 0;
  let hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= charOffset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: charOffset - lineIndex[lo] };
}

// ---------------------------------------------------------------------------
// Scope ID helper
// ---------------------------------------------------------------------------

function scopeId(filePath, lineIndex, charOffset) {
  const { line, column } = charToLineCol(lineIndex, charOffset);
  return `${filePath}:${line}:${column}`;
}

// ---------------------------------------------------------------------------
// Pass 1: Scope Analysis
// ---------------------------------------------------------------------------

function collectScopes(ast, code, relPath) {
  const lineIndex = buildLineIndex(code);
  const scopes = [];

  // // [LAW:dataflow-not-control-flow] Every path triggers the same visitor; scope data varies, not execution paths.
  traverseAst(ast, {
    // Collect scope info at every scope-creating node
    "Program|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassDeclaration|ClassExpression|ForStatement|ForInStatement|ForOfStatement|BlockStatement"(
      nodePath,
    ) {
      const scope = nodePath.scope;
      // BlockStatement creates a scope only if it has let/const bindings — babel handles this
      // Skip if this scope is the same object as the parent (no new bindings)
      if (nodePath.parentPath && nodePath.parentPath.scope === scope && nodePath.type !== "Program") {
        return;
      }

      const charOffset = nodePath.node.start ?? 0;
      const id = scopeId(relPath, lineIndex, charOffset);

      const parentCharOffset = scope.parent?.block?.start ?? null;
      const parentId =
        parentCharOffset !== null && scope.parent ? scopeId(relPath, lineIndex, parentCharOffset) : null;

      const kind = nodePath.type === "Program" ? "program" : nodePath.type.includes("Function") || nodePath.type.includes("Arrow") ? "function" : nodePath.type.includes("Class") ? "class" : "block";

      const bindings = {};
      for (const [name, binding] of Object.entries(scope.bindings)) {
        const shadowsParent = scope.parent ? scope.parent.hasBinding(name) : false;
        bindings[name] = {
          kind: binding.kind,
          references: binding.references,
          constantViolations: binding.constantViolations.length,
          shadows: shadowsParent ? scopeId(relPath, lineIndex, scope.parent.block.start ?? 0) : null,
        };
      }

      scopes.push({ scopeId: id, kind, parentScopeId: parentId, bindings });
    },
  });

  return scopes;
}

// ---------------------------------------------------------------------------
// Pass 2: Static Call Graph
// ---------------------------------------------------------------------------

function buildCallGraph(ast, code, relPath) {
  const lineIndex = buildLineIndex(code);
  const edges = [];
  const calledIds = new Set();
  const callerIds = new Set();

  traverseAst(ast, {
    CallExpression(nodePath) {
      const callee = nodePath.node.callee;
      const callSite = charToLineCol(lineIndex, nodePath.node.start ?? 0);

      // Direct identifier call: foo()
      // // [LAW:dataflow-not-control-flow] Both branches produce the same edge structure; only the resolution data varies.
      const callerFn = nodePath.getFunctionParent();
      const callerOffset = callerFn ? callerFn.node.start ?? 0 : 0;
      const callerId = scopeId(relPath, lineIndex, callerOffset);
      callerIds.add(callerId);

      if (callee.type === "Identifier") {
        const binding = nodePath.scope.getBinding(callee.name);
        const defOffset = binding?.path?.node?.start ?? null;
        const calleeId = defOffset !== null ? scopeId(relPath, lineIndex, defOffset) : `unresolved:${callee.name}`;
        calledIds.add(calleeId);

        edges.push({
          caller: callerId,
          callee: calleeId,
          calleeName: callee.name,
          line: callSite.line,
          column: callSite.column,
        });
      }

      // Member expression call: obj.method()
      if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
        const objBinding =
          callee.object.type === "Identifier" ? nodePath.scope.getBinding(callee.object.name) : null;
        const objOffset = objBinding?.path?.node?.start ?? null;
        const calleeId =
          objOffset !== null
            ? `${scopeId(relPath, lineIndex, objOffset)}.${callee.property.name}`
            : `unresolved:${callee.object.type === "Identifier" ? callee.object.name : "?"}.${callee.property.name}`;
        calledIds.add(calleeId);

        edges.push({
          caller: callerId,
          callee: calleeId,
          calleeName: `${callee.object.type === "Identifier" ? callee.object.name : "?"}.${callee.property.name}`,
          line: callSite.line,
          column: callSite.column,
        });
      }
    },
  });

  // Roots: callers that are never called
  const roots = [...callerIds].filter((id) => !calledIds.has(id));
  // Leaves: callees that never call anything
  const leaves = [...calledIds].filter((id) => !callerIds.has(id));

  return { edges, roots, leaves };
}

// ---------------------------------------------------------------------------
// Pass 3: Type Evidence
// ---------------------------------------------------------------------------

// // [LAW:dataflow-not-control-flow] Every member access / binary op produces evidence records; variability is in the evidence data.
const ARRAY_METHODS = new Set(["push", "pop", "shift", "unshift", "splice", "slice", "concat", "indexOf", "includes", "find", "findIndex", "filter", "map", "reduce", "forEach", "every", "some", "flat", "flatMap", "sort", "reverse", "join", "fill", "copyWithin", "entries", "keys", "values"]);
const STRING_METHODS = new Set(["charAt", "charCodeAt", "codePointAt", "trim", "trimStart", "trimEnd", "padStart", "padEnd", "startsWith", "endsWith", "includes", "indexOf", "lastIndexOf", "match", "matchAll", "replace", "replaceAll", "search", "slice", "split", "substring", "toLowerCase", "toUpperCase", "normalize", "repeat", "localeCompare"]);
const NUMBER_METHODS = new Set(["toFixed", "toPrecision", "toExponential"]);
const FUNCTION_METHODS = new Set(["call", "apply", "bind"]);

function collectTypeEvidence(ast, code, relPath) {
  const lineIndex = buildLineIndex(code);
  // [LAW:one-source-of-truth] Keep evidence in a null-prototype map so identifier keys like "constructor" are treated as data, not inherited members.
  const evidence = Object.create(null);

  function addEvidence(name, type, site, detail) {
    const existing = Array.isArray(evidence[name]) ? evidence[name] : [];
    existing.push({ type, line: site.line, detail });
    evidence[name] = existing;
  }

  traverseAst(ast, {
    // Method calls: x.push() -> x is array
    MemberExpression(nodePath) {
      const obj = nodePath.node.object;
      const prop = nodePath.node.property;
      if (obj.type !== "Identifier" || nodePath.node.computed || prop.type !== "Identifier") return;

      const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);
      const methodName = prop.name;

      if (ARRAY_METHODS.has(methodName)) addEvidence(obj.name, "array", site, `.${methodName}()`);
      else if (STRING_METHODS.has(methodName)) addEvidence(obj.name, "string", site, `.${methodName}()`);
      else if (NUMBER_METHODS.has(methodName)) addEvidence(obj.name, "number", site, `.${methodName}()`);
      else if (FUNCTION_METHODS.has(methodName)) addEvidence(obj.name, "function", site, `.${methodName}()`);

      // .length is ambiguous (array or string) — record as "has-length"
      if (methodName === "length") addEvidence(obj.name, "has-length", site, ".length");
    },

    // typeof x === "function" -> x is function
    BinaryExpression(nodePath) {
      const { left, right, operator } = nodePath.node;
      if (operator !== "===" && operator !== "==" && operator !== "!==" && operator !== "!=") return;

      const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);

      // typeof x === "type"
      if (left.type === "UnaryExpression" && left.operator === "typeof" && left.argument?.type === "Identifier" && right.type === "StringLiteral") {
        addEvidence(left.argument.name, right.value, site, `typeof === "${right.value}"`);
      }
      if (right.type === "UnaryExpression" && right.operator === "typeof" && right.argument?.type === "Identifier" && left.type === "StringLiteral") {
        addEvidence(right.argument.name, left.value, site, `typeof === "${left.value}"`);
      }

      // x === true/false -> x is boolean
      if (left.type === "Identifier" && right.type === "BooleanLiteral") {
        addEvidence(left.name, "boolean", site, `=== ${right.value}`);
      }
      if (right.type === "Identifier" && left.type === "BooleanLiteral") {
        addEvidence(right.name, "boolean", site, `=== ${left.value}`);
      }

      // x === null -> x is nullable
      if (left.type === "Identifier" && right.type === "NullLiteral") {
        addEvidence(left.name, "nullable", site, "=== null");
      }
      if (right.type === "Identifier" && left.type === "NullLiteral") {
        addEvidence(right.name, "nullable", site, "=== null");
      }
    },

    // Arithmetic: x + 1, x * y -> x is number (only when both sides suggest numeric)
    // We only record when one side is a numeric literal to avoid false positives
    "BinaryExpression|AssignmentExpression"(nodePath) {
      const { operator, left, right } = nodePath.node;
      const arithmeticOps = new Set(["+", "-", "*", "/", "%", "**", "+=", "-=", "*=", "/=", "%="]);
      if (!arithmeticOps.has(operator)) return;

      // Skip string concatenation: + with a string literal
      if (operator === "+" || operator === "+=") {
        if (left.type === "StringLiteral" || right.type === "StringLiteral") return;
      }

      const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);

      if (left.type === "Identifier" && right.type === "NumericLiteral") {
        addEvidence(left.name, "number", site, `${operator} ${right.value}`);
      }
      if (right.type === "Identifier" && left.type === "NumericLiteral") {
        addEvidence(right.name, "number", site, `${left.value} ${operator}`);
      }
    },

    // new Map/Set/Array/Promise -> constructor type
    NewExpression(nodePath) {
      const { callee } = nodePath.node;
      if (callee.type !== "Identifier") return;

      const parent = nodePath.parentPath?.node;
      if (!parent) return;

      const target =
        parent.type === "VariableDeclarator" && parent.id?.type === "Identifier"
          ? parent.id.name
          : parent.type === "AssignmentExpression" && parent.left?.type === "Identifier"
            ? parent.left.name
            : null;

      if (!target) return;

      const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);
      const constructorName = callee.name;

      const knownConstructors = new Set(["Map", "Set", "WeakMap", "WeakSet", "Array", "Promise", "RegExp", "Error", "Date", "URL", "URLSearchParams", "AbortController", "EventEmitter", "Buffer"]);
      if (knownConstructors.has(constructorName)) {
        addEvidence(target, constructorName.toLowerCase(), site, `new ${constructorName}()`);
      }
    },

    // await x -> x is Promise-like
    AwaitExpression(nodePath) {
      const arg = nodePath.node.argument;
      if (arg?.type === "Identifier") {
        const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);
        addEvidence(arg.name, "promise", site, "await");
      }
    },

    // for...of x -> x is iterable
    ForOfStatement(nodePath) {
      const right = nodePath.node.right;
      if (right?.type === "Identifier") {
        const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);
        addEvidence(right.name, "iterable", site, "for...of");
      }
    },

    // Spread: [...x] -> x is iterable
    SpreadElement(nodePath) {
      const arg = nodePath.node.argument;
      if (arg?.type === "Identifier") {
        const site = charToLineCol(lineIndex, nodePath.node.start ?? 0);
        addEvidence(arg.name, "iterable", site, "...spread");
      }
    },
  });

  return evidence;
}

// ---------------------------------------------------------------------------
// Pass 4: Cross-Reference Map
// ---------------------------------------------------------------------------

function buildCrossReferences(ast, code, relPath) {
  const lineIndex = buildLineIndex(code);
  const refs = {};

  traverseAst(ast, {
    // Visit every scope to collect binding definitions and their references
    "Program|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(nodePath) {
      const scope = nodePath.scope;

      for (const [name, binding] of Object.entries(scope.bindings)) {
        const defOffset = binding.identifier?.start ?? binding.path?.node?.start ?? 0;
        const defSite = charToLineCol(lineIndex, defOffset);
        const defId = scopeId(relPath, lineIndex, defOffset);

        const key = `${name}@${defId}`;
        const entry = refs[key] || {
          name,
          definition: { line: defSite.line, column: defSite.column, kind: binding.kind },
          usages: [],
        };

        // Collect reference paths
        for (const refPath of binding.referencePaths) {
          const refOffset = refPath.node.start ?? 0;
          const refSite = charToLineCol(lineIndex, refOffset);
          const context = classifyUsageContext(refPath);
          entry.usages.push({
            line: refSite.line,
            column: refSite.column,
            context,
          });
        }

        // Collect constant violations (reassignments)
        for (const violationPath of binding.constantViolations) {
          const vOffset = violationPath.node.start ?? 0;
          const vSite = charToLineCol(lineIndex, vOffset);
          entry.usages.push({
            line: vSite.line,
            column: vSite.column,
            context: "assignment",
          });
        }

        refs[key] = entry;
      }
    },
  });

  return refs;
}

/**
 * Classify how an identifier is used at a reference site.
 * Returns one of: "call", "member-read", "member-write", "assignment",
 * "call-arg", "return-value", "condition", "read"
 */
function classifyUsageContext(refPath) {
  const parent = refPath.parentPath;
  if (!parent) return "read";

  const parentNode = parent.node;

  // foo() — direct call
  if (parentNode.type === "CallExpression" && parentNode.callee === refPath.node) {
    return "call";
  }

  // foo.bar — member read
  if (parentNode.type === "MemberExpression" && parentNode.object === refPath.node) {
    const grandparent = parent.parentPath?.node;
    // foo.bar = x — member write
    if (grandparent?.type === "AssignmentExpression" && grandparent.left === parentNode) {
      return "member-write";
    }
    return "member-read";
  }

  // x = foo — assignment target
  if (parentNode.type === "AssignmentExpression" && parentNode.left === refPath.node) {
    return "assignment";
  }

  // someCall(foo) — argument to a call
  if (parentNode.type === "CallExpression" && parentNode.arguments?.includes(refPath.node)) {
    return "call-arg";
  }

  // return foo
  if (parentNode.type === "ReturnStatement") {
    return "return-value";
  }

  // if (foo) / foo ? a : b
  if (parentNode.type === "IfStatement" && parentNode.test === refPath.node) {
    return "condition";
  }
  if (parentNode.type === "ConditionalExpression" && parentNode.test === refPath.node) {
    return "condition";
  }

  return "read";
}

// ---------------------------------------------------------------------------
// Pass 5: Cross-File Resolution (stack-graphs)
// ---------------------------------------------------------------------------

function hasStackGraphsCli() {
  try {
    execFileSync("tree-sitter-stack-graphs-javascript", ["--version"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function resolveAcrossFiles(buildDir, fileResults) {
  if (!hasStackGraphsCli()) {
    console.warn("  Warning: tree-sitter-stack-graphs-javascript not found. Skipping cross-file resolution.");
    console.warn("  Install: cargo install --features cli tree-sitter-stack-graphs-javascript");
    return { available: false, edges: [] };
  }

  console.log("  Running stack-graphs index...");

  // Index the build directory
  try {
    execFileSync("tree-sitter-stack-graphs-javascript", ["index", buildDir], {
      encoding: "utf8",
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    console.warn(`  Warning: stack-graphs indexing failed: ${error.message}`);
    return { available: false, edges: [] };
  }

  // Query definitions for import/require sites across all files
  const crossFileEdges = [];

  for (const [relPath, fileResult] of Object.entries(fileResults)) {
    const absPath = path.resolve(buildDir, relPath);
    const crossRefs = fileResult.crossReferences;

    // Find bindings that come from imports
    for (const [key, ref] of Object.entries(crossRefs)) {
      if (ref.definition.kind !== "module") continue;

      try {
        const output = execFileSync(
          "tree-sitter-stack-graphs-javascript",
          ["query", "definition", `${absPath}:${ref.definition.line}:${ref.definition.column}`],
          { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] },
        );

        // Parse output lines — format is typically: file:line:col
        const lines = output.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^(.+):(\d+):(\d+)/);
          if (!match) continue;
          const [, defFile, defLine, defCol] = match;
          const defRelPath = path.relative(buildDir, defFile);
          if (defRelPath === relPath) continue; // Skip same-file

          crossFileEdges.push({
            fromFile: relPath,
            fromName: ref.name,
            fromLine: ref.definition.line,
            toFile: defRelPath,
            toLine: parseInt(defLine, 10),
            toColumn: parseInt(defCol, 10),
          });
        }
      } catch {
        // Individual query failures are expected for unresolvable references
        continue;
      }
    }
  }

  return { available: true, edges: crossFileEdges };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function analyzeFile(code, relPath) {
  const ast = parseSafe(code, relPath);
  if (ast.parseError) {
    return { parseError: ast.parseError };
  }

  // // [LAW:dataflow-not-control-flow] All five passes always execute on every file; variability is in the collected data.
  const scopes = collectScopes(ast, code, relPath);
  const callGraph = buildCallGraph(ast, code, relPath);
  const typeEvidence = collectTypeEvidence(ast, code, relPath);
  const crossReferences = buildCrossReferences(ast, code, relPath);

  return { scopes, callGraph, typeEvidence, crossReferences };
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help || !opts.buildDir) {
    console.log("Usage: node analyze.mjs <build-dir> [--deps <deps.json>] [--out <analysis.json>]");
    console.log("");
    console.log("Produces analysis.json with deterministic structural facts:");
    console.log("  - Scope trees with bindings, references, shadowing");
    console.log("  - Static call graph with caller/callee resolution");
    console.log("  - Type evidence from usage patterns (factual, not speculative)");
    console.log("  - Cross-reference map (def/use sites with context)");
    console.log("  - Cross-file resolution via stack-graphs (optional)");
    process.exit(help ? 0 : 1);
  }

  const buildDir = path.resolve(opts.buildDir);
  const outPath = opts.out ? path.resolve(opts.out) : path.join(buildDir, "analysis.json");

  if (!fs.existsSync(buildDir) || !fs.statSync(buildDir).isDirectory()) {
    console.error(`Error: ${buildDir} is not a directory`);
    process.exit(1);
  }

  console.log(`Analyzing: ${buildDir}`);

  const jsFiles = listJsFiles(buildDir);
  // Filter out manifest.json and analysis.json from processing
  const sourceFiles = jsFiles.filter(
    (f) => path.basename(f) !== "manifest.json" && path.basename(f) !== "analysis.json",
  );
  console.log(`Found ${sourceFiles.length} JS files`);

  const fileResults = {};
  const parseErrors = [];
  let totalScopes = 0;
  let totalEdges = 0;
  let totalBindings = 0;

  for (const absPath of sourceFiles) {
    const relPath = path.relative(buildDir, absPath);
    let code;
    try {
      code = fs.readFileSync(absPath, "utf8");
    } catch (error) {
      parseErrors.push({ file: relPath, error: String(error?.message || error) });
      continue;
    }

    console.log(`  ${relPath} (${(code.length / 1024).toFixed(0)}KB)`);

    const result = analyzeFile(code, relPath);
    if (result.parseError) {
      parseErrors.push({ file: relPath, error: result.parseError });
      console.log(`    Parse error: ${result.parseError.slice(0, 80)}`);
      continue;
    }

    fileResults[relPath] = result;
    totalScopes += result.scopes.length;
    totalEdges += result.callGraph.edges.length;
    totalBindings += Object.keys(result.crossReferences).length;

    console.log(
      `    ${result.scopes.length} scopes, ${result.callGraph.edges.length} call edges, ${Object.keys(result.crossReferences).length} bindings`,
    );
  }

  // Pass 5: Cross-file resolution
  console.log("");
  console.log("Cross-file resolution...");
  const crossFile = resolveAcrossFiles(buildDir, fileResults);
  if (crossFile.available) {
    console.log(`  ${crossFile.edges.length} cross-file edges`);
  }

  // Assemble output
  const analysis = {
    generatedAt: new Date().toISOString(),
    buildDir: path.relative(process.cwd(), buildDir),
    parseErrors,
    files: {},
    crossFileEdges: crossFile.edges,
    summary: {
      filesAnalyzed: Object.keys(fileResults).length,
      totalScopes,
      totalCallEdges: totalEdges,
      totalBindings,
      crossFileEdges: crossFile.edges.length,
      stackGraphsAvailable: crossFile.available,
    },
  };

  for (const [relPath, result] of Object.entries(fileResults)) {
    analysis.files[relPath] = {
      scopes: result.scopes,
      callGraph: result.callGraph,
      typeEvidence: result.typeEvidence,
      crossReferences: result.crossReferences,
    };
  }

  // Write output
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2));

  const relOut = path.relative(process.cwd(), outPath);
  console.log("");
  console.log(`Wrote ${relOut}`);
  console.log(`  Files analyzed: ${analysis.summary.filesAnalyzed}`);
  console.log(`  Total scopes: ${totalScopes}`);
  console.log(`  Total call edges: ${totalEdges}`);
  console.log(`  Total bindings: ${totalBindings}`);
  console.log(`  Cross-file edges: ${crossFile.edges.length}`);
  if (parseErrors.length > 0) {
    console.log(`  Parse errors: ${parseErrors.length}`);
  }
}

main();
