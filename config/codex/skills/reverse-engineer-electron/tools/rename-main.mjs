#!/usr/bin/env node
/**
 * Applies semantic renames to app/main.js from rename-maps/main.js.json
 * Handles word boundaries, regex flags, string literals, and scoped variables.
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const filePath = resolve('app/main.js');
let code = readFileSync(filePath, 'utf8');

function replaceWord(text, word, replacement) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'g'), replacement);
}

// ===== Phase 1: Safe multi-letter identifiers (global) =====
code = replaceWord(code, 'He', 'originalFs');
code = replaceWord(code, 'Be', 'buildApplicationMenu');
code = replaceWord(code, 'De', 'setupWindowEvents');
code = replaceWord(code, 'Fe', 'secureWebContents');
code = replaceWord(code, 'Me', 'openHelp');
code = replaceWord(code, 'Ne', 'stripProtocol');
code = replaceWord(code, 'Ue', 'isSeparator');
code = replaceWord(code, 'ae', 'titleBarStyle');
code = replaceWord(code, 'he', 'handleObsidianProtocol');

// ===== Phase 2: Single-letter class name =====
code = replaceWord(code, 'G', 'AdblockFilterList');

// ===== Phase 3: Context-sensitive identifiers =====
// it → matchRule: only when followed by ( (function call/def), avoids "open it?" strings
code = code.replace(/\bit\b(?=\s*\()/g, 'matchRule');

// Q → handleOpenURL: skip "Cmd+Q" in accelerator strings
code = code.replace(/\bQ\b/g, (match, offset) => {
  const before = code.slice(Math.max(0, offset - 5), offset);
  return before.includes('+') ? match : 'handleOpenURL';
});

// Z → openStarter: skip "Shift+Z" in accelerator strings
code = code.replace(/\bZ\b/g, (match, offset) => {
  const before = code.slice(Math.max(0, offset - 8), offset);
  return before.includes('+') ? match : 'openStarter';
});

// H → isWin: skip "Cmd+H" in accelerator strings
code = code.replace(/\bH\b/g, (match, offset) => {
  const before = code.slice(Math.max(0, offset - 5), offset);
  return before.includes('+') ? match : 'isWin';
});

// ===== Phase 4: Module-level requires =====
// i → electron: only replace i. (property access), skip /i (regex flag)
code = code.replace(/\bi\./g, (match, offset) => {
  return code[offset - 1] === '/' ? match : 'electron.';
});
code = code.replace('var i = require("electron")', 'var electron = require("electron")');

// m → fs: only replace m. (property access)
code = code.replace(/\bm\./g, (match, offset) => {
  return code[offset - 1] === '/' ? match : 'fs.';
});
code = code.replace('  m = ge(require("fs"))', '  fs = ge(require("fs"))');

// D → path: only replace D. (property access)
code = code.replace(/\bD\./g, (match, offset) => {
  return code[offset - 1] === '/' ? match : 'path.';
});
code = code.replace('  D = ge(require("path"))', '  path = ge(require("path"))');

// k → isDarwin: safe globally, no false positives
code = replaceWord(code, 'k', 'isDarwin');

// ===== Phase 5: Variables scoped to exported function =====
// These only appear inside the exported function, safe for global replace
code = replaceWord(code, 'b', 'settings');
code = replaceWord(code, 'F', 'vaults');
code = replaceWord(code, 'T', 'windows');
code = replaceWord(code, 'Y', 'useNativeFrame');

// ===== Phase 6: Exported function parameters (d, l, g) =====
// These ALSO appear as local params in helper functions before line 215.
// Only rename within the exported function body.
const modLines = code.split('\n');
const exportIdx = modLines.findIndex(line => line.includes('module.exports = function'));
if (exportIdx === -1) {
  console.error('Could not find exported function!');
  process.exit(1);
}

const preExport = modLines.slice(0, exportIdx).join('\n');
let exportBody = modLines.slice(exportIdx).join('\n');

// Rename function signature
exportBody = exportBody.replace(
  /module\.exports = function \(d, l, g\)/,
  'module.exports = function (appPath, updater, isDev)'
);

// d → appPath: skip \d in regex patterns
exportBody = exportBody.replace(/\bd\b/g, (match, offset) => {
  return exportBody[offset - 1] === '\\' ? match : 'appPath';
});

// l → updater: safe within exported function (no inner functions reuse 'l')
exportBody = replaceWord(exportBody, 'l', 'updater');

// g → isDev: skip /g regex flags
exportBody = exportBody.replace(/\bg\b/g, (match, offset) => {
  return exportBody[offset - 1] === '/' ? match : 'isDev';
});

code = preExport + '\n' + exportBody;

writeFileSync(filePath, code, 'utf8');
console.log('Renames applied successfully.');

// Verify syntax
try {
  execSync(`node --check ${filePath}`, { stdio: 'pipe' });
  console.log('Syntax check PASSED');
} catch (e) {
  console.error('SYNTAX ERROR:', e.stderr?.toString());
  // Show the problematic area
  const errMsg = e.stderr?.toString() || '';
  const lineMatch = errMsg.match(/:(\d+)/);
  if (lineMatch) {
    const errLine = parseInt(lineMatch[1]);
    const lines = readFileSync(filePath, 'utf8').split('\n');
    console.error('\nContext around error:');
    for (let i = Math.max(0, errLine - 3); i < Math.min(lines.length, errLine + 2); i++) {
      console.error(`${i + 1}: ${lines[i]}`);
    }
  }
  process.exit(1);
}
