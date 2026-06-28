# Project Structure

```
figma-local-mcp/
├── mcp-server/              # The MCP server (npm workspace: free-figma-mcp)
│   ├── server.js            # Stable entrypoint: wires bridge, stores, tools, guidance
│   ├── src/
│   │   ├── config.js        # Central path/port resolution (edit paths here)
│   │   ├── bridge.js        # WebSocket owner/relay bridge to the Figma plugin
│   │   ├── tools.js         # registerFigmaTools — all MCP tool definitions
│   │   ├── content.js       # textContent / jsonContent / imageContent helpers
│   │   ├── capabilities.js  # Config 2026 API capability probe + cache
│   │   ├── schema-probe.js  # zod validation error parsing / shape summaries
│   │   ├── api-catalog.js   # live Plugin API catalog store + diff
│   │   ├── code-connect-store.js  # local Code Connect-style mapping persistence
│   │   ├── preset-store.js  # motion preset persistence
│   │   ├── guidance.js      # registers skills + steering docs as MCP guidance
│   │   └── generators/      # code/scene generators (motion, preset-bake,
│   │                        #   scene-replicate, typewriter)
│   └── test/                # Node --test files, one per src module
│
├── figma-plugin/            # Figma Desktop plugin (sandbox side of the bridge)
│   ├── manifest.json        # import via Plugins -> Development -> Import manifest
│   ├── code.js              # plugin sandbox: runs against the Figma Plugin API
│   └── ui.html              # bridge control panel (Start/Stop/logs)
│
├── skills/                  # Agent skills (SKILL.md per skill) for valid scripts
├── powers/local-figma/      # Kiro power: POWER.md, mcp.json, steering/
├── examples/                # Sample mcpServers configs per platform
├── scripts/print-mcp-config.js  # generates IDE config with the real clone path
├── docs/                    # TOOLS, CLIENT_SETUP, compatibility, demo docs
├── .figma-mcp/              # Local runtime data (JSON): mappings, catalog, presets
└── .kiro/                   # Specs and steering for Kiro
```

## Where things go

- **New MCP tool** → add to `mcp-server/src/tools.js` inside `registerFigmaTools`, with a zod schema and try/catch handler returning `content.js` helpers.
- **New module** → place in `mcp-server/src/`, export a `createX(...)` factory, add a matching `mcp-server/test/x.test.js`.
- **New path or port** → add to `mcp-server/src/config.js`; don't hardcode paths elsewhere.
- **Code/scene generators** → `mcp-server/src/generators/`.
- **Agent-facing guidance** → `skills/<name>/SKILL.md` (skills) or `powers/local-figma/steering/` (Kiro power steering). These are loaded at startup by `guidance.js`.
- **Plugin-side behavior** (anything touching the live `figma` global) → `figma-plugin/code.js`; UI changes → `figma-plugin/ui.html`.

## Data flow reminder

The server never touches the Figma canvas directly. It sends commands over the WebSocket bridge to `figma-plugin/code.js`, which executes against the Figma Plugin API and returns results. Server-side code and plugin-side code are separate runtimes — keep that boundary in mind when adding features.
