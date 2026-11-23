//
// artifact.mjs — a JSON file a run produces for later runs and tools to read.
//
// [LAW:verifiable-goals] An artifact on disk is always whole and always from the last run that finished: a run
// clears its artifacts before any work, so one that fails leaves none, and writes each one to a sibling file and
// renames it into place, so an interrupted write leaves no truncated file.

import fs from "fs";
import path from "path";

export function clearArtifact(filePath) {
  fs.rmSync(filePath, { force: true });
}

export function writeArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const partialPath = `${filePath}.${process.pid}.partial`;
  fs.writeFileSync(partialPath, JSON.stringify(payload, null, 2));
  fs.renameSync(partialPath, filePath);
}
