//
// artifact.mjs — writing a run's JSON output files whole.

import fs from "fs";
import path from "path";

const partialPathOf = (filePath) => `${filePath}.${process.pid}.partial`;

function writePartial(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(partialPathOf(filePath), JSON.stringify(payload, null, 2));
}

// [LAW:verifiable-goals] An output present is whole and from the last run that wrote every output: a run clears its
// outputs before any work, so one that fails leaves none, and renames them into place only once every one is written.
export function clearOutputs(filePaths) {
  for (const filePath of filePaths) fs.rmSync(filePath, { force: true });
}

// Writes each output to a sibling and renames them into place only once all are written, so an interrupted write
// leaves the previous files whole, never a truncated one; a failed write removes the siblings it left.
export function writeOutputs(outputs) {
  try {
    for (const [filePath, payload] of outputs) writePartial(filePath, payload);
  } catch (error) {
    for (const [filePath] of outputs) fs.rmSync(partialPathOf(filePath), { force: true });
    throw error;
  }
  for (const [filePath] of outputs) fs.renameSync(partialPathOf(filePath), filePath);
}
