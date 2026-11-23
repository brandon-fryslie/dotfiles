//
// bundle.mjs — how a shipped JS file is read, and how a webpack or browserify bundle in it is found: which call holds
// its module factories, which module is its entry, and which modules each one requires.
//
// [LAW:types-are-the-program] A module id is a string in every format, as are its entry and its dependency ids, so
// an id from one place is compared with an id from another without conversion.

import fs from "fs";
import path from "path";
import { walk, traverse, parseRunnable, listFiles, SOURCE_TREE_EXCLUDES } from "./shape.mjs";

// The JS files a target holds: the target itself, or every .js file under it.
export function listJsFiles(target) {
  if (fs.statSync(target).isFile()) return path.extname(target) === ".js" ? [target] : [];
  return listFiles(target, SOURCE_TREE_EXCLUDES)
    .filter((rel) => path.extname(rel) === ".js")
    .map((rel) => path.join(target, rel));
}

// A JS file's outcome: unreadable or unparsed, with its errors, or parsed, with its code and syntax tree.
export function readJsFile(file) {
  let code;
  try {
    code = fs.readFileSync(file, "utf8");
  } catch (error) {
    return { kind: "unreadable", errors: [error.message] };
  }
  const { ast, errors } = parseRunnable(code, "js");
  return ast === null ? { kind: "unparsed", errors } : { kind: "parsed", code, ast };
}

const isFactory = (node) => node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";

function countModuleLikeEntries(node) {
  if (node?.type === "ArrayExpression") return node.elements.filter(isFactory).length;
  if (node?.type === "ObjectExpression") {
    return node.properties.filter(
      (property) => property.type === "ObjectProperty" && (isFactory(property.value) || isFactory(property.value.elements?.[0])),
    ).length;
  }
  return 0;
}

// The argument, of all the program's calls, that holds the most module factories.
function bestModuleArgument(ast) {
  let best = null;
  let bestScore = -1;
  walk(ast.program, (node) => {
    if (node.type !== "CallExpression") return;
    for (const arg of node.arguments) {
      if (arg?.type !== "ArrayExpression" && arg?.type !== "ObjectExpression") continue;
      const score = countModuleLikeEntries(arg);
      if (score > bestScore) {
        best = { call: node, arg };
        bestScore = score;
      }
    }
  });
  return best;
}

// The name a property's key states: a literal, quoted or computed, or an identifier that isn't computed (a computed
// identifier is a variable, not a name).
function propertyKey({ key, computed }) {
  if (key.type === "StringLiteral") return key.value;
  if (key.type === "NumericLiteral") return String(key.value);
  return !computed && key.type === "Identifier" ? key.name : null;
}

function literalValue(node) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type === "NumericLiteral") return String(node.value);
  return null;
}

// The webpack4 entry module: the id the bootstrap function assigns to its require's `s` before requiring it.
function webpack4Entry(bootstrap) {
  let entry = null;
  walk(bootstrap, (node) => {
    if (entry !== null || node.type !== "AssignmentExpression" || node.left.type !== "MemberExpression") return;
    if (!node.left.computed && node.left.property.name === "s") entry = literalValue(node.right);
  });
  return entry;
}

// The identifier a factory binds its require function to: browserify passes it first, webpack third. A plain
// parameter or one with a default binds it; any other slot (absent, or a pattern) binds no callable name, so the
// module requires nothing by call.
const REQUIRE_SLOT = { browserify: 0, webpack4: 2, webpack5: 2 };
function requireBinding(functionNode, format) {
  const slot = functionNode.params[REQUIRE_SLOT[format]];
  const bound = slot?.type === "AssignmentPattern" ? slot.left : slot;
  return bound?.type === "Identifier" ? bound : null;
}

function moduleRecord(code, format, { id, factory, container }) {
  return {
    id,
    source: code.slice(container.start, container.end),
    startOffset: container.start,
    endOffset: container.end,
    functionNode: factory,
    containerNode: container,
    require: requireBinding(factory, format),
  };
}

// The bundle a parsed build file is, or null for a file that isn't one: its format, entry module, and module records.
export function detectBundle(ast, code) {
  const best = bestModuleArgument(ast);
  if (!best) return null;
  const { call, arg } = best;

  if (arg.type === "ArrayExpression") {
    const modules = arg.elements.flatMap((element, index) =>
      isFactory(element) ? [moduleRecord(code, "webpack4", { id: String(index), factory: element, container: element })] : [],
    );
    return modules.length > 0 ? { format: "webpack4", entryModuleId: webpack4Entry(call.callee), modules } : null;
  }

  const keyed = arg.properties
    .filter((property) => property.type === "ObjectProperty" && propertyKey(property) !== null)
    .map((property) => ({ id: propertyKey(property), property }));
  const browserify = keyed.filter(({ property }) => property.value.type === "ArrayExpression" && isFactory(property.value.elements[0]));
  if (browserify.length > 0) {
    const entries = call.arguments[2];
    return {
      format: "browserify",
      entryModuleId: entries?.type === "ArrayExpression" ? literalValue(entries.elements[0]) : null,
      modules: browserify.map(({ id, property }) => moduleRecord(code, "browserify", { id, factory: property.value.elements[0], container: property })),
    };
  }
  const webpack = keyed.filter(({ property }) => isFactory(property.value));
  return webpack.length > 0
    ? { format: "webpack5", entryModuleId: null, modules: webpack.map(({ id, property }) => moduleRecord(code, "webpack5", { id, factory: property.value, container: property })) }
    : null;
}

const sortedUnique = (values) => [...new Set(values)].sort();

// Each module record's dependencies, sorted: the ids of the modules it requires, and for browserify the specifiers
// it requires them by. A webpack module requires a module by calling its require binding with the module's id. A
// browserify module requires by specifier, and its dependency map gives each specifier's id.
// [LAW:types-are-the-program] A call counts as a require only when its callee resolves, by scope, to the factory's
// require binding, so an inner function that rebinds the name (as minifiers do) is not a require.
export function moduleDependencies(ast, bundle) {
  const calledIds = new Map(bundle.modules.filter((record) => record.require).map((record) => [record.require, []]));
  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== "Identifier") return;
      const ids = calledIds.get(p.scope.getBinding(callee.name)?.identifier);
      const value = literalValue(p.node.arguments[0]);
      if (ids && value !== null) ids.push(value);
    },
  });
  const dependencies = {
    webpack4: (record) => ({ ids: calledIds.get(record.require) ?? [], specifiers: [] }),
    webpack5: (record) => ({ ids: calledIds.get(record.require) ?? [], specifiers: [] }),
    browserify: (record) => {
      const depMap = record.containerNode.value.elements[1];
      const entries = depMap?.type === "ObjectExpression" ? depMap.properties.filter((property) => property.type === "ObjectProperty") : [];
      return {
        ids: entries.map((property) => literalValue(property.value)).filter((value) => value !== null),
        specifiers: entries.map(propertyKey).filter((key) => key !== null),
      };
    },
  }[bundle.format];
  return new Map(bundle.modules.map((record) => {
    const { ids, specifiers } = dependencies(record);
    return [record, { dependencyIds: sortedUnique(ids), dependencySpecifiers: sortedUnique(specifiers) }];
  }));
}
