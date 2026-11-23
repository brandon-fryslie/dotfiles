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
  listCodeEntries,
  unreadText,
  SOURCE_TREE_EXCLUDES,
} from './shape.mjs';
import { inputAt, readText } from './path-state.mjs';

// --- CLI ---

function parseArgs(argv) {
  const positional = argv.slice(2).filter(arg => !arg.startsWith('--'));
  return { positional };
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

  const input = inputAt(inputDir, 'dir');
  if (input.kind !== 'dir') {
    console.error(`Error: ${inputDir} ${input.reason}`);
    process.exit(1);
  }

  // [LAW:one-source-of-truth] What prepare writes is listCodeEntries', the same set the prepare gate checks.
  const absDir = path.resolve(inputDir);
  const entries = listCodeEntries(absDir, SOURCE_TREE_EXCLUDES);
  const files = entries.filter(({ kind }) => kind === 'file');
  console.log(`\nFound ${files.length} source files`);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = [];
  let totalFunctions = 0;

  for (const entry of entries) {
    const outPath = path.join(outputDir, entry.rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    // Whatever an earlier run left at the path goes first, so nothing is written through a link it left there.
    fs.rmSync(outPath, { force: true });

    // [LAW:single-enforcer] shape.mjs's link rule: a link is written as itself, never read through; a special file
    // can't be copied, so it is named and its absence fails the prepare gate.
    if (entry.kind === 'link') {
      fs.symlinkSync(entry.target, outPath);
      console.log(`  ${entry.rel} -> ${entry.target} (link)`);
      continue;
    }
    if (entry.kind === 'special') {
      console.warn(`  ${unreadText(absDir, entry)}`);
      continue;
    }

    // A file it can't read is named and left unwritten, so the prepare gate fails on it, as on a special file.
    const read = readText(path.join(absDir, entry.rel));
    if (read.kind !== 'text') {
      console.warn(`  ${path.join(absDir, entry.rel)} ${read.reason}, so it is not prepared`);
      continue;
    }
    const content = read.text;
    console.log(`  ${entry.rel} (${(content.length / 1024).toFixed(0)}KB)`);

    // Step 1: Format with prettier
    let formatted;
    try {
      formatted = await prettier.format(content, {
        filepath: entry.rel, // prettier picks its parser by the extension, as loaderFor does
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
      formatted = content;
    }

    // Step 2: Write formatted file
    fs.writeFileSync(outPath, formatted);

    // Step 3: Extract manifest entries from formatted code
    const fileEntries = extractManifestEntries(formatted, entry.rel);
    totalFunctions += fileEntries.length;
    manifest.push(...fileEntries);

    console.log(`    -> ${fileEntries.length} functions, ${(formatted.length / 1024).toFixed(0)}KB formatted`);
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
