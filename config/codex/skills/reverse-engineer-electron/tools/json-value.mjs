//
// json-value.mjs — the shapes a parsed JSON value is checked against before a tool reads it.

// A JSON object: neither null nor an array.
export const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value) => typeof value === "string" && value !== "";

// The JSON type a value is: null, array, object, string, number or boolean.
export const jsonTypeOf = (value) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);

// [LAW:types-are-the-program] The top-level shapes a JSON input file is read as, each with the one test it holds to.
export const JSON_SHAPE = Object.freeze({
  object: { type: "object", holds: isPlainObject },
  array: { type: "array", holds: Array.isArray },
});
