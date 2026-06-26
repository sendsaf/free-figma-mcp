# Product Ideas — Figma Local MCP (Motion era)

> Captured 2026-06-26, ~48h after Figma Config 2026 Motion beta. Time-sensitive: the
> Plugin API exposes far more than Figma documents, and Motion shipped without a
> sound layer. First-mover window is open.

These build on what's already working in this repo: capability detection, the
API-discovery pipeline + catalog, `get_motion_context` / `export_motion_code`,
`bake_preset` / `apply_motion`, the 36-preset library (`.figma-mcp/motion-presets.json`),
and the guidance/skills layer.

---

## Idea 1 — Motion Intelligence + Custom Preset Library + Marketplace

**The gap:** A list of presets is inert. The value is knowing *when/why/how* to use
each, authoring *original* motion from intent, and being able to *save and reuse*
custom animations — something Figma's UI cannot do.

### Parts (in priority order)
1. **Preset intelligence layer (build first, lowest risk).**
   Tag every preset with intent/energy/use-cases (e.g., Burst = playful hero emphasis;
   Sink = dismissal; Pulse = attention loop). A skill maps a user request
   ("make this card feel celebratory") → the right preset. Reuses the existing skills
   pattern + `get_motion_context`.
2. **Original motion authoring (the real ceiling).**
   The 36 baked presets become a *few-shot corpus*. The IDE agent composes novel
   keyframe tracks from a description ("a nervous, hesitant entrance"). We already
   proved arbitrary keyframe writes work. This matches what Figma's closed agent does.
3. **Custom save/reuse (sharpest differentiator).**
   Figma can't save custom animations as reusable presets — we already can
   (bake → store → replay). Concrete "we do what they can't."
4. **Cloud/marketplace library + easy-apply plugin (highest risk, validate first).**

### Risks / honest cautions
- **IP boundary:** the 36 baked presets are *Figma's built-ins*. Do NOT sell/redistribute
  those. A marketplace must be for **original, user-authored** presets only.
- **Platform dependency:** Motion APIs are undocumented/beta; Figma may change them
  (breaking replay) or add native custom-preset saving (eroding part 3). Make the moat
  the **cross-file cloud library + intelligence**, not the save mechanic alone.
- **"Videos like After Effects":** parametric presets that reshape to any element beat
  baked video files. Lean into reusable recipes, not video assets.
- **Monetization friction:** Figma's plugin platform doesn't make direct charging easy;
  expect an external account/subscription bolt-on.

---

## Idea 2 — LLM + Generative Audio: Sound Design for Motion

**The gap:** Motion shipped with zero sound. Polished micro-interactions, game UI, and
motion reels all want sound. More novel and more defensible than the marketplace.

**The key insight:** we can read the exact motion timeline — every keyframe, its
`timelinePosition`, easing, and property. That's a precise, machine-readable description
of *motion events*. Pipeline:

```
get_motion_context (read keyframes/timing/easing)
  -> LLM maps motion events to sound-design intent
     (Slam impact @0.1s -> low thud; spring overshoot -> boing tail; Pop -> UI tick)
  -> text-to-audio model (Stable Audio / ElevenLabs SFX / MusicGen) synthesizes,
     synced to real keyframe times
  -> deliver as a timed audio track (or video export with sound)
```

Product shape: a live chat app/plugin that reads the selected node's animation and
proposes/refines sound design, automatically or by prompt.

### Validate early (gating unknowns)
- **Where does the audio live?** Figma prototypes can't robustly embed synced custom
  audio. Likely deliverable = exported audio track timed to the animation, or a video
  export with sound. Decide this first — it shapes the whole product.
- **Cost model:** generative audio is paid per generation (fits a paid product; need unit
  economics).
- **Sync precision:** solid — exact `timelinePosition` values enable event-accurate SFX.

---

## Sequencing

1. Motion intelligence layer (intent tags + "pick the right motion" skill).
2. Original-motion authoring from a prompt (presets as few-shot examples).
3. Pick one big bet → **sound design** is the more original/defensible product.
   Run a feasibility spike on audio delivery before committing.

## Live test in progress (Idea 1)

Parse a real product-reveal video (via Grok on X) into a replication spec expressed in
our tool vocabulary, then replicate it in Figma element-by-element. See
`MISC/video-replication/`.


---

## Idea 3 — Text Animation Presets (typewriter & friends)

**The gap:** Figma Motion ships **no text-specific presets**, yet text animation
(typewriter, line-by-line reveal, word stagger, character cascade) is the backbone of
motion graphics. Big opportunity for our own library + intelligence.

**Known working method (user-discovered):** typewriter via
`text in frame → clip content → auto-layout → keyframe the frame WIDTH from 0 → full`.
The width reveal wipes the text in like a typewriter.

**Directions to explore (build/validate):**
- **Width/clip reveal** (the above) — bake as a reusable "Typewriter" preset:
  keyframe `WIDTH` 0 → measured text width, linear/stepped easing for a mechanical feel.
- **Character/word stagger** — split a text layer into per-character or per-word nodes
  (or duplicate ranges) and apply a staggered enter preset (Burst/Rise) with increasing
  `startDelay`. The Plugin API exposes rich text range methods
  (`getStyledTextSegments`, `getRangeFontName`, etc.) we can leverage to split cleanly.
- **Line-by-line** — clip + `TRANSLATION_Y` reveal per line.
- **Caret** — a small rectangle that translates with the reveal edge.

**Why it fits us:** these are *recipes* (build + keyframe patterns), exactly what our
`bake_preset` / `apply_motion` + a "text motion" skill can package — and they need
parameterization (text length, speed, stagger) that a code layer handles better than a
fixed UI preset. Strong candidate for the original-authoring layer (Idea 1, part 2).

> User is new to motion graphics but opportunistic — wants the easiest robust methods.
> Action: prototype a parameterized "Typewriter" recipe and a "word stagger" recipe.


---

## Idea 4 — Auto-Exit / Scene Sequencing (fixes a real Figma Motion gap)

**The gap (user-discovered):** In Figma Motion, if an element has **no exit animation**,
it stays at its final state until the whole timeline ends. In a multi-beat sequence
(intro → feature → feature → outro), earlier elements **linger and overlap** later ones.
Figma offers no automatic "leave when the next beat starts."

**Our fix:** because we control the keyframes, we can **auto-insert exits**. The analysis
spec already captures `appearAtSec` / `leaveAtSec` per element; `convertScene` now supports
per-phase `startAtSec` (absolute pinning), so we add a fade-out (± scale/translate) exit at
`leaveAtSec`. When `leaveAtSec` is null but a later element overlaps the same space, we
recommend/insert an exit shortly before the successor appears.

**Why it matters:** this turns a pile-up of lingering layers into a clean, sequenced reveal
— something Figma's native Motion can't do automatically. It's a concrete "we fix what they
can't," and it's the kind of thing the `figma-motion-replicate` skill flags and resolves
during its analyze-first pass.

**Status:** `startAtSec` (absolute phase timing) implemented + tested in
`scene-replicate.js`. The skill (`skills/figma-motion-replicate`) encodes the exit/overlap
analysis. Next: a heuristic auto-exit for null-`leaveAtSec` elements based on successor
overlap.


---

## Figma Motion deep-dive findings (from official docs, 2026-06-26)

Source: figma.com/blog/introducing-figma-motion + Figma Learn Motion docs. These update
the ideas above:

- **Sound-design blocker (Idea 2) is largely RESOLVED.** Figma can export any animated
  frame to **MP4 / WEBM / GIF / SVG**. So the audio delivery path is concrete: export the
  motion as video → generate + mux a synced audio track (or deliver a video-with-sound).
  No need to embed audio in the prototype. This de-risks Idea 2 significantly.
- **Motion variables** (easing tokens with modes, switchable at page level) — a primitive
  for shared, consistent easing across many animations. Opportunity: our preset/intelligence
  layer could emit motion variables, not just per-element easing.
- **Animated components** — motion travels with a component across files (like our reusable
  preset concept, but native). Our custom-save differentiator should complement, not fight,
  this.
- **Shader-keyframing** — every shader-exposed property is now keyframeable. Opens animating
  shader params over time (future feature; pairs with `get_shader_context`).
- **3D transforms coming soon** (z-axis rotate, exports to CSS, MCP-connected). Watch for the
  Plugin API surface when it ships; our discovery pipeline will catch it.
- **Dev Mode code formats:** CSS, JSON, React, **motion.dev**. Our `export_motion_code` does
  CSS/JSON/React; adding a motion.dev format would match Figma's handoff exactly.
- **Anchor defaults:** translate from top-left, rotate from center — encoded into the
  `figma-motion-replicate` skill's fidelity notes.

### Next opportunities ranked
1. Confirm Plugin-API video export (vs UI-only) → unlocks Idea 2 delivery + replica verification.
2. Add a `motion.dev` output to `export_motion_code` (cheap, matches Figma handoff).
3. Emit/consume **motion variables** for shared easing in the intelligence layer.
