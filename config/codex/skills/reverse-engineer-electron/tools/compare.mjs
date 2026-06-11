#!/usr/bin/env node
//
// compare.mjs — Compare two JS/TS file collections by structural fingerprints
//
// Two token domains, kept apart (see shape.mjs):
//   positions  — names, lines, and char offsets always come from the source
//                file as it sits on disk, so every reference is navigable.
//   similarity — per-function token streams normalized through esbuild's
//                syntax minifier, so stylistic transforms (if→ternary,
//                statements→commas, var/let/const) collapse to the same shape.
//
// Usage: node compare.mjs <dir-a> <dir-b> [options]
//
// Options:
//   --details         Per-function map: each B function → best match in A with similarity %
//   --literals        Also compare string/number/regex literals
//   --verbose         Show per-file details
//   --no-minify       Skip minification (raw AST comparison)
//   --exclude=<pat>   Additional directory names to exclude (comma-separated)
//   --include=<pat>   Override default excludes (comma-separated)

import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import fs from 'fs';
import path from 'path';
import {
  walk,
  walkWithParent,
  isFunctionNode,
  resolveFunctionName,
  functionShapeTokens,
  tokensToHash,
  normalizedFunctionTokens,
} from './shape.mjs';

// --- Configuration ---

const DEFAULT_EXCLUDES = new Set([
  'node_modules', '.git', 'dist', '.vite', 'vendor', 'bower_components',
  '__pycache__', '.next', '.nuxt', '.output', 'coverage', '.cache',
  '.parcel-cache', '.turbo', '.svelte-kit',
]);

const NOISE_NUMBERS = new Set([
  0, 1, -1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  16, 32, 64, 100, 128, 256, 512, 1024,
]);

const MIN_STRING_LENGTH = 3;

// --- CLI ---

function parseArgs(argv) {
  const positional = [];
  const opts = {
    verbose: false,
    literals: false,
    details: false,
    minify: true,
    excludes: new Set(DEFAULT_EXCLUDES),
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--verbose')    { opts.verbose = true; }
    else if (arg === '--literals')   { opts.literals = true; }
    else if (arg === '--details')    { opts.details = true; }
    else if (arg === '--no-minify')  { opts.minify = false; }
    else if (arg.startsWith('--exclude=')) {
      for (const name of arg.slice('--exclude='.length).split(',')) {
        opts.excludes.add(name.trim());
      }
    } else if (arg.startsWith('--include=')) {
      opts.excludes = new Set(
        arg.slice('--include='.length).split(',').map(s => s.trim())
      );
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, opts };
}

// --- Minification ---

function minifyCode(code, filepath) {
  const loader = /\.tsx?$/.test(filepath) ? 'ts' : 'js';
  try {
    return transformSync(code, {
      loader,
      minify: true,
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: false,
      target: 'esnext',
      format: 'esm',
    }).code;
  } catch (e) {
    console.warn(`  Minify error ${filepath}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// --- Similarity: LCS-based ---
// For two token arrays, compute similarity as 2*LCS / (len(a) + len(b))
// For performance, use a banded LCS when both sequences are long

function lcsLength(a, b) {
  if (a.length === 0 || b.length === 0) return 0;

  // For very long sequences, use banded approach
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 500) {
    return lcsLengthBanded(a, b, Math.min(100, Math.floor(maxLen * 0.2)));
  }

  // Standard DP
  const m = a.length, n = b.length;
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev.set(curr);
    curr.fill(0);
  }
  return prev[n];
}

function lcsLengthBanded(a, b, bandwidth) {
  const m = a.length, n = b.length;
  // Only compute cells within `bandwidth` of the diagonal
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);

  for (let i = 1; i <= m; i++) {
    const jStart = Math.max(1, Math.floor(i * n / m) - bandwidth);
    const jEnd = Math.min(n, Math.floor(i * n / m) + bandwidth);
    for (let j = jStart; j <= jEnd; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev.set(curr);
    curr.fill(0);
  }
  return prev[n];
}

function tokenSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;
  const lcs = lcsLength(tokensA, tokensB);
  return (2 * lcs) / (tokensA.length + tokensB.length);
}

// --- File Discovery ---

function discoverFiles(dir, excludes) {
  const absDir = path.resolve(dir);
  const results = [];

  function scan(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (excludes.has(entry.name)) continue;
        scan(full);
      } else if (/\.(js|ts|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        results.push(full);
      }
    }
  }

  scan(absDir);
  results.sort();
  return results.map(f => ({
    path: path.relative(absDir, f),
    content: fs.readFileSync(f, 'utf8'),
  }));
}

// --- Parsing ---

function parseCode(code, filepath, withTS = false) {
  const plugins = withTS ? ['typescript', 'jsx', 'decorators'] : [];
  try {
    return parse(code, { sourceType: 'module', plugins, errorRecovery: true, allowReturnOutsideFunction: true });
  } catch (e) {
    console.warn(`  Parse error ${filepath}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// --- Extract functions from a source file ---
// Names, lines, and char offsets come from the source AST (the file the user
// can open); similarity tokens are normalized per function. Deriving positions
// from re-minified text was ticket .23: every reference pointed at line 1 of
// a one-line minified string nobody can navigate to.

function extractFunctions(file, shouldMinify) {
  const loader = /\.tsx?$/.test(file.path) ? 'ts' : 'js';
  const ast = parseCode(file.content, file.path, loader === 'ts');
  if (!ast) return [];

  const functions = [];
  walkWithParent(ast, null, (node, parent) => {
    if (!isFunctionNode(node)) return;

    let tokens;
    if (shouldMinify) {
      try {
        tokens = normalizedFunctionTokens(file.content.slice(node.start, node.end), loader);
      } catch (e) {
        console.warn(`  Normalize error ${file.path}:${node.loc?.start?.line}: ${e.message.split('\n')[0]} — using source-domain tokens for this function`);
        tokens = functionShapeTokens(node);
      }
    } else {
      tokens = functionShapeTokens(node);
    }

    functions.push({
      name: resolveFunctionName(node, parent),
      tokens,
      hash: tokensToHash(tokens),
      nodeCount: tokens.length,
      file: file.path,
      line: node.loc?.start?.line ?? 0,
      charOffset: node.start ?? 0,
    });
  });

  return functions;
}

// --- Build function index from collection A ---
// Returns { byHash: Map<hash, fn[]>, allFunctions: fn[] }

function buildFunctionIndex(files, shouldMinify) {
  const byHash = new Map();
  const allFunctions = [];

  for (const file of files) {
    for (const fn of extractFunctions(file, shouldMinify)) {
      allFunctions.push(fn);
      if (!byHash.has(fn.hash)) byHash.set(fn.hash, []);
      byHash.get(fn.hash).push(fn);
    }
  }

  return { byHash, allFunctions };
}

// --- Find best match for a function in collection A ---

function findBestMatch(fnB, indexA) {
  // Exact hash match first
  const exactMatches = indexA.byHash.get(fnB.hash);
  if (exactMatches) {
    return { match: exactMatches[0], similarity: 1.0 };
  }

  // Approximate: compare against functions of similar size
  // (within 3x size ratio to avoid O(n^2) on the full set)
  let bestSim = 0;
  let bestMatch = null;
  const sizeB = fnB.tokens.length;

  for (const fnA of indexA.allFunctions) {
    const sizeA = fnA.tokens.length;

    // Skip if sizes are too different (similarity can't exceed 2*min/(a+b))
    const maxPossible = (2 * Math.min(sizeA, sizeB)) / (sizeA + sizeB);
    if (maxPossible <= bestSim) continue;

    // Skip tiny functions — too many will match trivially
    if (sizeA < 5 && sizeB < 5) continue;

    const sim = tokenSimilarity(fnA.tokens, fnB.tokens);
    if (sim > bestSim) {
      bestSim = sim;
      bestMatch = fnA;
      if (sim === 1.0) break;
    }
  }

  return { match: bestMatch, similarity: bestSim };
}

// --- Summary fingerprint extraction ---

function extractFingerprints(files, shouldMinify, includeLiterals) {
  const strings = new Map();
  const numbers = new Map();
  const regexes = new Map();
  const shapes = new Map();
  let totalNodes = 0;
  let functionCount = 0;
  let minifyFailures = 0;

  for (const file of files) {
    let code = file.content;
    if (shouldMinify) {
      const m = minifyCode(code, file.path);
      if (m == null) { minifyFailures++; continue; }
      code = m;
    }
    const ast = parseCode(code, file.path);
    if (!ast) continue;

    walk(ast, (node) => {
      totalNodes++;
      switch (node.type) {
        case 'StringLiteral':
          if (includeLiterals && node.value.length >= MIN_STRING_LENGTH)
            strings.set(node.value, (strings.get(node.value) || 0) + 1);
          break;
        case 'TemplateLiteral':
          if (includeLiterals && node.quasis) {
            for (const q of node.quasis) {
              const val = q.value?.cooked ?? q.value?.raw;
              if (val && val.length >= MIN_STRING_LENGTH)
                strings.set(val, (strings.get(val) || 0) + 1);
            }
          }
          break;
        case 'NumericLiteral':
          if (includeLiterals && !NOISE_NUMBERS.has(node.value))
            numbers.set(node.value, (numbers.get(node.value) || 0) + 1);
          break;
        case 'RegExpLiteral':
          if (includeLiterals) {
            const pat = `/${node.pattern}/${node.flags}`;
            regexes.set(pat, (regexes.get(pat) || 0) + 1);
          }
          break;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression': {
          functionCount++;
          const hash = tokensToHash(functionShapeTokens(node));
          if (shapes.has(hash)) shapes.get(hash).count++;
          else shapes.set(hash, { hash, count: 1 });
          break;
        }
      }
    });
  }

  return { strings, numbers, regexes, shapes, totalNodes, functionCount, minifyFailures };
}

// --- Comparison ---

function compareMaps(mapA, mapB) {
  const keysA = new Set(mapA.keys());
  const keysB = new Set(mapB.keys());
  const shared = [...keysA].filter(k => keysB.has(k));
  const onlyA = [...keysA].filter(k => !keysB.has(k));
  const onlyB = [...keysB].filter(k => !keysA.has(k));
  return {
    sizeA: keysA.size, sizeB: keysB.size, shared: shared.length,
    onlyA, onlyB,
    coverageAinB: keysA.size > 0 ? (shared.length / keysA.size * 100).toFixed(1) : 'N/A',
    coverageBinA: keysB.size > 0 ? (shared.length / keysB.size * 100).toFixed(1) : 'N/A',
  };
}

// --- Reporting ---

function truncate(s, max = 80) {
  if (typeof s !== 'string') return String(s);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function printSection(label, comp, maxItems = 30) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log('='.repeat(60));
  console.log(`  A: ${comp.sizeA} unique    B: ${comp.sizeB} unique    Shared: ${comp.shared}`);
  console.log(`  A->B: ${comp.coverageAinB}%    B->A: ${comp.coverageBinA}%`);

  if (comp.onlyA.length > 0) {
    const show = comp.onlyA.slice(0, maxItems);
    console.log(`\n  Only in A (${comp.onlyA.length} total):`);
    for (const item of show) console.log(`    - ${JSON.stringify(truncate(item))}`);
    if (comp.onlyA.length > maxItems) console.log(`    ... and ${comp.onlyA.length - maxItems} more`);
  }

  if (comp.onlyB.length > 0) {
    const show = comp.onlyB.slice(0, maxItems);
    console.log(`\n  Only in B (${comp.onlyB.length} total):`);
    for (const item of show) console.log(`    - ${JSON.stringify(truncate(item))}`);
    if (comp.onlyB.length > maxItems) console.log(`    ... and ${comp.onlyB.length - maxItems} more`);
  }
}

function printDetails(results) {
  // Group by file
  const byFile = new Map();
  for (const r of results) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }

  const named = results.filter(r => r.name);

  console.log(`\n${'='.repeat(70)}`);
  console.log('PER-FUNCTION MAP (Collection B -> Collection A)');
  console.log('='.repeat(70));
  console.log(`  Total: ${results.length} functions (${named.length} named, ${results.length - named.length} anonymous)`);

  for (const [file, fns] of byFile) {
    const namedFns = fns.filter(f => f.name);
    if (namedFns.length === 0) continue;

    // Sort by similarity ascending (worst first)
    namedFns.sort((a, b) => a.similarity - b.similarity);

    console.log(`\n--- ${file} (${namedFns.length} named functions) ---`);
    for (const fn of namedFns) {
      const pct = (fn.similarity * 100).toFixed(0).padStart(3);
      const indicator = fn.similarity >= 0.95 ? 'OK ' :
                        fn.similarity >= 0.70 ? '~  ' : 'BAD';
      const matchInfo = fn.bestMatch
        ? `-> ${fn.bestMatch.file}:${fn.bestMatch.line} ${fn.bestMatch.name || '(anon)'} (char ${fn.bestMatch.charOffset})`
        : '-> (no match)';
      console.log(`  ${indicator} ${pct}%  ${fn.name} (line ${fn.line}, ${fn.nodeCount} tokens)  ${matchInfo}`);
    }
  }

  // Summary: worst matches
  const worst = named.filter(r => r.similarity < 0.95).sort((a, b) => a.similarity - b.similarity);
  if (worst.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FUNCTIONS NEEDING INVESTIGATION (similarity < 95%) — ${worst.length} total`);
    console.log('='.repeat(70));
    console.log('Sorted by similarity (lowest first). Use the file:line reference to find');
    console.log('the corresponding function in the original minified source.\n');

    for (const fn of worst) {
      const pct = (fn.similarity * 100).toFixed(0).padStart(3);
      const matchLoc = fn.bestMatch
        ? `${fn.bestMatch.file}:${fn.bestMatch.line}:${fn.bestMatch.charOffset}`
        : '(no match)';
      const matchName = fn.bestMatch?.name || '';
      console.log(`  ${pct}%  ${fn.file}  ${fn.name} (${fn.nodeCount} tokens)`);
      console.log(`        best match: ${matchLoc}  ${matchName}`);
    }
  }
}

// --- Detail mode ---

function runDetails(filesA, filesB, shouldMinify) {
  console.log('\nBuilding function index for Collection A...');
  const indexA = buildFunctionIndex(filesA, shouldMinify);
  console.log(`  ${indexA.allFunctions.length} functions indexed`);

  console.log('Analyzing Collection B functions...');
  const results = [];

  for (const file of filesB) {
    for (const fn of extractFunctions(file, shouldMinify)) {
      const { match, similarity } = findBestMatch(fn, indexA);

      results.push({
        file: file.path,
        name: fn.name,
        line: fn.line,
        nodeCount: fn.tokens.length,
        hash: fn.hash,
        similarity,
        bestMatch: match ? {
          file: match.file,
          name: match.name,
          line: match.line,
          charOffset: match.charOffset,
        } : null,
      });
    }
  }

  printDetails(results);
}

// --- Main ---

function main() {
  const { positional, opts } = parseArgs(process.argv);

  if (positional.length < 2) {
    console.log('Usage: node compare.mjs <dir-a> <dir-b> [options]');
    console.log('');
    console.log('Compares two JS/TS file collections by structural fingerprints.');
    console.log('Both sides are minified through esbuild to normalize structure.');
    console.log('');
    console.log('Options:');
    console.log('  --details         Per-function similarity map (B -> best match in A)');
    console.log('  --literals        Also compare string/number/regex literals');
    console.log('  --verbose         Show per-file details');
    console.log('  --no-minify       Skip minification (raw AST comparison)');
    console.log('  --exclude=a,b     Additional directory names to exclude');
    console.log('  --include=a,b     Override default excludes (only exclude these)');
    console.log('');
    console.log('Default excluded dirs: ' + [...DEFAULT_EXCLUDES].join(', '));
    console.log('');
    console.log('Example:');
    console.log('  node compare.mjs /tmp/codex-extracted/.vite/build/ ./src/main/');
    console.log('  node compare.mjs /tmp/codex-extracted/.vite/build/ ./src/main/ --details');
    process.exit(1);
  }

  const [dirA, dirB] = positional;

  console.log('AST Fingerprint Comparison');
  console.log('='.repeat(60));
  console.log(`Excluding: ${[...opts.excludes].join(', ')}`);
  console.log(`Minification: ${opts.minify ? 'ON (esbuild)' : 'OFF'}`);

  const filesA = discoverFiles(dirA, opts.excludes);
  const filesB = discoverFiles(dirB, opts.excludes);

  console.log(`\nCollection A: ${dirA}`);
  console.log(`  ${filesA.length} files, ${filesA.reduce((s, f) => s + f.content.length, 0).toLocaleString()} chars`);
  if (opts.verbose) {
    for (const f of filesA) console.log(`    ${f.path} (${f.content.length.toLocaleString()})`);
  }

  console.log(`\nCollection B: ${dirB}`);
  console.log(`  ${filesB.length} files, ${filesB.reduce((s, f) => s + f.content.length, 0).toLocaleString()} chars`);
  if (opts.verbose) {
    for (const f of filesB) console.log(`    ${f.path} (${f.content.length.toLocaleString()})`);
  }

  // Summary comparison
  console.log('\nExtracting fingerprints...');
  const fpA = extractFingerprints(filesA, opts.minify, opts.literals);
  const fpB = extractFingerprints(filesB, opts.minify, opts.literals);

  console.log(`  A: ${fpA.totalNodes.toLocaleString()} AST nodes, ${fpA.functionCount.toLocaleString()} functions`);
  console.log(`  B: ${fpB.totalNodes.toLocaleString()} AST nodes, ${fpB.functionCount.toLocaleString()} functions`);

  const shapeComp = compareMaps(fpA.shapes, fpB.shapes);
  printSection('FUNCTION SHAPES', shapeComp, 15);

  if (opts.literals) {
    printSection('STRING LITERALS', compareMaps(fpA.strings, fpB.strings));
    printSection('NUMERIC LITERALS', compareMaps(fpA.numbers, fpB.numbers));
    printSection('REGEX PATTERNS', compareMaps(fpA.regexes, fpB.regexes));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Shapes:     A->B ${shapeComp.coverageAinB}%   B->A ${shapeComp.coverageBinA}%   (${shapeComp.shared} shared)`);
  console.log(`  Functions:  A=${fpA.functionCount}  B=${fpB.functionCount}`);
  console.log(`  AST nodes:  A=${fpA.totalNodes.toLocaleString()}  B=${fpB.totalNodes.toLocaleString()}`);

  // Per-function detail mode
  if (opts.details) {
    runDetails(filesA, filesB, opts.minify);
  }
}

main();
