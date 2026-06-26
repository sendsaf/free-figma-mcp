import assert from "node:assert/strict";
import { test } from "node:test";
import { computeTypewriterLayout, buildTypewriterKeyframes, sequenceLines } from "../src/generators/typewriter.js";

test("computeTypewriterLayout: pads by positive overflow + safety, ignores negative", () => {
  const L = computeTypewriterLayout({ layoutW: 700, layoutH: 90, fontSize: 75, overflow: { left: 1, right: 6, top: -16, bottom: -2 } });
  const safety = Math.max(2, Math.ceil(75 * 0.04)); // 3
  // width: 700 + padLeft(1) + padRight(6) + 2*safety
  assert.equal(L.clipWidth, Math.ceil(700 + 1 + 6 + 2 * safety));
  // height: negative top/bottom overflow ignored -> only safety pad
  assert.equal(L.clipHeight, Math.ceil(90 + 0 + 0 + 2 * safety));
  assert.equal(L.textX, 1 + safety);
  assert.equal(L.textY, 0 + safety);
});

test("computeTypewriterLayout: tolerates missing overflow", () => {
  const L = computeTypewriterLayout({ layoutW: 100, layoutH: 40, fontSize: 20 });
  assert.ok(L.clipWidth >= 100 && L.clipHeight >= 40);
});

test("buildTypewriterKeyframes: wipe reveal + hold + erase", () => {
  const r = buildTypewriterKeyframes({ fullWidth: 500, startSec: 0, revealSec: 1.2, holdSec: 1.0, eraseSec: 0.8, mode: "wipe" });
  assert.deepEqual(r.keyframes[0], { t: 0, v: 0 });
  assert.deepEqual(r.keyframes[1], { t: 1.2, v: 500 });
  assert.deepEqual(r.keyframes[2], { t: 2.2, v: 500 }); // hold
  assert.deepEqual(r.keyframes[3], { t: 3.0, v: 0 });   // erase
  assert.equal(r.endSec, 3.0);
});

test("buildTypewriterKeyframes: step mode reveals per character, monotonic", () => {
  const r = buildTypewriterKeyframes({ fullWidth: 400, charCount: 4, startSec: 0, revealSec: 0.8, mode: "step" });
  // 1 start + 2 per char = 9 keyframes
  assert.equal(r.keyframes.length, 1 + 4 * 2);
  // values never decrease through the reveal
  for (let i = 1; i < r.keyframes.length; i++) {
    assert.ok(r.keyframes[i].v >= r.keyframes[i - 1].v, "width non-decreasing during reveal");
  }
  assert.equal(r.keyframes[r.keyframes.length - 1].v, 400);
});

test("sequenceLines: stacks lines with erase between, last stays", () => {
  const seq = sequenceLines([{ fullWidth: 500, charCount: 10 }, { fullWidth: 300, charCount: 6 }], { revealSec: 1, holdSec: 1, eraseSec: 0.5, gapSec: 0.2 });
  assert.equal(seq.lines.length, 2);
  assert.equal(seq.lines[0].startSec, 0);
  // line 2 starts after line 1's reveal+hold+erase + gap = 1+1+0.5+0.2 = 2.7
  assert.equal(seq.lines[1].startSec, 2.7);
  // last line has no erase (stays) -> its last keyframe holds full width
  const last = seq.lines[1].keyframes[seq.lines[1].keyframes.length - 1];
  assert.equal(last.v, 300);
});

test("buildTypewriterKeyframes: deterministic", () => {
  const a = JSON.stringify(buildTypewriterKeyframes({ fullWidth: 500, revealSec: 1.2, holdSec: 1, eraseSec: 0.8 }));
  const b = JSON.stringify(buildTypewriterKeyframes({ fullWidth: 500, revealSec: 1.2, holdSec: 1, eraseSec: 0.8 }));
  assert.equal(a, b);
});
