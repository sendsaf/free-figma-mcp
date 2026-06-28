#!/usr/bin/env node
// Copy repo-root asset directories (skills, figma-plugin, powers) INTO the
// mcp-server package so they ship in the published npm tarball. Runs on
// `prepack`. Paired with clean-assets.js (`postpack`) which removes the copies.
//
// These dirs live at the repo root (outside the package), and npm cannot pack
// files above the package root — so we stage copies inside the package at
// publish time and let config.js prefer the bundled copy when present.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const repoRoot = path.resolve(serverRoot, "..");

export const BUNDLED_ASSETS = ["skills", "figma-plugin", "powers"];

// Single files copied into the package (repo-relative -> package-relative).
export const BUNDLED_FILES = [
  [path.join(".figma-mcp", "motion-presets.json"), path.join("data", "motion-presets.json")]
];

function bundle() {
  for (const name of BUNDLED_ASSETS) {
    const from = path.join(repoRoot, name);
    const to = path.join(serverRoot, name);
    if (!fs.existsSync(from)) {
      console.error(`[bundle-assets] skip: ${from} not found`);
      continue;
    }
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
    console.error(`[bundle-assets] bundled ${name} -> ${to}`);
  }
  for (const [rel, dest] of BUNDLED_FILES) {
    const from = path.join(repoRoot, rel);
    const to = path.join(serverRoot, dest);
    if (!fs.existsSync(from)) {
      console.error(`[bundle-assets] skip file: ${from} not found`);
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.error(`[bundle-assets] bundled ${rel} -> ${to}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  bundle();
}
