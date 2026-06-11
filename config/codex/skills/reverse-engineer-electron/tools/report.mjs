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
import fs from 'fs';
import path from 'path';

// [LAW:one-source-of-truth] Identity hashes must come from the exact algorithm
// and domain prepare.mjs wrote into manifest.json; similarity tokens must come
// from the exact normalizer applied to both sides. Both contracts live in
// shape.mjs — see the rationale there.
import {
  walkWithParent,
  isFunctionNode,
  resolveFunctionName,
  functionShapeTokens,
  tokensToHash,
  normalizedFunctionTokens,
} from './shape.mjs';

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

// --- Build index from manifest + prepared files ---
//
// Each function carries values from two separate domains:
//   identity  — source-AST shape tokens of the prepared file, the domain
//               prepare.mjs (and gate.mjs) hash into manifest.json. Re-derived
//               here from the same file with the same shared algorithm, so the
//               manifest lookup matches by construction.
//   similarity — per-function normalized tokens, used only against deminified
//               functions normalized the same way.
// Re-minifying the whole file and hashing THAT was ticket .22: identity
// computed in the similarity domain, so the lookup silently never matched.

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

  const byHash = new Map();
  const allFunctions = [];

  for (const [relPath, entries] of entriesByFile) {
    const filePath = path.join(preparedDir, relPath);
    const rawCode = fs.readFileSync(filePath, 'utf8');

    const ast = parse(rawCode, {
      sourceType: 'module',
      plugins: [],
      errorRecovery: true,
      allowReturnOutsideFunction: true,
    });
    if (!ast) continue;

    const manifestByHash = new Map();
    for (const entry of entries) {
      const arr = manifestByHash.get(entry.shapeHash) || [];
      arr.push(entry);
      manifestByHash.set(entry.shapeHash, arr);
    }

    let unmatched = 0;
    walkWithParent(ast, null, (node, parent) => {
      if (!isFunctionNode(node)) return;

      const identityTokens = functionShapeTokens(node);
      const candidates = manifestByHash.get(tokensToHash(identityTokens)) || [];
      const manifestEntry = candidates.shift() || null;
      if (!manifestEntry) unmatched++;

      let tokens;
      try {
        tokens = normalizedFunctionTokens(rawCode.slice(node.start, node.end), 'js');
      } catch (e) {
        console.warn(`  Normalize error ${relPath}:${node.loc?.start?.line}: ${e.message.split('\n')[0]} — using source-domain tokens for this function`);
        tokens = identityTokens;
      }

      // Metadata prefers the manifest; on a miss it degrades to honest values
      // from the source AST we just parsed — never to a fabricated line 0.
      const record = {
        name: manifestEntry?.name ?? resolveFunctionName(node, parent),
        tokens,
        hash: tokensToHash(tokens),
        tokenCount: tokens.length,
        file: relPath,
        line: manifestEntry?.line ?? node.loc?.start?.line ?? 0,
        charOffset: manifestEntry?.charOffset ?? node.start ?? 0,
        strings: manifestEntry?.strings ?? [],
      };

      allFunctions.push(record);
      const arr = byHash.get(record.hash) || [];
      arr.push(record);
      byHash.set(record.hash, arr);
    });

    if (unmatched > 0) {
      // [LAW:no-silent-failure] A prepared file that disagrees with its
      // manifest means the manifest is stale or the file was edited; say so.
      console.warn(`  Manifest mismatch: ${unmatched} function(s) in ${relPath} have no manifest entry — re-run prepare.mjs`);
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

// One pass over the source as the agent wrote it: names, lines, and char
// offsets come straight from the file the user will open, while similarity
// tokens are normalized per function — the same split as the prepared side.
function buildDeminifiedIndex(dir) {
  const files = discoverFiles(dir);
  const results = [];

  for (const file of files) {
    const ast = parse(file.content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators'],
      errorRecovery: true,
      allowReturnOutsideFunction: true,
    });
    if (!ast) continue;

    const loader = /\.tsx?$/.test(file.relPath) ? 'ts' : 'js';

    walkWithParent(ast, null, (node, parent) => {
      if (!isFunctionNode(node)) return;

      let tokens;
      try {
        tokens = normalizedFunctionTokens(file.content.slice(node.start, node.end), loader);
      } catch (e) {
        console.warn(`  Normalize error ${file.relPath}:${node.loc?.start?.line}: ${e.message.split('\n')[0]} — using source-domain tokens for this function`);
        tokens = functionShapeTokens(node);
      }

      results.push({
        file: file.relPath,
        name: resolveFunctionName(node, parent),
        line: node.loc?.start?.line ?? 0,
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
