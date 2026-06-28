#!/usr/bin/env node
// Remove the asset copies that bundle-assets.js staged inside the package.
// Runs on `postpack` so the dev tree stays clean after `npm pack`/`publish`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_ASSETS } from "./bundle-assets.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");

for (const name of [...BUNDLED_ASSETS, "data"]) {
  const target = path.join(serverRoot, name);
  fs.rmSync(target, { recursive: true, force: true });
  console.error(`[clean-assets] removed ${target}`);
}
