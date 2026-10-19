import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const TOOLS_DIR = path.resolve(import.meta.dirname, "..");

function runNode(scriptPath, args, cwd) {
  return spawnSync("node", [path.join(TOOLS_DIR, scriptPath), ...args], { cwd, encoding: "utf8" });
}

// Ticket qtw: prepare, report and gate each parsed with their own babel config, so
// a file carrying syntax one config read and another did not failed the gate's
// manifest multiset check — or passed it for the wrong reason. Decorators and JSX
// are the two syntaxes the old configs disagreed on.
const DECORATED_JSX = [
  "class Panel{@memo render(items){return items.map(i=><li key={i.id}>{i.name}</li>)}",
  "@bound onClick(e){return this.render([e])}}",
  "function wrap(x){return <div>{x}</div>}",
].join("");
const NAMES = ["render", "onClick", "wrap"];

test("one parse feeds prepare, gate and report: a decorated JSX fixture passes the gate", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ec-parse-config-"));
  fs.mkdirSync(path.join(tmp, "input"));
  fs.writeFileSync(path.join(tmp, "input", "main.js"), DECORATED_JSX);

  const prep = runNode("prepare.mjs", [path.join(tmp, "input"), path.join(tmp, "prepared")], tmp);
  assert.equal(prep.status, 0, `prepare.mjs failed:\n${prep.stdout}\n${prep.stderr}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "prepared", "manifest.json"), "utf8"));
  const manifestNames = manifest.map((e) => e.name);
  for (const name of NAMES) {
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
  assert.deepEqual(artifact.mismatches.parseErrors, []);
  assert.equal(artifact.metrics.functionCountPrepared, manifest.length);

  fs.mkdirSync(path.join(tmp, "demin"));
  fs.copyFileSync(path.join(tmp, "prepared", "main.js"), path.join(tmp, "demin", "main.jsx"));
  const rep = runNode("report.mjs", [path.join(tmp, "prepared"), path.join(tmp, "demin"), "--json"], tmp);
  assert.equal(rep.status, 0, `report.mjs failed:\n${rep.stdout}\n${rep.stderr}`);
  assert.doesNotMatch(rep.stderr, /Normalize error|Manifest mismatch/, rep.stderr);
  const results = JSON.parse(rep.stdout.slice(rep.stdout.indexOf("[")));
  for (const name of NAMES) {
    const r = results.find((x) => x.name === name);
    assert.ok(r, `report must find ${name}`);
    assert.equal(r.similarity, 1, name);
  }
});

// [LAW:one-source-of-truth] The "Done when" of ticket qtw, checked structurally:
// shape.mjs is the only module in tools/ that imports the parser.
test("shape.mjs is the only importer of @babel/parser", () => {
  const files = ["", "tests"].flatMap((d) =>
    fs.readdirSync(path.join(TOOLS_DIR, d)).filter((f) => f.endsWith(".mjs")).map((f) => path.join(d, f)));
  const importers = files.filter((f) => /from ["']@babel\/parser["']/.test(fs.readFileSync(path.join(TOOLS_DIR, f), "utf8")));
  assert.deepEqual(importers, ["shape.mjs"]);
});
