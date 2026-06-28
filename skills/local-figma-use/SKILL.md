---
name: local-figma-use
description: Use before calling `use_figma` on this local Figma MCP server. Applies to creating, editing, deleting, or programmatically inspecting nodes in the active Figma Desktop file.
disable-model-invocation: false
---

# Local Figma use_figma Skill

This local MCP server executes `use_figma` code in the active Figma Desktop document through the Free Figma MCP Bridge.

## Required Rules

1. Use `return` for all output. The agent only sees returned values.
2. Do not use `figma.notify()`, `figma.closePlugin()`, or `console.log()` for agent-visible output.
3. Write plain JavaScript with top-level `await`; do not wrap code in an async IIFE.
4. Load fonts with `await figma.loadFontAsync(...)` before text mutations.
5. Use color channels in the 0-1 range.
6. Use `await figma.setCurrentPageAsync(page)` to switch pages.
7. Set `layoutSizingHorizontal` or `layoutSizingVertical` after appending to an auto-layout parent.
8. Return all created or mutated node IDs.
9. Work incrementally and validate with `get_metadata` or `get_screenshot`.

## Local Helper Object

Do not patch `figma` or node prototypes. Figma objects are not extensible in some runtimes.

Inside `use_figma`, a local `mcp` helper object is available:

- `mcp.createAutoLayout(direction, props)`
- `mcp.query(node, selector)`
- `mcp.set(node, props)`
- `await mcp.screenshot(node, opts)`

Use these forms instead of `figma.createAutoLayout`, `node.query`, `node.set`, or `node.screenshot`.

## Local Behavior

- `fileKey` is not used to fetch remote files.
- The active Figma Desktop document is the source of truth.
- Use selection-based workflows whenever possible.

## Typical Flow

1. Inspect with `get_metadata`.
2. Search existing local components/styles with `search_design_system`.
3. Write with `use_figma`.
4. Return node IDs.
5. Verify with `get_screenshot`.

## Design-System Generation From Existing Frames

When the user asks to create a design system from a selected frame or existing component:

1. Call `get_design_context` for the exact selected reference.
2. Use `context.designSystem` as the primary source:
   - `colors`
   - `typography`
   - `spacing`
   - `radii`
   - `components`
   - `instances`
3. Preserve the reference screenshot's visual language.
4. Do not generate a generic design system if the extracted context contains concrete tokens/components.
5. If the reference is unclear or too small, ask for a better selected frame/component.

## Reference Docs

Load only the references needed for the task:

| Reference | Use When |
|---|---|
| [gotchas.md](references/gotchas.md) | Before any non-trivial `use_figma` write. |
| [common-patterns.md](references/common-patterns.md) | Creating frames, text, auto-layout, screenshots, or incremental writes. |
| [variable-patterns.md](references/variable-patterns.md) | Creating, reading, or binding variables/tokens. |
| [component-patterns.md](references/component-patterns.md) | Creating components, variants, instances, or component properties. |
| [validation-and-recovery.md](references/validation-and-recovery.md) | Debugging failed scripts or checking visual fidelity. |
