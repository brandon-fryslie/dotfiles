#!/usr/bin/env node
//
// report.mjs — Compare deminified files against prepared manifest
//
// Usage: node report.mjs <prepared-dir> <deminified-dir> [options]
//
// Options:
//   --threshold=N   Only show functions below N% similarity (default: 100)
//   --json          Output as JSON instead of text
//
// The prepared-dir must contain manifest.json (from prepare.mjs) and the
// formatted original files. The deminified-dir contains agent-produced .ts/.js files.

import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// --- CLI ---

function parseArgs(argv) {
  const positional = [];
  const opts = { threshold: 100, json: false };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--threshold=')) {
      opts.threshold = parseInt(arg.slice('--threshold='.length), 10);
    } else if (arg === '--json') {
      opts.json = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, opts };
}

// --- Shared helpers (same algorithms as compare.mjs) ---

const SKIP_KEYS = new Set([
  'type', 'start', 'end', 'loc', 'leadingComments',
  'trailingComments', 'innerComments', 'extra', 'range', 'comments',
]);

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object' && item.type) walk(item, visitor);
      }
    } else if (val && typeof val === 'object' && val.type) {
      walk(val, visitor);
    }
  }
}

function walkWithParent(node, parent, visitor) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object' && item.type) walkWithParent(item, node, visitor);
      }
    } else if (val && typeof val === 'object' && val.type) {
      walkWithParent(val, node, visitor);
    }
  }
}

function resolveFunctionName(node, parent) {
  if (node.id?.name) return node.id.name;
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent.type === 'Property' || parent.type === 'MethodDefinition') {
    const key = parent.key;
    return key?.name || (typeof key?.value === 'string' ? key.value : null);
  }
  if (parent.type === 'AssignmentExpression' && parent.left) {
    if (parent.left.type === 'MemberExpression') {
      const obj = parent.left.object?.name || '';
      const prop = parent.left.property?.name || '';
      return obj ? `${obj}.${prop}` : prop || null;
    }
    if (parent.left.type === 'Identifier') return parent.left.name;
  }
  return null;
}

function functionShapeTokens(node) {
  const parts = [];
  walk(node, (n) => {
    switch (n.type) {
      case 'Identifier':        break;
      case 'StringLiteral':     parts.push('S'); break;
      case 'NumericLiteral':    parts.push('N'); break;
      case 'BooleanLiteral':    parts.push(n.value ? 'T' : 'F'); break;
      case 'NullLiteral':       parts.push('null'); break;
      case 'RegExpLiteral':     parts.push('R'); break;
      case 'BigIntLiteral':     parts.push('BI'); break;
      case 'TemplateLiteral':   parts.push('TL'); break;
      case 'TemplateElement':   break;
      case 'BinaryExpression':
      case 'LogicalExpression':
      case 'AssignmentExpression':
        parts.push(n.operator); break;
      case 'UnaryExpression':
        parts.push(`U:${n.operator}`); break;
      case 'UpdateExpression':
        parts.push(`${n.prefix ? 'pre' : 'post'}${n.operator}`); break;
      default:
        parts.push(n.type);
    }
  });
  return parts;
}

function tokensToHash(tokens) {
  return createHash('sha256').update(tokens.join(',')).digest('hex').slice(0, 16);
}

// --- LCS similarity ---

function lcsLength(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 500) {
    return lcsLengthBanded(a, b, Math.min(100, Math.floor(maxLen * 0.2)));
  }
  const m = a.length, n = b.length;
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
    }
    prev.set(curr);
    curr.fill(0);
  }
  return prev[n];
}

function lcsLengthBanded(a, b, bandwidth) {
  const m = a.length, n = b.length;
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    const jStart = Math.max(1, Math.floor(i * n / m) - bandwidth);
    const jEnd = Math.min(n, Math.floor(i * n / m) + bandwidth);
    for (let j = jStart; j <= jEnd; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
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

// --- Minification (normalize structure before comparison) ---

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

// --- Build index from manifest + prepared files ---
// Reads the prepared (formatted) files and extracts structural tokens for each function.
// The manifest provides metadata; we re-parse the formatted files to get token sequences.

function buildIndexFromManifest(preparedDir) {
  const manifestPath = path.join(preparedDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Group manifest entries by file
  const entriesByFile = new Map();
  for (const entry of manifest) {
    const arr = entriesByFile.get(entry.file) || [];
    arr.push(entry);
    entriesByFile.set(entry.file, arr);
  }

  // For each file, read the formatted source, minify, extract tokens
  const byHash = new Map();
  const allFunctions = [];

  for (const [relPath, entries] of entriesByFile) {
    const filePath = path.join(preparedDir, relPath);
    const rawCode = fs.readFileSync(filePath, 'utf8');

    // Minify the formatted code to normalize structure
    const minified = minifyCode(rawCode, relPath);
    if (minified == null) continue;

    const ast = parse(minified, {
      sourceType: 'module',
      plugins: [],
      errorRecovery: true,
      allowReturnOutsideFunction: true,
    });
    if (!ast) continue;

    // Extract functions from minified AST
    const fns = [];
    walkWithParent(ast, null, (node, parent) => {
      const isFn = node.type === 'FunctionDeclaration' ||
                   node.type === 'FunctionExpression' ||
                   node.type === 'ArrowFunctionExpression';
      if (!isFn) return;

      const tokens = functionShapeTokens(node);
      fns.push({
        name: resolveFunctionName(node, parent),
        tokens,
        hash: tokensToHash(tokens),
        tokenCount: tokens.length,
        charStart: node.start ?? 0,
      });
    });

    // Match extracted functions to manifest entries by shapeHash
    // Build a lookup from shapeHash → manifest entries
    const manifestByHash = new Map();
    for (const entry of entries) {
      const arr = manifestByHash.get(entry.shapeHash) || [];
      arr.push(entry);
      manifestByHash.set(entry.shapeHash, arr);
    }

    for (const fn of fns) {
      // Try to find manifest entry with matching hash
      const candidates = manifestByHash.get(fn.hash) || [];
      const manifestEntry = candidates.shift() || null;

      const record = {
        name: manifestEntry?.name || fn.name,
        tokens: fn.tokens,
        hash: fn.hash,
        tokenCount: fn.tokenCount,
        file: relPath,
        line: manifestEntry?.line ?? 0,
        charOffset: manifestEntry?.charOffset ?? fn.charStart,
        strings: manifestEntry?.strings || [],
      };

      allFunctions.push(record);
      const arr = byHash.get(fn.hash) || [];
      arr.push(record);
      byHash.set(fn.hash, arr);
    }
  }

  return { byHash, allFunctions, manifest };
}

// --- Build index from deminified files ---

const DEMINIFIED_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'prepared']);

function discoverFiles(dir) {
  const absDir = path.resolve(dir);
  const results = [];

  function scan(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (DEMINIFIED_EXCLUDES.has(entry.name)) continue;
        scan(full);
      } else if (/\.(js|ts|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        results.push(full);
      }
    }
  }

  scan(absDir);
  results.sort();
  return results.map(f => ({
    absPath: f,
    relPath: path.relative(absDir, f),
    content: fs.readFileSync(f, 'utf8'),
  }));
}

function extractNameLines(code, filepath) {
  const map = new Map();
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators'],
    errorRecovery: true,
    allowReturnOutsideFunction: true,
  });
  if (!ast) return map;

  walkWithParent(ast, null, (node, parent) => {
    if (node.type.startsWith('TS')) return;
    const isFn = node.type === 'FunctionDeclaration' ||
                 node.type === 'FunctionExpression' ||
                 node.type === 'ArrowFunctionExpression';
    if (!isFn) return;
    const name = resolveFunctionName(node, parent);
    if (name && !map.has(name)) {
      map.set(name, node.loc?.start?.line ?? 0);
    }
  });

  return map;
}

function buildDeminifiedIndex(dir) {
  const files = discoverFiles(dir);
  const results = [];

  for (const file of files) {
    const nameLines = extractNameLines(file.content, file.relPath);

    const minified = minifyCode(file.content, file.relPath);
    if (minified == null) continue;

    const ast = parse(minified, {
      sourceType: 'module',
      plugins: [],
      errorRecovery: true,
      allowReturnOutsideFunction: true,
    });
    if (!ast) continue;

    walkWithParent(ast, null, (node, parent) => {
      const isFn = node.type === 'FunctionDeclaration' ||
                   node.type === 'FunctionExpression' ||
                   node.type === 'ArrowFunctionExpression';
      if (!isFn) return;

      const name = resolveFunctionName(node, parent);
      const tokens = functionShapeTokens(node);

      results.push({
        file: file.relPath,
        name,
        line: name ? (nameLines.get(name) ?? '?') : '?',
        tokens,
        hash: tokensToHash(tokens),
        tokenCount: tokens.length,
      });
    });
  }

  return results;
}

// --- Find best match ---

function findBestMatch(fnB, indexA) {
  // Exact hash match first
  const exactMatches = indexA.byHash.get(fnB.hash);
  if (exactMatches) {
    return { match: exactMatches[0], similarity: 1.0 };
  }

  // Approximate: compare against functions of similar size
  let bestSim = 0;
  let bestMatch = null;
  const sizeB = fnB.tokens.length;

  for (const fnA of indexA.allFunctions) {
    const sizeA = fnA.tokenCount;
    const maxPossible = (2 * Math.min(sizeA, sizeB)) / (sizeA + sizeB);
    if (maxPossible <= bestSim) continue;
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

// --- Reporting ---

function printReport(results, threshold) {
  const named = results.filter(r => r.name);
  const filtered = named.filter(r => r.similarity * 100 <= threshold);

  // Group by file
  const byFile = new Map();
  for (const r of filtered) {
    const arr = byFile.get(r.file) || [];
    arr.push(r);
    byFile.set(r.file, arr);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('FUNCTION SIMILARITY REPORT');
  console.log('='.repeat(70));
  console.log(`  Total: ${results.length} functions (${named.length} named, ${results.length - named.length} anonymous)`);
  console.log(`  Showing: ${filtered.length} functions at or below ${threshold}% similarity`);

  for (const [file, fns] of byFile) {
    fns.sort((a, b) => a.similarity - b.similarity);
    console.log(`\n--- ${file} (${fns.length} functions) ---`);

    for (const fn of fns) {
      const pct = (fn.similarity * 100).toFixed(0).padStart(3);
      const indicator = fn.similarity >= 0.95 ? 'OK ' :
                        fn.similarity >= 0.70 ? '~  ' : 'BAD';
      const matchInfo = fn.bestMatch
        ? `-> ${fn.bestMatch.file}:${fn.bestMatch.line} ${fn.bestMatch.name || '(anon)'}`
        : '-> (no match)';
      console.log(`  ${indicator} ${pct}%  ${fn.name} (line ${fn.line}, ${fn.tokenCount} tokens)  ${matchInfo}`);
    }
  }

  // Summary: worst matches
  const worst = named.filter(r => r.similarity < 0.95).sort((a, b) => a.similarity - b.similarity);
  if (worst.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FUNCTIONS NEEDING INVESTIGATION (< 95%) — ${worst.length} total`);
    console.log('='.repeat(70));

    for (const fn of worst) {
      const pct = (fn.similarity * 100).toFixed(0).padStart(3);
      const matchLoc = fn.bestMatch
        ? `${fn.bestMatch.file}:${fn.bestMatch.line}`
        : '(no match)';
      const matchName = fn.bestMatch?.name || '';
      console.log(`  ${pct}%  ${fn.file}  ${fn.name} (${fn.tokenCount} tokens)`);
      console.log(`        best match: ${matchLoc}  ${matchName}`);
      if (fn.bestMatch?.strings?.length > 0) {
        const strs = fn.bestMatch.strings.slice(0, 3).map(s => JSON.stringify(s.length > 40 ? s.slice(0, 40) + '...' : s));
        console.log(`        strings: ${strs.join(', ')}`);
      }
    }
  }

  // Stats
  const exact = named.filter(r => r.similarity >= 0.99).length;
  const close = named.filter(r => r.similarity >= 0.95 && r.similarity < 0.99).length;
  const approx = named.filter(r => r.similarity >= 0.70 && r.similarity < 0.95).length;
  const bad = named.filter(r => r.similarity < 0.70).length;

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Exact (>=99%):  ${exact}`);
  console.log(`  Close (95-99%): ${close}`);
  console.log(`  Approx (70-95%): ${approx}`);
  console.log(`  Bad (<70%):     ${bad}`);
  console.log(`  Total named:    ${named.length}`);
}

// --- Main ---

function main() {
  const { positional, opts } = parseArgs(process.argv);

  if (positional.length < 2) {
    console.log('Usage: node report.mjs <prepared-dir> <deminified-dir> [options]');
    console.log('');
    console.log('Compare deminified files against the prepared manifest.');
    console.log('');
    console.log('Options:');
    console.log('  --threshold=N   Only show functions below N% similarity (default: 100)');
    console.log('  --json          Output as JSON');
    console.log('');
    console.log('Example:');
    console.log('  node report.mjs prepared/ ../src/main/');
    process.exit(1);
  }

  const [preparedDir, deminifiedDir] = positional;

  console.log('Building index from prepared manifest...');
  const indexA = buildIndexFromManifest(preparedDir);
  console.log(`  ${indexA.allFunctions.length} original functions indexed`);

  console.log('Analyzing deminified files...');
  const deminifiedFns = buildDeminifiedIndex(deminifiedDir);
  console.log(`  ${deminifiedFns.length} deminified functions found`);

  console.log('Matching functions...');
  const results = [];
  for (const fn of deminifiedFns) {
    const { match, similarity } = findBestMatch(fn, indexA);
    results.push({
      file: fn.file,
      name: fn.name,
      line: fn.line,
      tokenCount: fn.tokenCount,
      similarity,
      bestMatch: match ? {
        file: match.file,
        name: match.name,
        line: match.line,
        strings: match.strings,
      } : null,
    });
  }

  if (opts.json) {
    const named = results.filter(r => r.name && r.similarity * 100 <= opts.threshold);
    named.sort((a, b) => a.similarity - b.similarity);
    console.log(JSON.stringify(named, null, 2));
  } else {
    printReport(results, opts.threshold);
  }
}

main();
