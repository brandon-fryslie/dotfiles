import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "@babel/parser";

import { walkWithParent, isFunctionNode, resolveFunctionName, normalizedFunctionTokens } from "../shape.mjs";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-methods-test-"));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runNode(scriptPath, args, cwd) {
  return spawnSync("node", [path.join(TOOLS_DIR, scriptPath), ...args], { cwd, encoding: "utf8" });
}

// Every body-bearing kind babel emits that is not a plain function: constructor,
// static, getter, private, async generator, computed-key, object-literal method,
// and a function-valued property for contrast. Ticket ayg: none of the methods
// were seen by any tool. The second class and `wrap` are the slices the esbuild
// wrapper once rejected: a `super()` constructor, a private method recursing
// through its own name, an identifier-computed key, an arrow reading `arguments`,
// and an object getter keyed `constructor`.
const MINIFIED_ORIGINAL = [
  "class Cart{#tax=0.2;constructor(items){this.items=items}static empty(){return new Cart([])}",
  "get total(){return this.items.reduce((a,i)=>a+i.price*i.qty,0)*(1+this.#tax)}",
  '#log(msg){console.log("cart:"+msg)}async *stream(){for(const i of this.items){yield i}}',
  "[Symbol.iterator](){return this.items[Symbol.iterator]()}}",
  "const util={fmt(n){return n.toFixed(2)},plain:function(a){return a+1}};",
  "const k=\"size\";class Bag extends Cart{#h;constructor(o){super([]);this.#h=()=>o}",
  "#walk(n){return n?this.#walk(n-1):0}[k](){return this.#walk(3)}}",
  "function wrap(){return [1].map(x=>arguments[0]+x)}",
  "const proto={get constructor(){return Bag}};",
].join("");

const METHOD_NAMES = ["constructor", "empty", "total", "#log", "stream", "fmt", "plain", "#walk", "wrap", "#h"];
// Nameless but present: the reducer arrow, `[Symbol.iterator]`, `[k]`, the `arguments` arrow.
const NAMELESS_COUNT = 4;

function parseModule(code) {
  return parse(code, { sourceType: "module", plugins: [], errorRecovery: true, allowReturnOutsideFunction: true });
}

function namedFunctions(code) {
  const names = [];
  walkWithParent(parseModule(code), null, (node, parent) => {
    if (isFunctionNode(node)) names.push(resolveFunctionName(node, parent));
  });
  return names;
}

test("isFunctionNode and resolveFunctionName see every method kind babel emits", () => {
  const names = namedFunctions(MINIFIED_ORIGINAL);
  for (const name of METHOD_NAMES) {
    assert.ok(names.includes(name), `${name} must be found, got ${JSON.stringify(names)}`);
  }
  assert.equal(names.filter((n) => n === null).length, NAMELESS_COUNT, JSON.stringify(names));
  assert.ok(!names.includes("k"), `a computed key's identifier is not a name: ${JSON.stringify(names)}`);
});

test("normalizedFunctionTokens parses a method slice standalone and bridges a stylistic rewrite", () => {
  // The body reads a private field the slice alone cannot declare.
  const original = "class A { #k; m(x) { if (x) { return this.#k; } else { return 2; } } }";
  const rewrite = "class A { #k; m(flag) { return flag ? this.#k : 2; } }";
  const tokensOf = (code) => {
    let found = null;
    walkWithParent(parseModule(code), null, (node) => {
      if (!found && node.type === "ClassMethod") found = normalizedFunctionTokens(node, code, "js");
    });
    return found;
  };
  assert.deepEqual(tokensOf(original), tokensOf(rewrite));
});

// Tokens of the first node of the given kind in code, normalized.
function normalizedOf(code, type, plugins = []) {
  const ast = parse(code, { sourceType: "module", plugins, errorRecovery: true });
  let tokens = null;
  walkWithParent(ast, null, (node) => {
    if (!tokens && node.type === type) tokens = normalizedFunctionTokens(node, code, "js");
  });
  assert.ok(tokens, `no ${type} in ${code}`);
  return tokens;
}

test("normalizedFunctionTokens parses a private method that recurses through its own name", () => {
  assert.ok(normalizedOf("class A { #f(n) { return n ? this.#f(n - 1) : 0; } }", "ClassPrivateMethod").length > 0);
});

test("normalizedFunctionTokens collapses method shorthand and a function-valued property", () => {
  assert.deepEqual(
    normalizedOf("const o = { m(a) { return a + 1; } };", "ObjectMethod"),
    normalizedOf("const o = { m: function (a) { return a + 1; } };", "FunctionExpression"),
  );
});

test("normalizedFunctionTokens accepts a decorated method and a private-name computed key", () => {
  assert.ok(normalizedOf("class A { @dec m() { return 1; } }", "ClassMethod", ["decorators"]).length > 0);
  assert.ok(normalizedOf("class A { #k; [this.#k]() { return 1; } }", "ClassMethod").length > 0);
});

test("resolveFunctionName names a private member assignment and refuses a computed one", () => {
  assert.ok(namedFunctions("class A { #h; constructor() { this.#h = () => 1; } }").includes("#h"));
  assert.deepEqual(namedFunctions("o[k] = function () {};"), [null]);
});

test("prepare manifests methods, gate prepare accepts the manifest, and report resolves them", () => {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "input", "main.js"), MINIFIED_ORIGINAL);

  const prep = runNode("prepare.mjs", [path.join(tmp, "input"), path.join(tmp, "prepared")], tmp);
  assert.equal(prep.status, 0, `prepare.mjs failed:\n${prep.stdout}\n${prep.stderr}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "prepared", "manifest.json"), "utf8"));
  const manifestNames = manifest.map((e) => e.name);
  for (const name of METHOD_NAMES) {
    assert.ok(manifestNames.includes(name), `manifest must contain ${name}, got ${JSON.stringify(manifestNames)}`);
  }

  const gate = runNode(
    "gate.mjs",
    ["prepare", "--orig", path.join(tmp, "input"), "--prepared", path.join(tmp, "prepared"),
     "--manifest", path.join(tmp, "prepared", "manifest.json"), "--out", path.join(tmp, "gate.json")],
    tmp,
  );
  assert.equal(gate.status, 0, `gate.mjs prepare failed:\n${gate.stdout}\n${gate.stderr}`);
  const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "gate.json"), "utf8"));
  assert.equal(artifact.pass, true, JSON.stringify(artifact.mismatches));
  assert.equal(artifact.metrics.functionCountManifest, manifest.length);
  assert.equal(artifact.metrics.functionCountPrepared, manifest.length);

  fs.mkdirSync(path.join(tmp, "demin"), { recursive: true });
  fs.copyFileSync(path.join(tmp, "prepared", "main.js"), path.join(tmp, "demin", "main.js"));
  const rep = runNode("report.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin"), "--json"], tmp);
  assert.equal(rep.status, 0, `report.mjs failed:\n${rep.stdout}\n${rep.stderr}`);
  assert.doesNotMatch(rep.stderr, /Normalize error/, rep.stderr);
  const results = JSON.parse(rep.stdout.slice(rep.stdout.indexOf("[")));
  for (const name of METHOD_NAMES) {
    const r = results.find((x) => x.name === name);
    assert.ok(r, `report must find ${name}`);
    assert.equal(r.similarity, 1, name);
    assert.equal(r.bestMatch.line, manifest.find((e) => e.name === name).line, name);
  }

  const cmp = runNode("compare.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin"), "--details"], tmp);
  assert.equal(cmp.status, 0, `compare.mjs failed:\n${cmp.stdout}\n${cmp.stderr}`);
  for (const name of METHOD_NAMES) {
    const re = new RegExp(`OK\\s+100%\\s+${name.replace("#", "\\#")} \\(line`);
    assert.match(cmp.stdout, re, `compare must map ${name} at 100%`);
  }

  // substitute mangles identifiers before matching, so names do not survive to its
  // output; what it must show is every function seen and every named one verified.
  const prepared = fs.readFileSync(path.join(tmp, "prepared", "main.js"), "utf8");
  writeText(path.join(tmp, "replacement.js"), prepared.replaceAll("items", "list"));
  const sub = runNode(
    "substitute.mjs",
    [path.join(tmp, "prepared", "main.js"), "1", String(prepared.split("\n").length), path.join(tmp, "replacement.js"), "--dry-run"],
    tmp,
  );
  assert.equal(sub.status, 0, `substitute.mjs failed:\n${sub.stdout}\n${sub.stderr}`);
  const all = namedFunctions(MINIFIED_ORIGINAL);
  const named = all.filter((n) => n !== null).length;
  assert.match(sub.stdout, new RegExp(`Original:\\s+${all.length} functions \\(${named} named\\)`), sub.stdout);
  assert.match(sub.stdout, new RegExp(`Replacement:\\s+${all.length} functions \\(${named} named\\)`), sub.stdout);
  assert.match(sub.stdout, new RegExp(`All ${named} named function\\(s\\) pass threshold`), sub.stdout);
});
