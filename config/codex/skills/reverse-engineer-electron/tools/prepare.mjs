#!/usr/bin/env node
//
// prepare.mjs — Format JS and build function manifest
//
// Usage: node prepare.mjs <input-dir> <output-dir>
//
// Input:  Directory of minified .js files (e.g., /tmp/codex-extracted/.vite/build/)
// Output: Formatted files in output-dir + manifest.json with function metadata
//
// Note: This script only formats and analyzes with AST parsing.
// It does NOT rename identifiers and does NOT use regex-based code parsing.

import { parse } from '@babel/parser';
import prettier from 'prettier';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// --- CLI ---

function parseArgs(argv) {
  const positional = argv.slice(2).filter(arg => !arg.startsWith('--'));
  return { positional };
}

// --- AST helpers (reused from compare.mjs) ---

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

// Structural token extraction — same algorithm as compare.mjs
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

// Extract string literals from a function body
function extractStrings(node) {
  const strings = [];
  walk(node, (n) => {
    if (n.type === 'StringLiteral' && n.value.length >= 2) {
      strings.push(n.value);
    } else if (n.type === 'TemplateLiteral' && n.quasis) {
      for (const q of n.quasis) {
        const val = q.value?.cooked ?? q.value?.raw;
        if (val && val.length >= 2) strings.push(val);
      }
    }
  });
  return strings;
}

// --- Char offset → line/column ---

function buildLineIndex(code) {
  const lines = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') lines.push(i + 1);
  }
  return lines;
}

function charToLineCol(lineIndex, charOffset) {
  let lo = 0, hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= charOffset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: charOffset - lineIndex[lo] };
}

// --- File discovery ---

function discoverJsFiles(dir) {
  const absDir = path.resolve(dir);
  const results = [];

  function scan(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        scan(full);
      } else if (path.extname(entry.name) === '.js') {
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

// --- Extract manifest entries from formatted code ---

function extractManifestEntries(code, relPath) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: [],
    errorRecovery: true,
    allowReturnOutsideFunction: true,
  });

  const lineIndex = buildLineIndex(code);
  const entries = [];

  walkWithParent(ast, null, (node, parent) => {
    const isFn = node.type === 'FunctionDeclaration' ||
                 node.type === 'FunctionExpression' ||
                 node.type === 'ArrowFunctionExpression';
    if (!isFn) return;

    const name = resolveFunctionName(node, parent);
    const tokens = functionShapeTokens(node);
    const charOffset = node.start ?? 0;
    const { line, column } = charToLineCol(lineIndex, charOffset);

    const params = node.params || [];

    entries.push({
      name: name || null,
      file: relPath,
      line,
      column,
      charOffset,
      paramCount: params.length,
      tokenCount: tokens.length,
      shapeHash: tokensToHash(tokens),
      strings: extractStrings(node),
    });
  });

  return entries;
}

// --- Main ---

async function main() {
  const { positional } = parseArgs(process.argv);

  if (positional.length < 2) {
    console.log('Usage: node prepare.mjs <input-dir> <output-dir>');
    console.log('');
    console.log('Format minified JS files and build function manifest.');
    console.log('');
    console.log('Example:');
    console.log('  node prepare.mjs /tmp/codex-extracted/.vite/build/ prepared/');
    process.exit(1);
  }

  const [inputDir, outputDir] = positional;

  console.log(`Input:  ${inputDir}`);
  console.log(`Output: ${outputDir}`);

  // Discover input files
  const files = discoverJsFiles(inputDir);
  console.log(`\nFound ${files.length} .js files`);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = [];
  let totalFunctions = 0;

  for (const file of files) {
    const outPath = path.join(outputDir, file.relPath);
    const outDir = path.dirname(outPath);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`  ${file.relPath} (${(file.content.length / 1024).toFixed(0)}KB)`);

    // Step 1: Format with prettier
    let formatted;
    try {
      formatted = await prettier.format(file.content, {
        parser: 'babel',
        printWidth: 100,
        tabWidth: 2,
        semi: true,
        singleQuote: false,
        trailingComma: 'all',
      });
    } catch (e) {
      console.warn(`    prettier error: ${e.message.split('\n')[0]}`);
      formatted = file.content;
    }

    // Step 2: Write formatted file
    fs.writeFileSync(outPath, formatted);

    // Step 3: Extract manifest entries from formatted code
    const entries = extractManifestEntries(formatted, file.relPath);
    totalFunctions += entries.length;
    manifest.push(...entries);

    console.log(`    -> ${entries.length} functions, ${(formatted.length / 1024).toFixed(0)}KB formatted`);
  }

  // Write manifest
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nDone. ${totalFunctions} functions in manifest.`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
