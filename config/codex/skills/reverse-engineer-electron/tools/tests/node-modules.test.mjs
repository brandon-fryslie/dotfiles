import assert from "node:assert/strict";
import test from "node:test";
import { packageNameOf } from "../node-modules.mjs";

test("packageNameOf names the package a module path is inside, by its last node_modules segment", () => {
  assert.equal(packageNameOf("./node_modules/a/index.js"), "a");
  assert.equal(packageNameOf("./node_modules/a/node_modules/b/lib/x.js"), "b");
  assert.equal(packageNameOf("node_modules/@scope/b"), "@scope/b");
  assert.equal(packageNameOf("node_modules/a/node_modules/@scope/c/index.js"), "@scope/c");
  assert.equal(packageNameOf(".\\node_modules\\a\\index.js"), "a");
  assert.equal(packageNameOf("/node_modules/foo/index.js */"), "foo");
  assert.equal(packageNameOf("./src/app.js"), null);
  assert.equal(packageNameOf("node_modules/@scope"), null);
  assert.equal(packageNameOf("node_modules/"), null);
});
