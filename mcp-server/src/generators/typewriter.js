// Pure math for the typewriter recipe: clip-frame sizing (with the glyph-overflow
// padding fix) and WIDTH-reveal keyframes (wipe or true character-step). No Figma
// access; fully unit-testable. The plugin measures ink bounds and feeds them here.

function round(n) {
  if (typeof n !== "number" || !isFinite(n)) return 0;
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Size the clip frame so glyph ink (descenders, ascenders, side-bearing/italic
 * overhang) is never shaved — only the intentional right reveal edge clips.
 * @param {{layoutW:number, layoutH:number, fontSize:number, overflow:{left:number,right:number,top:number,bottom:number}}} m
 *   overflow = absoluteRenderBounds minus absoluteBoundingBox per side (positive = ink outside).
 */
export function computeTypewriterLayout(m) {
  const fontSize = m.fontSize || 16;
  const safety = Math.max(2, Math.ceil(fontSize * 0.04));
  const ov = m.overflow || { left: 0, right: 0, top: 0, bottom: 0 };
  const padLeft = Math.max(0, ov.left || 0);
  const padRight = Math.max(0, ov.right || 0);
  const padTop = Math.max(0, ov.top || 0);
  const padBottom = Math.max(0, ov.bottom || 0);
  return {
    clipWidth: Math.ceil((m.layoutW || 0) + padLeft + padRight + 2 * safety),
    clipHeight: Math.ceil((m.layoutH || 0) + padTop + padBottom + 2 * safety),
    textX: padLeft + safety,
    textY: padTop + safety,
    safety
  };
}

/**
 * Build WIDTH keyframes (in px) for a typewriter reveal, optional hold + erase exit.
 * @param {{fullWidth:number, startSec?:number, revealSec?:number, holdSec?:number, eraseSec?:number, mode?:"wipe"|"step", charCount?:number}} o
 * @returns {{keyframes:Array<{t:number,v:number}>, endSec:number}}
 */
export function buildTypewriterKeyframes(o) {
  const fullWidth = Math.max(0, o.fullWidth || 0);
  const start = o.startSec || 0;
  const reveal = o.revealSec != null ? o.revealSec : 1.2;
  const hold = o.holdSec || 0;
  const erase = o.eraseSec || 0;
  const keyframes = [{ t: round(start), v: 0 }];

  if (o.mode === "step" && o.charCount > 0) {
    const stepW = fullWidth / o.charCount;
    const per = reveal / o.charCount;
    const eps = Math.min(0.0005, per * 0.1);
    for (let i = 1; i <= o.charCount; i++) {
      keyframes.push({ t: round(start + per * i - eps), v: round(stepW * (i - 1)) }); // hold prev
      keyframes.push({ t: round(start + per * i), v: round(stepW * i) });             // jump to i
    }
  } else {
    keyframes.push({ t: round(start + reveal), v: round(fullWidth) });
  }

  let end = start + reveal;
  if (hold > 0) { keyframes.push({ t: round(end + hold), v: round(fullWidth) }); end += hold; }
  if (erase > 0) { keyframes.push({ t: round(end + erase), v: 0 }); end += erase; }
  return { keyframes, endSec: round(end) };
}

/**
 * Lay out a sequence of lines that each type in, hold, and erase before the next,
 * returning per-line timing windows (caller builds the keyframes with these).
 * @param {Array<{fullWidth:number, charCount:number}>} lines
 * @param {{revealSec?:number, holdSec?:number, eraseSec?:number, gapSec?:number, mode?:string}} opts
 */
export function sequenceLines(lines, opts = {}) {
  const revealSec = opts.revealSec != null ? opts.revealSec : 1.2;
  const holdSec = opts.holdSec != null ? opts.holdSec : 1.0;
  const eraseSec = opts.eraseSec != null ? opts.eraseSec : 0.8;
  const gapSec = opts.gapSec != null ? opts.gapSec : 0.2;
  let cursor = 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    const built = buildTypewriterKeyframes({
      fullWidth: lines[i].fullWidth,
      charCount: lines[i].charCount,
      startSec: cursor,
      revealSec, holdSec,
      eraseSec: isLast ? 0 : eraseSec, // last line stays
      mode: opts.mode || "wipe"
    });
    out.push({ startSec: cursor, ...built });
    cursor = built.endSec + (isLast ? 0 : gapSec);
  }
  return { lines: out, totalSec: round(cursor) };
}
