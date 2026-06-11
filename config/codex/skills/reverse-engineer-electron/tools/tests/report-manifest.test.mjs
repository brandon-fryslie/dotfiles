import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ec-report-test-"));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runNode(scriptPath, args, cwd) {
  return spawnSync("node", [path.join(TOOLS_DIR, scriptPath), ...args], {
    cwd,
    encoding: "utf8",
  });
}

// A "minified" original with a non-trivial function: minifySyntax rewrites
// its if/else into a ternary, so its re-minified token stream differs from
// the formatted token stream — the exact divergence ticket .22 pins down.
const MINIFIED_ORIGINAL = [
  'function processOrder(o){if(o.status==="pending"){console.log("processing order");',
  "return o.items.length>0?o.items.map(i=>i.price*i.qty).reduce((a,b)=>a+b,0):0}",
  'else{console.warn("order not pending");return-1}}',
  "function tinyHelper(x){return x+1}",
].join("");

function prepareFixture() {
  const tmp = mkTmpDir();
  writeText(path.join(tmp, "input", "main.js"), MINIFIED_ORIGINAL);

  const prep = runNode("prepare.mjs", [path.join(tmp, "input"), path.join(tmp, "prepared")], tmp);
  assert.equal(prep.status, 0, `prepare.mjs failed:\n${prep.stdout}\n${prep.stderr}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "prepared", "manifest.json"), "utf8"));
  return { tmp, manifest };
}

function runReportJson(tmp) {
  const rep = runNode("report.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin"), "--json"], tmp);
  assert.equal(rep.status, 0, `report.mjs failed:\n${rep.stdout}\n${rep.stderr}`);
  const jsonStart = rep.stdout.indexOf("[");
  assert.notEqual(jsonStart, -1, `no JSON array in report output:\n${rep.stdout}`);
  return { results: JSON.parse(rep.stdout.slice(jsonStart)), stderr: rep.stderr };
}

test("report resolves manifest metadata (name, original line, strings) for a perfect deminified copy", () => {
  const { tmp, manifest } = prepareFixture();

  const processOrderEntry = manifest.find((e) => e.name === "processOrder");
  assert.ok(processOrderEntry, "manifest must contain processOrder");
  assert.ok(processOrderEntry.line > 0, "manifest line must be positive");
  assert.ok(processOrderEntry.strings.includes("processing order"));

  // The strongest possible input: the deminified file IS the prepared file.
  fs.mkdirSync(path.join(tmp, "demin"), { recursive: true });
  fs.copyFileSync(path.join(tmp, "prepared", "main.js"), path.join(tmp, "demin", "main.js"));

  const { results } = runReportJson(tmp);

  const processOrder = results.find((r) => r.name === "processOrder");
  assert.ok(
    processOrder,
    `report must keep the source-domain name "processOrder", got names: ${JSON.stringify(results.map((r) => r.name))}`,
  );
  assert.equal(processOrder.similarity, 1);

  // The manifest's whole purpose: original line numbers and extracted strings.
  assert.ok(processOrder.bestMatch, "processOrder must have a best match");
  assert.equal(processOrder.bestMatch.name, "processOrder");
  assert.equal(processOrder.bestMatch.line, processOrderEntry.line);
  assert.deepEqual(processOrder.bestMatch.strings, processOrderEntry.strings);
});

test("report's deminified-side line numbers come from the actual source file", () => {
  const { tmp } = prepareFixture();

  // A deminified rewrite with a known layout: processOrder starts on line 3.
  writeText(
    path.join(tmp, "demin", "main.ts"),
    [
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
    ].join("\n"),
  );

  const { results } = runReportJson(tmp);

  const processOrder = results.find((r) => r.name === "processOrder");
  assert.ok(processOrder, "report must find processOrder in the deminified sources");
  assert.equal(processOrder.line, 3, "line must point into the file the user can open");

  const tinyHelper = results.find((r) => r.name === "tinyHelper");
  assert.ok(tinyHelper, "report must find tinyHelper in the deminified sources");
  assert.equal(tinyHelper.line, 15);
});

test("structural normalization still bridges stylistic rewrites (if/else vs ternary, renamed params)", () => {
  const { tmp, manifest } = prepareFixture();

  // Same shape as the original, but written the way a human would:
  // different identifiers, if/else statements, separate statements.
  writeText(
    path.join(tmp, "demin", "main.ts"),
    [
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
    ].join("\n"),
  );

  const { results } = runReportJson(tmp);

  const processOrder = results.find((r) => r.name === "processOrder");
  assert.ok(processOrder);
  assert.ok(
    processOrder.similarity >= 0.95,
    `equivalent rewrite must score as a match, got ${processOrder.similarity}`,
  );

  const processOrderEntry = manifest.find((e) => e.name === "processOrder");
  assert.equal(processOrder.bestMatch.line, processOrderEntry.line);
  assert.deepEqual(processOrder.bestMatch.strings, processOrderEntry.strings);
});

test("a prepared file that drifted from its manifest fails loudly, not as silent line-0 metadata", () => {
  const { tmp } = prepareFixture();

  // Simulate a stale manifest: the prepared file was structurally edited after
  // prepare ran. (String/number VALUES don't participate in shape tokens, so
  // the edit must change the token stream, not just a literal's content.)
  const preparedPath = path.join(tmp, "prepared", "main.js");
  fs.writeFileSync(
    preparedPath,
    fs.readFileSync(preparedPath, "utf8").replace("return -1;", "return null;"),
  );

  fs.mkdirSync(path.join(tmp, "demin"), { recursive: true });
  fs.copyFileSync(preparedPath, path.join(tmp, "demin", "main.js"));

  const { stderr } = runReportJson(tmp);
  assert.match(
    stderr,
    /manifest/i,
    `a manifest/prepared-file mismatch must be surfaced on stderr, got:\n${stderr}`,
  );
});
