#!/usr/bin/env node
//
// read-json.mjs — path-state.mjs's JSON reader for the shell tools, so they read a JSON file as the node tools do.
//
// Usage: node read-json.mjs <file>
//
// Exit codes: 0 with the file's JSON value on stdout; 3 when nothing is there; 1 with the file and why on stderr when
// it is there but can't be read as JSON.

import process from "process";
import { mismatchText, readJson } from "./path-state.mjs";

const EXIT = { json: 0, absent: 3, unusable: 1 };

const file = process.argv[2];
if (file === undefined) {
  console.error("Usage: node read-json.mjs <file>");
  process.exit(2);
}

const read = readJson(file);
if (read.kind === "json") {
  process.stdout.write(JSON.stringify(read.value));
  process.exit(EXIT.json);
}
if (read.kind === "absent") process.exit(EXIT.absent);
console.error(`Error: ${file} ${mismatchText("file", read)}`);
process.exit(EXIT.unusable);
