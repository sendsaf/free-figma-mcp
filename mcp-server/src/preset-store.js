// File-backed store for baked motion presets (name -> preset).

import fs from "node:fs";

export function createPresetStore({ localDataDir, presetsPath, seedPath = null }) {
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(presetsPath, "utf8"));
    } catch {
      /* fall through to the bundled read-only seed */
    }
    if (seedPath) {
      try {
        return JSON.parse(fs.readFileSync(seedPath, "utf8"));
      } catch {
        /* ignore */
      }
    }
    return {};
  }

  function writeAll(presets) {
    fs.mkdirSync(localDataDir, { recursive: true });
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
  }

  function save(preset) {
    const all = readAll();
    all[preset.name] = preset;
    writeAll(all);
    return preset;
  }

  function get(name) {
    return readAll()[name] || null;
  }

  function list() {
    const all = readAll();
    return Object.keys(all).map((name) => ({
      name,
      category: all[name].category,
      durationSec: all[name].durationSec,
      trackCount: (all[name].tracks || []).length
    }));
  }

  return { presetsPath, readAll, writeAll, save, get, list };
}
