import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const bridgePort = Number(process.env.FIGMA_MCP_BRIDGE_PORT || 3055);

const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(srcDir, "..");
export const projectRoot = path.resolve(serverRoot, "..");
export const serverEntry = path.join(serverRoot, "server.js");

// Resolve an asset directory that lives at the repo root during development but
// is bundled INSIDE the package at publish time (via prepack). Prefer the
// bundled copy next to the server when present, else fall back to the repo root.
function resolveAssetDir(name) {
  const bundled = path.join(serverRoot, name);
  try {
    if (fs.existsSync(bundled)) return bundled;
  } catch {
    /* ignore */
  }
  return path.join(projectRoot, name);
}

export const pluginDir = resolveAssetDir("figma-plugin");
export const skillsDir = resolveAssetDir("skills");
export const localDataDir = path.join(projectRoot, ".figma-mcp");
export const mappingsPath = path.join(localDataDir, "code-connect-mappings.json");
export const apiCatalogPath = path.join(localDataDir, "api-catalog.json");
export const motionPresetsPath = path.join(localDataDir, "motion-presets.json");
// Read-only preset library bundled into the package at publish time (prepack
// copies .figma-mcp/motion-presets.json -> mcp-server/data/). null in dev when
// the writable copy at the repo root is used instead.
export const bundledPresetsPath = (() => {
  const candidate = path.join(serverRoot, "data", "motion-presets.json");
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    /* ignore */
  }
  return null;
})();
export const steeringDir = path.join(resolveAssetDir("powers"), "local-figma", "steering");
