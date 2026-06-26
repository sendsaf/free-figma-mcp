---
name: figma-text-motion
description: "Use this skill for text-based motion in Figma — typewriter / type-on reveals, line-by-line and word reveals. Figma Motion ships NO text presets, so this is the gap-filler. Triggers: 'typewriter', 'type-on text', 'reveal text', 'animate this heading typing in', 'text reveal'. Backed by the text_typewriter tool."
disable-model-invocation: false
---

# Text Motion: typewriter & reveals (Figma's missing text presets)

Figma Motion has no text-specific presets, yet text reveals are core to motion graphics.
The `text_typewriter` tool fills this gap.

## How the typewriter works

Reveal text by animating a **clip frame's WIDTH** from 0 → full. The text sits left-aligned
inside a `clipsContent` frame; as width grows, more text shows (left-to-right). Two modes:
- **wipe** (default): smooth width reveal — fast, clean.
- **step**: true character-by-character (tightly-spaced keyframes approximate steps).

## The glyph-overflow padding fix (always apply)

Sizing the clip to `text.width × text.height` shaves glyph ink — descenders (g, y, p, j),
ascenders/diacritics, italic slant, and first/last side-bearing overhang. Fix:
1. Measure the text's true ink box with **`absoluteRenderBounds`** vs the layout box
   (`absoluteBoundingBox`); compute positive overflow per side.
2. Pad the clip by that overflow + a small safety (~0.04 × fontSize); offset the text inside
   by left/top pad; set full-reveal width = layoutWidth + left+right overflow + safety.
   Net: only the intentional right reveal edge clips.
3. Fallback when render bounds are null (text clipped/invisible): fixed padding ~0.35×fontSize
   top/bottom, ~0.12×fontSize left/right. Always measure on a **standalone, visible** copy.

`text_typewriter` does all of this automatically and matches the **selected text's font**
(family/style/size/color) by default.

## Usage

- `text_typewriter({ lines: ["First line", "Second line"], mode, revealSec, holdSec,
  eraseSec, gapSec, fontFamily?, fontStyle?, fontSize?, background?, canvasNodeId? })`.
- Lines sequence: each types in → holds → erases; the **last stays**. Centered on the frame.
- Defaults: reveal 1.2s, hold 1.0s, erase 0.8s, gap 0.2s, wipe mode.

## Critical gotcha — viewing animated text

Once WIDTH keyframes are applied, the frame is a **motion timeline**. In static views (and
the `get_screenshot` / `node.visible` API), clips render at the **playhead**: at t=0 their
width is 0, so they read `visible:false` and screenshots come back blank. This is NOT a build
error — a non-animated clip renders fine. **To see the typewriter, switch the frame to Motion
mode and play/scrub the timeline.** Don't rely on static screenshots to verify animated text;
verify structurally (clip dims include the ink padding; WIDTH keyframes present) instead.

## Next options
- Blinking **caret** (a thin rect at the reveal edge with looping opacity).
- Word/line stagger (split text, offset each child's start).
- Bake as named presets ("Typewriter", "Type + erase", "Word stagger").
