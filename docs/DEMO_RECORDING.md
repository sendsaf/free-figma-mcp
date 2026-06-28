# Recording a demo

A short checklist for capturing a clean walkthrough of Free Figma MCP.

## Before recording

1. Close other MCP clients so only one owns the bridge on port `3055`.
2. Start your IDE/CLI MCP client and confirm `free-figma-mcp` is connected.
3. In Figma Desktop, run `Plugins -> Development -> Free Figma MCP Bridge` and
   press **Start**.
4. Open a blank Figma draft so writes are easy to see.

## Suggested script

1. **Smoke test** — ask the agent to call `whoami`, then `get_metadata` for the
   current selection. Show the response.
2. **Write** — paste the dashboard prompt from the README and let the agent
   build a frame end to end via `use_figma`.
3. **Verify** — have the agent call `get_screenshot` and `get_metadata` to
   confirm what it created.
4. **Iterate** — one follow-up prompt (tighten spacing, add a selected state) to
   show the inspect → edit loop.

## Tips

- Keep the Figma plugin panel visible — the log and command count make the
  bridge activity legible on camera.
- If a call hangs, a stale owner may hold port `3055`; restart the MCP server
  and re-run the plugin bridge (see [CLIENT_SETUP.md](CLIENT_SETUP.md#multiple-ides)).
- For audio, Figma Motion exports (MP4/WEBM) can be recorded separately and
  layered in during editing.
