//
// shape.mjs — the structural-shape contract shared by every tool that finds,
// hashes, or compares functions: prepare, gate, report, compare, substitute,
// detect-dependencies, verify-dependency-swap, unbundle-index (walker).
//
// [LAW:one-source-of-truth] The manifest's shapeHash is only meaningful if every
// tool that produces or looks up a hash derives it from the same algorithm over
// the same domain. Duplicated copies of this code drifted once (prepare hashed
// the formatted AST while report hashed a re-minified one — ticket .22); a shared
// module makes "same algorithm" structural rather than disciplinary.
//
// Three distinct token domains, deliberately kept apart:
//
//   - IDENTITY (functionShapeTokens over the source AST): stable for one file as
//     written. prepare.mjs records it in manifest.json; gate.mjs and report.mjs
//     re-derive it from the same file to look entries up. Never run through a
//     transformer — any syntax rewrite breaks the contract with the manifest.
//
//   - BODY (statementsShape): IDENTITY's tokens over a list of statements alone,
//     a function's body or a whole file's, so a bundled module factory, whose
//     parameters the bundler chose, matches the package file or function it was
//     built from.
//
//   - SIMILARITY (normalizedFunctionTokens): esbuild-minified so that stylistic
//     differences (if/else vs ternary, statement merging) between the original
//     and an agent's deminified rewrite collapse to the same token stream. Only
//     ever compared against tokens produced by this same function.

import { parse } from '@babel/parser';
import traverseImport from '@babel/traverse';
import { isFunction, isClassMethod, isClassPrivateMethod, isObjectMethod } from '@babel/types';
import { transformSync } from 'esbuild';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { listDir, pathState } from './path-state.mjs';

// [LAW:one-source-of-truth] The parse that feeds every tool. gate once compared its
// own parse of a prepared file against prepare's parse of the same file under a
// different config (ticket qtw: three configs across nine tools), so any input the
// two read differently failed the gate or passed it for the wrong reason. One
// entry point, keyed by the file's loader, makes "same parse" structural.
//
// The loader is the one discriminator both readers of a file key on: babel's
// plugin set here, esbuild's loader in normalizedFunctionTokens. JS is read as
// JSX on both sides — JSX only claims a `<` where plain JS has no legal reading,
// so it rejects nothing a js loader accepts — which is why .jsx is not its own
// loader. [LAW:dataflow-not-control-flow] the per-loader differences are data;
// every loader parses the way an engine reads the file (parseSource).
const LOADERS = Object.freeze({
  js: { esbuild: 'jsx', plugins: ['jsx', 'decorators'] },
  ts: { esbuild: 'ts', plugins: ['typescript', 'decorators'] },
  tsx: { esbuild: 'tsx', plugins: ['typescript', 'jsx', 'decorators'] },
});

// A file's parse goal is what its name declares: .mjs and .mts are modules, .cjs and .cts scripts. Every other
// extension declares nothing; whatever loads the file decides (in an Electron app, a renderer's script tag as much
// as package.json's type), so the file is read under whichever goal accepts it.
const SOURCE_KIND_BY_EXTENSION = Object.freeze({
  '.js': { loader: 'js', goal: 'undeclared' },
  '.mjs': { loader: 'js', goal: 'module' },
  '.cjs': { loader: 'js', goal: 'script' },
  '.jsx': { loader: 'js', goal: 'undeclared' },
  '.ts': { loader: 'ts', goal: 'undeclared' },
  '.mts': { loader: 'ts', goal: 'module' },
  '.cts': { loader: 'ts', goal: 'script' },
  '.tsx': { loader: 'tsx', goal: 'undeclared' },
});

function loaderSpec(loader) {
  const spec = LOADERS[loader];
  if (!spec) throw new Error(`unknown loader ${JSON.stringify(loader)}`); // [LAW:no-silent-failure]
  return spec;
}

const DECLARATION_FILE = /\.d\.[mc]?ts$/;

// A file the toolchain reads: one with a loader, and not a declaration file,
// which parses as ts but declares no bodies.
export function isSourceFile(filePath) {
  return !DECLARATION_FILE.test(filePath) && path.extname(filePath) in SOURCE_KIND_BY_EXTENSION;
}

// [LAW:one-source-of-truth] The walk that feeds every tool. Nine copies drifted
// once (ticket 67o: gate skipped only .git while prepare skipped node_modules, so
// gate prepare demanded files prepare never wrote). The exclude set is data the
// caller passes [LAW:dataflow-not-control-flow]; the walk and its order are the
// same for every caller. A directory it can't list stops the walk naming it
// [LAW:no-silent-failure] — a silently shortened inventory is a gate that passes
// for the wrong reason.
export const SOURCE_TREE_EXCLUDES = new Set(['node_modules', '.git']);

// Sorted posix-relative paths of every entry under rootDir that is not a
// directory, as node reaches them: a directory, or a link to one, is descended
// once by its real path (so a link cycle ends), unless its name is in excludes.
// Every other entry is listed, a dangling link or a special file too: it is there
// whether or not it can be read, and the caller reads it through path-state.mjs,
// whose reason names one it can't read rather than taking it for missing.
export function listFiles(rootDir, excludes) {
  const out = [];
  const walked = new Set();
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const real = fs.realpathSync(current);
    if (walked.has(real)) continue;
    walked.add(real);
    const listed = listDir(current);
    if (listed.kind !== 'listed') throw new Error(`${current} can't be listed (${listed.code})`);
    for (const entry of listed.entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory() || (entry.isSymbolicLink() && pathState(abs).kind === 'dir')) {
        if (!excludes.has(entry.name)) stack.push(abs);
      } else {
        out.push(path.relative(rootDir, abs).split(path.sep).join('/'));
      }
    }
  }
  return out.sort();
}

// The source inventory every tool that parses a tree starts from: the walk,
// narrowed to the files parseFile can load.
export function listSourceFiles(rootDir, excludes) {
  return listFiles(rootDir, excludes).filter(isSourceFile);
}

export function sourceKindOf(filePath) {
  const kind = SOURCE_KIND_BY_EXTENSION[path.extname(filePath)];
  if (!kind) throw new Error(`no loader for ${filePath}`); // [LAW:no-silent-failure]
  return kind;
}

export const loaderFor = (filePath) => sourceKindOf(filePath).loader;

const parseOptions = (loader, sourceType) => ({
  sourceType,
  plugins: loaderSpec(loader).plugins,
  allowReturnOutsideFunction: true,
});

// @babel/traverse, whichever way the module system hands over its default export.
export const traverse = traverseImport.default || traverseImport;

// The parse is made the way an engine reads code under its goal: a script, sloppy
// unless it says otherwise, or a module; an undeclared goal is a script if the
// code runs as one, else a module. Code an engine would reject throws; with error
// recovery, babel would hand back a tree for it (a duplicate `let`, say), and a
// tree for code that doesn't run is one no tool should hash or analyze.
// [LAW:no-silent-failure]
export function parseSource(code, { loader, goal }) {
  if (goal !== 'undeclared') return parse(code, parseOptions(loader, goal));
  try {
    return parse(code, parseOptions(loader, 'script'));
  } catch (scriptError) {
    try {
      return parse(code, parseOptions(loader, 'module'));
    } catch (moduleError) {
      throw new SyntaxError(`as a script: ${scriptError.message}; as a module: ${moduleError.message}`, { cause: moduleError });
    }
  }
}

// The parse for code that came from a file: the loader and goal are the file's,
// and a failure names the file — babel's SyntaxError carries only a line and column.
export function parseFile(code, filePath) {
  try {
    return parseSource(code, sourceKindOf(filePath));
  } catch (e) {
    throw new Error(`${filePath}: ${e.message}`, { cause: e }); // [LAW:no-silent-failure]
  }
}

// [LAW:one-source-of-truth] The esbuild side of "both readers see one file":
// the one transform whose output normalizedFunctionTokens and the whole-file
// fingerprints read back. Output is plain JS for every loader (types stripped,
// JSX lowered, decorators passed through), so it reads back as parseMinified does.
export function minifySource(code, loader) {
  return transformSync(code, {
    loader: loaderSpec(loader).esbuild,
    minify: true,
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    target: 'esnext',
  }).code;
}

// minifySource's output, parsed: plain JS, under the goal of the code it minified. The transform converts no module
// format, so its output has its input's module syntax and its input's goal: a CommonJS file stays a sloppy script.
export const parseMinified = (minified, goal) => parseSource(minified, { loader: 'js', goal });

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

// The name a member key or property states. A string literal states it whether
// quoted or computed (`"m"(){}`, `o["m"] = ...`); a computed Identifier
// (`[t](){}`, `o[t] = ...`) is a variable, not a name.
function keyName(key, computed) {
  if (!key) return null;
  if (key.type === 'PrivateName') return `#${key.id.name}`;
  if (typeof key.value === 'string') return key.value;
  return computed ? null : key.name ?? null;
}

export function resolveFunctionName(node, parent) {
  if (node.id?.name) return node.id.name;
  // Methods carry their own key; a function-valued property's key is on the parent.
  if (node.key) return keyName(node.key, node.computed);
  if (!parent) return null;
  if (parent.type === 'ExportDefaultDeclaration') return 'default';
  if (parent.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent.type === 'ObjectProperty' || parent.type === 'ClassProperty' ||
      parent.type === 'ClassPrivateProperty') {
    return keyName(parent.key, parent.computed);
  }
  if (parent.type === 'AssignmentExpression' && parent.left) {
    if (parent.left.type === 'MemberExpression') {
      const prop = keyName(parent.left.property, parent.left.computed);
      if (!prop) return null;
      const obj = parent.left.object?.name;
      return obj ? `${obj}.${prop}` : prop;
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

// A function's body as statements: a block's own, or an expression body as the
// one statement that returns it, which is what `=> x` means.
export function bodyStatements(fn) {
  return fn.body.type === 'BlockStatement' ? fn.body.body : [{ type: 'ReturnStatement', argument: fn.body }];
}

// The BODY domain: the tokens of a list of statements, with their count and their hash.
export function statementsShape(statements) {
  const tokens = statements.flatMap(functionShapeTokens);
  return { size: tokens.length, hash: tokensToHash(tokens) };
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
// from a static method: a method body admits `arguments` in a nested arrow (a
// field initializer does not), and an object literal admits members a class
// body refuses (`get constructor(){}`). Each form knows where its slice sits
// in the minified member, so the read-back is positional, never by name.
function wrapperFor(node, src) {
  if (isClassMethod(node) || isClassPrivateMethod(node)) {
    return { member: src, slice: (m) => m };
  }
  if (isObjectMethod(node)) {
    return { member: `static f() { return ({ ${src} }); }`, slice: (m) => m.body.body[0].argument.properties[0] };
  }
  return { member: `static f() { return (${src}); }`, slice: (m) => m.body.body[0].argument };
}

// Private names the slice reaches for anywhere — a computed key, a decorator, a
// param, the body — minus the node's own key: a `#m(){}` is already declared by
// the member itself, and a body that recurses through `this.#m` must not
// redeclare it as a field.
function privateNamesIn(node) {
  const names = new Set();
  walk(node, (n) => { if (n.type === 'PrivateName') names.add(n.id.name); });
  if (node.key?.type === 'PrivateName') names.delete(node.key.id.name);
  return [...names];
}

// What a function is apart from its params and body: its member kind and the
// flags a rewrite must not flip. `m: function(a){}` and `m(a){}` share a head;
// a getter, a static, an async or generator function, and an arrow (no `this`
// of its own) each have their own.
function functionHead(node) {
  const kind = node.type === 'ArrowFunctionExpression' ? 'arrow' : (node.kind ?? 'method');
  const flags = ['static', 'async', 'generator'].filter((f) => node[f]).map((f) => `+${f}`).join('');
  return `F:${kind}${flags}`;
}

// Normalize one function node's source text through esbuild's syntax minifier
// and return its shape tokens. Throws on unparseable input; callers own the
// fallback so degradation is loud at the boundary. [LAW:no-silent-failure]
export function normalizedFunctionTokens(node, code, loader) {
  const fields = privateNamesIn(node).map((name) => `#${name};`).join(' ');
  const wrapper = wrapperFor(node, code.slice(node.start, node.end));
  const wrapped = `export default class extends Object { ${fields} ${wrapper.member} }`;
  const minified = minifySource(wrapped, loader);
  const ast = parseMinified(minified, 'module');

  // The wrapper is ours, so the slice's position in it is known: the one
  // function-bearing member of the class the module exports by default, then
  // the form's own path.
  const cls = ast.program.body.find((n) => n.type === 'ExportDefaultDeclaration')?.declaration;
  const member = cls?.body.body.find(isFunctionNode);
  const fnNode = member && wrapper.slice(member);
  if (!fnNode || !isFunctionNode(fnNode)) {
    throw new Error('no function node survived normalization');
  }
  // The slice's tokens are its head, params and body; its key is the member's,
  // not the function's.
  return [functionHead(fnNode), ...[...fnNode.params, fnNode.body].flatMap(functionShapeTokens)];
}

// --- Similarity scoring ---
// [LAW:one-source-of-truth] One LCS, one score: report, compare and substitute
// must agree on what "95%" means for the same pair of token streams.


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

export function tokenSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;
  const lcs = lcsLength(tokensA, tokensB);
  return (2 * lcs) / (tokensA.length + tokensB.length);
}
