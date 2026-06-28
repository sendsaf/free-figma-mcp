#!/usr/bin/env node

const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "mcp-server", "server.js");
const mode = process.argv.includes("--kiro") ? "kiro" : "standard";

const standardConfig = {
  mcpServers: {
    "free-figma-mcp": {
      command: "node",
      args: [serverPath],
      env: {}
    }
  }
};

const kiroConfig = {
  powers: {
    mcpServers: {
      "power-free-figma-mcp": {
        command: "node",
        args: [serverPath],
        env: {},
        disabled: false,
        autoApprove: []
      }
    }
  }
};

console.log(JSON.stringify(mode === "kiro" ? kiroConfig : standardConfig, null, 2));
