# Demo Recording Guide

Use this when recording a short walkthrough of Figma Local MCP.

## Recorder

Recordly is a good fit for a product demo because it is open source and includes polished demo features such as auto-zoom, cursor animation, microphone/system audio, timeline editing, and MP4/GIF export.

- Website: <https://recordly.dev/>
- Source: <https://github.com/webadderallorg/Recordly>

## Preflight

Run these from the repository root:

```bash
npm install
npm run validate
npm run mcp:config:antigravity
```

Copy the output of `npm run mcp:config:antigravity` into Antigravity's raw MCP config.

For Kiro, use:

```bash
npm run mcp:config:kiro
```

## Figma Setup

1. Open Figma Desktop.
2. Import `figma-plugin/manifest.json` from `Plugins -> Development -> Import plugin from manifest`.
3. Create a new blank Figma draft.
4. Run `Plugins -> Development -> Figma Local MCP Bridge`.
5. Press `Start` in the plugin window.

## Demo Flow

1. Show the README and the one-command Antigravity config output.
2. Paste the generated MCP config into Antigravity.
3. Restart Antigravity so it loads the MCP server.
4. Open a blank Figma draft and start the plugin bridge.
5. Ask Antigravity:

```text
Use Figma Local MCP to get metadata for my current Figma file or selection.
```

6. Then ask Antigravity:

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

7. Then ask:

```text
Use Figma Local MCP to tighten spacing, align the dashboard sections, and improve visual hierarchy.
```

8. Optional second improvement:

```text
Use Figma Local MCP to add a small onboarding callout and a selected state in the left navigation.
```

## What To Say

- "This runs locally through Figma Desktop."
- "The MCP client talks to a local Node server."
- "The Figma plugin connects over localhost."
- "The active Figma file is the source of truth."
- "The same setup works from MCP-capable IDEs, CLIs, and agents."

## Before Publishing The Video

- Do not show private Figma files, tokens, or proprietary client work.
- Keep the terminal path visible only if you are comfortable showing your local username.
- Mention that `fileKey` parameters are accepted for compatibility, but local mode works against the active Figma Desktop file.
