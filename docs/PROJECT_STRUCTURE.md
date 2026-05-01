# Project Structure

## Runtime Pieces

- `mcp-server/server.js`: stable MCP entrypoint used by IDE configs.
- `mcp-server/src/bridge.js`: WebSocket owner/relay bridge for Figma plugin and multiple IDE clients.
- `mcp-server/src/tools.js`: official-style MCP tool registration.
- `mcp-server/src/code-connect-store.js`: local Code Connect-style JSON storage.
- `mcp-server/src/content.js`: MCP content helpers.
- `figma-plugin/code.js`: Figma plugin sandbox command executor.
- `figma-plugin/ui.html`: bridge control panel.

## Agent Guidance

- `skills/`: local agent skills for IDEs that support skill loading.
- `powers/local-figma/`: Kiro power package and steering files.
- `docs/`: setup, tool behavior, compatibility, and project documentation.

## Examples

- `examples/mcp-config.windows.json`: generic Windows MCP config.
- `examples/mcp-config.macos-linux.json`: generic macOS/Linux MCP config.
- `examples/kiro-power-mcp.json`: Kiro power MCP config snippet.

## Local-Only Files

Do not commit local generated or machine-specific files:

- `.figma-mcp/`
- `.kiro/settings/mcp.json`
- `node_modules/`
- `.env`
