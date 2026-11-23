//
// json-value.mjs — the shapes a parsed JSON value is checked against before a tool reads it.

// A JSON object: neither null nor an array.
export const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value) => typeof value === "string" && value !== "";

// [LAW:types-are-the-program] The top-level shape a tool reads a JSON input as, which path-state.mjs's readJson
// requires of every value it returns, so no tool reads a manifest that is null or a list that is an object.
export const JSON_SHAPE = {
  object: { what: "a JSON object", accepts: isPlainObject },
  array: { what: "a JSON array", accepts: Array.isArray },
};
