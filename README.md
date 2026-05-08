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

| Capability                                   | Figma Local MCP                                                  |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Works with any MCP client                    | Yes. IDEs, CLIs, and agents that support MCP can use it.         |
| Requires Claude Code                         | No. Claude Code can use it, but it is not required.              |
| Uses Figma Desktop directly                  | Yes. The active desktop file is the runtime target.              |
| Avoids remote MCP quotas for local workflows | Yes. Local tool calls route through your own bridge.             |
| Multi-IDE friendly                           | Yes. First process owns the bridge; later IDEs relay through it. |
| Official-style tool names                    | Yes. Agents see familiar Figma MCP-style tools.                  |
| Local Code Connect-style mappings            | Yes. Mappings are stored locally as JSON.                        |
| Agent skills and Kiro power                  | Included.                                                        |
| Open and hackable                            | Yes. Plain Node server plus Figma plugin files.                  |

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

## Installation

Use this setup for any MCP-capable IDE, CLI, or agent that accepts a standard `mcpServers` config.

**1. Install from the repository root**

```bash
npm install
npm run validate
npm run mcp:config
```

The `npm run mcp:config` command prints a ready-to-copy config using the real path to your clone.

**2. Add the MCP server to your IDE**

Paste the generated JSON into your IDE's MCP config:

```json
{
  "mcpServers": {
    "figma-local-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/figma-local-mcp/mcp-server/server.js"],
      "env": {}
    }
  }
}
```

You can also start from these files:

- [examples/mcp-config.windows.json](examples/mcp-config.windows.json)
- [examples/mcp-config.macos-linux.json](examples/mcp-config.macos-linux.json)
- [examples/antigravity-mcp-config.json](examples/antigravity-mcp-config.json)

**3. Import the Figma plugin**

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `figma-plugin/manifest.json`.

**4. Start a Figma session**

1. Start your IDE or CLI MCP client.
2. In Figma Desktop, run `Plugins -> Development -> Figma Local MCP Bridge`.
3. Press `Start` in the plugin window.
4. Open or create a Figma draft.
5. Ask your agent to call `get_metadata`, `get_design_context`, or `use_figma`.

## Try A Demo Prompt

Use this from a blank Figma draft to verify the full local write flow:

```text
Use Figma Local MCP to build a polished SaaS analytics dashboard in my currently open blank Figma draft.

Requirements:
- Use the active Figma file and create everything locally through the Figma Local MCP tools.
- Create one desktop frame named "Local MCP Analytics Dashboard" at 1440 x 1024.
- Design a realistic product dashboard for a fictional usage analytics tool called "SignalBoard".
- Include a left navigation rail, top command bar, KPI cards, a line chart area, a usage breakdown section, recent activity, and a compact settings panel.
- Use a restrained professional visual style with neutral surfaces, blue and green accents, clear hierarchy, and production-quality spacing.
- Use auto layout where practical.
- Create readable text layers, realistic numbers, and grouped sections with meaningful layer names.
- After creating the frame, use get_metadata to summarize what was created and get_screenshot to verify the result.
```

Good follow-up prompts:

```text
Use Figma Local MCP to tighten spacing, align the dashboard sections, and improve visual hierarchy.
```

```text
Use Figma Local MCP to add a small onboarding callout and a selected state in the left navigation.
```

## Antigravity Setup

Antigravity uses the same standard `mcpServers` shape.

Print config for the current clone:

```bash
npm run mcp:config:antigravity
```

1. Open Antigravity.
2. Open the Agent panel.
3. Use the menu in the Agent panel to open `Manage MCP Servers`.
4. Open the raw MCP config.
5. Paste the generated JSON into the `mcpServers` config.
6. Save and restart Antigravity so it reloads the MCP server.

If you prefer editing a file directly, Antigravity commonly stores the raw MCP config at:

```text
~/.gemini/antigravity/mcp_config.json
```

You can also start from [examples/antigravity-mcp-config.json](examples/antigravity-mcp-config.json), but the `npm run mcp:config:antigravity` command is better for demos because it prints the real path for your clone.

## Kiro Power Setup

Kiro users can use the standard MCP config above, or install the included power package for extra steering files.

1. Open Kiro.
2. Open the Powers panel from the Command Palette.
3. Click **Add Custom Power**.
4. Select **Local Directory**.
5. Enter the full path to `<repo>/powers/local-figma`.
6. Edit `~/.kiro/powers/local-figma/mcp.json` and replace `PLACEHOLDER_SERVER_PATH` with your local `mcp-server/server.js` path.

For Kiro power-style config, you can print a ready-to-copy snippet:

```bash
npm run mcp:config:kiro
```

The power includes steering files for `use_figma`, design implementation, FigJam, Code Connect-style mappings, setup, and troubleshooting.

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

| Remote Figma MCP                     | Figma Local MCP                                    |
| ------------------------------------ | -------------------------------------------------- |
| Hosted by Figma                      | Runs on your machine                               |
| Works from Figma cloud context       | Works from active Figma Desktop file               |
| Can hit hosted MCP limits            | Local bridge calls do not consume hosted MCP quota |
| Requires remote service availability | Requires Figma Desktop and the local plugin        |
| Great for official cloud workflows   | Great for local IDE and desktop automation         |

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

For a short video walkthrough, the Antigravity setup above is enough to record without opening another document. A longer checklist is available in [docs/DEMO_RECORDING.md](docs/DEMO_RECORDING.md).

## Security

This project intentionally gives an MCP client the ability to inspect and mutate your active Figma document through local plugin code. Treat it like a local developer tool with powerful access. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
