// File-backed store for baked motion presets (name -> preset).

import fs from "node:fs";

export function createPresetStore({ localDataDir, presetsPath }) {
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(presetsPath, "utf8"));
    } catch {
      return {};
    }
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
