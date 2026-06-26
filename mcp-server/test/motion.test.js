import assert from "node:assert/strict";
import { test } from "node:test";
import { emitMotionCode } from "../src/generators/motion.js";

// MotionContext built from the real manualKeyframeTracks captured live
// (rotation 0->360 and opacity 0->1 over 1.2s, custom cubic-bezier easing).
const REAL_MOTION = {
  nodeId: "46:21",
  supported: true,
  degraded: false,
  source: "motion",
  presetStyles: [],
  timelineDurationMs: 1200,
  keyframeTracks: {
    ROTATION: {
      id: "KeyframeTrackId:46:22",
      baseValue: { type: "FLOAT", value: 0 },
      keyframes: [
        { id: "46:23", easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } }, value: { type: "FLOAT", value: 0 }, timelinePosition: 0 },
        { id: "46:24", easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } }, value: { type: "FLOAT", value: 360 }, timelinePosition: 1.2 }
      ]
    },
    OPACITY: {
      id: "KeyframeTrackId:46:26",
      baseValue: { type: "FLOAT", value: 1 },
      keyframes: [
        { id: "46:27", easing: { type: "EASE_OUT" }, value: { type: "FLOAT", value: 0 }, timelinePosition: 0 },
        { id: "46:28", easing: { type: "EASE_OUT" }, value: { type: "FLOAT", value: 1 }, timelinePosition: 1.2 }
      ]
    }
  },
  reactions: [],
  warnings: []
};

test("emitMotionCode(css): produces keyframes + animation for real tracks", () => {
  const out = emitMotionCode(REAL_MOTION, "css");
  assert.equal(out.language, "css");
  assert.match(out.code, /@keyframes anim-46-21-rotation/);
  assert.match(out.code, /transform: rotate\(360deg\)/);
  assert.match(out.code, /opacity: 1/);
  assert.match(out.code, /cubic-bezier\(0\.5, 0, 0\.5, 1\)/);
  assert.match(out.code, /100% \{/);
});

test("emitMotionCode: deterministic (byte-identical across calls)", () => {
  assert.equal(emitMotionCode(REAL_MOTION, "css").code, emitMotionCode(REAL_MOTION, "css").code);
  assert.equal(emitMotionCode(REAL_MOTION, "json").code, emitMotionCode(REAL_MOTION, "json").code);
});

test("emitMotionCode: language matches format", () => {
  assert.equal(emitMotionCode(REAL_MOTION, "css").language, "css");
  assert.equal(emitMotionCode(REAL_MOTION, "json").language, "json");
  assert.equal(emitMotionCode(REAL_MOTION, "react").language, "tsx");
});

test("emitMotionCode(react): emits keyframe arrays per property", () => {
  const out = emitMotionCode(REAL_MOTION, "react");
  assert.match(out.code, /"rotation":\[0,360\]/);
  assert.match(out.code, /"opacity":\[0,1\]/);
  assert.match(out.code, /duration: 1\.2/);
});

test("emitMotionCode: empty context is safe and warns", () => {
  const out = emitMotionCode({ nodeId: "x", keyframeTracks: {}, presetStyles: [] }, "css");
  assert.match(out.code, /no motion/);
  assert.ok(out.warnings.length > 0);
});

test("emitMotionCode: preset-only context emits a summary comment", () => {
  const out = emitMotionCode({ nodeId: "y", keyframeTracks: {}, presetStyles: [{ name: "motion.preset_name.scale", duration: 0.5 }] }, "css");
  assert.match(out.code, /preset: motion.preset_name.scale/);
  assert.ok(out.warnings.some((w) => /preset/i.test(w)));
});

test("emitMotionCode: never throws on malformed input", () => {
  assert.doesNotThrow(() => emitMotionCode(null, "css"));
  assert.doesNotThrow(() => emitMotionCode({}, "json"));
  assert.doesNotThrow(() => emitMotionCode({ keyframeTracks: { ROTATION: {} } }, "react"));
});
