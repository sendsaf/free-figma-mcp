# Compatibility with the official Figma MCP

Free Figma MCP is **not affiliated with Figma**. It is a local compatibility
bridge inspired by the official Figma MCP workflow. It reuses official-style
tool names so agents written for the official server feel at home, but the
execution model is different.

## What matches

- Tool names (`get_metadata`, `get_design_context`, `get_screenshot`,
  `get_variable_defs`, `use_figma`, Code Connect tools, etc.).
- The general inspect → reason → write loop agents already use.
- MCP transport (stdio) and standard `mcpServers` client configuration.

## What differs

| Aspect | Official remote MCP | Free Figma MCP (local) |
| ------ | ------------------- | ---------------------- |
| Runtime target | Figma cloud context | Active Figma **Desktop** document |
| Connectivity | Hosted service | Local plugin bridge on `ws://localhost:3055` |
| `fileKey` | Selects a cloud file | Accepted for compatibility, ignored (uses active file) |
| Quotas | Hosted MCP limits apply | No hosted quota for local plugin work |
| Requirements | Account + service availability | Figma Desktop + the imported plugin running |

## Known limits

- Operates only on the **active** desktop document; it does not fetch arbitrary
  remote files.
- `use_figma` runs arbitrary JavaScript in the plugin sandbox — only connect
  agents and repositories you trust (see [SECURITY.md](../SECURITY.md)).
- Long synchronous scripts must cooperate with `mcp.shouldStop()` /
  `mcp.throwIfStopped()` for the Stop button to interrupt them.
- Some Config 2026 surfaces are exposed via discovery (`introspect_api`,
  `probe_schema`) because the Plugin API evolves faster than fixed docs; a few
  capabilities depend on your installed Figma build (`get_capabilities`).

This is not a drop-in replacement for every remote MCP feature. It is a
local-first execution path for agents that need fast, hackable,
desktop-connected Figma access.
