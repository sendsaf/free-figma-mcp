# MCP Client Setup

Use one of the [examples](../examples) as the base config:

```json
{
  "mcpServers": {
    "figma-local-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\figma-local-mcp\\mcp-server\\server.js"],
      "env": {}
    }
  }
}
```

Or print a ready-to-copy config for the current clone:

```bash
npm run mcp:config
```

For Antigravity, the same standard config applies:

```bash
npm run mcp:config:antigravity
```

For Kiro power-style config:

```bash
npm run mcp:config:kiro
```

## Session Startup

1. Open Figma Desktop.
2. Run `Plugins -> Development -> Figma Local MCP Bridge`.
3. Keep the bridge window open. Press `Start` in the plugin window when you want it to connect to the local MCP bridge.
4. Start or restart your IDE agent so it loads the MCP server.

## Multiple IDEs

Multiple IDEs can keep this MCP active at the same time.

- The first MCP process owns the local WebSocket bridge on port `3055`.
- Later MCP processes detect that the port is already owned and automatically enter relay mode.
- The Figma plugin should be open only once in the active Figma file; all IDEs route through that bridge owner.
- You should no longer see `EADDRINUSE` as a fatal startup error. A relay process should log that it is using relay mode.

Keep one local Figma MCP entry enabled per IDE workspace for normal use, but this relay support also covers separate IDEs or windows that start their own MCP process.

## Troubleshooting

If tools fail with "Figma plugin is not connected":

- Confirm the MCP server is running.
- Confirm Figma Desktop is open.
- Run the local plugin bridge again.
- Confirm the plugin window says it is connected to `ws://localhost:3055`.

If the first command logs activity but later commands hang or cannot get data:

- Stop the MCP server from your IDE, or restart the IDE so it restarts the MCP process.
- Close and rerun `Plugins -> Development -> Figma Local MCP Bridge` in Figma Desktop.
- Press `Start` again in the plugin window.
- Try a small command first, such as `get_metadata` on the current selection.

Large `use_figma` write commands can keep the Figma plugin busy until Figma finishes executing the script. The server applies command timeouts, but a long synchronous plugin script may still need the plugin window to be reopened before the next call.

If an agent passes a Figma URL:

- This local server accepts `fileKey` for compatibility, but uses the active desktop file.
- Make sure the matching file is open in Figma Desktop.
- Select the target layer or pass the node ID if available.

## Installing Dependencies

This repo does not keep `node_modules` checked in. Install from the repository root before starting:

```powershell
cd "C:\path\to\figma-local-mcp"
npm install
```

## Skills and Rules

If your IDE supports agent skills or rule files, add or reference these local skills:

- `skills/local-figma-use/SKILL.md`
- `skills/local-figma-implement-design/SKILL.md`
- `skills/local-figma-use-figjam/SKILL.md`

If your IDE does not support skills, copy the relevant skill content into that IDE's project rules or agent instructions.

## Kiro Power

For Kiro, use the local power-style package in:

```text
powers/local-figma/
```

It contains:

- `POWER.md` for intent detection and high-level behavior.
- `steering/*.md` for workflow-specific guidance.
- `mcp.json` for a self-contained MCP server config.

For local-only Kiro workspace settings, use:

```text
.kiro/settings/mcp.json
```

For Kiro power registration, the local server should also appear under:

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

Prefer enabling only one local Figma entry per Kiro workspace to avoid duplicate tool listings. If multiple IDE windows do launch separate MCP server processes, the later ones should relay through the first process instead of crashing on WebSocket port `3055`.

## Plugin Window Controls

The Figma plugin UI includes:

- `Start`: connects to the WebSocket bridge.
- `Stop`: returns control to the active MCP caller, or disconnects the bridge when no command is active.
- `Minimize` / `Open`: collapses or expands the plugin window.
- `Focus selection`: scrolls and zooms the Figma viewport to the current selection.
- `Clear log`: clears local bridge activity logs.

Figma plugins cannot force a true OS-level always-on-top overlay outside Figma. The local bridge can collapse its Figma plugin window, but Figma controls the windowing model.

The `Stop` control cannot forcibly terminate Figma's JavaScript VM in the middle of a synchronous operation. It immediately sends a stopped result back to the MCP caller and signals the plugin sandbox. Long custom `use_figma` scripts should periodically call `mcp.throwIfStopped()` or check `mcp.shouldStop()` inside loops.

## Smoke Test

After setup:

1. Open a Figma file.
2. Select any frame or layer.
3. Ask the IDE agent: "Use the Figma Local MCP get_metadata tool on my current selection."
4. If XML comes back, the bridge is working.
