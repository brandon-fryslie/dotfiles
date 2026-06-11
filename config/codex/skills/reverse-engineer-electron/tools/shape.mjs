//
// shape.mjs — the structural-shape contract shared by prepare.mjs and report.mjs
//
// [LAW:one-source-of-truth] The manifest's shapeHash is only meaningful if every
// tool that produces or looks up a hash derives it from the same algorithm over
// the same domain. Duplicated copies of this code drifted once (prepare hashed
// the formatted AST while report hashed a re-minified one — ticket .22); a shared
// module makes "same algorithm" structural rather than disciplinary.
//
// Two distinct token domains, deliberately kept apart:
//
//   - IDENTITY (functionShapeTokens over the source AST): stable for one file as
//     written. prepare.mjs records it in manifest.json; gate.mjs and report.mjs
//     re-derive it from the same file to look entries up. Never run through a
//     transformer — any syntax rewrite breaks the contract with the manifest.
//
//   - SIMILARITY (normalizedFunctionTokens): esbuild-minified so that stylistic
//     differences (if/else vs ternary, statement merging) between the original
//     and an agent's deminified rewrite collapse to the same token stream. Only
//     ever compared against tokens produced by this same function.

import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import { createHash } from 'crypto';

const SKIP_KEYS = new Set([
  'type', 'start', 'end', 'loc', 'leadingComments',
  'trailingComments', 'innerComments', 'extra', 'range', 'comments',
]);

export function walk(node, visitor) {
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

export function walkWithParent(node, parent, visitor) {
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

export function isFunctionNode(node) {
  return node.type === 'FunctionDeclaration' ||
         node.type === 'FunctionExpression' ||
         node.type === 'ArrowFunctionExpression';
}

export function resolveFunctionName(node, parent) {
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

export function functionShapeTokens(node) {
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

export function tokensToHash(tokens) {
  return createHash('sha256').update(tokens.join(',')).digest('hex').slice(0, 16);
}

export function extractStrings(node) {
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

export function buildLineIndex(code) {
  const lines = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') lines.push(i + 1);
  }
  return lines;
}

export function charToLineCol(lineIndex, charOffset) {
  let lo = 0, hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= charOffset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: charOffset - lineIndex[lo] };
}

// --- Similarity domain ---

// Normalize one function's source text through esbuild's syntax minifier and
// return its shape tokens. Throws on unparseable input; callers own the
// fallback so degradation is loud at the boundary. [LAW:no-silent-failure]
export function normalizedFunctionTokens(fnSource, loader) {
  // The export anchor is load-bearing: a bare `(function(){...});` expression
  // statement is side-effect-free, so minifySyntax deletes it outright.
  const wrapped = `export default (${fnSource});`;
  const minified = transformSync(wrapped, {
    loader,
    minify: true,
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    target: 'esnext',
    format: 'esm',
  }).code;

  const ast = parse(minified, {
    sourceType: 'module',
    plugins: [],
    errorRecovery: true,
    allowReturnOutsideFunction: true,
  });

  let fnNode = null;
  walk(ast, (n) => {
    if (!fnNode && isFunctionNode(n)) fnNode = n;
  });
  if (!fnNode) {
    throw new Error('no function node survived normalization');
  }
  return functionShapeTokens(fnNode);
}
