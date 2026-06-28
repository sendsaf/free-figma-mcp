#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFigmaBridge } from "./src/bridge.js";
import { createApiCatalogStore } from "./src/api-catalog.js";
import { createCapabilityCache } from "./src/capabilities.js";
import { createCodeConnectStore } from "./src/code-connect-store.js";
import { createPresetStore } from "./src/preset-store.js";
import { registerGuidance } from "./src/guidance.js";
import { apiCatalogPath, bridgePort, bundledPresetsPath, localDataDir, mappingsPath, motionPresetsPath, skillsDir, steeringDir } from "./src/config.js";
import { registerFigmaTools } from "./src/tools.js";

const bridge = createFigmaBridge({
  port: bridgePort,
  logger: (message) => console.error(message)
});

const codeConnectStore = createCodeConnectStore({
  localDataDir,
  mappingsPath
});

const capabilities = createCapabilityCache();

const apiCatalogStore = createApiCatalogStore({ localDataDir, apiCatalogPath });

const presetStore = createPresetStore({ localDataDir, presetsPath: motionPresetsPath, seedPath: bundledPresetsPath });

const server = new McpServer({
  name: "free-figma-mcp",
  version: "0.1.0"
});

registerFigmaTools(server, {
  sendToFigma: bridge.sendToFigma,
  codeConnectStore,
  capabilities,
  apiCatalogStore,
  presetStore
});

const guidance = registerGuidance(server, { skillsDir, steeringDir });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[mcp] free-figma-mcp server started (${bridge.getMode()} mode, bridge :${bridge.getPort()}); guidance: ${guidance.skillCount} skills, ${guidance.steeringCount} steering docs`);
