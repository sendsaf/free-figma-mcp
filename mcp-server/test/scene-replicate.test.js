import assert from "node:assert/strict";
import { test } from "node:test";
import { convertScene, convertEasing } from "../src/generators/scene-replicate.js";

const SPEC = {
  scene: { canvas: [1920, 1080], totalDurationSec: 1.5, background: "#0A0A0A" },
  elements: [
    {
      name: "Logo", type: "IMAGE", text: null,
      layout: { x: 860, y: 440, width: 200, height: 200, fill: "#FFFFFF", fontSize: null },
      startDelay: 0.2,
      phases: [
        { category: "enter", presetMatch: null, tracks: [
          { property: "OPACITY", keyframes: [ { t: 0, v: 0, easing: [0.5, 0, 0.5, 1] }, { t: 0.4, v: 1, easing: [0.5, 0, 0.5, 1] } ] },
          { property: "SCALE_X", keyframes: [ { t: 0, v: 0.6, easing: "spring" }, { t: 0.8, v: 1, easing: "spring" } ] }
        ] }
      ]
    },
    {
      name: "Title", type: "TEXT", text: "Hello",
      layout: { x: 760, y: 700, width: 400, height: 60, fill: "#FFFFFF", fontSize: 48 },
      startDelay: 0,
      phases: [ { category: "enter", presetMatch: "Burst", tracks: [] } ]
    }
  ]
};

const PRESETS = {
  Burst: { tracks: [ { property: "OPACITY", keyframes: [ { timelinePosition: 0, value: { type: "FLOAT", value: 0 }, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } } }, { timelinePosition: 0.3, value: { type: "FLOAT", value: 1 }, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } } } ] } ] }
};

test("convertEasing: array -> cubic-bezier, 'spring' -> spring, else default", () => {
  assert.deepEqual(convertEasing([0.1, 0.2, 0.3, 0.4]).easingFunctionCubicBezier, { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 });
  assert.equal(convertEasing("spring").type, "CUSTOM_SPRING");
  assert.equal(convertEasing(undefined).type, "CUSTOM_CUBIC_BEZIER");
});

test("convertScene: builds element plan with motion payloads", () => {
  const plan = convertScene(SPEC, { presets: PRESETS });
  assert.deepEqual(plan.canvas, [1920, 1080]);
  assert.equal(plan.background, "#0A0A0A");
  assert.equal(plan.elements.length, 2);

  const logo = plan.elements[0];
  assert.equal(logo.type, "IMAGE");
  const opacity = logo.payloads.find((p) => p.field.name === "OPACITY");
  assert.ok(opacity, "expected OPACITY payload");
  // startDelay 0.2 offsets keyframes and prepends a hold at 0
  assert.equal(opacity.track.keyframes[0].timelinePosition, 0, "hold keyframe at 0");
  assert.equal(opacity.track.keyframes[1].timelinePosition, 0.2, "first real kf offset by startDelay");
  assert.equal(opacity.track.keyframes[2].timelinePosition, 0.6, "0.4 + 0.2 delay");
  // value wrapped as FLOAT
  assert.deepEqual(opacity.track.keyframes[1].value, { type: "FLOAT", value: 0 });
  // spring easing converted on SCALE_X
  const scale = logo.payloads.find((p) => p.field.name === "SCALE_X");
  assert.equal(scale.track.keyframes[1].easing.type, "CUSTOM_SPRING");
});

test("convertScene: presetMatch substitutes baked preset tracks", () => {
  const plan = convertScene(SPEC, { presets: PRESETS });
  const title = plan.elements[1];
  const opacity = title.payloads.find((p) => p.field.name === "OPACITY");
  // Burst preset has opacity 0->1 over 0.3 (startDelay 0, no hold prepend)
  assert.equal(opacity.track.keyframes[0].timelinePosition, 0);
  assert.equal(opacity.track.keyframes[opacity.track.keyframes.length - 1].timelinePosition, 0.3);
});

test("convertScene: warns on missing preset match, falls back to inline", () => {
  const spec = { elements: [ { name: "X", type: "RECTANGLE", phases: [ { category: "enter", presetMatch: "DoesNotExist", tracks: [ { property: "OPACITY", keyframes: [ { t: 0, v: 0 }, { t: 0.2, v: 1 } ] } ] } ] } ] };
  const plan = convertScene(spec, { presets: PRESETS });
  assert.ok(plan.warnings.some((w) => /DoesNotExist/.test(w)));
  assert.ok(plan.elements[0].payloads.length === 1);
});

test("convertScene: cycle phase sets loop", () => {
  const spec = { elements: [ { name: "Spinner", type: "RECTANGLE", phases: [ { category: "cycle", tracks: [ { property: "ROTATION", keyframes: [ { t: 0, v: 0 }, { t: 2, v: 360 } ] } ] } ] } ] };
  const plan = convertScene(spec);
  assert.equal(plan.elements[0].loop, true);
});

test("convertScene: tolerates empty/missing spec", () => {
  assert.deepEqual(convertScene(null).elements, []);
  assert.deepEqual(convertScene({}).elements, []);
});

test("convertScene: phase startAtSec pins an exit to an absolute scene time", () => {
  const spec = { elements: [ {
    name: "Card", type: "RECTANGLE", startDelay: 0.5,
    phases: [
      { category: "enter", tracks: [ { property: "OPACITY", keyframes: [ { t: 0, v: 0 }, { t: 0.5, v: 1 } ] } ] },
      { category: "exit", startAtSec: 4, tracks: [ { property: "OPACITY", keyframes: [ { t: 0, v: 1 }, { t: 0.5, v: 0 } ] } ] }
    ]
  } ] };
  const plan = convertScene(spec);
  const op = plan.elements[0].payloads.find((p) => p.field.name === "OPACITY");
  const times = op.track.keyframes.map((k) => k.timelinePosition);
  // enter offset by startDelay 0.5 (+ hold at 0); exit pinned at absolute 4 -> 4 and 4.5
  assert.ok(times.includes(4), "exit pinned at absolute 4s");
  assert.ok(times.includes(4.5), "exit ends at 4.5s");
});
