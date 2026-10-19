//
// shape.mjs — the structural-shape contract shared by every tool that finds,
// hashes, or compares functions: prepare, gate, report, compare, substitute,
// detect-dependencies, verify-dependency-swap.
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
import { isFunction, isClassMethod, isClassPrivateMethod, isObjectMethod } from '@babel/types';
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

// [LAW:one-source-of-truth] babel's Function alias is the list of body-bearing
// node kinds — FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
// ObjectMethod, ClassMethod, ClassPrivateMethod — maintained by the parser's own
// package, so the toolchain cannot drift from what the parser emits (ticket ayg:
// a hand-kept list of three left every method invisible).
export function isFunctionNode(node) {
  return isFunction(node);
}

// The name a member's key states. A computed key (`[t](){}`) states none: its
// expression is a value, and an Identifier there is a variable, not the name.
function keyName(owner) {
  const key = owner.key;
  if (!key || owner.computed) return null;
  if (key.type === 'PrivateName') return `#${key.id.name}`;
  return key.name || (typeof key.value === 'string' ? key.value : null);
}

export function resolveFunctionName(node, parent) {
  if (node.id?.name) return node.id.name;
  // Methods carry their own key; a function-valued property's key is on the parent.
  if (node.key) return keyName(node);
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent.type === 'ObjectProperty' || parent.type === 'ClassProperty' ||
      parent.type === 'ClassPrivateProperty') {
    return keyName(parent);
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

// A function's source slice is a syntactically complete unit only inside a
// wrapper, and the wrapper is one shape for every kind: an exported derived
// class body. The export is load-bearing (a bare `(function(){...});` statement
// is side-effect-free, so minifySyntax deletes it); the class body is what lets
// a method slice (`static async *m(){}`) and any body reading `this.#x` parse
// at all, since esbuild refuses a private name no enclosing class declares;
// `extends Object` is what lets a constructor slice call `super()`.
//
// A class method stands in the body as itself. Every other kind is returned
// from a sentinel static method: a method body admits `arguments` in a nested
// arrow (a field initializer does not), and an object literal admits members a
// class body refuses (`get constructor(){}`). The sentinel's name is how the
// read-back tells the wrapper from the slice.
const SENTINEL = '__slice__';

function memberFor(node, src) {
  if (isClassMethod(node) || isClassPrivateMethod(node)) return src;
  const expr = isObjectMethod(node) ? `{ ${src} }` : src;
  return `static ${SENTINEL}() { return (${expr}); }`;
}

// Private names the function's params and body reach for, minus the node's own
// key: a `#m(){}` is already declared by the member itself, and a body that
// recurses through `this.#m` must not redeclare it as a field.
function privateNamesIn(node) {
  const names = new Set();
  const collect = (n) => { if (n.type === 'PrivateName') names.add(n.id.name); };
  for (const param of node.params) walk(param, collect);
  walk(node.body, collect);
  if (node.key?.type === 'PrivateName') names.delete(node.key.id.name);
  return [...names];
}

// Normalize one function node's source text through esbuild's syntax minifier
// and return its shape tokens. Throws on unparseable input; callers own the
// fallback so degradation is loud at the boundary. [LAW:no-silent-failure]
export function normalizedFunctionTokens(node, code, loader) {
  const fields = privateNamesIn(node).map((name) => `#${name};`).join(' ');
  const member = memberFor(node, code.slice(node.start, node.end));
  const wrapped = `export default class extends Object { ${fields} ${member} }`;
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
    if (!fnNode && isFunctionNode(n) && n.key?.name !== SENTINEL) fnNode = n;
  });
  if (!fnNode) {
    throw new Error('no function node survived normalization');
  }
  return functionShapeTokens(fnNode);
}
