// Pure Motion -> code generator. No Figma access; deterministic; never throws
// for MotionContext-shaped input. Consumes the shapes verified live from the
// Plugin API: node.animationStyles (presets) and node.manualKeyframeTracks.

/**
 * @typedef {Object} MotionContext
 * @property {string} nodeId
 * @property {boolean} supported
 * @property {boolean} degraded
 * @property {"motion"|"reactions"|"none"} source
 * @property {Array<Object>} presetStyles      // from node.animationStyles
 * @property {Object<string,Object>} keyframeTracks  // from node.manualKeyframeTracks
 * @property {number|null} timelineDurationMs
 * @property {Array<Object>} reactions
 * @property {string[]} warnings
 */

function num(value) {
  if (value && typeof value === "object" && typeof value.value === "number") return value.value;
  if (typeof value === "number") return value;
  return 0;
}

// Round away floating-point noise (e.g., 360.00001 -> 360) and trailing zeros.
function tidy(n) {
  return Math.round((+n || 0) * 1000) / 1000;
}

function sanitize(id) {
  return String(id == null ? "node" : id).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function easingToCss(easing) {
  if (!easing || typeof easing !== "object") return "ease";
  if (easing.type === "CUSTOM_CUBIC_BEZIER" || easing.easingFunctionCubicBezier) {
    const b = easing.easingFunctionCubicBezier || {};
    return `cubic-bezier(${+b.x1 || 0}, ${+b.y1 || 0}, ${+b.x2 || 0}, ${+b.y2 || 0})`;
  }
  switch (easing.type) {
    case "LINEAR": return "linear";
    case "EASE_IN": return "ease-in";
    case "EASE_OUT": return "ease-out";
    case "EASE_IN_AND_OUT": return "ease-in-out";
    default: return "ease";
  }
}

// Map a manual-keyframe property id to a CSS declaration string for a value.
function cssDeclaration(property, value) {
  const n = tidy(num(value));
  switch (property) {
    case "OPACITY": return `opacity: ${n};`;
    case "ROTATION": return `transform: rotate(${n}deg);`;
    case "TRANSLATION_X": return `transform: translateX(${n}px);`;
    case "TRANSLATION_Y": return `transform: translateY(${n}px);`;
    case "TRANSLATION_XY": return `transform: translate(${n}px, ${n}px);`;
    case "SCALE_X": return `transform: scaleX(${n});`;
    case "SCALE_Y": return `transform: scaleY(${n});`;
    case "SCALE_XY": return `transform: scale(${n});`;
    case "WIDTH": return `width: ${n}px;`;
    case "HEIGHT": return `height: ${n}px;`;
    case "CORNER_RADIUS": return `border-radius: ${n}px;`;
    case "GRID_ROW_GAP":
    case "GRID_COLUMN_GAP": return `gap: ${n}px;`;
    default: return `/* ${property}: ${n} */`;
  }
}

function trackDurationSec(track, fallbackMs) {
  const kfs = (track && track.keyframes) || [];
  let max = 0;
  for (const kf of kfs) max = Math.max(max, +kf.timelinePosition || 0);
  if (max > 0) return max;
  return fallbackMs ? fallbackMs / 1000 : 0;
}

function emitTrackKeyframes(name, property, track, durationSec) {
  const kfs = ((track && track.keyframes) || [])
    .slice()
    .sort((a, b) => (+a.timelinePosition || 0) - (+b.timelinePosition || 0));
  let body = "";
  for (const kf of kfs) {
    const pos = +kf.timelinePosition || 0;
    const pct = durationSec > 0 ? Math.round((pos / durationSec) * 1000) / 10 : 0;
    body += `  ${pct}% { ${cssDeclaration(property, kf.value)} animation-timing-function: ${easingToCss(kf.easing)}; }\n`;
  }
  return `@keyframes ${name} {\n${body}}\n`;
}

function emitMotionCss(motion) {
  const warnings = (motion.warnings || []).slice();
  const tracks = motion.keyframeTracks && typeof motion.keyframeTracks === "object" ? motion.keyframeTracks : {};
  const trackNames = Object.keys(tracks);

  if (trackNames.length === 0) {
    if ((motion.presetStyles || []).length > 0) {
      warnings.push("Only preset animation styles found; emitting a summary comment. Re-run with manual keyframe tracks for full CSS.");
      const summary = (motion.presetStyles || [])
        .map((s) => `  /* preset: ${s.name || s.styleId} (duration ${s.duration != null ? s.duration + "s" : "?"}) */`)
        .join("\n");
      return { language: "css", format: "css", code: `/* motion presets */\n${summary}\n`, warnings };
    }
    warnings.push("No keyframes; emitting empty animation.");
    return { language: "css", format: "css", code: "/* no motion */\n", warnings };
  }

  const base = sanitize(motion.nodeId);
  let blocks = "";
  const animations = [];
  const transformProps = [];
  for (const property of trackNames) {
    const track = tracks[property];
    const dur = trackDurationSec(track, motion.timelineDurationMs);
    const name = `anim-${base}-${property.toLowerCase()}`;
    blocks += emitTrackKeyframes(name, property, track, dur);
    animations.push(`${name} ${dur}s both`);
    if (/^(ROTATION|TRANSLATION|SCALE)/.test(property)) transformProps.push(property);
  }
  if (transformProps.length > 1) {
    warnings.push("Multiple transform-based tracks emitted as separate animations; CSS transform may conflict. Consider merging into one track.");
  }

  const code = `${blocks}.target {\n  animation: ${animations.join(", ")};\n}\n`;
  return { language: "css", format: "css", code, warnings };
}

function emitMotionJson(motion) {
  return {
    language: "json",
    format: "json",
    code: JSON.stringify(
      {
        nodeId: motion.nodeId,
        source: motion.source,
        timelineDurationMs: motion.timelineDurationMs == null ? null : motion.timelineDurationMs,
        presetStyles: motion.presetStyles || [],
        keyframeTracks: motion.keyframeTracks || {}
      },
      null,
      2
    ),
    warnings: (motion.warnings || []).slice()
  };
}

function emitMotionReact(motion) {
  // Emit a Framer-Motion-style keyframe object per property (best-effort).
  const tracks = motion.keyframeTracks && typeof motion.keyframeTracks === "object" ? motion.keyframeTracks : {};
  const props = Object.keys(tracks);
  const warnings = (motion.warnings || []).slice();
  if (props.length === 0) {
    warnings.push("No manual keyframe tracks; emitting empty React animate object.");
    return { language: "tsx", format: "react", code: "export const motion = { animate: {}, transition: {} };\n", warnings };
  }
  const animate = {};
  let maxDur = 0;
  for (const property of props) {
    const track = tracks[property];
    const kfs = ((track && track.keyframes) || []).slice().sort((a, b) => (+a.timelinePosition || 0) - (+b.timelinePosition || 0));
    animate[property.toLowerCase()] = kfs.map((kf) => tidy(num(kf.value)));
    maxDur = Math.max(maxDur, trackDurationSec(track, motion.timelineDurationMs));
  }
  const code =
    `export const motion = {\n` +
    `  animate: ${JSON.stringify(animate)},\n` +
    `  transition: { duration: ${maxDur} }\n` +
    `};\n`;
  return { language: "tsx", format: "react", code, warnings };
}

/**
 * @param {MotionContext} motion
 * @param {"css"|"json"|"react"} format
 * @returns {{language:string, code:string, format:string, warnings:string[]}}
 */
export function emitMotionCode(motion, format = "css") {
  const safe = motion && typeof motion === "object" ? motion : {};
  switch (format) {
    case "json": return emitMotionJson(safe);
    case "react": return emitMotionReact(safe);
    case "css":
    default: return emitMotionCss(safe);
  }
}
