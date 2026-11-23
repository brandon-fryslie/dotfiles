import fs from "node:fs";
import path from "node:path";

// Writes a fixture file, creating its directories.
export function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}
