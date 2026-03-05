#!/usr/bin/env node
//
// substitute.mjs — Replace a line range in a prepared file with a semantically-renamed chunk
//
// Usage: node substitute.mjs <file> <start-line> <end-line> <replacement-file> [options]
//
// Options:
//   --threshold=N   Minimum structural similarity % required (default: 95)
//   --dry-run       Report similarity without modifying the file
//   --force         Skip structural verification, just replace
//
// The replacement file should contain the same code with semantic variable names
// and JSDoc type annotations. Both sides are normalized through esbuild before
// structural comparison, so cosmetic differences (whitespace, JSDoc comments,
// if→ternary) don't affect similarity scores.

import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import { createHash } from 'crypto';
import fs from 'fs';

// --- CLI ---

function parseArgs(argv) {
  const positional = [];
  const opts = { threshold: 95, dryRun: false, force: false };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--threshold=')) {
      opts.threshold = parseInt(arg.slice('--threshold='.length), 10);
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, opts };
}

// --- Minification (normalize structure before comparison) ---

function minifyCode(code) {
  try {
    return transformSync(code, {
      loader: 'js',
      minify: true,
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: false,
      target: 'esnext',
      format: 'esm',
    }).code;
  } catch (e) {
    console.warn(`  Minify error: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// --- AST Walking ---

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

// --- Function Name Resolution ---

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

// --- Structural Fingerprinting ---

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

// --- LCS Similarity ---

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

// --- Function extraction ---

function extractFunctions(code) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: [],
    errorRecovery: true,
    allowReturnOutsideFunction: true,
  });

  const functions = [];
  walkWithParent(ast, null, (node, parent) => {
    const isFn = node.type === 'FunctionDeclaration' ||
                 node.type === 'FunctionExpression' ||
                 node.type === 'ArrowFunctionExpression';
    if (!isFn) return;

    const tokens = functionShapeTokens(node);
    functions.push({
      name: resolveFunctionName(node, parent),
      tokens,
      hash: tokensToHash(tokens),
      tokenCount: tokens.length,
    });
  });

  return functions;
}

// --- Matching ---

function findBestMatch(fnB, functionsA) {
  // Exact hash match first
  const exactMatch = functionsA.find(fnA => fnA.hash === fnB.hash);
  if (exactMatch) {
    return { match: exactMatch, similarity: 1.0 };
  }

  // Approximate: compare against functions of similar size
  let bestSim = 0;
  let bestMatch = null;
  const sizeB = fnB.tokens.length;

  for (const fnA of functionsA) {
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

// --- Main ---

function main() {
  const { positional, opts } = parseArgs(process.argv);

  if (positional.length < 4) {
    console.log('Usage: node substitute.mjs <file> <start-line> <end-line> <replacement-file> [options]');
    console.log('');
    console.log('Replace a line range in a prepared file with a semantically-renamed chunk.');
    console.log('Verifies structural similarity before replacing to catch logic errors.');
    console.log('');
    console.log('Arguments:');
    console.log('  <file>              Prepared file to modify (e.g., prepared/main.js)');
    console.log('  <start-line>        First line to replace (1-indexed, inclusive)');
    console.log('  <end-line>          Last line to replace (1-indexed, inclusive)');
    console.log('  <replacement-file>  File with semantically-renamed code');
    console.log('');
    console.log('Options:');
    console.log('  --threshold=N   Minimum similarity % required (default: 95)');
    console.log('  --dry-run       Report similarity without modifying the file');
    console.log('  --force         Skip structural verification, just replace');
    console.log('');
    console.log('Example:');
    console.log('  # Check similarity first');
    console.log('  node substitute.mjs prepared/main.js 56074 56200 auth-chunk.js --dry-run');
    console.log('');
    console.log('  # Replace when satisfied');
    console.log('  node substitute.mjs prepared/main.js 56074 56200 auth-chunk.js');
    console.log('');
    console.log('  # Lower threshold for chunks with intentional restructuring');
    console.log('  node substitute.mjs prepared/main.js 56074 56200 auth-chunk.js --threshold=85');
    process.exit(1);
  }

  const [filePath, startStr, endStr, replacementPath] = positional;
  const startLine = parseInt(startStr, 10);
  const endLine = parseInt(endStr, 10);

  if (isNaN(startLine) || isNaN(endLine) || startLine < 1 || endLine < startLine) {
    console.error(`Error: Invalid line range ${startStr}-${endStr}. Lines are 1-indexed, end >= start.`);
    process.exit(1);
  }

  // Read the prepared file
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');

  if (endLine > lines.length) {
    console.error(`Error: End line ${endLine} exceeds file length (${lines.length} lines).`);
    process.exit(1);
  }

  // Extract original chunk (0-indexed slice, but user provides 1-indexed lines)
  const originalChunkLines = lines.slice(startLine - 1, endLine);
  const originalChunk = originalChunkLines.join('\n');

  // Read replacement
  const replacement = fs.readFileSync(replacementPath, 'utf8');

  const originalLineCount = originalChunkLines.length;
  const replacementLineCount = replacement.split('\n').length;
  const lineDelta = replacementLineCount - originalLineCount;

  console.log(`File:        ${filePath} (${lines.length} lines)`);
  console.log(`Range:       lines ${startLine}-${endLine} (${originalLineCount} lines)`);
  console.log(`Replacement: ${replacementPath} (${replacementLineCount} lines)`);
  console.log(`Line delta:  ${lineDelta >= 0 ? '+' : ''}${lineDelta}`);

  // --- Structural verification ---

  if (!opts.force) {
    console.log(`\nStructural verification (threshold: ${opts.threshold}%)...`);

    // Wrap chunks so they parse as valid modules.
    // The chunk may be a fragment in the middle of a file, so we wrap in an IIFE
    // to give the parser a valid scope. If that fails, try raw.
    const wrapForParsing = (code) => {
      // Try parsing raw first — it might be valid as-is
      try {
        const minified = minifyCode(code);
        if (minified != null) return minified;
      } catch (_) { /* fall through */ }

      // Wrap in a function body to make fragments parseable
      const wrapped = `(function(){\n${code}\n})()`;
      return minifyCode(wrapped);
    };

    const minOriginal = wrapForParsing(originalChunk);
    const minReplacement = wrapForParsing(replacement);

    if (minOriginal == null) {
      console.error('Error: Failed to parse original chunk.');
      process.exit(1);
    }
    if (minReplacement == null) {
      console.error('Error: Failed to parse replacement chunk.');
      process.exit(1);
    }

    const originalFns = extractFunctions(minOriginal);
    const replacementFns = extractFunctions(minReplacement);

    console.log(`  Original:    ${originalFns.length} functions (${originalFns.filter(f => f.name).length} named)`);
    console.log(`  Replacement: ${replacementFns.length} functions (${replacementFns.filter(f => f.name).length} named)`);

    // Match each replacement function to an original function
    const namedReplacements = replacementFns.filter(f => f.name);
    const results = [];
    let allPass = true;

    for (const fn of namedReplacements) {
      const { match, similarity } = findBestMatch(fn, originalFns);
      const pct = (similarity * 100).toFixed(0);
      const pass = similarity * 100 >= opts.threshold;
      if (!pass) allPass = false;

      results.push({ fn, match, similarity, pass });
    }

    // Report
    if (results.length > 0) {
      console.log('');
      const nameWidth = Math.max(...results.map(r => r.fn.name.length), 4);

      for (const r of results) {
        const pct = (r.similarity * 100).toFixed(0).padStart(3);
        const indicator = r.pass ? 'OK ' : 'BAD';
        const matchName = r.match?.name || '(anon)';
        const matchTokens = r.match?.tokenCount || '?';
        console.log(`  ${indicator}  ${pct}%  ${r.fn.name.padEnd(nameWidth)}  (${r.fn.tokenCount} tokens) -> ${matchName} (${matchTokens} tokens)`);
      }
    }

    // Also check anonymous function counts
    const anonOriginal = originalFns.filter(f => !f.name).length;
    const anonReplacement = replacementFns.filter(f => !f.name).length;
    if (Math.abs(anonOriginal - anonReplacement) > anonOriginal * 0.5 && anonOriginal > 2) {
      console.log(`\n  Warning: anonymous function count changed significantly (${anonOriginal} -> ${anonReplacement})`);
    }

    if (!allPass) {
      const failing = results.filter(r => !r.pass);
      console.log(`\nFailed: ${failing.length} function(s) below ${opts.threshold}% threshold.`);
      console.log('Use --threshold=N to lower the threshold, or --force to skip verification.');
      process.exit(1);
    }

    if (results.length === 0 && replacementFns.length === 0) {
      console.log('\n  Warning: no functions found in either chunk. Structural comparison skipped.');
      console.log('  Proceeding based on line range only.');
    } else {
      console.log(`\nAll ${results.length} named function(s) pass threshold.`);
    }
  } else {
    console.log('\nStructural verification: skipped (--force)');
  }

  // --- Substitute ---

  if (opts.dryRun) {
    console.log(`\nDry run: no changes made. Remove --dry-run to apply.`);
    process.exit(0);
  }

  // Replace lines
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const newContent = [...before, replacement, ...after].join('\n');

  fs.writeFileSync(filePath, newContent);

  const newLineCount = newContent.split('\n').length;
  console.log(`\nSubstituted: lines ${startLine}-${endLine} replaced.`);
  console.log(`File is now ${newLineCount} lines (was ${lines.length}, delta ${lineDelta >= 0 ? '+' : ''}${lineDelta}).`);
}

main();
