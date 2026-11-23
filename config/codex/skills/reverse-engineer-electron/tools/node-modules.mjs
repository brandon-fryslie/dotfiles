// An app's node_modules as Node's module resolution reads it: the package locations require() looks in, and what each
// one loads once its links are followed.
import fs from "fs";
import path from "path";

// [LAW:types-are-the-program] Every state a path can be in once followed through its links, as a value: a caller
// handles each one rather than crashing on a loop or an unreadable target, or dropping it unseen. A directory is one
// that can be listed and read, since that is what every reader of it does next.
export function pathState(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return { kind: "file" };
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.X_OK);
    return { kind: "directory" };
  } catch (error) {
    if (error.code !== "ENOENT") return { kind: "unreadable", code: error.code };
    return fs.lstatSync(dir, { throwIfNoEntry: false }) ? { kind: "dangling", target: fs.readlinkSync(dir) } : { kind: "absent" };
  }
}

// A path with its existing directories resolved through symlinks, so two spellings of one tree (/var vs /private/var
// on macOS) compare equal; the part that doesn't exist yet is kept as written.
export function realExisting(dir) {
  return fs.existsSync(dir) ? fs.realpathSync(dir) : path.join(realExisting(path.dirname(dir)), path.basename(dir));
}

// [LAW:one-source-of-truth] Where an entry of an app's node_modules really lives: the real directory holding it, and
// whether that is inside the app's real node_modules. Past a link out of it (a scope linked to a workspace's own
// scope, say), nothing is the app's to change, so a copy living there can't be swapped.
export function entryHome(realNodeModules, dir) {
  const parent = realExisting(path.dirname(dir));
  return { parent, inApp: parent === realNodeModules || parent.startsWith(`${realNodeModules}${path.sep}`) };
}

// [LAW:one-source-of-truth] The package a module path is inside: the one named right after its last node_modules
// segment, since a nested node_modules holds a dependency's own copies (node_modules/a/node_modules/b/x.js is in b).
// Null for a path inside no package.
export function packageNameOf(modulePath) {
  const parts = modulePath.split(/[\\/]/);
  const at = parts.lastIndexOf("node_modules");
  if (at === -1) return null;
  const [first, second] = parts.slice(at + 1);
  if (!first) return null;
  if (!first.startsWith("@")) return first;
  return second ? `${first}/${second}` : null;
}

// The top-level package locations of one node_modules directory, each by the name require() resolves through it:
// node_modules/<name> and node_modules/@scope/<name>. Dot entries (.bin, .pnpm, .original) are tooling, not packages.
// A scope that is not a listable directory stays an entry itself, so its state is still read.
export function topLevelEntries(nodeModulesDir) {
  const listing = (dir) => fs.readdirSync(dir).filter((name) => !name.startsWith("."));
  return listing(nodeModulesDir).flatMap((name) => {
    const dir = path.join(nodeModulesDir, name);
    if (!name.startsWith("@") || pathState(dir).kind !== "directory") return [{ name, dir }];
    return listing(dir).map((child) => ({ name: `${name}/${child}`, dir: path.join(dir, child) }));
  });
}

// What a top-level entry loads: a package, under the entry's name and its own (they differ for an npm alias,
// `"x": "npm:other@1"`, which loads other under the name x), or the reason it loads none with a version.
export function readEntry({ name, dir }) {
  const state = pathState(dir);
  if (state.kind !== "directory") return { ...state, name, dir };
  let text;
  try {
    text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
  } catch (error) {
    return error.code === "ENOENT" ? { kind: "no-manifest", name, dir } : { kind: "unreadable", code: error.code, name, dir };
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    return { kind: "invalid-manifest", reason: error.message, name, dir };
  }
  const named = (value) => typeof value === "string" && value !== "";
  if (!named(manifest?.name) || !named(manifest.version)) {
    return { kind: "invalid-manifest", reason: "name and version must be non-empty strings", name, dir };
  }
  return { kind: "package", packageName: manifest.name, version: manifest.version, name, dir };
}

// Why an entry loads no package, said for an operator; `where` is how the entry's path is shown.
export function describeEntry(entry, where) {
  switch (entry.kind) {
    case "absent": return `${where} was listed but is gone`;
    case "dangling": return `${where} is a link to ${entry.target}, which does not exist`;
    case "unreadable": return `${where} cannot be read (${entry.code})`;
    case "file": return `${where} is a file, not a package directory`;
    case "no-manifest": return `${where} has no package.json, so it has no version`;
    case "invalid-manifest": return `${where}/package.json is not a usable manifest: ${entry.reason}`;
  }
  throw new Error(`${where} loads ${entry.kind}, which is not a reason to load no package`);
}
