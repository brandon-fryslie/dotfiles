import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { writeText } from "./fixtures.mjs";
import { loadLockfile } from "../package-lock.mjs";

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// What loadLockfile reads from a package-lock.json path made by makeLock.
function lockfileAt(makeLock) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ec-package-lock-"));
  roots.push(root);
  const file = path.join(root, "package-lock.json");
  makeLock(file);
  return loadLockfile(file);
}

const lockText = (text) => (file) => writeText(file, text);
const lockJson = (lock) => lockText(JSON.stringify(lock));
const unusable = (reason) => ({ verdict: { kind: "incomplete", reason }, packages: [], unread: [] });

test("a package-lock.json that isn't there is absent, not a lockfile that records nothing", () => {
  assert.deepEqual(lockfileAt(() => {}), { verdict: { kind: "absent" }, packages: [], unread: [] });
});

test("a package-lock.json that can't be used as a lockfile at all says why, and gives no packages", () => {
  const truncated = '{"lockfileVersion": 3, "packages": {"node_modules/foo": ';
  const invalidJson = (() => {
    try {
      JSON.parse(truncated);
    } catch (error) {
      return error.message;
    }
  })();
  const cases = [
    [(file) => fs.symlinkSync("missing-lock.json", file), "it is not a file (dangling:missing-lock.json)"],
    [(file) => fs.mkdirSync(file), "it is not a file (dir)"],
    [(file) => assert.equal(spawnSync("mkfifo", [file]).status, 0), "it is not a file (special)"],
    [lockText(truncated), `it doesn't parse as JSON: ${invalidJson}`],
    [lockText("null"), "it is JSON null, not a JSON object"],
    [lockJson([{ "node_modules/foo": { version: "1.0.0" } }]), "it is a JSON array, not a JSON object"],
    [lockJson({ packages: { "node_modules/foo": { version: "1.0.0" } } }), "it records no lockfileVersion"],
    [lockJson({ lockfileVersion: "3", packages: {} }), 'its lockfileVersion "3" is not 1, 2 or 3'],
    [lockJson({ lockfileVersion: 3 }), "its packages is missing"],
    [lockJson({ lockfileVersion: 3, packages: null }), "its packages is not an object"],
    [lockJson({ lockfileVersion: 1, dependencies: [] }), "its dependencies is not an object"],
  ];
  for (const [makeLock, reason] of cases) assert.deepEqual(lockfileAt(makeLock), unusable(reason), reason);
});

test("a package-lock.json that can't be read says so, not that it doesn't parse", { skip: process.getuid?.() === 0 ? "chmod 000 doesn't restrict root" : false }, () => {
  const lockfile = lockfileAt((file) => {
    writeText(file, "{}");
    fs.chmodSync(file, 0o000);
  });
  assert.deepEqual(lockfile, unusable("it can't be read (EACCES)"));
});

test("a v3 lockfile lists every package it records by location, and each entry it can't read by its location and why", () => {
  const lockfile = lockfileAt(lockJson({ lockfileVersion: 3, packages: {
    "": { name: "app" },
    "packages/workspace": { name: "workspace", version: "0.0.0" },
    "node_modules/workspace": { link: true, resolved: "packages/workspace" },
    "node_modules/foo": {},
    "node_modules/@scope/bar": { resolved: "https://example.test/bar.tgz" },
    "node_modules/aliased": { name: "real", version: "1.0.0" },
    "node_modules/evil": { name: "../../evil", version: "1.0.0" },
    "node_modules/typed": { version: 1 },
    "node_modules/bare": "1.0.0",
    "node_modules/baz": { version: "1.0.0" },
    "node_modules/baz/node_modules/nested": {},
    "node_modules/trailing/": { version: "1.0.0" },
    "node_modules/": { link: true },
    "node_modules/@scope": { version: "1.0.0" },
  } }));
  assert.deepEqual(lockfile.packages, [
    { name: "baz", version: "1.0.0", location: "node_modules/baz" },
    { name: "real", version: "1.0.0", location: "node_modules/aliased" },
  ]);
  assert.deepEqual(lockfile.unread, [
    { entry: "node_modules/", reason: "is not a package location" },
    { entry: "node_modules/@scope", reason: "is not a package location" },
    { entry: "node_modules/@scope/bar", reason: "records no version" },
    { entry: "node_modules/bare", reason: "is not an object" },
    { entry: "node_modules/baz/node_modules/nested", reason: "records no version" },
    { entry: "node_modules/evil", reason: 'records name "../../evil", which is not a package name' },
    { entry: "node_modules/foo", reason: "records no version" },
    { entry: "node_modules/trailing/", reason: "is not a package location" },
    { entry: "node_modules/typed", reason: "records version 1, which is not a version" },
  ]);
  assert.deepEqual(lockfile.verdict, { kind: "incomplete", reason: "node_modules/ is not a package location, node_modules/@scope is not a package location, node_modules/@scope/bar records no version, node_modules/bare is not an object, node_modules/baz/node_modules/nested records no version, node_modules/evil records name \"../../evil\", which is not a package name, node_modules/foo records no version, node_modules/trailing/ is not a package location, node_modules/typed records version 1, which is not a version" });
});

test("a lockfile that begins with a UTF-8 byte order mark is read as npm reads it", () => {
  const lockfile = lockfileAt(lockText(`\uFEFF${JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/foo": { version: "1.0.0" } } })}`));
  assert.deepEqual(lockfile, { verdict: { kind: "listed" }, packages: [{ name: "foo", version: "1.0.0", location: "node_modules/foo" }], unread: [] });
});

test("a v2 lockfile is read from its packages section, never its v1 dependencies mirror", () => {
  const lockfile = lockfileAt(lockJson({
    lockfileVersion: 2,
    dependencies: { foo: { version: "1.0.0" }, bar: { version: "3.0.0" } },
    packages: { "": {}, "node_modules/foo": { version: "2.0.0" } },
  }));
  assert.deepEqual(lockfile, { verdict: { kind: "listed" }, packages: [{ name: "foo", version: "2.0.0", location: "node_modules/foo" }], unread: [] });
});

test("a v1 lockfile's nested dependencies are read at their nested locations, with aliases and links", () => {
  const lockfile = lockfileAt(lockJson({ lockfileVersion: 1, dependencies: {
    foo: { version: "1.0.0", dependencies: { bar: { version: "2.0.0" }, quux: {} } },
    aliased: { version: "npm:@scope/real@3.0.0" },
    "@scope/scoped": { version: "4.0.0" },
    linked: { version: "file:../linked" },
    halfalias: { version: "npm:bar" },
    broken: { version: "1.0.0", dependencies: "bar" },
  } }));
  assert.deepEqual(lockfile.packages, [
    { name: "@scope/real", version: "3.0.0", location: "node_modules/aliased" },
    { name: "@scope/scoped", version: "4.0.0", location: "node_modules/@scope/scoped" },
    { name: "bar", version: "2.0.0", location: "node_modules/foo/node_modules/bar" },
    { name: "broken", version: "1.0.0", location: "node_modules/broken" },
    { name: "foo", version: "1.0.0", location: "node_modules/foo" },
  ]);
  assert.deepEqual(lockfile.unread, [
    { entry: "node_modules/broken", reason: "records dependencies that are not an object" },
    { entry: "node_modules/foo/node_modules/quux", reason: "records no version" },
    { entry: "node_modules/halfalias", reason: 'records version "npm:bar", which is not an npm:<name>@<version> alias' },
  ]);
});
