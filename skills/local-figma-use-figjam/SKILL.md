---
name: local-figma-use-figjam
description: Use for FigJam operations through this local Figma MCP bridge.
disable-model-invocation: false
---

# Local FigJam Skill

Use this skill when the active editor is FigJam or the user asks to create/update FigJam diagrams or boards.

## Workflow

1. Inspect with `get_figjam` before writing.
2. Use `generate_diagram` for simple Mermaid-to-board creation.
3. Use `use_figma` for targeted FigJam edits.
4. Return created or mutated node IDs.
5. Use `get_screenshot` when a specific node ID is available.

## Notes

- FigJam supports a different Plugin API surface than Figma Design.
- The local `generate_diagram` tool creates simple editable board content, not Figma's full remote diagram generator.
- Keep board edits incremental and verify structure after each major change.

## Reference Docs

| Reference | Use When |
|---|---|
| [figjam-patterns.md](references/figjam-patterns.md) | Creating sections, stickies, text, and simple board layouts. |
| [diagram-patterns.md](references/diagram-patterns.md) | Creating diagrams with `generate_diagram` or `use_figma`. |
| [validation.md](references/validation.md) | Inspecting and fixing FigJam board output. |
