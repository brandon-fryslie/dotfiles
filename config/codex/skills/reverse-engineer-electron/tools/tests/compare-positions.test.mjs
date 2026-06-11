import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-compare-test-"));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

// Collection A: the "already minified" bundle as shipped. The banner pushes
// the functions off line 1, so a line number derived from re-minified text
// (where everything collapses to line 1) is distinguishable from the truth.
const MINIFIED_A = [
  "// bundle banner line 1",
  "// bundle banner line 2",
  "// bundle banner line 3",
  '"use strict";',
  'function processOrder(o){if(o.status==="pending"){console.log("processing order");return o.items.length>0?o.items.map(i=>i.price*i.qty).reduce((a,b)=>a+b,0):0}else{console.warn("order not pending");return-1}}',
  "function tinyHelper(x){return x+1}",
  "",
].join("\n");

const PROCESS_ORDER_LINE_A = 5;
const TINY_HELPER_LINE_A = 6;

// Collection B: a stylistic deminified rewrite — renamed identifiers,
// if/else kept, multi-line layout. processOrder starts on line 3.
const DEMINIFIED_B = [
  "// Deminified by an agent.",
  "",
  "function processOrder(order) {",
  '  if (order.status === "pending") {',
  '    console.log("processing order");',
  "    return order.items.length > 0",
  "      ? order.items.map((item) => item.price * item.qty).reduce((sum, value) => sum + value, 0)",
  "      : 0;",
  "  } else {",
  '    console.warn("order not pending");',
  "    return -1;",
  "  }",
  "}",
  "",
  "function tinyHelper(x) {",
  "  return x + 1;",
  "}",
  "",
].join("\n");

function runCompareDetails() {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "a", "main.js"), MINIFIED_A);
  writeText(path.join(tmp, "b", "main.ts"), DEMINIFIED_B);

  const res = spawnSync(
    "node",
    [path.join(TOOLS_DIR, "compare.mjs"), path.join(tmp, "a"), path.join(tmp, "b"), "--details"],
    { cwd: tmp, encoding: "utf8" },
  );
  assert.equal(res.status, 0, `compare.mjs failed:\n${res.stdout}\n${res.stderr}`);
  return { tmp, stdout: res.stdout };
}

// Parse one per-function detail row:
//   OK 100%  processOrder (line 3, 42 tokens)  -> main.js:5 processOrder (char 71)
function parseDetailRow(stdout, name) {
  const re = new RegExp(
    `^\\s*\\S+\\s+(\\d+)%\\s+${name} \\(line (\\d+|\\?), \\d+ tokens\\)\\s+-> (\\S+):(\\d+) ${name} \\(char (\\d+)\\)$`,
    "m",
  );
  const m = stdout.match(re);
  assert.ok(m, `no detail row for ${name} in:\n${stdout}`);
  return {
    similarity: Number(m[1]),
    lineB: m[2] === "?" ? null : Number(m[2]),
    fileA: m[3],
    lineA: Number(m[4]),
    charA: Number(m[5]),
  };
}

test("collection-A references point into the original file, not re-minified text", () => {
  const { stdout } = runCompareDetails();

  const processOrder = parseDetailRow(stdout, "processOrder");
  assert.equal(
    processOrder.lineA,
    PROCESS_ORDER_LINE_A,
    "A-side line must be the line in the file the user can open",
  );
  assert.ok(
    MINIFIED_A.slice(processOrder.charA).startsWith("function processOrder"),
    `A-side char offset ${processOrder.charA} must land on the function in the original file`,
  );

  const tinyHelper = parseDetailRow(stdout, "tinyHelper");
  assert.equal(tinyHelper.lineA, TINY_HELPER_LINE_A);
  assert.ok(
    MINIFIED_A.slice(tinyHelper.charA).startsWith("function tinyHelper"),
    `A-side char offset ${tinyHelper.charA} must land on the function in the original file`,
  );
});

test("collection-B lines come from the deminified source the agent wrote", () => {
  const { stdout } = runCompareDetails();

  assert.equal(parseDetailRow(stdout, "processOrder").lineB, 3);
  assert.equal(parseDetailRow(stdout, "tinyHelper").lineB, 15);
});

// Over-correction guard: fixing positions must not regress the reason
// minification exists — stylistic rewrites (if/else vs ternary, renamed
// params, statement layout) must still collapse to the same token stream.
test("stylistic rewrites still bridge across collections", () => {
  const { stdout } = runCompareDetails();

  const processOrder = parseDetailRow(stdout, "processOrder");
  assert.ok(
    processOrder.similarity >= 95,
    `equivalent rewrite must score as a match, got ${processOrder.similarity}%`,
  );

  const tinyHelper = parseDetailRow(stdout, "tinyHelper");
  assert.ok(tinyHelper.similarity >= 95, `got ${tinyHelper.similarity}%`);
});
