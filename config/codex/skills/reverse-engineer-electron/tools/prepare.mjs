#!/usr/bin/env node
//
// prepare.mjs — Format JS and build function manifest
//
// Usage: node prepare.mjs <input-dir> <output-dir>
//
// Input:  Directory of minified source files (e.g., /tmp/codex-extracted/.vite/build/)
// Output: Formatted files in output-dir + manifest.json with function metadata
//
// Note: This script only formats and analyzes with AST parsing.
// It does NOT rename identifiers and does NOT use regex-based code parsing.

import prettier from 'prettier';
import fs from 'fs';
import path from 'path';

// [LAW:one-source-of-truth] The shape-token algorithm and the manifest's hash
// domain live in shape.mjs, shared with report.mjs — see the rationale there.
import {
  walkWithParent,
  isFunctionNode,
  resolveFunctionName,
  functionShapeTokens,
  tokensToHash,
  extractStrings,
  buildLineIndex,
  charToLineCol,
  parseFile,
  isSourceFile,
} from './shape.mjs';

// --- CLI ---

function parseArgs(argv) {
  const positional = argv.slice(2).filter(arg => !arg.startsWith('--'));
  return { positional };
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
      } else if (isSourceFile(entry.name)) {
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
  const ast = parseFile(code, relPath);

  const lineIndex = buildLineIndex(code);
  const entries = [];

  walkWithParent(ast, null, (node, parent) => {
    if (!isFunctionNode(node)) return;

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
  console.log(`\nFound ${files.length} source files`);

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
        filepath: file.relPath, // prettier picks its parser by the extension, as loaderFor does
        printWidth: 100,
        tabWidth: 2,
        semi: true,
        singleQuote: false,
        trailingComma: 'all',
        // The identity domain assumes prettier changes layout only; unquoting a
        // key turns a StringLiteral into an Identifier and changes the tokens.
        quoteProps: 'preserve',
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
