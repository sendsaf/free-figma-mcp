---
name: local-figma-implement-design
description: Use when implementing application code from the active Figma Desktop selection through this local MCP server.
disable-model-invocation: false
---

# Local Figma Implement Design Skill

Use this skill when the deliverable is code in the user's repository based on the active Figma Desktop file.

## Required Workflow

1. Identify the target node:
   - Prefer the current Figma selection.
   - If the user provides a Figma URL, extract `node-id` but remember that this local server still uses the active desktop file.
2. Call `get_metadata` to understand the structure.
3. Call `get_design_context` for the target node or selection.
4. Call `get_screenshot` for visual reference.
5. Call `get_variable_defs` before hardcoding colors, spacing, radius, or typography.
6. Inspect the codebase for existing components before writing new code.
7. Translate Figma context into the project's conventions.
8. Validate the implemented UI against the screenshot.

## Rules

- Reuse project components where possible.
- Prefer project tokens, but preserve Figma visual fidelity.
- Do not invent assets if Figma provides enough context.
- Document unavoidable deviations briefly in code comments.
- If context is too large, use `get_metadata` to target smaller child nodes.

## Tool Order

Use this order unless the user gives a narrower instruction:

```text
get_metadata
get_design_context
get_screenshot
get_variable_defs
```

Then inspect the local codebase and implement.

## Local MCP Caveats

- The local `get_design_context` returns metadata and node JSON, not official remote React/Tailwind generation.
- `fileKey` is compatibility-only. Ensure the matching file is open in Figma Desktop.
- If a URL node ID is present, pass `nodeId`; otherwise rely on selection.
- For missing assets, inspect the screenshot and metadata before creating placeholders.

## Codebase Integration Checklist

- Identify framework and styling system from package/config files.
- Search for existing components before adding new ones.
- Map Figma variables to project tokens where possible.
- Keep layout primitives consistent with the app.
- Verify with a browser/app screenshot when the project supports it.

## Related References

For Figma write or inspection snippets, use:

- [../local-figma-use/references/common-patterns.md](../local-figma-use/references/common-patterns.md)
- [../local-figma-use/references/validation-and-recovery.md](../local-figma-use/references/validation-and-recovery.md)
- [../local-figma-use/references/variable-patterns.md](../local-figma-use/references/variable-patterns.md)
