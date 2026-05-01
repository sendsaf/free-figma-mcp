# Setup Steering

Use this steering when configuring or troubleshooting the local MCP server.

## Install Dependencies

```powershell
cd "C:\path\to\figma-local-mcp"
npm install
```

## Load Plugin

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `figma-plugin/manifest.json` from your local checkout.

## Run Each Session

1. Open Figma Desktop.
2. Run `Plugins -> Development -> Figma Local MCP Bridge`.
3. Press `Start` in the plugin window.
4. Start or restart Kiro so MCP tools are loaded.

## Kiro MCP Config

Use the example config in:

```text
examples/kiro-power-mcp.json
```

Point it to:

```text
C:\path\to\figma-local-mcp\mcp-server\server.js
```

Kiro can register the same server as a power-backed MCP server under `powers.mcpServers`:

```json
{
  "powers": {
    "mcpServers": {
      "power-figma-local-mcp": {
        "command": "node",
        "args": [
          "C:\\path\\to\\figma-local-mcp\\mcp-server\\server.js"
        ],
        "env": {},
        "disabled": false,
        "autoApprove": []
      }
    }
  }
}
```

Prefer enabling only one local Figma entry per Kiro workspace to avoid duplicate tool listings. If multiple IDE windows launch separate MCP server processes, later processes relay through the first bridge owner instead of crashing on WebSocket port `3055`.

## Troubleshooting

If a tool says the Figma plugin is not connected:

- Confirm Figma Desktop is open.
- Run the Figma Local MCP Bridge plugin.
- Press `Start` in the plugin window.
- Restart Kiro after changing MCP config.
