import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAnimations, makePreset, presetToApplyPayload } from "../src/generators/preset-bake.js";

// Trimmed but faithful slice of the real `node.animations` captured after
// applying the "Burst" UI preset (note the floating-point noise + a no-op X track).
const BURST_ANIMATIONS = {
  OPACITY: {
    timelineDuration: 2,
    baseValue: { type: "FLOAT", value: 1 },
    tracks: [{ keyframes: [
      { id: "a", easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } }, value: { type: "FLOAT", value: 0 }, timelinePosition: 0 },
      { id: "b", easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } }, value: { type: "FLOAT", value: 1 }, timelinePosition: 0.03 }
    ] }]
  },
  TRANSLATION_X: {
    tracks: [{ keyframes: [
      { value: { type: "FLOAT", value: 0 }, timelinePosition: 0, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } },
      { value: { type: "FLOAT", value: 0 }, timelinePosition: 0.3, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } }
    ] }]
  },
  TRANSLATION_Y: {
    tracks: [{ keyframes: [
      { value: { type: "FLOAT", value: 116 }, timelinePosition: 0, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07000000029802322, y1: 0.9700000286102295, x2: 0.5799999833106995, y2: 1 } } },
      { value: { type: "FLOAT", value: 0 }, timelinePosition: 0.3, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } }
    ] }]
  },
  ROTATION: {
    tracks: [{ keyframes: [
      { value: { type: "FLOAT", value: 90.00000250447816 }, timelinePosition: 0, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } },
      { value: { type: "FLOAT", value: 0 }, timelinePosition: 0.3, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } }
    ] }]
  },
  SCALE_X: {
    tracks: [{ keyframes: [
      { value: { type: "FLOAT", value: 0.800000011920929 }, timelinePosition: 0, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } },
      { value: { type: "FLOAT", value: 1 }, timelinePosition: 0.3, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.07, y1: 0.97, x2: 0.58, y2: 1 } } }
    ] }]
  }
};

test("normalizeAnimations: rounds noise, drops no-op tracks, sorts", () => {
  const norm = normalizeAnimations(BURST_ANIMATIONS);
  const props = norm.tracks.map((t) => t.property);
  assert.ok(!props.includes("TRANSLATION_X"), "no-op TRANSLATION_X should be dropped");
  assert.deepEqual(props, ["OPACITY", "ROTATION", "SCALE_X", "TRANSLATION_Y"], "tracks sorted, no-ops removed");

  const rotation = norm.tracks.find((t) => t.property === "ROTATION");
  assert.equal(rotation.keyframes[0].value.value, 90, "rotation value rounded 90.0000025 -> 90");

  const scale = norm.tracks.find((t) => t.property === "SCALE_X");
  assert.equal(scale.keyframes[0].value.value, 0.8, "scale value rounded 0.80000001 -> 0.8");

  const ty = norm.tracks.find((t) => t.property === "TRANSLATION_Y");
  assert.equal(ty.keyframes[0].easing.easingFunctionCubicBezier.x1, 0.07, "easing bezier rounded");

  assert.equal(norm.durationSec, 0.3);
});

test("normalizeAnimations: can keep no-op tracks when asked", () => {
  const norm = normalizeAnimations(BURST_ANIMATIONS, { dropNoOps: false });
  assert.ok(norm.tracks.some((t) => t.property === "TRANSLATION_X"));
});

test("normalizeAnimations: tolerates empty / malformed input", () => {
  assert.deepEqual(normalizeAnimations(null).tracks, []);
  assert.deepEqual(normalizeAnimations({}).tracks, []);
  assert.deepEqual(normalizeAnimations({ X: {} }).tracks, []);
});

test("makePreset + presetToApplyPayload: produce replayable payloads", () => {
  const preset = makePreset("Burst", normalizeAnimations(BURST_ANIMATIONS), { category: "enter", capturedAt: "2026-06-26" });
  assert.equal(preset.name, "Burst");
  assert.equal(preset.category, "enter");
  assert.equal(preset.source, "figma-ui-bake");

  const payload = presetToApplyPayload(preset);
  assert.equal(payload.length, preset.tracks.length);
  const first = payload[0];
  assert.equal(first.field.type, "PROPERTY");
  assert.ok(first.field.name);
  assert.ok(Array.isArray(first.track.keyframes));
  assert.ok(first.track.keyframes[0].value.type);
});

test("normalizeAnimations: deterministic output", () => {
  assert.equal(JSON.stringify(normalizeAnimations(BURST_ANIMATIONS)), JSON.stringify(normalizeAnimations(BURST_ANIMATIONS)));
});

test("normalizeAnimations: preserves CUSTOM_SPRING easing params (regression)", () => {
  const springAnim = {
    TRANSLATION_Y: {
      tracks: [{ keyframes: [
        { value: { type: "FLOAT", value: -60 }, timelinePosition: 0, easing: { type: "CUSTOM_SPRING", easingFunctionSpring: { bounce: 0.6535898384862247 } } },
        { value: { type: "FLOAT", value: 0 }, timelinePosition: 1.2, easing: { type: "CUSTOM_SPRING", easingFunctionSpring: { bounce: 0.6535898384862247 } } }
      ] }]
    }
  };
  const norm = normalizeAnimations(springAnim);
  const easing = norm.tracks[0].keyframes[0].easing;
  assert.equal(easing.type, "CUSTOM_SPRING");
  assert.equal(easing.easingFunctionSpring.bounce, 0.6536, "spring bounce preserved + rounded");
});
