# Video Motion-Analysis Prompt (for Gemini — also works in other models)

Paste the block below into a model that ingests video natively (recommended: **Google
Gemini in AI Studio** — upload the MP4 or give a YouTube/Vimeo URL). Then send me the JSON.

**Design notes (why it's written this way):**
- Framed as a *motion-design analyst*, NOT as a feeder for our tool. We never tell it what
  we'll build — keeps its context clean and unbiased (no context rot).
- It captures **velocity, not just endpoints**: multi-keyframe curves so anticipation,
  overshoot, and settle survive (the things that make motion feel good — 2 keyframes can't).
- It asks for **timestamps per keyframe** (Gemini is timestamp-aware; this is where Grok
  went shallow), and for **physics (springs)** and special effects in the model's own terms.
- It captures **appear/leave + hold** times so we can add proper exits (no lingering/overlap).
- Layout in **percentages** (resolution-independent); we map to px on our side.

---

## PROMPT (copy from here)

You are a senior motion-design analyst. Watch this video closely, frame by frame, and
produce a precise, structured breakdown of its motion design so it could be faithfully
reproduced by someone who has never seen it. Output STRICT JSON only — no prose.

Watch the VELOCITY of each motion, not just where it starts and ends. Capture as many
keyframes as the movement needs (use 3–5 when a motion accelerates, overshoots, bounces,
or settles — do NOT flatten a bouncy move into two keyframes). Cite the timestamp of each
keyframe in seconds.

Identify and report (use your own judgment; describe what you actually observe):
- Every distinct visual ELEMENT (background, logo, headline, subtext, button, input,
  product UI, shapes, icons, grouped lists, etc.).
- WHEN each element appears, how long it holds at rest, and when it leaves (seconds).
- HOW each element moves, including these behaviors when present:
  - **anticipation** (a small counter-move before the main move),
  - **overshoot + settle** (goes past the target, then eases back),
  - **squash & stretch** (width and height scale in OPPOSITE directions on impacts) —
    report scaleX and scaleY SEPARATELY,
  - **arcs** (motion follows a curved path, not a straight line),
  - **transform origin** (does it scale/rotate from center, a corner, or an edge?),
  - **stagger** (for groups: the time interval between each child animating, and direction),
  - **secondary motion** (shadows, particles, child lag).
- The EASING / PHYSICS of each motion segment. If it bounces/overshoots/settles like a
  spring, report a spring with estimated mass / stiffness / damping / bounce. Otherwise give
  an approximate cubic-bezier `[x1,y1,x2,y2]` PER SEGMENT (ease-in and ease-out may differ).
- SPECIAL EFFECTS / styles (blur reveal, glow, drop shadow, gradient shift, parallax,
  typewriter text, morph, motion blur, color shift), plus any CAMERA/global move
  (scene zoom, pan, parallax depth).

Output EXACTLY this JSON shape:

```json
{
  "video": { "durationSec": 0, "aspect": "16:9", "summary": "one-line description" },
  "palette": ["#000000"],
  "camera": { "move": "none | zoom | pan | parallax", "notes": "" },
  "elements": [
    {
      "name": "Logo",
      "kind": "image | text | shape | icon | background | productUI | group",
      "content": "literal text if it's text, else null",
      "layoutPct": { "x": 45, "y": 40, "w": 10, "h": 18, "color": "#FF6B9D", "fontSizePct": 6 },
      "transformOrigin": "center | top-left | bottom | ...",
      "appearAtSec": 0.5,
      "holdSec": 4.0,
      "leaveAtSec": 6.0,
      "stagger": { "childCount": 0, "intervalSec": 0, "direction": "" },
      "motion": [
        {
          "phase": "in | loop | out",
          "style": "free description, e.g. 'anticipate dip then spring pop with overshoot'",
          "physics": { "model": "spring | ease | linear", "mass": 1, "stiffness": 200, "damping": 16, "bounce": 0.4 },
          "keyframes": [
            { "tSec": 0.5, "property": "scaleX", "value": 0.95, "easingToNext": [0.2,0.9,0.3,1] },
            { "tSec": 0.7, "property": "scaleX", "value": 1.12, "easingToNext": [0.4,0,0.6,1] },
            { "tSec": 1.0, "property": "scaleX", "value": 1.0, "easingToNext": null }
          ]
        }
      ],
      "effects": []
    }
  ],
  "globalEffects": [],
  "notes": "anything else needed to faithfully recreate it"
}
```

Rules:
- `property` is one of: opacity, x, y, scaleX, scaleY, rotation, width, height, cornerRadius.
  (Always split scale into scaleX and scaleY.)
- Units: opacity 0–1; x/y px relative to resting position (negative = left/up); scale a
  factor (1 = 100%); rotation degrees; width/height/cornerRadius px.
- `easingToNext` is the cubic-bezier from this keyframe to the next (null on the last). Use
  spring physics instead when the segment clearly oscillates/overshoots.
- Prefer accurate timestamps and extra keyframes over round numbers and flat ramps.
- If an element never leaves, set `leaveAtSec` to null. Only include elements that animate
  or matter visually.

## (end of prompt)
