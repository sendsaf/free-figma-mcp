import assert from "node:assert/strict";
import { test } from "node:test";
import { parseValidationError, extractEnums, summarizeShape } from "../src/schema-probe.js";

// Real error captured from applyManualKeyframeTrack with an invalid PROPERTY name.
const PROPERTY_ENUM_ERROR =
  "in applyManualKeyframeTrack: Property \"field\" failed validation: Expected one of the following, but none matched:\n" +
  "  Invalid enum value. Expected 'CORNER_RADIUS' | 'STROKE_WEIGHT' | 'WIDTH' | 'HEIGHT' | 'OPACITY' | 'TRANSLATION_X' | 'TRANSLATION_Y' | 'TRANSLATION_XY' | 'ROTATION' | 'SCALE_X' | 'SCALE_Y' | 'SCALE_XY' | 'PATH_TRIM_START' | 'PATH_TRIM_END', received '____INVALID____' at .name\n" +
  "  Multiple issues:\n" +
  "    Invalid literal value, expected \"INDEXED_ITEM\" at .type\n" +
  "    Required value missing at .collection\n" +
  "    Required value missing at .index\n" +
  "    Unrecognized key(s) in object: 'name'";

// Real error captured from setReactionsAsync with an invalid shape.
const REACTIONS_ERROR =
  "in setReactionsAsync: Property \"reactions\" failed validation: Expected [0].trigger to be one of the following, but none matched:\n" +
  "  Required value missing at [0].trigger\n" +
  "Unrecognized key(s) in object: 'bad' at index 0";

// Real error captured while probing the keyframe value shape.
const VALUE_TYPE_ERROR =
  "in applyManualKeyframeTrack: Property \"track\" failed validation: " +
  "Invalid literal value, expected \"FLOAT\" at .keyframes[0].value.type\n" +
  "Expected object, received number at .keyframes[0].value.value";

test("parseValidationError: extracts method and arg", () => {
  const p = parseValidationError(PROPERTY_ENUM_ERROR);
  assert.equal(p.method, "applyManualKeyframeTrack");
  assert.equal(p.arg, "field");
  assert.equal(p.isUnion, true);
});

test("parseValidationError: extracts the full animatable-property enum", () => {
  const p = parseValidationError(PROPERTY_ENUM_ERROR);
  const names = p.enums[".name"];
  assert.ok(Array.isArray(names), "expected an enum at .name");
  for (const expected of ["OPACITY", "ROTATION", "TRANSLATION_XY", "SCALE_XY", "PATH_TRIM_END", "WIDTH"]) {
    assert.ok(names.includes(expected), `enum should include ${expected}`);
  }
});

test("parseValidationError: extracts literal discriminator and required fields", () => {
  const p = parseValidationError(PROPERTY_ENUM_ERROR);
  const shape = summarizeShape(p);
  assert.deepEqual(shape.literals[".type"], ["INDEXED_ITEM"]);
  assert.ok(shape.required.includes(".collection"));
  assert.ok(shape.required.includes(".index"));
});

test("parseValidationError: extracts unrecognized keys", () => {
  const p = parseValidationError(PROPERTY_ENUM_ERROR);
  const unk = p.constraints.find((c) => c.kind === "unrecognized");
  assert.ok(unk, "expected an unrecognized-keys constraint");
  assert.deepEqual(unk.keys, ["name"]);
});

test("parseValidationError: handles reactions error (method, required, unrecognized)", () => {
  const p = parseValidationError(REACTIONS_ERROR);
  assert.equal(p.method, "setReactionsAsync");
  assert.equal(p.arg, "reactions");
  assert.ok(p.constraints.some((c) => c.kind === "required" && c.path === "[0].trigger"));
  const unk = p.constraints.find((c) => c.kind === "unrecognized");
  assert.deepEqual(unk.keys, ["bad"]);
});

test("parseValidationError: extracts nested literal + type mismatch", () => {
  const p = parseValidationError(VALUE_TYPE_ERROR);
  assert.ok(p.constraints.some((c) => c.kind === "literal" && c.path === ".keyframes[0].value.type" && c.expected === "FLOAT"));
  assert.ok(p.constraints.some((c) => c.kind === "type" && c.path === ".keyframes[0].value.value" && c.expected === "object" && c.received === "number"));
});

test("parseValidationError: tolerates empty / non-string input", () => {
  assert.deepEqual(parseValidationError(null).constraints, []);
  assert.deepEqual(parseValidationError(undefined).enums, {});
  assert.equal(parseValidationError({}).method, null);
});

test("extractEnums: returns just the enum map", () => {
  const enums = extractEnums(PROPERTY_ENUM_ERROR);
  assert.ok(enums[".name"].includes("ROTATION"));
});
