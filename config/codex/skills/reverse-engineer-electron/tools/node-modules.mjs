// An app's node_modules as Node's module resolution reads it: the package locations require() looks in, and what each
// one loads once its links are followed.
import fs from "fs";
import path from "path";

// [LAW:types-are-the-program] Every state a path can be in once followed through its links, as a value: a caller
// handles each one rather than crashing on a loop or an unreadable target, or dropping it unseen.
export function pathState(dir) {
  try {
    return fs.statSync(dir).isDirectory() ? { kind: "directory" } : { kind: "file" };
  } catch (error) {
    if (error.code !== "ENOENT") return { kind: "unreadable", code: error.code };
    return fs.lstatSync(dir, { throwIfNoEntry: false }) ? { kind: "dangling", target: fs.readlinkSync(dir) } : { kind: "absent" };
  }
}

// [LAW:one-source-of-truth] The top-level package locations of one node_modules directory, each by the name require()
// resolves through it: node_modules/<name> and node_modules/@scope/<name>. Dot entries (.bin, .pnpm, .original) are
// tooling, not packages. A scope that is not a directory stays an entry itself, so its state is still read.
export function topLevelEntries(nodeModulesDir) {
  const listing = (dir) => fs.readdirSync(dir).filter((name) => !name.startsWith("."));
  return listing(nodeModulesDir).flatMap((name) => {
    const dir = path.join(nodeModulesDir, name);
    if (!name.startsWith("@") || pathState(dir).kind !== "directory") return [{ name, dir }];
    return listing(dir).map((child) => ({ name: `${name}/${child}`, dir: path.join(dir, child) }));
  });
}

// What a top-level entry loads: a package and its version, or the reason it loads none this pipeline can trial. An
// entry whose package.json names another package is an npm alias (`"x": "npm:other@1"`): it loads that package under
// the entry's name.
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
  if (typeof manifest?.name !== "string" || typeof manifest.version !== "string") {
    return { kind: "invalid-manifest", reason: "name and version must be strings", name, dir };
  }
  if (manifest.name !== name) return { kind: "alias", packageName: manifest.name, version: manifest.version, name, dir };
  return { kind: "package", version: manifest.version, name, dir };
}
