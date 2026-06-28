// Schema-by-error decoder.
//
// Figma's Plugin API validates inputs at runtime and, when a call is wrong,
// throws an error string that describes the *expected* schema: allowed enum
// values, required fields, literal discriminators, and type mismatches.
//
// This module turns those human-readable error strings into structured facts
// we can store in an API catalog and generate tools/types from. It is pure
// (string in, object out) so it is fully unit-testable without Figma.

/**
 * @typedef {Object} ParsedSchema
 * @property {string|null} method   Method name (from "in <method>: ...").
 * @property {string|null} arg      Argument name (from 'Property "<arg>" failed validation').
 * @property {boolean} isUnion      True when the validator reported a union ("one of the following").
 * @property {Array<Object>} constraints  Flat list of extracted constraints.
 * @property {Object<string,string[]>} enums  Convenience map of path -> allowed enum values.
 */

/**
 * Parse a Figma Plugin API validation error string into structured schema facts.
 * @param {string} message
 * @returns {ParsedSchema}
 */
export function parseValidationError(message) {
  const text = String(message == null ? "" : message);
  const result = {
    method: null,
    arg: null,
    isUnion: /Expected one of the following, but none matched/.test(text),
    constraints: [],
    enums: {}
  };

  const head = text.match(/^in\s+([A-Za-z0-9_]+):\s*Property\s+"([^"]+)"\s+failed validation/);
  if (head) {
    result.method = head[1];
    result.arg = head[2];
  } else {
    const headOnly = text.match(/^in\s+([A-Za-z0-9_]+):/);
    if (headOnly) result.method = headOnly[1];
  }

  const PATH = "([.\\[][^\\s\\n,]*)";
  let m;

  // Enum: Expected 'A' | 'B' | 'C', received 'X' at .path
  const enumRe = new RegExp(
    "Expected\\s+((?:'[^']*'\\s*\\|\\s*)*'[^']*')\\s*,\\s*received\\s+'?([^'\\n]+?)'?\\s+at\\s+" + PATH,
    "g"
  );
  while ((m = enumRe.exec(text)) !== null) {
    const values = m[1].split("|").map((s) => s.trim().replace(/^'|'$/g, ""));
    const path = m[3];
    result.constraints.push({ kind: "enum", path, expected: values, received: m[2] });
    result.enums[path] = values;
  }

  // Literal discriminator: Invalid literal value, expected "X" at .path
  const litRe = new RegExp('Invalid literal value, expected\\s+"([^"]+)"\\s+at\\s+' + PATH, "g");
  while ((m = litRe.exec(text)) !== null) {
    result.constraints.push({ kind: "literal", path: m[2], expected: m[1] });
  }

  // Type mismatch: Expected <type>, received <type> [at .path]
  const typeRe = new RegExp(
    "Expected\\s+(object|string|number|boolean|array|null)\\s*,\\s*received\\s+" +
      "(object|string|number|boolean|array|null|undefined)(?:\\s+at\\s+" + PATH + ")?",
    "g"
  );
  while ((m = typeRe.exec(text)) !== null) {
    result.constraints.push({ kind: "type", path: m[3] || null, expected: m[1], received: m[2] });
  }

  // Required field: Required value missing [at .path]
  const reqRe = new RegExp("Required value missing(?:\\s+at\\s+" + PATH + ")?", "g");
  while ((m = reqRe.exec(text)) !== null) {
    result.constraints.push({ kind: "required", path: m[1] || null });
  }

  // Unrecognized keys: Unrecognized key(s) in object: 'a', 'b' [at index 0]
  const unkRe = /Unrecognized key\(s\) in object:\s*([^\n]+?)(?:\s+at\s+([^\n]+))?$/gm;
  while ((m = unkRe.exec(text)) !== null) {
    const keys = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    result.constraints.push({ kind: "unrecognized", keys, at: m[2] ? m[2].trim() : null });
  }

  return result;
}

/**
 * Convenience: collect all enum value sets discovered in an error, keyed by path.
 * @param {string} message
 * @returns {Object<string,string[]>}
 */
export function extractEnums(message) {
  return parseValidationError(message).enums;
}

/**
 * Summarize a parsed schema into the required field names and any literal
 * discriminator (e.g., the `type` field of a discriminated union).
 * @param {ParsedSchema} parsed
 */
export function summarizeShape(parsed) {
  const required = [];
  const literals = {};
  for (const c of parsed.constraints) {
    if (c.kind === "required" && c.path) required.push(c.path);
    if (c.kind === "literal" && c.path) {
      if (!literals[c.path]) literals[c.path] = [];
      if (literals[c.path].indexOf(c.expected) === -1) literals[c.path].push(c.expected);
    }
  }
  return { required, literals };
}
