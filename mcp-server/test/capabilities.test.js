import assert from "node:assert/strict";
import { test } from "node:test";
import { createCapabilityCache, normalizeCapabilities } from "../src/capabilities.js";

const LEAVES = {
  motion: ["reactions", "animationStyles", "manualKeyframes", "presets"],
  shaders: ["list", "import"],
  codeLayers: ["jsx"],
  slots: ["create"],
  weave: ["read"]
};

function everyLeafIsBoolean(report) {
  for (const group of Object.keys(LEAVES)) {
    for (const leaf of LEAVES[group]) {
      if (typeof report.capabilities[group][leaf] !== "boolean") return false;
    }
  }
  return true;
}

function stripProbedAt(report) {
  const { probedAt, ...rest } = report;
  return rest;
}

// Property 1: Capability totality — every leaf is a strict boolean for any input.
test("normalizeCapabilities: totality across varied inputs (Property 1)", () => {
  const inputs = [
    undefined,
    null,
    {},
    42,
    "nope",
    { capabilities: {} },
    { capabilities: { motion: { timeline: true } } },
    { motion: { reactions: 1, timeline: "yes" }, weave: { read: null } },
    { capabilities: { slots: { create: true }, shaders: { list: true } }, editorType: "figma", apiVersion: "1.0.0" }
  ];
  for (const raw of inputs) {
    const report = normalizeCapabilities(raw);
    assert.equal(report.source, "local-plugin");
    assert.ok(everyLeafIsBoolean(report), `non-boolean leaf for input ${JSON.stringify(raw)}`);
    assert.equal(typeof report.probedAt, "number");
  }
});

// Property 2: Capability idempotence (ignoring probedAt).
test("normalizeCapabilities: idempotence ignoring probedAt (Property 2)", () => {
  const inputs = [
    {},
    { capabilities: { motion: { animationStyles: true, manualKeyframes: true } }, editorType: "figjam" },
    { motion: { reactions: true }, shaders: { list: true, import: true } }
  ];
  for (const raw of inputs) {
    const once = normalizeCapabilities(raw);
    const twice = normalizeCapabilities(once);
    assert.deepEqual(stripProbedAt(twice), stripProbedAt(once));
  }
});

test("normalizeCapabilities: coerces truthy-but-not-true values to false", () => {
  const report = normalizeCapabilities({ capabilities: { motion: { reactions: 1, animationStyles: "true" } } });
  assert.equal(report.capabilities.motion.reactions, false);
  assert.equal(report.capabilities.motion.animationStyles, false);
});

test("normalizeCapabilities: preserves a numeric probedAt", () => {
  const report = normalizeCapabilities({ probedAt: 123, capabilities: {} });
  assert.equal(report.probedAt, 123);
});

test("createCapabilityCache: caches within TTL and refresh re-probes", async () => {
  let calls = 0;
  const sendToFigma = async () => {
    calls += 1;
    return { capabilities: { motion: { reactions: true } }, editorType: "figma" };
  };
  const cache = createCapabilityCache({ ttlMs: 10_000 });

  const a = await cache.get({ sendToFigma });
  const b = await cache.get({ sendToFigma });
  assert.equal(calls, 1, "second call within TTL should be served from cache");
  assert.deepEqual(a, b);
  assert.equal(a.capabilities.motion.reactions, true);

  await cache.get({ sendToFigma, refresh: true });
  assert.equal(calls, 2, "refresh should bypass the cache");

  cache.clear();
  await cache.get({ sendToFigma });
  assert.equal(calls, 3, "clear should force a re-probe");
});

test("createCapabilityCache: requires a sendToFigma function", async () => {
  const cache = createCapabilityCache();
  await assert.rejects(() => cache.get({}), /requires a sendToFigma/);
});
