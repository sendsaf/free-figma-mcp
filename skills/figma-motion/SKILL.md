---
name: figma-motion
description: "Use this skill when the task involves animation or motion in the active Figma file: reading the animation applied to a node, authoring motion (preset styles or manual keyframes), or exporting a node's animation to CSS / JSON / React. Triggers: 'animate this', 'add motion', 'get the animation', 'export this animation to CSS/React', 'what motion is on this', 'apply a scale/slide/fade/rotate', 'keyframe the opacity/rotation/position', 'turn this Figma animation into code'. Pairs with figma-use for any write that goes beyond the preset/keyframe helpers. Verified against Config 2026 Motion (figma.motion, node.applyAnimationStyle, node.applyManualKeyframeTrack)."
disable-model-invocation: false
---

# Figma Motion: read, author, and export animation

Use this skill to work with **Motion** (Config 2026) on the active Figma Desktop file through the local MCP. Two directions:

- **Read + export**: get the animation on a node and turn it into code (CSS / JSON / React).
- **Author**: apply preset animation styles or manual keyframe tracks to a node.

Confirmed live in the Plugin API: `figma.motion.figmaAnimationStyles()` (preset catalog), `node.applyAnimationStyle(styleId)`, `node.applyManualKeyframeTrack(field, track)`, and read-only `node.animationStyles` / `node.manualKeyframeTracks` / `node.timelines`.

## When to use this skill

- The user wants to **see** a node's animation, or **convert it to code**.
- The user wants to **add motion** to a node (fade/scale/slide/rotate, or custom keyframes).
- The user mentions keyframes, easing, timeline, or any animatable property.

For composed view-building use `figma-generate-design`; for arbitrary writes load `figma-use` (its color/font rules apply to any `use_figma` script).

## Required flow

### A. Read a node's motion, then export to code

1. Run `get_motion_context` (optionally with `nodeId`; defaults to the current selection). It returns a `MotionContext`: applied `presetStyles`, `keyframeTracks` (per-property keyframes with easing), `timelineDurationMs`, and `reactions` as a fallback.
2. Pass that object straight into `export_motion_code` with `format: "css" | "json" | "react"`.
3. Read the returned `warnings`. If `source` is `"reactions"` (`degraded: true`), the node has no Motion timeline — only prototype transitions — so the code is an approximation; say so.
4. Translate the emitted code into the project's conventions (e.g., map the `.target` selector to the real component class, or fold the React `animate` object into the existing component).

### B. Author motion on a node

1. Run `get_capabilities` (or `introspect_api`) once to confirm `motion.animationStyles` / `motion.manualKeyframes` are available in the connected build.
2. For a **preset**: in a `use_figma` script, call `node.applyAnimationStyle("Position" | "Scale" | "Rotation" | "Size" | "Opacity" | "Path")`. Read `figma.motion.figmaAnimationStyles()` first to see each preset's editable props.
3. For **custom keyframes**: call `node.applyManualKeyframeTrack(field, track)` where:
   - `field` is `{ type: "PROPERTY", name: <one of the 30 animatable properties> }` (e.g., `OPACITY`, `ROTATION`, `TRANSLATION_X/Y/XY`, `SCALE_X/Y/XY`, `WIDTH`, `HEIGHT`, `CORNER_RADIUS`, …) — or `{ type: "INDEXED_ITEM", collection, index, … }` to keyframe an item inside a collection like `effects`.
   - `track` is `{ keyframes: [{ timelinePosition: <seconds>, value: { type: "FLOAT", value: <n> }, easing }] }`.
4. Always return created/mutated node IDs from the script.
5. Validate with `get_motion_context` (read it back) and `get_screenshot`.

## Property → CSS reference (used by export_motion_code)

`OPACITY`→`opacity`; `ROTATION`→`transform: rotate(deg)`; `TRANSLATION_X/Y/XY`→`translate*`; `SCALE_X/Y/XY`→`scale*`; `WIDTH`/`HEIGHT`→`width`/`height`; `CORNER_RADIUS`→`border-radius`; `GRID_*_GAP`→`gap`. Easing maps to `cubic-bezier(...)` or the standard keywords.

## Pitfalls

- Multiple transform-family tracks (rotate + translate + scale) export as separate CSS animations and can conflict on `transform`; merge them or note the limitation (`export_motion_code` already warns).
- Manual keyframe `value` must be a typed object (`{ type: "FLOAT", value }`), not a bare number.
- `timelinePosition` is in **seconds**, not milliseconds.
- Numeric noise from Figma (e.g., `360.00001`) is rounded by the exporter; when authoring, pass clean numbers.
