//
// json-value.mjs — the shapes a parsed JSON value is checked against before a tool reads it.

// A JSON object: neither null nor an array.
export const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value) => typeof value === "string" && value !== "";
