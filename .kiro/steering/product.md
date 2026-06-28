# Product

Free Figma MCP is a local bridge that lets any MCP-capable IDE, CLI, or agent (Kiro, Cursor, Claude Code, Codex, VS Code, Antigravity, etc.) drive **Figma Desktop** directly.

It exposes official-style Figma MCP tool names but routes all work through the user's *active local Figma file* via a local plugin, instead of depending on a hosted remote MCP session.

## Why it exists

- Work with any MCP client, not just Claude Code.
- Keep Figma Desktop as the source of truth.
- Faster local round trips for inspect/write workflows that don't need cloud fetches.
- Avoid hosted MCP rate limits for local plugin-backed work.
- A bridge users can inspect, extend, fork, and test.

> Not affiliated with Figma. It is a local compatibility bridge inspired by the official Figma MCP workflow.

## How it works

```
MCP client -> local MCP stdio server -> owner/relay bridge
  -> ws://localhost:3055 -> Figma plugin UI -> plugin sandbox
  -> Figma Plugin API -> active Figma Desktop document
```

The bridge is multi-client aware: the first process to start owns the WebSocket on port `3055`; later clients relay through it instead of failing on a port conflict.

## Key behaviors and limits

- Operates on the **active** Figma Desktop document. `fileKey` args are accepted for compatibility but local mode does not fetch arbitrary remote files.
- `use_figma` executes arbitrary JavaScript in the Figma plugin sandbox — treat it as a powerful local dev tool and only connect trusted agents.
- Long synchronous Figma scripts must cooperate with `mcp.shouldStop()` / `mcp.throwIfStopped()` for the Stop button to work.
- Ships with agent skills (`skills/`) and a Kiro power (`powers/local-figma/`) so agents generate valid Figma scripts.
