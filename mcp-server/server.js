#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFigmaBridge } from "./src/bridge.js";
import { createCodeConnectStore } from "./src/code-connect-store.js";
import { bridgePort, localDataDir, mappingsPath } from "./src/config.js";
import { registerFigmaTools } from "./src/tools.js";

const bridge = createFigmaBridge({
  port: bridgePort,
  logger: (message) => console.error(message)
});

const codeConnectStore = createCodeConnectStore({
  localDataDir,
  mappingsPath
});

const server = new McpServer({
  name: "figma-local-mcp",
  version: "0.1.0"
});

registerFigmaTools(server, {
  sendToFigma: bridge.sendToFigma,
  codeConnectStore
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[mcp] figma-local-mcp server started (${bridge.getMode()} mode, bridge :${bridge.getPort()})`);
