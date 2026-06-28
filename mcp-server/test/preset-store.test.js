import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createPresetStore } from "../src/preset-store.js";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ffm-presets-"));
}

test("preset store reads the writable file when present", () => {
  const dir = tmp();
  const presetsPath = path.join(dir, "motion-presets.json");
  fs.writeFileSync(presetsPath, JSON.stringify({ Burst: { name: "Burst", category: "enter", tracks: [] } }));
  const store = createPresetStore({ localDataDir: dir, presetsPath });
  assert.equal(store.get("Burst").category, "enter");
});

test("preset store falls back to the bundled read-only seed", () => {
  const seedDir = tmp();
  const seedPath = path.join(seedDir, "seed.json");
  fs.writeFileSync(seedPath, JSON.stringify({ Reveal: { name: "Reveal", category: "enter", durationSec: 1, tracks: [{}] } }));

  // presetsPath points at a file that does NOT exist yet -> seed is used.
  const dir = tmp();
  const presetsPath = path.join(dir, "does-not-exist", "motion-presets.json");
  const store = createPresetStore({ localDataDir: dir, presetsPath, seedPath });

  assert.equal(store.get("Reveal").name, "Reveal");
  const list = store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].trackCount, 1);
});

test("writes merge into the writable path, preserving the seed library", () => {
  const seedDir = tmp();
  const seedPath = path.join(seedDir, "seed.json");
  fs.writeFileSync(seedPath, JSON.stringify({ Seeded: { name: "Seeded", tracks: [] } }));

  const dir = tmp();
  const presetsPath = path.join(dir, "motion-presets.json");
  const store = createPresetStore({ localDataDir: dir, presetsPath, seedPath });

  store.save({ name: "Custom", category: "exit", tracks: [] });
  // First save reads the seed, adds the new preset, and persists both so the
  // bundled library is never lost when a user bakes their own preset.
  assert.ok(fs.existsSync(presetsPath));
  assert.equal(store.get("Custom").category, "exit");
  assert.equal(store.get("Seeded").name, "Seeded");
});
