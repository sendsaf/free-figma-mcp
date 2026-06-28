// Capability detection + normalization for Config 2026 Plugin API surfaces.
//
// The MCP server never touches `figma.*` directly. It asks the plugin sandbox to
// probe the live Plugin API (via `{ type: "get_capabilities" }`) and normalizes
// the raw response into a stable, fully-populated CapabilityReport so every tool
// can rely on strict booleans at every leaf.

/** @typedef {import("./types").CapabilityReport} CapabilityReport */

const asBool = (value) => value === true;

const CAPABILITY_SHAPE = {
  motion: ["reactions", "animationStyles", "manualKeyframes", "presets"],
  shaders: ["list", "import"],
  codeLayers: ["jsx"],
  slots: ["create"],
  weave: ["read"]
};

function normalizeCapabilityLeaves(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const group of Object.keys(CAPABILITY_SHAPE)) {
    const groupSource = source[group] && typeof source[group] === "object" ? source[group] : {};
    out[group] = {};
    for (const leaf of CAPABILITY_SHAPE[group]) {
      out[group][leaf] = asBool(groupSource[leaf]);
    }
  }
  return out;
}

/**
 * Normalize a raw plugin response (or a partial/legacy object) into a fully
 * populated CapabilityReport. Every capability leaf becomes a strict boolean.
 * Idempotent except for the `probedAt` timestamp, which is preserved when the
 * input already carries a numeric value.
 *
 * @param {*} raw
 * @returns {CapabilityReport}
 */
export function normalizeCapabilities(raw) {
  const report = raw && typeof raw === "object" ? raw : {};
  const capsSource =
    report.capabilities && typeof report.capabilities === "object" ? report.capabilities : report;

  return {
    source: "local-plugin",
    apiVersion: typeof report.apiVersion === "string" ? report.apiVersion : null,
    editorType: typeof report.editorType === "string" ? report.editorType : "unknown",
    capabilities: normalizeCapabilityLeaves(capsSource),
    probedAt: typeof report.probedAt === "number" ? report.probedAt : Date.now()
  };
}

/**
 * Server-side cache for the capability probe. Avoids a plugin round-trip on every
 * motion/shader/slot call by reusing a recent report within the TTL.
 *
 * @param {{ ttlMs?: number }} [options]
 */
export function createCapabilityCache({ ttlMs = 60_000 } = {}) {
  let cached = null;
  let cachedAt = 0;

  async function get({ refresh = false, sendToFigma } = {}) {
    if (typeof sendToFigma !== "function") {
      throw new Error("createCapabilityCache.get requires a sendToFigma function.");
    }
    const now = Date.now();
    if (!refresh && cached && now - cachedAt < ttlMs) {
      return cached;
    }
    const result = await sendToFigma({ type: "get_capabilities" });
    cached = normalizeCapabilities(result);
    cachedAt = now;
    return cached;
  }

  function clear() {
    cached = null;
    cachedAt = 0;
  }

  return { get, clear };
}
