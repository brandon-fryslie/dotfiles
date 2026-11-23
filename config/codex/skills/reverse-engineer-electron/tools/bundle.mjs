//
// bundle.mjs — the bundle-analysis contract shared by detect-dependencies and unbundle-index: which call in a parsed
// build file is a webpack or browserify bundle, what its module factories are, and which modules each one requires.
//
// [LAW:one-source-of-truth] Both tools once carried their own copies of this code, and the copies drifted (lbl.p2q:
// a factory whose require slot had a default had dependencies in one tool's report and none in the other's).

import traverseImport from "@babel/traverse";

const traverseAst = traverseImport.default || traverseImport;

const isFactory = (node) => node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";

function collectCandidateCalls(node, out) {
  if (!node || typeof node !== "object") return;
  if (node.type === "CallExpression" && node.arguments.some((arg) => arg?.type === "ArrayExpression" || arg?.type === "ObjectExpression")) {
    out.push(node);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) collectCandidateCalls(item, out);
    else if (value && typeof value === "object") collectCandidateCalls(value, out);
  }
}

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
  const calls = [];
  collectCandidateCalls(ast.program, calls);
  let best = null;
  let bestScore = -1;
  for (const call of calls) {
    for (const arg of call.arguments) {
      const score = countModuleLikeEntries(arg);
      if (score > bestScore) {
        best = { call, arg };
        bestScore = score;
      }
    }
  }
  return best;
}

function propertyKeyValue(keyNode) {
  if (!keyNode) return null;
  if (keyNode.type === "Identifier") return keyNode.name;
  if (keyNode.type === "StringLiteral") return keyNode.value;
  if (keyNode.type === "NumericLiteral") return String(keyNode.value);
  return null;
}

function entryModuleFromCode(code) {
  const marker = ".s=";
  let idx = code.indexOf(marker);
  while (idx !== -1) {
    let pos = idx + marker.length;
    let value = "";
    while (pos < code.length && code[pos] >= "0" && code[pos] <= "9") value += code[pos++];
    if (value.length > 0) return Number(value);
    idx = code.indexOf(marker, idx + marker.length);
  }
  return null;
}

function literalValue(node) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type === "NumericLiteral") return String(node.value);
  return null;
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

function moduleRecord(code, format, { id, key, factory, container }) {
  return {
    id,
    key,
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
      isFactory(element) ? [moduleRecord(code, "webpack4", { id: index, key: String(index), factory: element, container: element })] : [],
    );
    return modules.length > 0 ? { format: "webpack4", entryModuleId: entryModuleFromCode(code), modules } : null;
  }

  if (arg.type === "ObjectExpression") {
    const keyed = arg.properties
      .filter((property) => property.type === "ObjectProperty" && propertyKeyValue(property.key) !== null)
      .map((property) => ({ key: propertyKeyValue(property.key), property }));
    const browserify = keyed.filter(({ property }) => property.value.type === "ArrayExpression" && isFactory(property.value.elements[0]));
    if (browserify.length > 0) {
      const firstEntry = call.arguments[2]?.type === "ArrayExpression" ? call.arguments[2].elements[0] : null;
      return {
        format: "browserify",
        entryModuleId: firstEntry?.type === "NumericLiteral" || firstEntry?.type === "StringLiteral" ? firstEntry.value : null,
        modules: browserify.map(({ key, property }) =>
          moduleRecord(code, "browserify", { id: key, key, factory: property.value.elements[0], container: property }),
        ),
      };
    }
    const webpack = keyed.filter(({ property }) => isFactory(property.value));
    if (webpack.length > 0) {
      return {
        format: "webpack5",
        entryModuleId: null,
        modules: webpack.map(({ key, property }) => moduleRecord(code, "webpack5", { id: key, key, factory: property.value, container: property })),
      };
    }
  }

  return null;
}

// Each module's dependencies, by module id: the ids its require binding is called with, and for browserify the
// specifiers and ids of its dependency map. [LAW:types-are-the-program] A call counts as a require only when its
// callee resolves, by scope, to the factory's require binding, so an inner function that rebinds the name (as
// minifiers do) is not a require.
export function moduleDependencies(ast, bundle) {
  const byRequire = new Map(bundle.modules.filter((record) => record.require).map((record) => [record.require, { ids: [], specifiers: [] }]));
  traverseAst(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== "Identifier") return;
      const found = byRequire.get(p.scope.getBinding(callee.name)?.identifier);
      const value = literalValue(p.node.arguments[0]);
      if (found && value !== null) found.ids.push(value);
    },
  });
  const unique = (values) => [...new Set(values)];
  return new Map(bundle.modules.map((record) => {
    const fromCalls = byRequire.get(record.require) ?? { ids: [], specifiers: [] };
    const depMap = bundle.format === "browserify" ? record.containerNode.value.elements[1] : null;
    const mapped = depMap?.type === "ObjectExpression" ? depMap.properties.filter((property) => property.type === "ObjectProperty") : [];
    return [record, {
      dependencyIds: unique([...fromCalls.ids, ...mapped.map((property) => literalValue(property.value)).filter((value) => value !== null)]),
      dependencySpecifiers: unique(mapped.map((property) => propertyKeyValue(property.key)).filter(Boolean)),
    }];
  }));
}
