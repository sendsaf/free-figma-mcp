// Convert a "scene replication spec" (the JSON shape produced by the Grok video
// prompt) into an executable plan: per-element build params + apply_motion
// payloads. Pure (no Figma access); fully unit-testable.
//
// Input spec shape (per MISC/video-replication/GROK-PROMPT.md):
//   { scene:{canvas,totalDurationSec,background},
//     elements:[ { name,type,text,layout:{x,y,width,height,fill,fontSize},
//                  startDelay, phases:[ {category,presetMatch,tracks:[{property,keyframes:[{t,v,easing}]}]} ] } ] }

function round(n) {
  if (typeof n !== "number" || !isFinite(n)) return 0;
  return Math.round(n * 1e4) / 1e4;
}

export function convertEasing(e) {
  if (Array.isArray(e) && e.length === 4) {
    return { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: e[0], y1: e[1], x2: e[2], y2: e[3] } };
  }
  if (e === "spring") {
    return { type: "CUSTOM_SPRING", easingFunctionSpring: { bounce: 0.5 } };
  }
  return { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 } };
}

// Normalize a Grok track ({property, keyframes:[{t,v,easing}]}) to our keyframe
// format ({property, keyframes:[{timelinePosition, value:{type:"FLOAT",value}, easing}]}).
function normalizeGrokTrack(track) {
  const keyframes = ((track && track.keyframes) || []).map((k) => ({
    timelinePosition: round(k.t != null ? k.t : (k.timelinePosition || 0)),
    value: k.value && typeof k.value === "object" ? k.value : { type: "FLOAT", value: +k.v || 0 },
    easing: k.easing && typeof k.easing === "object" && !Array.isArray(k.easing) ? k.easing : convertEasing(k.easing)
  }));
  return { property: track.property, keyframes };
}

function phaseDuration(tracks) {
  let d = 0;
  for (const t of tracks) for (const k of t.keyframes || []) d = Math.max(d, k.timelinePosition || 0);
  return d;
}

// Offset every keyframe time by `offset`; optionally prepend a hold keyframe at 0.
function offsetTracks(tracks, offset, hold) {
  return tracks.map((t) => {
    const kfs = t.keyframes.map((k) => ({
      timelinePosition: round((k.timelinePosition || 0) + offset),
      value: k.value,
      easing: k.easing
    }));
    if (hold && offset > 0 && kfs.length) {
      kfs.unshift({ timelinePosition: 0, value: kfs[0].value, easing: kfs[0].easing });
    }
    return { property: t.property, keyframes: kfs };
  });
}

// Merge keyframes of the same property across phases into one track per property.
function mergeTracksByProperty(trackLists) {
  const map = {};
  for (const tracks of trackLists) {
    for (const t of tracks) {
      if (!map[t.property]) map[t.property] = [];
      map[t.property] = map[t.property].concat(t.keyframes);
    }
  }
  return Object.keys(map).sort().map((property) => ({
    property,
    keyframes: map[property].sort((a, b) => a.timelinePosition - b.timelinePosition)
  }));
}

/**
 * @param {object} spec  scene spec from the Grok prompt
 * @param {{presets?: Object<string,{tracks:Array}>, usePresetMatches?: boolean}} [opts]
 * @returns {{canvas:number[], background:string, totalDurationSec:number, warnings:string[], elements:Array}}
 */
export function convertScene(spec, opts = {}) {
  const presets = opts.presets || {};
  const useMatches = opts.usePresetMatches !== false;
  const scene = (spec && spec.scene) || {};
  const elementsIn = (spec && spec.elements) || [];
  const warnings = [];

  const elements = elementsIn.map((el) => {
    const startDelay = +el.startDelay || 0;
    let cursor = startDelay;
    let loop = false;
    let firstPhase = true;
    const phaseTrackLists = [];

    for (const phase of el.phases || []) {
      if (phase.category === "cycle") loop = true;
      let tracks;
      if (useMatches && phase.presetMatch && presets[phase.presetMatch]) {
        tracks = presets[phase.presetMatch].tracks.map((t) => ({ property: t.property, keyframes: t.keyframes.slice() }));
      } else {
        if (phase.presetMatch && useMatches) warnings.push(`Preset '${phase.presetMatch}' not found; using inline tracks for '${el.name}'.`);
        tracks = (phase.tracks || []).map(normalizeGrokTrack);
      }
      const dur = phaseDuration(tracks);
      // A phase may pin to an absolute scene time (e.g. an exit at 4.0s); else it
      // runs sequentially after the previous phase.
      const offset = phase.startAtSec != null ? +phase.startAtSec : cursor;
      phaseTrackLists.push(offsetTracks(tracks, offset, firstPhase));
      cursor = offset + dur;
      firstPhase = false;
    }

    const merged = mergeTracksByProperty(phaseTrackLists);
    const payloads = merged.map((t) => ({ field: { type: "PROPERTY", name: t.property }, track: { keyframes: t.keyframes } }));

    return {
      name: el.name || "Element",
      type: el.type || "RECTANGLE",
      text: el.text != null ? el.text : null,
      layout: el.layout || { x: 0, y: 0, width: 100, height: 100, fill: "#CCCCCC", fontSize: null },
      loop,
      payloads
    };
  });

  return {
    canvas: scene.canvas || [1920, 1080],
    background: scene.background || "#000000",
    totalDurationSec: scene.totalDurationSec || 0,
    warnings,
    elements
  };
}
