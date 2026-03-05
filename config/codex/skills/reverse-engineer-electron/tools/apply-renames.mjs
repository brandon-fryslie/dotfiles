#!/usr/bin/env node
/**
 * Apply renames from a JSON spec file to a JavaScript source file.
 * Uses single-pass regex with JS-identifier-aware boundaries.
 *
 * Skips matches that appear to be:
 *   - Object property key definitions (identifier followed by ":")
 *   - Inside Unicode regex property patterns (\p{...})
 *
 * Usage: node apply-renames.mjs <source.js> <spec.json> [--dry-run]
 *
 * Spec format:
 *   { "oldName": "newName", ... }
 *
 * Or with metadata (keys starting with __ are metadata, not renames):
 *   {
 *     "__startLine": 14067,   // only apply to lines >= this (1-indexed)
 *     "__endLine": 185649,    // only apply to lines <= this
 *     "Sg": "Scope",
 *     ...
 *   }
 */
import { readFileSync, writeFileSync } from "fs";

const [, , filePath, specPath, ...flags] = process.argv;
const dryRun = flags.includes("--dry-run");

if (!filePath || !specPath) {
  console.error(
    "Usage: node apply-renames.mjs <source.js> <spec.json> [--dry-run]",
  );
  process.exit(1);
}

const raw = JSON.parse(readFileSync(specPath, "utf8"));

// Extract metadata (keys starting with __)
const startLine = raw.__startLine || 1;
const endLine = raw.__endLine || Infinity;

// Build rename map (non-metadata entries only)
const spec = {};
for (const [key, value] of Object.entries(raw)) {
  if (!key.startsWith("__")) {
    spec[key] = value;
  }
}

// Sort entries longest-first to prevent partial matches
const entries = Object.entries(spec).sort(
  (a, b) => b[0].length - a[0].length,
);

if (entries.length === 0) {
  console.log(`No renames to apply to ${filePath}`);
  process.exit(0);
}

// Escape special regex chars in identifier names (handles $)
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build alternation pattern
const pattern = entries.map(([old]) => escapeForRegex(old)).join("|");

// Use JS-identifier-aware boundaries:
// Not preceded by [a-zA-Z0-9_$] and not followed by [a-zA-Z0-9_$]
const re = new RegExp(
  `(?<![a-zA-Z0-9_$])(${pattern})(?![a-zA-Z0-9_$])`,
  "g",
);

const content = readFileSync(filePath, "utf8");
const lines = content.split("\n");

// Count replacements per identifier
const counts = {};
const skipped = { propKey: 0, unicodeRegex: 0 };
const hasRange = startLine > 1 || endLine < Infinity;

if (hasRange) {
  console.log(
    `  Restricting renames to lines ${startLine}-${endLine === Infinity ? "EOF" : endLine}`,
  );
}

/**
 * Check if a match at the given position is a property key definition.
 * Property keys are followed by ":" but NOT in ternary expressions (preceded by "?")
 * or switch case labels (preceded by "case ").
 */
function isPropertyKey(line, matchStart, matchEnd) {
  // Check what follows the match (skip whitespace)
  const after = line.slice(matchEnd).trimStart();
  if (!after.startsWith(":")) return false;

  // It's followed by ":" — check if this is a ternary or case label
  const before = line.slice(0, matchStart).trimEnd();
  // Ternary: "condition ? value :"
  if (before.endsWith("?")) return false;
  // Case label: "case VALUE:"
  if (/\bcase\s*$/.test(before)) return false;

  return true; // It's a property key — skip it
}

/**
 * Check if a match is inside a Unicode regex property pattern \p{...}
 * e.g., \p{sc=Arabic} — "sc" should not be renamed here
 */
function isInUnicodeRegexProp(line, matchStart) {
  // Look backwards for \p{ or \P{
  const before = line.slice(Math.max(0, matchStart - 10), matchStart);
  return /\\[pP]\{[^}]*$/.test(before);
}

/**
 * Check if a match is inside a regex literal.
 * Scans backwards from the match position to find an unmatched `/` that
 * starts a regex literal. This catches both character classes like [a-z0-9]
 * and other patterns inside regex.
 *
 * Why not just detect [...]? Because brackets are ambiguous — they could
 * be array literals or regex char classes. But regex literals are delimited
 * by `/`, which is unambiguous in formatted code.
 */
function isInRegexLiteral(line, matchStart) {
  // Scan backwards to find an opening / that could start a regex
  let slashCount = 0;
  let pos = matchStart - 1;

  // First, find the nearest unescaped /
  while (pos >= 0) {
    if (line[pos] === "/" && (pos === 0 || line[pos - 1] !== "\\")) {
      // Found a /. Is this a regex open or a division/comment?
      // Check what precedes it: regex follows operators, keywords, or start of line.
      // Division follows identifiers, numbers, or closing brackets/parens.
      const before = line.slice(0, pos).trimEnd();
      if (before.length === 0) return true; // Start of line — regex

      const lastChar = before[before.length - 1];
      // After these, / starts a regex
      if ("=(!&|^~:?%,;[{<>+-*/".includes(lastChar)) return true;
      // After keywords like return, typeof, in, instanceof, etc.
      if (/\b(?:return|typeof|instanceof|in|delete|void|throw|new|case|yield|await)\s*$/.test(before)) return true;

      // Otherwise, it's a division operator — not a regex
      return false;
    }
    pos--;
  }

  return false; // No / found — not in a regex
}

// Apply renames line by line (respecting range)
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1; // 1-indexed
  if (lineNum < startLine || lineNum > endLine) continue;

  lines[i] = lines[i].replace(re, (match, _p1, offset) => {
    const matchEnd = offset + match.length;

    // Skip property key definitions
    if (isPropertyKey(lines[i], offset, matchEnd)) {
      skipped.propKey++;
      return match;
    }

    // Skip Unicode regex property patterns
    if (isInUnicodeRegexProp(lines[i], offset)) {
      skipped.unicodeRegex++;
      return match;
    }

    // Skip matches inside regex literals /pattern/
    if (isInRegexLiteral(lines[i], offset)) {
      skipped.regex = (skipped.regex || 0) + 1;
      return match;
    }

    counts[match] = (counts[match] || 0) + 1;
    return spec[match] || match;
  });
}

const newContent = lines.join("\n");
const totalReplacements = Object.values(counts).reduce((a, b) => a + b, 0);
const identifiersHit = Object.keys(counts).length;

console.log(
  `${dryRun ? "[DRY RUN] " : ""}${filePath}: ${totalReplacements} replacements across ${identifiersHit}/${entries.length} identifiers`,
);

// Show skip stats
const totalSkipped = skipped.propKey + skipped.unicodeRegex + (skipped.regex || 0);
if (totalSkipped > 0) {
  console.log(
    `  Skipped: ${skipped.propKey} property keys, ${skipped.unicodeRegex} unicode regex, ${skipped.regex || 0} regex literals`,
  );
}

// Show top renames (most occurrences first)
const sorted = entries
  .filter(([old]) => counts[old])
  .sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0));

for (const [old, newName] of sorted.slice(0, 30)) {
  console.log(`  ${old} -> ${newName}: ${counts[old]} occurrences`);
}
if (sorted.length > 30) {
  console.log(`  ... and ${sorted.length - 30} more`);
}

// Show identifiers with zero matches
const missed = entries.filter(([old]) => !counts[old]);
if (missed.length > 0) {
  console.log(
    `  (${missed.length} identifiers had 0 matches: ${missed.map(([o]) => o).join(", ")})`,
  );
}

if (!dryRun) {
  writeFileSync(filePath, newContent);
}
