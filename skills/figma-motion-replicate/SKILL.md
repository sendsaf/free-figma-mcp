---
name: figma-motion-replicate
description: "Use this skill when given a motion-analysis spec (e.g. from the Gemini/Grok video prompt in MISC/video-replication) to replicate in Figma. It enforces an ANALYZE-FIRST workflow grounded in motion-graphics principles: reason about timing/velocity, anticipation/overshoot/squash, stagger, exits/overlap, and physics — propose improvements, THEN build via replicate_scene. Triggers: 'replicate this video/spec', 'rebuild this animation', a pasted motion-analysis JSON."
disable-model-invocation: false
---

# Replicate Motion from an Analysis Spec — Analyze First, Then Build

Input spec (from `MISC/video-replication/GROK-PROMPT.md`): a tool-agnostic motion analysis —
`{ video, palette, camera, elements:[{ name, kind, content, layoutPct, transformOrigin,
appearAtSec, holdSec, leaveAtSec, stagger, motion:[{phase, style, physics,
keyframes:[{tSec, property, value, easingToNext}]}], effects }], globalEffects, notes }`.

Each keyframe is **absolute scene time** (`tSec`), one **property** per keyframe entry,
with `easingToNext` (cubic-bezier to the following keyframe). Do not collapse multi-keyframe
curves — they carry the anticipation/overshoot/settle that make motion feel right.

## Step 1 — Analyze before implementing (always)

Produce a short written analysis covering:

1. **Element → node mapping.** text→TEXT; shape/background→RECTANGLE;
   icon/image/productUI→RECTANGLE placeholder (flag — real assets dropped in later);
   group→expand into children (see stagger).
2. **Layout.** `layoutPct` → px on canvas (default 1920×1080). Flag overlaps/collisions.
3. **Motion translation (group keyframes by property → our tracks):**
   - property map: opacity→OPACITY, x→TRANSLATION_X, y→TRANSLATION_Y, scaleX→SCALE_X,
     scaleY→SCALE_Y, rotation→ROTATION, width→WIDTH, height→HEIGHT, cornerRadius→CORNER_RADIUS.
   - `tSec` → `timelinePosition` directly (already absolute). Keep ALL keyframes.
   - easing: map each keyframe's `easingToNext` to that keyframe's easing; spring physics
     → `"spring"` carrying `bounce` (default 0.45).
4. **Motion-graphics fidelity checks — actively look for and FIX:**
   - **Anticipation:** style mentions it but keyframes lack the counter-move → add a small
     pre-keyframe (e.g., scale 0.95 just before the pop).
   - **Overshoot + settle:** style says springy/bouncy but only 2 keyframes given →
     synthesize a 3rd: peak overshoot then settle (or switch to spring easing).
   - **Squash & stretch:** ensure scaleX and scaleY are independent (opposite on impacts);
     never collapse to a single scale.
   - **Easing asymmetry:** honor per-segment `easingToNext` rather than one curve.
   - **Stagger:** for a `group` with `stagger.childCount/intervalSec`, expand into N child
     elements, each offset by `i * intervalSec` (via `startAtSec`).
   - **Arcs:** approximate a curved path with intermediate translate keyframes; note it's
     an approximation.
5. **Physics sanity.** bounce ~0.2 subtle, ~0.4 lively, ~0.6 energetic. Recommend tweaks if
   the value contradicts the described feel.
6. **Exit / overlap handling (fixes a real Figma Motion gap).** An element with no exit
   lingers at its final state and later elements overlap it. For each element:
   - `leaveAtSec` set → add an **exit phase pinned at `startAtSec: leaveAtSec`** (fade out,
     plus scale/translate if the style suggests). Use `holdSec` to confirm dwell time.
   - `leaveAtSec` null but a later element overlaps its space → recommend/insert an exit
     just before the successor's `appearAtSec`. Report which exits were added and why.
7. **Sequencing & camera.** Enter pins to `appearAtSec`. Note any global camera move
   (zoom/parallax) and apply it to the scene frame or as a shared track if feasible.

Present the analysis + concrete recommendations. Proceed if intent is clear; pause only if a
choice materially changes the result.

## Step 2 — Build the replicate_scene spec

`{ scene:{canvas:[1920,1080], background}, elements:[{ name, type, text,
layout:{x,y,width,height,fill,fontSize,CORNER_RADIUS}, startDelay,
phases:[{ category, startAtSec, presetMatch, tracks:[{property, keyframes:[{t,v,easing}]}] }] }] }`
- Put each phase's absolute start in `startAtSec` (enter at `appearAtSec`, exit at `leaveAtSec`).
- Keyframe `t` is relative to the phase; or pass absolute and let `startAtSec` be 0 — be
  consistent. Keep every keyframe and its easing.
- `presetMatch` only when the described style clearly matches a baked preset
  (`list_motion_presets`) AND fidelity benefits; otherwise keep the analyzed tracks.

## Step 3 — Replicate and verify

- Call `replicate_scene` (builds elements, applies motion, loops cycles, extends node
  timelines past the default 2s to the last keyframe).
- Verify structurally (positions, text, animated props). A static screenshot shows the t=0
  state (pre-animation = mostly invisible); the user scrubs/plays the timeline to see motion.
- Report fidelity caveats honestly:
  - **Faithful:** multi-keyframe tracks, per-keyframe easing, springs (bounce), separate
    scaleX/Y squash, opacity/translate/rotate/width/height/corner, stagger via child offsets.
  - **Approximate:** arcs (multi-keyframe fake), transform origin (Plugin API scales around
    the node's own transform — arbitrary anchors limited).
  - **Visual-only (not keyframeable for us):** motion blur, glow/blur reveals — note as
    manual styling.

## Figma Motion capabilities & constraints (target these)

Grounded in Figma's official Motion docs (Config 2026). Use to maximize fidelity:

- **Keyframeable:** Figma's headline animatable props are position, scale, rotation, opacity
  (keyframed independently). The Plugin API we use exposes MORE (WIDTH, HEIGHT,
  CORNER_RADIUS, padding/gap, etc. — ~30 properties), and **every shader-exposed property
  is keyframeable**. Don't assume only the four; use the broader set when the motion needs it.
- **Anchor / transform origin:** Figma's default anchor is **top-left for translate** and
  **center for rotation**. So TRANSLATION_X/Y are measured from top-left, ROTATION pivots on
  center. When a spec says "scale/rotate from a corner," flag that arbitrary anchors aren't
  directly controllable — approximate by pairing scale with a compensating translate.
- **Stacking vs sequencing:** Figma stacks animation styles to play together or sequences
  them on the timeline. Our model maps cleanly — multiple tracks stack; `startAtSec`
  sequences. Use both deliberately.
- **Easing:** per-keyframe cubic-bezier OR spring (autokey + customize each keyframe). Matches
  our `CUSTOM_CUBIC_BEZIER` / `CUSTOM_SPRING`. Consider **motion variables** (shared easing
  tokens with modes) for consistency across many elements.
- **Timeline default is short (2s)** — we extend per node to the last keyframe. Keep doing this.
- **Delivery / verification:** an animated frame exports to **MP4 / GIF / SVG / WEBM**, and
  Dev Mode emits **CSS / JSON / React / motion.dev**. Offer export for verification/handoff
  (a static screenshot only shows the t=0 state). Note: confirm Plugin-API support for video
  export vs. UI-only before promising it.

## Principles

- Velocity over endpoints; preserve anticipation, overshoot, settle, squash.
- Analyze, recommend, then build — never silent-implement a complex spec.
- Prefer adding exits over letting elements linger (the Figma Motion overlap fix).
- Use the broader animatable property set (incl. shader props) when it improves fidelity.
- Be honest about placeholders, anchor limits, and approximations.
