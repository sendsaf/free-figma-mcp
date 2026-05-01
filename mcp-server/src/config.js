import path from "node:path";
import { fileURLToPath } from "node:url";

export const bridgePort = Number(process.env.FIGMA_MCP_BRIDGE_PORT || 3055);

const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(srcDir, "..");
export const projectRoot = path.resolve(serverRoot, "..");
export const localDataDir = path.join(projectRoot, ".figma-mcp");
export const mappingsPath = path.join(localDataDir, "code-connect-mappings.json");
