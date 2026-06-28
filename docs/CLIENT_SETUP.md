# Client Setup

Setting up Free Figma MCP in any client is **two separate steps**, and clients
differ on both:

1. **MCP server config** — tells the client how to launch the server.
2. **Agent guidance** — teaches the agent how to drive Figma correctly (the
   skills and steering this repo ships).

The interactive CLI handles both:

```bash
npm run setup
# or, per client, headless:
node mcp-server/cli.js --client <key> --guidance
```

## 1. MCP server configMost clients use a JSON `mcpServers` map. Two are different: **VS Code** uses a
`servers` map, and **Codex** uses TOML.

| Client         | Key            | Config file                                   | Format          | Scope     |
| -------------- | -------------- | --------------------------------------------- | --------------- | --------- |
| Claude Desktop | `claude-desktop` | OS app config (`claude_desktop_config.json`)  | `mcpServers`    | user      |
| Claude Code    | `claude-code`  | `.mcp.json`                                   | `mcpServers`    | project   |
| Cursor         | `cursor`       | `~/.cursor/mcp.json`                          | `mcpServers`    | user      |
| VS Code        | `vscode`       | `.vscode/mcp.json`                            | `servers`       | project   |
| Windsurf       | `windsurf`     | `~/.codeium/windsurf/mcp_config.json`         | `mcpServers`    | user      |
| Codex CLI      | `codex`        | `~/.codex/config.toml` (`CODEX_HOME` aware)   | `toml`          | user      |
| Kiro           | `kiro`         | `.kiro/settings/mcp.json`                     | `mcpServers`    | project   |

JSON clients get an entry like:

```json
{
  "mcpServers": {
    "free-figma-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/free-figma-mcp/mcp-server/server.js"],
      "env": {}
    }
  }
}
```

VS Code uses the same entry under a `servers` key (with `"type": "stdio"`).

Codex gets a TOML block appended to `config.toml`, leaving your other sections
untouched:

```toml
[mcp_servers.free-figma-mcp]
command = "node"
args = ["/absolute/path/to/free-figma-mcp/mcp-server/server.js"]
```

To run the published package instead of a clone, add `--npx`. That swaps the
entry to `npx -y free-figma-mcp` (a `cmd /c npx ...` wrapper on Windows, bare
`npx` on macOS/Linux).

### Per-OS config locations

Project-scoped files (`.mcp.json`, `.vscode/mcp.json`, `.kiro/settings/mcp.json`)
sit in your workspace and are identical on every OS. Home-relative ones
(`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`,
`~/.codex/config.toml`) only swap the home prefix per OS. The two Electron apps
resolve their user-data directory per platform:

| Client         | Windows                                              | macOS                                                             | Linux                                          |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`        | `~/Library/Application Support/Claude/claude_desktop_config.json` | `$XDG_CONFIG_HOME` or `~/.config/Claude/...`   |
| Qoder          | `%APPDATA%\Qoder\SharedClientCache\mcp.json`         | `~/Library/Application Support/Qoder/SharedClientCache/mcp.json`  | `$XDG_CONFIG_HOME` or `~/.config/Qoder/...`    |

The CLI detects the OS automatically via `process.platform` and respects
`APPDATA`, `XDG_CONFIG_HOME`, and `CODEX_HOME` overrides. Windows paths are
written with escaped backslashes in both JSON and TOML. The Windows Qoder path
is verified; the macOS/Linux Electron paths follow each app's standard
user-data location.

## 2. Agent guidance: skills vs rules

These are **two different things**, and the CLI installs them separately:

- **Skills** = Agent Skills: model-invoked `SKILL.md` folders (plus
  `references/` and `scripts/`). A Claude-ecosystem concept. The model decides
  when to load one. `--skills` copies the folders verbatim.
- **Rules** = a client's own always-on / triggered instruction system
  (Cursor rules, Kiro steering, Codex/Claude `AGENTS.md`/`CLAUDE.md`,
  VS Code copilot-instructions, Windsurf rules). `--rules` writes these.

Independent of both, the server registers every skill as an MCP **prompt** and
every steering doc as an MCP **resource**, so any client that surfaces those
gets the guidance with no files at all.

### Scope: project vs global

Each install is scoped. `--scope project` (default) writes into the current
workspace; `--scope global` (or `--global`) writes to the user-level location —
**only offered where the client actually has one.**

| Client         | Skills (`--skills`)                    | Rules (`--rules`)                                   |
| -------------- | -------------------------------------- | --------------------------------------------------- |
| Claude Code    | `.claude/skills/` · global `~/.claude/skills/` | `CLAUDE.md` · global `~/.claude/CLAUDE.md`   |
| Claude Desktop | global `~/.claude/skills/` only        | — (skills/MCP only)                                 |
| Cursor         | — (no skills store)                    | `.cursor/rules/<id>.md` (project)                   |
| Windsurf       | —                                      | `.windsurf/rules/<id>.md` · global `~/.codeium/windsurf/memories/global_rules.md` |
| Codex CLI      | —                                      | `AGENTS.md` · global `~/.codex/AGENTS.md`           |
| Kiro           | —                                      | `.kiro/steering/<id>.md` (project)                  |
| Qoder          | —                                      | `.qoder/rules/<id>.md` (project)                    |
| VS Code        | —                                      | `.github/copilot-instructions.md` (project)         |

For **dir-style** rule clients (Cursor, Windsurf, Kiro, Qoder) each skill becomes
one rule doc. For **file-style** rule clients (Codex, VS Code, Claude Code) a
single marked guidance section is written and updated in place (wrapped in
`<!-- free-figma-mcp:guidance -->` markers, so re-running never duplicates it).

```bash
node mcp-server/cli.js --client claude-code --skills --scope global  # Agent Skills, user-global
node mcp-server/cli.js --client qoder --rules                        # one rule doc per skill in .qoder/rules
node mcp-server/cli.js --client codex --rules --scope global         # guidance into ~/.codex/AGENTS.md
```

The interactive flow asks about skills and rules separately after you configure
a client, and asks for the scope when the client supports more than one.

## Installing the Figma plugin

The plugin (`manifest.json`, `code.js`, `ui.html`) must be imported into Figma
Desktop once. The CLI copies the three files for you and defaults to your OS
Downloads folder in a named subfolder:

- Windows / macOS: `~/Downloads/free-figma-mcp-plugin`
- Linux: `$XDG_DOWNLOAD_DIR/free-figma-mcp-plugin` (else `~/Downloads/...`)

At the prompt, press Enter to accept that, type any folder path, or type `.` for
the current directory. If the chosen folder can't be written, it asks again and
Enter falls back to the current directory. Then import the copied
`manifest.json` via `Plugins -> Development -> Import plugin from manifest`.

This matters most for `npx`: the package runs from a transient cache, so copying
the plugin to a stable folder (Downloads) is what makes it importable.

## Kiro vs the rest

Kiro has the richest path: install the bundled **power** so you get the MCP
server config *and* the steering files together.

1. Powers panel → **Add Custom Power** → **Local Directory** → `<repo>/powers/local-figma`.
2. Edit `~/.kiro/powers/local-figma/mcp.json` and set the real `server.js` path
   (or run `npm run mcp:config:kiro` to print a ready snippet).

If you would rather not use the power, `--client kiro` writes
`.kiro/settings/mcp.json` and `--rules` drops one steering doc per skill into
`.kiro/steering/` — Kiro auto-includes both.

## Multiple IDEs

The bridge is multi-client aware: the first process to start owns the WebSocket
on port `3055`; later clients relay through it. If a first command logs activity
but later calls hang, a stale owner may be holding the port — restart the IDE's
MCP server and re-run the Figma plugin bridge.
