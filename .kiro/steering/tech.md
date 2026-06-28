# Tech Stack

## Runtime & language

- **Node.js >= 20**, ES modules only (`"type": "module"`). Use `import`/`export`, not `require`.
- Plain JavaScript (no TypeScript, no build/transpile step). Source runs directly.
- The Figma plugin (`figma-plugin/code.js`) runs in the Figma plugin sandbox and uses the Figma Plugin API.

## Key dependencies

- `@modelcontextprotocol/sdk` — MCP server (`McpServer`, `StdioServerTransport`).
- `ws` — WebSocket bridge between the MCP server and the Figma plugin (port `3055`, override with `FIGMA_MCP_BRIDGE_PORT`).
- `zod` (v3) — tool input schema validation.

The project is an npm workspace; the server lives in the `mcp-server` workspace (`free-figma-mcp`). No other workspaces.

## Common commands

Run all commands from the **repository root**.

```bash
npm install                # install deps

npm run validate           # full gate: check + check:plugin + test
npm run check              # node --check on every server source file
npm run check:plugin       # node --check on figma-plugin/code.js
npm test                   # Node built-in test runner (node --test)

npm start                  # start the MCP stdio server
npm run dev                # start server with --watch

npm run mcp:config         # print ready-to-copy mcpServers JSON for this clone
npm run mcp:config:kiro    # print Kiro power-style config
```

Run `npm run validate` before considering any change complete.

## Testing

- Uses the **Node built-in test runner** (`node --test`), no external test framework.
- Tests live in `mcp-server/test/*.test.js`, one file per source module.
- When adding or changing a source module, add or update its matching test file.

## Conventions

- Modules export factory functions (e.g. `createFigmaBridge`, `createCodeConnectStore`, `registerFigmaTools`) that take a single options object; dependencies are injected, not imported as singletons.
- All filesystem paths are resolved centrally in `src/config.js` from `import.meta.url`. Add new paths there rather than hardcoding.
- Logging goes to `stderr` via `console.error` (stdout is reserved for the MCP stdio transport — never `console.log` from the server).
- Tools are registered with `server.tool(name, description, zodSchema, handler)`. Handlers wrap logic in try/catch and return content via the helpers in `src/content.js` (`textContent`, `jsonContent`, `imageContent`). Errors are returned as `textContent(\`Error: ${error.message}\`)`, not thrown.
- Inside `use_figma` scripts: colors are 0-1 range, load fonts before text ops, use `await figma.setCurrentPageAsync(page)`, return data via `return` (not `figma.notify`), and return node IDs.
- Local persisted data (mappings, api catalog, motion presets) lives in `.figma-mcp/` as JSON.
