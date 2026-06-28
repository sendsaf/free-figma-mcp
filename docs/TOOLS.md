# Tools

Free Figma MCP exposes official-style Figma MCP tool names, but every call is
routed through your **active local Figma Desktop document** via the plugin
bridge. `fileKey` arguments are accepted for compatibility but ignored — local
mode never fetches arbitrary cloud files.

## Inspection

| Tool | Local behavior |
| ---- | -------------- |
| `whoami` | Reports local mode and the connected user; no Figma account/seat data. |
| `get_metadata` | Sparse XML of the current selection, page, or a given `nodeId`. |
| `get_design_context` | Metadata + variables + styles + optional screenshot for a layer. |
| `get_screenshot` | PNG export of the selection or a node. |
| `get_variable_defs` | Variables, styles, and bound-variable references in scope. |
| `get_figjam` | FigJam board metadata as XML. |
| `search_design_system` | Search components, variables, and styles in the active file. |

## Writing

| Tool | Local behavior |
| ---- | -------------- |
| `use_figma` | Executes JavaScript in the Figma plugin sandbox (the primary write tool). |
| `create_new_file` | Creates a new page in the active document. |
| `generate_diagram` | Renders Mermaid syntax into editable Figma/FigJam nodes. |
| `generate_figma_design` | Builds simple layers from HTML or a URL snapshot. |

## Code Connect (local)

`get_code_connect_map`, `add_code_connect_map`, `get_code_connect_suggestions`,
and `send_code_connect_mappings` persist mappings locally as JSON in
`.figma-mcp/` — no cloud round trip.

## Config 2026 surfaces

Discovery and the newer Figma surfaces are exposed as dedicated tools:

- **Capabilities / discovery:** `get_capabilities`, `introspect_api`,
  `probe_schema`, `build_api_catalog`.
- **Motion:** `get_motion_context`, `export_motion_code` (CSS/JSON/React),
  `bake_preset`, `list_motion_presets`, `apply_motion`, `replicate_scene`,
  `text_typewriter`.
- **Slots:** `get_slot_context`, `set_slot_content`.
- **Shaders:** `get_shader_context`.

## `use_figma` rules

- Colors are 0-1 range (`{ r: 1, g: 0, b: 0 }`).
- Load fonts before text ops: `await figma.loadFontAsync({ family, style })`.
- Switch pages with `await figma.setCurrentPageAsync(page)`.
- Return data via `return` (not `figma.notify`) and return created node IDs.
- For long scripts, cooperate with `mcp.shouldStop()` / `mcp.throwIfStopped()`
  so the plugin Stop button works.

The server also serves each skill as an MCP **prompt** and each steering doc as
an MCP **resource**, so capable clients get workflow guidance automatically.
