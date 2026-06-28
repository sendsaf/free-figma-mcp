---
name: "local-figma"
displayName: "Free Figma MCP"
description: "Free Figma MCP: local Figma Desktop integration for inspecting and modifying the active Figma or FigJam file through a local plugin bridge. Use when working with the free-figma-mcp MCP server, active Figma selections, local use_figma writes, local design-to-code context, local Code Connect-style mappings, or FigJam board edits."
keywords: ["figma", "local figma", "mcp", "figma desktop", "use_figma", "design to code", "figjam", "local bridge", "code connect", "design system"]
author: "Local"
---

# Free Figma MCP

## Overview

This power teaches agents how to use the `free-figma-mcp` MCP server. The server exposes official-style Figma MCP tool names, but it runs locally through Figma Desktop and the Free Figma MCP Bridge plugin.

The active Figma Desktop document is the source of truth. `fileKey` parameters are accepted for compatibility, but this local server does not fetch arbitrary cloud files.

## When to Use This Power

Use this power when the user:

- Wants to inspect the current Figma Desktop selection.
- Wants to create, edit, delete, or fix objects in the active Figma file.
- Wants to implement application code from a selected Figma frame.
- Wants to inspect local variables, styles, components, or screenshots.
- Wants local Code Connect-style mappings.
- Wants to create or inspect FigJam board content through the local bridge.
- Mentions `free-figma-mcp`, Free Figma MCP, or the Free Figma MCP Bridge.

## Available MCP Tools

| Tool | Local behavior |
|---|---|
| `use_figma` | Execute JavaScript in the active Figma Desktop file through the Plugin API. |
| `get_metadata` | Sparse XML for selected/current nodes. |
| `get_design_context` | Local node JSON, metadata XML, variables/styles, and optional screenshot. |
| `get_screenshot` | PNG export for selected/current node. |
| `get_variable_defs` | Local variables, styles, and bound variable references. |
| `search_design_system` | Search active-file components, variables, and styles. |
| `create_design_system_rules` | Generate local workflow rules. |
| `get_code_connect_map` | Read local mappings from `.figma-mcp/code-connect-mappings.json`. |
| `add_code_connect_map` | Save a local mapping between a Figma node and code component. |
| `get_code_connect_suggestions` | Suggest mappings from active-file component instances. |
| `send_code_connect_mappings` | Save accepted local mappings. |
| `get_figjam` | Inspect the active FigJam board. |
| `generate_diagram` | Create simple local editable diagram/source layers from Mermaid syntax. |
| `generate_figma_design` | Convert URL/HTML text into simple editable Figma layers. |
| `create_new_file` | Create a new page in the active local file. |
| `whoami` | Return local MCP identity, not Figma account data. |

## Steering

Load the appropriate steering file based on user intent:

- Creating/editing Figma canvas objects -> `steering/use-figma.md`
- Implementing code from Figma -> `steering/implement-design.md`
- Working with FigJam -> `steering/use-figjam.md`
- Code Connect-style local mappings -> `steering/code-connect.md`
- Setup or troubleshooting -> `steering/setup.md`

## Critical Local Rules

1. The local bridge requires Figma Desktop plus the Free Figma MCP Bridge plugin window.
2. The MCP server talks to `ws://localhost:3055`.
3. The active desktop file is used; `fileKey` is compatibility-only.
4. Use current Figma selection when possible.
5. Use `get_metadata`, `get_design_context`, and `get_screenshot` before implementing UI code.
6. Load `local-figma-use` guidance before any non-trivial `use_figma` script.
7. Use `return`, not `figma.notify()` or `console.log()`, for tool output.

## Quick Smoke Test

1. Open Figma Desktop.
2. Run `Plugins -> Development -> Free Figma MCP Bridge`.
3. Select a layer.
4. Ask the agent to call `get_metadata` on the current selection.

If XML comes back, the local power and MCP bridge are working.

## MCP Config Placeholders

**IMPORTANT:** Before using this power, replace the following placeholder in `mcp.json` with your actual value:

- **`PLACEHOLDER_SERVER_PATH`**: Absolute path to your local `server.js` file in the figma-local-mcp project.
  - **How to get it:**
    1. Locate where you cloned or downloaded the figma-local-mcp repository
    2. Navigate to the `mcp-server` directory within that repository
    3. Copy the full absolute path to `server.js`
    4. Example paths:
       - Windows: `D:\\Figma Plugin\\figma-local-mcp\\mcp-server\\server.js`
       - macOS/Linux: `/Users/yourname/projects/figma-local-mcp/mcp-server/server.js`

**After replacing the placeholder, your mcp.json should look like:**
```json
{
  "mcpServers": {
    "free-figma-mcp": {
      "command": "node",
      "args": [
        "D:\\Figma Plugin\\figma-local-mcp\\mcp-server\\server.js"
      ],
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

**MCP Server:** free-figma-mcp  
**Package:** Local installation (requires the Free Figma MCP repository)
