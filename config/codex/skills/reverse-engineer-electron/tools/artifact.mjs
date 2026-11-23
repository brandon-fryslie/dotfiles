//
// artifact.mjs — writing JSON files whole, and a run's output files.

import fs from "fs";
import path from "path";

const partialPathOf = (filePath) => `${filePath}.${process.pid}.partial`;

function writePartial(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(partialPathOf(filePath), JSON.stringify(payload, null, 2));
}

// Writes a JSON file to a sibling and renames it into place, so an interrupted write leaves the previous file whole,
// never a truncated one.
export function writeJsonWhole(filePath, payload) {
  writePartial(filePath, payload);
  fs.renameSync(partialPathOf(filePath), filePath);
}

// [LAW:verifiable-goals] A run's outputs are all from the last run that finished, or absent: a run clears them before
// any work, so one that fails leaves none, and renames them into place only once every one is written whole.
export function clearOutputs(filePaths) {
  for (const filePath of filePaths) fs.rmSync(filePath, { force: true });
}

export function writeOutputs(outputs) {
  for (const [filePath, payload] of outputs) writePartial(filePath, payload);
  for (const [filePath] of outputs) fs.renameSync(partialPathOf(filePath), filePath);
}
