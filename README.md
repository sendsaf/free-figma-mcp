![Figma Local MCP](./assets/local-figma-mcp.png)

# Figma Local MCP

Run Figma MCP tools locally through Figma Desktop. Works with any MCP-capable IDE.

> This project is not affiliated with Figma. It is a local compatibility bridge inspired by the official Figma MCP workflow.

## Installation

**1. Clone and install**

```bash
git clone https://github.com/safwanthottoli/figma-local-mcp.git
cd figma-local-mcp
npm install
```

**2. Get your MCP config**

```bash
npm run mcp:config
```

This prints a ready-to-copy config using the real path to your clone.

**3. Add the config to your IDE**

Paste the output into your IDE's MCP server config. The format works with any MCP-capable client (Cursor, Claude Code, VS Code, Antigravity, Windsurf, etc.):

```json
{
  "mcpServers": {
    "figma-local-mcp": {
      "command": "node",
      "args": ["/path/to/figma-local-mcp/mcp-server/server.js"],
      "env": {}
    }
  }
}
```

OS-specific examples and Kiro power config are in [examples/](examples/).

**4. Import the Figma plugin**

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `figma-plugin/manifest.json`.

**5. Start a session**

1. Start your IDE or CLI MCP client.
2. In Figma Desktop, run `Plugins -> Development -> Figma Local MCP Bridge`.
3. Press `Start` in the plugin window.
4. Ask your agent to call `get_metadata` on your current selection.

## Quick Test

```text
Use Figma Local MCP to get metadata for my current Figma file or selection.
```

Then try a write:

```text
Use Figma Local MCP to create a simple card component in my open Figma file.
```

## Tools

| Tool | What it does |
|------|-------------|
| `use_figma` | Execute JavaScript in the Figma plugin sandbox |
| `get_metadata` | Sparse XML for selected/current nodes |
| `get_design_context` | Metadata, variables, styles, and optional screenshot |
| `get_screenshot` | PNG export of a node |
| `get_variable_defs` | Variables, styles, and bound references |
| `search_design_system` | Search components, variables, styles |
| `create_design_system_rules` | Generate workflow rules |
| `get_code_connect_map` | Read local Code Connect mappings |
| `add_code_connect_map` | Add a local mapping |
| `get_code_connect_suggestions` | Suggest mappings from instances |
| `send_code_connect_mappings` | Save confirmed mappings |
| `get_figjam` | FigJam metadata |
| `generate_diagram` | Mermaid to Figma/FigJam |
| `generate_figma_design` | URL/HTML to Figma layers |
| `create_new_file` | Create a new page |
| `whoami` | Local identity info |

## Architecture

```text
IDE / CLI / Agent
  -> MCP stdio server
  -> WebSocket bridge (ws://localhost:3055)
  -> Figma plugin
  -> Figma Desktop
```

Multi-client aware: first process owns the bridge, later IDEs relay through it.

## Agent Skills

For IDEs that support skill files:

- [skills/local-figma-use/SKILL.md](skills/local-figma-use/SKILL.md) — `use_figma` rules and helpers
- [skills/local-figma-implement-design/SKILL.md](skills/local-figma-implement-design/SKILL.md) — design-to-code workflow
- [skills/local-figma-use-figjam/SKILL.md](skills/local-figma-use-figjam/SKILL.md) — FigJam operations

For Kiro: [powers/local-figma/](powers/local-figma/)

## Development

```bash
npm install
npm run validate
```

## Limits

- Works on the active Figma Desktop document only.
- `fileKey` accepted for compatibility but doesn't fetch remote files.
- `use_figma` executes JavaScript in the plugin sandbox. Only connect agents you trust.

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
