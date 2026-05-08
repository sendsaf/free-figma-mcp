![Figma Local MCP](./assets/local-figma-mcp.png)
# Figma Local MCP

Run Figma through your own local MCP server.

Figma Local MCP gives any MCP-capable IDE, CLI, or agent a direct local bridge into Figma Desktop. It exposes official-style Figma MCP tool names, but routes the work through your active local Figma file instead of depending on a hosted remote MCP session.

No Claude Code lock-in. No single-IDE dependency. No remote Figma MCP quota wall for local desktop workflows. Your agent talks to your local MCP server, your local MCP server talks to your Figma plugin, and Figma updates the real canvas.

> This project is not affiliated with Figma. It is a local compatibility bridge inspired by the official Figma MCP workflow.

## Why This Exists

Official remote MCP is useful, but local Figma work needs a different tool:

- You want Figma automation from Kiro, Cursor, Claude Code, Codex, VS Code, terminal agents, and any future MCP client.
- You want to keep using Figma Desktop as the source of truth.
- You want faster local round trips for inspect/write workflows that do not need cloud file fetches.
- You want to avoid hosted MCP rate limits for local plugin-backed work.
- You want a bridge you can inspect, extend, fork, test, and run without waiting on a vendor integration.

Figma Local MCP is that bridge.

## What Makes It Stand Out

| Capability | Figma Local MCP |
|---|---|
| Works with any MCP client | Yes. IDEs, CLIs, and agents that support MCP can use it. |
| Requires Claude Code | No. Claude Code can use it, but it is not required. |
| Uses Figma Desktop directly | Yes. The active desktop file is the runtime target. |
| Avoids remote MCP quotas for local workflows | Yes. Local tool calls route through your own bridge. |
| Multi-IDE friendly | Yes. First process owns the bridge; later IDEs relay through it. |
| Official-style tool names | Yes. Agents see familiar Figma MCP-style tools. |
| Local Code Connect-style mappings | Yes. Mappings are stored locally as JSON. |
| Agent skills and Kiro power | Included. |
| Open and hackable | Yes. Plain Node server plus Figma plugin files. |

## Tool Surface

The server exposes official-style Figma MCP tools:

- `use_figma`
- `get_metadata`
- `get_design_context`
- `get_screenshot`
- `get_variable_defs`
- `search_design_system`
- `create_design_system_rules`
- `get_code_connect_map`
- `add_code_connect_map`
- `get_code_connect_suggestions`
- `send_code_connect_mappings`
- `get_figjam`
- `generate_diagram`
- `generate_figma_design`
- `create_new_file`
- `whoami`

See [docs/TOOLS.md](docs/TOOLS.md) for exact local behavior.

## Architecture

```text
Any MCP-capable IDE / CLI / agent
  -> local MCP stdio server
  -> local owner/relay bridge
  -> ws://localhost:3055
  -> Figma plugin UI
  -> Figma plugin sandbox
  -> Figma Plugin API
  -> active Figma Desktop document
```

The local bridge is multi-client aware. If two IDEs start the MCP server, the first process owns the WebSocket bridge and the later processes relay through it instead of crashing on port `3055`.

## Quick Start

### Option A: Install as Kiro Power (Recommended for Kiro Users)

**Prerequisites:**
1. Clone or download this repository
2. Run `npm install` from the repository root
3. Import the Figma plugin (see step 2 below)

**Installation Steps:**

1. **Import the Figma plugin**
   - Open Figma Desktop
   - Go to `Plugins -> Development -> Import plugin from manifest`
   - Select `figma-plugin/manifest.json` from this repository

2. **Install the power in Kiro**
   - Open Kiro
   - Open the Powers panel (Command Palette -> "Open Powers")
   - Click **"Add Custom Power"** button
   - Select **"Local Directory"**
   - Enter the full path to: `<repo>/powers/local-figma`
   - Click **"Add"**

3. **Configure the server path**
   - After installation, the power will be at `~/.kiro/powers/local-figma/`
   - Edit `~/.kiro/powers/local-figma/mcp.json`
   - Replace `PLACEHOLDER_SERVER_PATH` with your actual path:
     - Windows: `D:\\path\\to\\figma-local-mcp\\mcp-server\\server.js`
     - macOS/Linux: `/path/to/figma-local-mcp/mcp-server/server.js`

4. **Start using it**
    - In Figma Desktop, run `Plugins -> Development -> Figma Local MCP Bridge`
   - Press `Start` in the plugin window
   - Select a layer in Figma
   - Ask Kiro: "Get metadata for the current Figma selection"

The power includes comprehensive steering files for different workflows:
- `steering/use-figma.md` - Creating/editing Figma objects
- `steering/implement-design.md` - Implementing code from Figma designs
- `steering/use-figjam.md` - Working with FigJam boards
- `steering/code-connect.md` - Code Connect-style mappings
- `steering/setup.md` - Setup and troubleshooting

### Option B: Manual MCP Configuration (Other MCP Clients)

**1. Install from the repo root**

```bash
npm install
npm run validate
npm run mcp:config
```

**2. Import the Figma plugin**

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `figma-plugin/manifest.json`.

**3. Configure your MCP client**

Use one of the examples:

- [examples/mcp-config.windows.json](examples/mcp-config.windows.json)
- [examples/mcp-config.macos-linux.json](examples/mcp-config.macos-linux.json)
- [examples/kiro-power-mcp.json](examples/kiro-power-mcp.json)

Or print a ready-to-copy config for your current clone:

```bash
npm run mcp:config
```

For Kiro power-style config:

```bash
npm run mcp:config:kiro
```

Point your MCP client at:

```text
<repo>/mcp-server/server.js
```

**4. Start a Figma session**

1. Start your IDE or CLI MCP client.
2. In Figma Desktop, run `Plugins -> Development -> Figma Local MCP Bridge`.
3. Press `Start` in the plugin window.
4. Select a frame, component, or layer.
5. Ask your agent to call `get_metadata`, `get_design_context`, or `use_figma`.

## Plugin Control Panel

The Figma plugin UI is built for real use:

- `Start`: connect to the local bridge.
- `Stop`: return control to the active MCP caller, or disconnect the bridge when no command is active.
- `Minimize` / `Open`: collapse or expand the panel.
- `Focus selection`: jump Figma viewport to the current selection.
- Logs and command count: see what the bridge is doing.

## Agent Guidance Included

This repo includes local skills and Kiro power files so agents do not blindly generate invalid Figma scripts.

Skills:

- [skills/local-figma-use/SKILL.md](skills/local-figma-use/SKILL.md)
- [skills/local-figma-implement-design/SKILL.md](skills/local-figma-implement-design/SKILL.md)
- [skills/local-figma-use-figjam/SKILL.md](skills/local-figma-use-figjam/SKILL.md)

Kiro power:

- [powers/local-figma/POWER.md](powers/local-figma/POWER.md)
- [powers/local-figma/steering](powers/local-figma/steering)
- [powers/local-figma/mcp.json](powers/local-figma/mcp.json)

## Local vs Remote Figma MCP

| Remote Figma MCP | Figma Local MCP |
|---|---|
| Hosted by Figma | Runs on your machine |
| Works from Figma cloud context | Works from active Figma Desktop file |
| Can hit hosted MCP limits | Local bridge calls do not consume hosted MCP quota |
| Requires remote service availability | Requires Figma Desktop and the local plugin |
| Great for official cloud workflows | Great for local IDE and desktop automation |

This is not a replacement for every remote MCP feature. It is a local-first execution path for agents that need fast, hackable, desktop-connected Figma access.

## Development

Run everything from the repository root:

```bash
npm install
npm run check
npm run check:plugin
npm test
npm run validate
```

Repository shape:

```text
mcp-server/
  server.js              # stable MCP entrypoint
  src/                   # bridge, tools, content helpers, storage
  test/                  # Node test runner tests
figma-plugin/
  manifest.json
  code.js                # Figma plugin sandbox
  ui.html                # plugin bridge control panel
docs/
examples/
skills/
powers/
```

## Honest Limits

- The local bridge operates on the active Figma Desktop document.
- `fileKey` arguments are accepted for compatibility, but local mode does not fetch arbitrary remote files.
- `use_figma` executes JavaScript in the Figma plugin sandbox. Only connect agents and repositories you trust.
- The Stop button can unblock the MCP caller immediately, but long synchronous Figma scripts need to cooperate with `mcp.shouldStop()` or `mcp.throwIfStopped()`.

See [docs/OFFICIAL_COMPATIBILITY.md](docs/OFFICIAL_COMPATIBILITY.md) for compatibility details.

## Recording A Demo

For a short video walkthrough, see [docs/DEMO_RECORDING.md](docs/DEMO_RECORDING.md). It includes a preflight checklist, copy-paste MCP config commands, and a simple demo script.

## Security

This project intentionally gives an MCP client the ability to inspect and mutate your active Figma document through local plugin code. Treat it like a local developer tool with powerful access. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
