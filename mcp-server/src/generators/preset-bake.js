// Bake a Figma UI animation preset into a reusable, replayable motion preset.
//
// Insight: after a named preset (e.g. "Burst") is applied in Figma's UI, the
// node exposes fully-resolved keyframes at `node.animations` — already in the
// shape `applyManualKeyframeTrack` consumes. This module normalizes that raw
// `animations` object into a clean preset (rounded values, no-op tracks
// dropped, internal ids stripped) that we can store and replay on any node.
//
// Pure: no Figma access; fully unit-testable.

function round(n, places = 4) {
  if (typeof n !== "number" || !isFinite(n)) return n;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function cleanValue(v) {
  if (!v || typeof v !== "object") return v;
  if (v.type === "FLOAT" && typeof v.value === "number") return { type: "FLOAT", value: round(v.value) };
  if (v.type === "VECTOR" && v.value && typeof v.value === "object") {
    return { type: "VECTOR", value: { x: round(v.value.x), y: round(v.value.y) } };
  }
  return v;
}

function cleanEasing(easing) {
  if (!easing || typeof easing !== "object") return easing;
  if (easing.easingFunctionCubicBezier) {
    const b = easing.easingFunctionCubicBezier;
    return {
      type: easing.type || "CUSTOM_CUBIC_BEZIER",
      easingFunctionCubicBezier: { x1: round(b.x1), y1: round(b.y1), x2: round(b.x2), y2: round(b.y2) }
    };
  }
  if (easing.easingFunctionSpring) {
    const s = easing.easingFunctionSpring;
    const spring = {};
    for (const k of Object.keys(s)) spring[k] = typeof s[k] === "number" ? round(s[k]) : s[k];
    return { type: easing.type || "CUSTOM_SPRING", easingFunctionSpring: spring };
  }
  return { type: easing.type };
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A track is a no-op when every keyframe holds the same value (no change).
function isNoOpTrack(keyframes) {
  if (!keyframes || keyframes.length < 2) return true;
  const first = keyframes[0].value;
  return keyframes.every((kf) => valuesEqual(kf.value, first));
}

/**
 * Normalize a raw `node.animations` object into a replayable preset.
 * @param {Object} animations  map of PROPERTY -> { tracks:[{keyframes,...}], timelineDuration, baseValue }
 * @param {{dropNoOps?: boolean}} [options]
 * @returns {{tracks: Array<{property:string, keyframes:Array}>, durationSec:number, droppedNoOps:string[]}}
 */
export function normalizeAnimations(animations, options = {}) {
  const dropNoOps = options.dropNoOps !== false;
  const src = animations && typeof animations === "object" ? animations : {};
  const tracks = [];
  const droppedNoOps = [];
  let durationSec = 0;

  for (const property of Object.keys(src)) {
    const entry = src[property];
    const subTracks = (entry && entry.tracks) || [];
    const raw = (subTracks[0] && subTracks[0].keyframes) || [];
    const keyframes = raw
      .map((kf) => ({
        timelinePosition: round(kf.timelinePosition),
        value: cleanValue(kf.value),
        easing: cleanEasing(kf.easing)
      }))
      .sort((a, b) => a.timelinePosition - b.timelinePosition);

    if (dropNoOps && isNoOpTrack(keyframes)) {
      droppedNoOps.push(property);
      continue;
    }
    for (const kf of keyframes) durationSec = Math.max(durationSec, kf.timelinePosition);
    tracks.push({ property, keyframes });
  }

  // Stable ordering for deterministic output.
  tracks.sort((a, b) => a.property.localeCompare(b.property));
  return { tracks, durationSec: round(durationSec), droppedNoOps };
}

/**
 * Assemble a named, storable preset from normalized tracks.
 * @param {string} name
 * @param {ReturnType<typeof normalizeAnimations>} normalized
 * @param {{category?:string, capturedAt?:string}} [meta]
 */
export function makePreset(name, normalized, meta = {}) {
  return {
    name,
    category: meta.category || "uncategorized",
    source: "figma-ui-bake",
    capturedAt: meta.capturedAt || new Date().toISOString(),
    durationSec: normalized.durationSec,
    tracks: normalized.tracks
  };
}

/**
 * Convert preset tracks into the per-track payloads the plugin's apply_motion
 * handler sends to applyManualKeyframeTrack.
 * @param {{tracks:Array}} preset
 */
export function presetToApplyPayload(preset) {
  const tracks = (preset && preset.tracks) || [];
  return tracks.map((t) => ({
    field: { type: "PROPERTY", name: t.property },
    track: { keyframes: t.keyframes }
  }));
}
