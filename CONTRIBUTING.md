# Contributing

Thanks for improving Figma Local MCP.

## Development Setup

```bash
npm install
npm run check
npm test
```

Import the plugin from `figma-plugin/manifest.json` in Figma Desktop.

## Pull Request Expectations

- Keep compatibility with the existing `mcp-server/server.js` entrypoint.
- Add or update tests for server behavior that can run without Figma Desktop.
- Keep Figma plugin sandbox code compatible with Figma's JavaScript parser. Avoid optional chaining, object spread, optional catch binding, and monkey-patching Figma objects in `figma-plugin/code.js`.
- Document user-visible tool or workflow changes in the README or relevant skill files.
- Do not commit `node_modules`, `.figma-mcp`, local logs, personal MCP tokens, or private Figma files.

## Local Validation

Run this before opening a PR:

```bash
npm run validate
```

If you only changed the Figma plugin, also run:

```bash
node --check figma-plugin/code.js
```
