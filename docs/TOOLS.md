# Local Tool Behavior

This MCP server exposes official-style Figma MCP tool names, but the implementation is local. Tools operate on the active Figma Desktop file connected through the plugin bridge.

The local bridge is multi-client aware. The first MCP process owns `ws://localhost:3055`; additional IDE-launched MCP processes relay their tool calls through that owner.

## Inspection Tools

| Tool | Local behavior |
|---|---|
| `get_metadata` | Returns sparse XML for `nodeId`, current selection, or current page. |
| `get_design_context` | Returns metadata XML, node JSON, extracted design-system summary, variables/styles, and an optional screenshot. |
| `get_screenshot` | Exports a PNG for `nodeId`, the first selected node, or another exportable target. |
| `get_variable_defs` | Returns local variable collections, local variables, styles, and bound variable references. |
| `get_figjam` | Returns XML for the active FigJam selection/page, with optional screenshots. |

## Write Tools

| Tool | Local behavior |
|---|---|
| `use_figma` | Executes JavaScript in the Figma plugin sandbox with access to `figma`. |
| `generate_diagram` | Creates simple editable local diagram/source layers from Mermaid syntax. |
| `generate_figma_design` | Fetches URL/HTML text and creates simple editable text layers. |
| `create_new_file` | Creates a new page in the active local Figma document. |

## Design System and Code Connect Tools

| Tool | Local behavior |
|---|---|
| `search_design_system` | Searches components, component sets, variables, and styles in the active file. |
| `create_design_system_rules` | Returns local Figma-to-code workflow rules. |
| `get_code_connect_map` | Reads local mappings from `.figma-mcp/code-connect-mappings.json`. |
| `add_code_connect_map` | Writes a local mapping to `.figma-mcp/code-connect-mappings.json`. |
| `get_code_connect_suggestions` | Finds local component instances and combines them with saved local mappings. |
| `send_code_connect_mappings` | Saves accepted local mappings. |

## Identity

| Tool | Local behavior |
|---|---|
| `whoami` | Returns local MCP identity info, not Figma account/team/seat data. |

## `use_figma` Rules

- Use `return` for output.
- Do not call `figma.notify()` or `figma.closePlugin()`.
- Use top-level `await`; code is wrapped in an async function by the plugin.
- Load fonts before changing text.
- Use 0-1 color channels, not 0-255.
- Use `await figma.setCurrentPageAsync(page)` to switch pages.
- Return created or mutated node IDs.
- Keep writes incremental and verify with `get_metadata` or `get_screenshot`.

## Local `mcp` Helpers Inside `use_figma`

The plugin does not mutate `figma` or node prototypes because Figma objects may be non-extensible. Instead, `use_figma` code receives a local `mcp` helper object:

```js
const frame = mcp.createAutoLayout("VERTICAL", { name: "Card" })
const titles = mcp.query(figma.currentPage, "TEXT[name=Title]")
mcp.set(frame, { opacity: 0.8, width: 320 })
const screenshot = await mcp.screenshot(frame, { scale: 1 })
mcp.throwIfStopped()
```

Do not use `figma.createAutoLayout`, `node.query`, `node.set`, or `node.screenshot`.

For long-running `use_figma` scripts, check `mcp.shouldStop()` or call `mcp.throwIfStopped()` inside loops. The plugin UI Stop button immediately returns a stopped result to the MCP caller, while these helpers let script code stop cooperatively before doing more writes.

## Recommended Agent Workflows

### Implement Code From Figma

1. User selects a node in Figma Desktop or provides a URL with `node-id`.
2. Agent calls `get_metadata`.
3. Agent calls `get_design_context`.
4. Agent calls `get_screenshot`.
5. Agent calls `get_variable_defs`.
6. Agent inspects the codebase and implements using project conventions.
7. Agent validates the result against the screenshot.

### Generate a Design System From a Reference

1. Select the source frame/component in Figma Desktop.
2. Call `get_design_context` on that exact selection.
3. Use `context.designSystem.colors`, `typography`, `spacing`, `radii`, `components`, and `instances` as the source of truth.
4. Use `get_screenshot` to keep the generated system visually aligned with the reference.
5. Do not invent unrelated colors, typography, radii, or component names when the extracted context has enough information.

### Write to Figma

1. Agent calls `get_metadata` or `search_design_system`.
2. Agent calls `use_figma` with a small incremental script.
3. Script returns created/mutated IDs.
4. Agent calls `get_screenshot` or `get_metadata` to validate.
5. Agent fixes only the broken part if needed.

### Work With Components

1. Call `search_design_system` for an existing local component.
2. If creating a new component, use `use_figma`.
3. Add local Code Connect-style mappings with `add_code_connect_map` when the user wants code mapping.
4. Verify with `get_code_connect_map`.

### Work With FigJam

1. Call `get_figjam`.
2. Use `generate_diagram` for simple Mermaid diagrams.
3. Use `use_figma` for targeted board edits.
4. Validate with `get_figjam` and optional `get_screenshot`.
